from __future__ import annotations

import json
import threading
import textwrap
from datetime import datetime, timezone
from pathlib import Path
from dataclasses import asdict
from typing import Any, Dict, Iterable, List, Optional

from openai import OpenAI

from research_agent.agents import agent_inner_loop, build_supervisor_context
from research_agent.agents.contracts import AnalysisResult, LiteratureSummary
from research_agent.agents.data_analysis import run_basic_analysis
from research_agent.agents.literature import plan_queries
from research_agent.analysis.ingestion import list_tables
from research_agent.analysis.stats import safe_auc_placeholder
from research_agent.config import settings as core_settings
from research_agent.supervisor.checks import basic_alignment_check
from research_agent.tools import (
    plan_literature_queries_handler,
    run_python_code_handler,
    terminate_function,
    tools as BASE_TOOL_SPEC,
    extract_json_from_text,
)

# Public values imported by top-level orchestrator shim
tmp_dir: str = str(core_settings.runs_root / "session")

MAX_SUPERVISOR_REVIEW_LOOPS = 3

_DEFAULT_AGENT_PROMPT = textwrap.dedent(
    """
    You are a Data Analysis Agent operating in a domain-agnostic research workflow.
    Goals:
    1) Inspect and summarize the selected SQLite .db (tables, row counts, schemas, missingness).
    2) Perform appropriate generic analyses aligned to the user-provided research goal (e.g., EDA, correlations, simple statistical tests, baselines).
    3) Persist results as CSV/SQLite tables and produce transparent, reproducible logs.

    Constraints:
    - Use only Python scientific libraries (pandas, numpy, scipy, sklearn, statsmodels).
    - No domain-specific heuristics; explain assumptions and steps.
    - Prefer text/tabular outputs over plots.
    - Never fabricate numbers; compute from the loaded data.
    """
).strip()

_DEFAULT_SUPERVISOR_PROMPT = textwrap.dedent(
    """
    You are the Supervisor. Ensure all agent outputs align with the user-defined research goal, are reproducible, and meet quality checks (data coverage, validity of methods, consistency of conclusions).
    Direct corrective actions when gaps are found and produce a concise final verdict with next steps.
    Incorporate the literature agent's most recent plan and evidence when crafting feedback, and translate those insights into actionable guidance for the analysis agent. When evidence gaps remain, call the available tools (e.g., plan_literature_queries) to scope further work before requesting escalations.
    """
).strip()

_DEFAULT_LITERATURE_PROMPT = textwrap.dedent(
    """
    You are a Literature Review Agent. Given a research goal, propose search queries, inclusion/exclusion criteria, and an evidence plan using sources such as arXiv, Semantic Scholar, Google Scholar, SSRN, documentation/blogs, and patents.
    """
).strip()

MAIN_AGENT_TOOL_SPEC = BASE_TOOL_SPEC + [terminate_function]
SUPERVISOR_TOOL_SPEC = [
    tool for tool in BASE_TOOL_SPEC if tool.get("name") == "plan_literature_queries"
]
LITERATURE_AGENT_TOOL_SPEC = [
    {"type": "web_search"},
    terminate_function,
]


def configure_session(session_id: str) -> None:
    global tmp_dir
    tmp_dir = str(core_settings.runs_root / session_id)


def _ensure_dirs(root: Path) -> Dict[str, Path]:
    root.mkdir(parents=True, exist_ok=True)
    analysis = root / "analysis"
    analysis.mkdir(parents=True, exist_ok=True)
    return {"root": root, "analysis": analysis}


def _write_json(path: Path, obj: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2), encoding="utf-8")


def _write_jsonl(path: Path, records: Iterable[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False))
            handle.write("\n")


def _emit(reporter, kind: str, **data: Any) -> None:
    if reporter is None:
        return
    try:
        reporter.log(kind, **data)
    except Exception:
        pass


def _get_prompt(prompt_overrides: Optional[Dict[str, str]], role: str, fallback: str) -> str:
    if not prompt_overrides:
        return fallback
    value = prompt_overrides.get(role)
    return value.strip() if value else fallback


def _format_tables(summary: AnalysisResult) -> str:
    tables = summary.summary.get("tables", [])
    if not tables:
        return "No tables discovered in the SQLite database."
    lines = []
    for entry in tables:
        name = entry.get("name", "<unknown>")
        row_count = entry.get("row_count")
        row_text = "?" if row_count is None else f"{int(row_count)}"
        lines.append(f"- {name}: {row_text} rows")
    return "\n".join(lines)


def _format_small_table(summary: AnalysisResult) -> str:
    info = summary.summary.get("small_table_summary")
    if not info:
        return "No small table profile generated."
    payload = {
        "table": info.get("table"),
        "row_count": info.get("row_count"),
        "columns": list((info.get("summary") or {}).get("dtypes", {}).keys())[:10],
    }
    return json.dumps(payload, ensure_ascii=False)


def _snapshot_message(message: Any) -> Dict[str, Any]:
    if message is None:
        return {}
    if isinstance(message, dict):
        data = {
            "role": message.get("role"),
            "content": message.get("content"),
        }
        if "tool_call_id" in message:
            data["tool_call_id"] = message["tool_call_id"]
        return {k: v for k, v in data.items() if v is not None}
    role = getattr(message, "role", None)
    content = getattr(message, "content", None)
    tool_calls = getattr(message, "tool_calls", None)
    snapshot: Dict[str, Any] = {"role": role, "content": content}
    if tool_calls:
        snapshot["tool_calls"] = [
            {
                "id": getattr(call, "id", None),
                "name": getattr(getattr(call, "function", None), "name", None),
                "arguments": getattr(getattr(call, "function", None), "arguments", None),
            }
            for call in tool_calls
        ]
    return {k: v for k, v in snapshot.items() if v is not None}


def _format_feedback_history(feedback_notes: List[str]) -> Optional[str]:
    cleaned: List[str] = []
    for idx, note in enumerate(feedback_notes, 1):
        payload = (note or "").strip()
        if not payload:
            continue
        cleaned.append(f"Iteration {idx} feedback:\n{payload}")
    if not cleaned:
        return None
    return "\n\n".join(cleaned)


def _supervisor_satisfied(content: Optional[str]) -> bool:
    if not content:
        return False
    text = content.lower()
    if "partially met" in text or "not met" in text or "needs work" in text:
        return False
    if "fully met" in text or "fully satisfied" in text or "fully aligned" in text:
        return True
    return False


def _build_initial_instruction(
    *,
    database_path: str,
    analysis_dir: Path,
    goal: Optional[str],
    analysis_result: AnalysisResult,
    feedback: Optional[str] = None,
) -> str:
    tables_text = _format_tables(analysis_result)
    small_table = _format_small_table(analysis_result)
    goal_text = goal.strip() if isinstance(goal, str) else ""
    instruction = textwrap.dedent(
        f"""
        User goal: {goal_text or 'No explicit goal supplied; focus on transparent dataset profiling and insightful analyses.'}
        SQLite database: {database_path}
        Working directory for artifacts: {analysis_dir}

        Quick dataset audit:
        {tables_text}

        Small-table preview (if any):
        {small_table}

        Guidelines:
        - Think step-by-step and outline a plan before running code.
        - Use the `run_python_code` tool for any computation and persist results under the working directory.
        - Prefer tabular/text artifacts (CSV, JSON) over plots, unless essential.
        - Call the `terminate` function when you have produced a final report and saved key artifacts.
        """
    ).strip()
    if feedback:
        feedback_block = textwrap.indent(feedback.strip(), "  ")
        instruction = (
            f"{instruction}\n\nSupervisor feedback to address:\n{feedback_block}\n\n"
            "Address each item above, updating or regenerating artifacts as needed, and explicitly confirm how the feedback was resolved before calling `terminate`."
        )
    return instruction


def _entry_field(entry: Any, key: str, default: Any = None) -> Any:
    if isinstance(entry, dict):
        return entry.get(key, default)
    return getattr(entry, key, default)


def _summarize_transcript(transcript: List[Any], max_sections: int = 3, max_chars: int = 3000) -> str:
    """Return the most recent assistant messages collapsed into a brief text block."""
    if not transcript:
        return ""
    assistant_chunks = [
        (str(_entry_field(entry, "content", "")).strip())
        for entry in transcript
        if (_entry_field(entry, "role") == "assistant") and str(_entry_field(entry, "content", "")).strip()
    ]
    if not assistant_chunks:
        return ""
    tail = assistant_chunks[-max_sections:]
    summary = "\n\n".join(tail)
    if len(summary) > max_chars:
        summary = summary[-max_chars:]
    return summary.strip()


def _build_literature_instruction(
    *,
    goal: Optional[str],
    analysis_result: AnalysisResult,
    main_transcript: List[Dict[str, Any]],
    previous_summary: Optional[LiteratureSummary],
    iteration: int,
) -> str:
    goal_text = goal.strip() if isinstance(goal, str) else ""
    analysis_snapshot = json.dumps(analysis_result.summary or {}, ensure_ascii=False, indent=2)
    if len(analysis_snapshot) > 2000:
        analysis_snapshot = analysis_snapshot[:2000] + "\n... (truncated)"

    main_highlights = _summarize_transcript(main_transcript, max_sections=3, max_chars=1800)
    previous_context_parts: list[str] = []
    if previous_summary:
        if previous_summary.plan:
            recent_plan = json.dumps(previous_summary.plan[-3:], ensure_ascii=False, indent=2)
            previous_context_parts.append(f"Recent literature plan steps:\n{recent_plan}")
        if previous_summary.insights:
            insights_text = "\n".join(f"- {item}" for item in previous_summary.insights)
            previous_context_parts.append(f"Prior insights:\n{insights_text}")
    previous_context = "\n\n".join(previous_context_parts) if previous_context_parts else "No prior literature synthesis captured."

    return textwrap.dedent(
        f"""
        You are the Literature Review Agent. This is iteration {iteration}.
        Primary research goal: {goal_text or 'General dataset understanding'}

        Latest analysis-agent highlights:
        {main_highlights or 'No analysis summary available yet.'}

        Dataset audit snapshot:
        {analysis_snapshot}

        {previous_context}

        Tasks:
        1. Propose a focused literature search plan (2-4 objectives) that complements the analysis agent's work.
        2. For each objective, invoke the `web_search` tool to retrieve recent, high-quality sources (papers, trials, datasets, patents).
        3. Summarize how the evidence informs or challenges the research goal and note remaining gaps.

        Output strictly as JSON (no Markdown fences) with this schema:
        {{
          "plan": [
            {{"objective": "...", "query": "...", "rationale": "...", "expected_insight": "..."}}
          ],
          "sources": [
            {{"title": "...", "summary": "...", "url": "...", "source": "...", "published": "...", "relevance": "..."}}
          ],
          "insights": ["key takeaway 1", "key takeaway 2"],
          "notes": "Optional commentary about limitations or next steps."
        }}
        Ensure every listed source corresponds to an actual web search result with an accessible URL.
        """
    ).strip()


def _coerce_literature_summary(payload: Dict[str, Any] | None, fallback: LiteratureSummary) -> LiteratureSummary:
    if not isinstance(payload, dict):
        return fallback

    def _ensure_dict_list(value: Any) -> List[Dict[str, Any]]:
        if isinstance(value, dict):
            return [dict(value)]
        if isinstance(value, list):
            results: List[Dict[str, Any]] = []
            for item in value:
                if isinstance(item, dict):
                    results.append(dict(item))
                elif isinstance(item, str):
                    results.append({"summary": item})
            return results
        return []

    def _ensure_str_list(value: Any) -> List[str]:
        if isinstance(value, list):
            strings = []
            for entry in value:
                if isinstance(entry, str):
                    stripped = entry.strip()
                    if stripped:
                        strings.append(stripped)
                elif entry is not None:
                    strings.append(str(entry))
            return strings
        if isinstance(value, str):
            stripped = value.strip()
            return [stripped] if stripped else []
        return []

    plan = _ensure_dict_list(payload.get("plan") or payload.get("search_plan"))
    sources = _ensure_dict_list(
        payload.get("sources") or payload.get("findings") or payload.get("evidence")
    )
    insights = _ensure_str_list(payload.get("insights") or payload.get("takeaways") or payload.get("summary_points"))
    notes_value = payload.get("notes") or payload.get("summary") or payload.get("commentary") or ""

    if not plan:
        plan = fallback.plan
    if not sources and fallback.sources:
        sources = fallback.sources
    if not insights and fallback.insights:
        insights = fallback.insights

    return LiteratureSummary(plan=plan, sources=sources, insights=insights, notes=str(notes_value).strip())


def _run_main_agent(
    *,
    client: OpenAI,
    reporter,
    database_path: str,
    analysis_dir: Path,
    goal: Optional[str],
    analysis_result: AnalysisResult,
    prompt_text: str,
    cancel_event: Optional[threading.Event],
    feedback: Optional[str] = None,
) -> Dict[str, Any]:
    messages: List[Any] = [
        {"role": "system", "content": prompt_text},
        {
            "role": "user",
            "content": _build_initial_instruction(
                database_path=database_path,
                analysis_dir=analysis_dir,
                goal=goal,
                analysis_result=analysis_result,
                feedback=feedback,
            ),
        },
    ]
    transcript: List[Dict[str, Any]] = [_snapshot_message(entry) for entry in messages]

    state = {"terminated": False}

    def _terminate_handler(args: Dict[str, Any]) -> str:
        reason = (args or {}).get("reason")
        state["terminated"] = True
        return f"Termination acknowledged. {'Reason: ' + reason if reason else ''}".strip()

    tool_handlers = {
        "run_python_code": run_python_code_handler,
        "plan_literature_queries": plan_literature_queries_handler,
        "terminate": _terminate_handler,
    }

    max_turns = 12
    for _ in range(max_turns):
        if cancel_event and cancel_event.is_set():
            state["terminated"] = True
            break

        response = agent_inner_loop(
            agent_name="main",
            client=client,
            messages=messages,
            toolspec=MAIN_AGENT_TOOL_SPEC,
            tool_handlers=tool_handlers,
            reporter=reporter,
        )
        transcript.append(_snapshot_message(response))

        if state["terminated"]:
            break

    return {"messages": messages, "transcript": transcript, "terminated": state["terminated"]}


def _run_literature_agent(
    *,
    client: OpenAI,
    reporter,
    literature_prompt: str,
    goal: Optional[str],
    analysis_result: AnalysisResult,
    main_transcript: List[Dict[str, Any]],
    previous_summary: LiteratureSummary,
    iteration: int,
    cancel_event: Optional[threading.Event],
) -> Dict[str, Any]:
    instruction = _build_literature_instruction(
        goal=goal,
        analysis_result=analysis_result,
        main_transcript=main_transcript,
        previous_summary=previous_summary,
        iteration=iteration,
    )

    messages: List[Any] = [
        {"role": "system", "content": literature_prompt},
        {"role": "user", "content": instruction},
    ]
    transcript: List[Dict[str, Any]] = [_snapshot_message(entry) for entry in messages]
    state = {"terminated": False}

    def _terminate_handler(args: Dict[str, Any]) -> str:
        reason = (args or {}).get("reason")
        state["terminated"] = True
        return f"Termination acknowledged. {'Reason: ' + reason if reason else ''}".strip()

    tool_handlers = {
        "terminate": _terminate_handler,
    }

    _emit(
        reporter,
        "literature_agent",
        stage="planning",
        iteration=iteration,
        message="Generating literature search plan and evidence.",
    )

    response = None
    max_turns = 6
    for _ in range(max_turns):
        if cancel_event and cancel_event.is_set():
            state["terminated"] = True
            break

        response = agent_inner_loop(
            agent_name="literature",
            client=client,
            messages=messages,
            toolspec=LITERATURE_AGENT_TOOL_SPEC,
            tool_handlers=tool_handlers,
            reporter=reporter,
        )
        transcript.append(_snapshot_message(response))

        if state["terminated"]:
            break

        # Literature agent typically produces a complete response in one turn.
        break

    raw_text = getattr(response, "content", "") if response is not None else ""
    parsed_payload = extract_json_from_text(raw_text) if raw_text else None
    has_prior = bool(previous_summary.plan or previous_summary.sources or previous_summary.insights or previous_summary.notes)
    fallback_summary = previous_summary if has_prior else plan_queries(goal=goal)
    summary = _coerce_literature_summary(
        parsed_payload if isinstance(parsed_payload, dict) else None,
        fallback_summary,
    )

    if parsed_payload is None:
        summary.notes = summary.notes or "Fallback plan generated because the literature agent response was not parseable JSON."

    _emit(
        reporter,
        "literature_agent",
        stage="completed",
        iteration=iteration,
        plan_count=len(summary.plan),
        source_count=len(summary.sources),
    )

    return {
        "messages": messages,
        "transcript": transcript,
        "raw_text": raw_text,
        "summary": summary,
    }


def _run_supervisor(
    *,
    client: OpenAI,
    reporter,
    supervisor_prompt: str,
    goal: Optional[str],
    main_messages: List[Any],
    analysis_result: AnalysisResult,
    literature_summary: LiteratureSummary,
    verdict,
) -> Dict[str, Any]:
    supervisor_messages: List[Any] = [
        {"role": "system", "content": supervisor_prompt},
    ]
    supervisor_messages.extend(
        build_supervisor_context(
            main_messages,
            literature_records=(literature_summary.sources or literature_summary.plan),
            analysis_records=[analysis_result.summary],
        )
    )

    issues_text = "\n".join(f"- {issue}" for issue in (verdict.issues or [])) or "- None"
    next_steps_text = "\n".join(f"- {step}" for step in (verdict.next_steps or [])) or "- None"

    supervisor_messages.append(
        {
            "role": "user",
            "content": textwrap.dedent(
                f"""
                Review the main agent's work.
                User goal: {goal or 'N/A'}
                Deterministic alignment check: aligned={verdict.aligned}
                Issues noted: {issues_text}
                Suggested next steps: {next_steps_text}

                Provide a concise verdict covering:
                - Goal alignment
                - Data quality or coverage concerns
                - Key findings from the analysis
                - How literature findings should influence the analysis agent's next steps
                - Recommended follow-up actions
                - Optional: trigger `plan_literature_queries` when additional evidence is needed
                """
            ).strip(),
        }
    )

    transcript: List[Dict[str, Any]] = [_snapshot_message(entry) for entry in supervisor_messages]

    response = agent_inner_loop(
        agent_name="supervisor",
        client=client,
        messages=supervisor_messages,
        toolspec=SUPERVISOR_TOOL_SPEC,
        tool_handlers={"plan_literature_queries": plan_literature_queries_handler},
        reporter=reporter,
    )
    transcript.append(_snapshot_message(response))

    return {"messages": supervisor_messages, "transcript": transcript, "final": getattr(response, "content", "")}


def main(
    *,
    port: int = 0,
    database_path: str,
    extra_reporters: Optional[List[Any]] = None,
    cancel_event: Optional[threading.Event] = None,
    session_id_override: Optional[str] = None,
    prompt_overrides: Optional[Dict[str, str]] = None,
    goal: Optional[str] = None,
) -> None:
    del port  # Placeholder for CLI compatibility.

    session_id = session_id_override or "session"
    run_root = Path(tmp_dir)
    paths = _ensure_dirs(run_root)
    analysis_dir = paths["analysis"]

    reporters = list(extra_reporters or [])
    reporter = reporters[0] if reporters else None

    if reporter is not None:
        reporter.main_agent(1, f"Starting domain-agnostic analysis for {Path(database_path).name}")
    _emit(reporter, "workflow_progress", stage="staging", message="Preparing inputs")

    analysis_result: AnalysisResult = run_basic_analysis(database_path, goal=goal)
    _write_json(analysis_dir / "analysis_summary.json", analysis_result.summary)

    agent_prompt = _get_prompt(prompt_overrides, "agent", _DEFAULT_AGENT_PROMPT)
    supervisor_prompt = _get_prompt(prompt_overrides, "supervisor", _DEFAULT_SUPERVISOR_PROMPT)
    literature_prompt = _get_prompt(prompt_overrides, "literature", _DEFAULT_LITERATURE_PROMPT)

    client = OpenAI()

    literature_summary = LiteratureSummary()

    verdict = basic_alignment_check(goal=goal, analysis=analysis_result, literature=literature_summary)

    feedback_notes: List[str] = []
    final_main_session: Optional[Dict[str, Any]] = None
    final_supervisor_session: Optional[Dict[str, Any]] = None
    final_literature_session: Optional[Dict[str, Any]] = None
    iterations_run = 0

    for iteration in range(1, MAX_SUPERVISOR_REVIEW_LOOPS + 1):
        iterations_run = iteration
        feedback_text = _format_feedback_history(feedback_notes)
        progress_msg = "Engaging main agent" if iteration == 1 else f"Re-engaging main agent (revision {iteration})"
        _emit(reporter, "workflow_progress", stage="analysis", message=progress_msg)

        main_session = _run_main_agent(
            client=client,
            reporter=reporter,
            database_path=database_path,
            analysis_dir=analysis_dir,
            goal=goal,
            analysis_result=analysis_result,
            prompt_text=agent_prompt,
            cancel_event=cancel_event,
            feedback=feedback_text,
        )
        final_main_session = main_session
        _write_jsonl(
            analysis_dir / f"main_agent_conversation_iter{iteration}.jsonl",
            main_session["transcript"],
        )

        literature_session = _run_literature_agent(
            client=client,
            reporter=reporter,
            literature_prompt=literature_prompt,
            goal=goal,
            analysis_result=analysis_result,
            main_transcript=main_session["transcript"],
            previous_summary=literature_summary,
            iteration=iteration,
            cancel_event=cancel_event,
        )
        literature_summary = literature_session["summary"]
        _write_jsonl(
            analysis_dir / f"literature_agent_conversation_iter{iteration}.jsonl",
            literature_session["transcript"],
        )
        _write_json(analysis_dir / "literature_plan.json", asdict(literature_summary))

        final_literature_session = literature_session

        supervisor_session = _run_supervisor(
            client=client,
            reporter=reporter,
            supervisor_prompt=supervisor_prompt,
            goal=goal,
            main_messages=main_session["messages"],
            analysis_result=analysis_result,
            literature_summary=literature_summary,
            verdict=verdict,
        )
        final_supervisor_session = supervisor_session
        _write_jsonl(
            analysis_dir / f"supervisor_conversation_iter{iteration}.jsonl",
            supervisor_session["transcript"],
        )

        final_text = supervisor_session.get("final", "")
        if _supervisor_satisfied(final_text):
            break
        feedback_notes.append(final_text or "")

    if final_main_session:
        _write_jsonl(analysis_dir / "main_agent_conversation.jsonl", final_main_session["transcript"])
    if final_supervisor_session:
        _write_jsonl(analysis_dir / "supervisor_conversation.jsonl", final_supervisor_session["transcript"])
    if final_literature_session:
        _write_jsonl(analysis_dir / "literature_agent_conversation.jsonl", final_literature_session["transcript"])
    _write_json(analysis_dir / "literature_plan.json", asdict(literature_summary))
    _write_json(
        analysis_dir / "supervisor_verdict.json",
        {
            "aligned": verdict.aligned,
            "issues": verdict.issues,
            "next_steps": verdict.next_steps,
            "notes": verdict.notes,
            "llm_summary": (final_supervisor_session or {}).get("final", ""),
            "review_iterations": iterations_run,
            "feedback_history": feedback_notes,
        },
    )

    _emit(reporter, "workflow_progress", stage="analyzing", message="Preparing UI summary")

    discovered = list_tables(database_path)
    num_samples = sum(t.row_count or 0 for t in discovered)
    num_features = len(analysis_result.summary.get("schema", {}))
    auc = safe_auc_placeholder(num_samples, num_features)

    logistic_summary = {
        "status": "ok",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "class_balance": {},
        "num_samples": int(num_samples),
        "num_features": int(num_features),
        "raw_feature_count": int(num_features),
        "auc": float(auc),
        "fold_aucs": [],
        "top_peptides": [],
        "top_proteins": [],
        "top_features": [],
        "top_features_positive": [],
        "top_features_negative": [],
    }

    _emit(reporter, "workflow_progress", stage="writing_summary", message="Saving artifacts")
    _write_json(analysis_dir / "logistic_regression_summary.json", logistic_summary)

    if reporter is not None:
        supervisor_text = (final_supervisor_session or {}).get("final", "Supervisor summary unavailable.")
        reporter.supervisor(1, supervisor_text)

    _emit(reporter, "workflow_complete", status="ok", mean_auc=auc)
    if reporter is not None:
        reporter.terminated()
