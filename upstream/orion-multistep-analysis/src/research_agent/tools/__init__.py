import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from typing import Any, Mapping, Sequence

from research_agent.agents.literature import plan_queries

tools = [
    {
        "type": "function",
        "name": "run_python_code",
        "description": (
            "Execute Python code in a sandboxed subprocess and return stdout+stderr. "
            "Always import pandas/numpy as needed. Keep outputs tabular and concise."
        ),
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "Python code to run."},
            },
            "required": ["code"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "plan_literature_queries",
        "description": (
            "Generate a structured literature search plan (providers, keywords, filters). "
            "Use this before requesting the user to run searches or when refining evidence needs. "
            "Supply the goal plus any extra guidance (e.g., focus, keywords) as a single string."
        ),
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "goal": {
                    "type": "string",
                    "description": (
                        "Primary research question with optional extra cues. "
                        "For example: 'Customer churn prediction\\nFocus: subscription cohorts\\nKeywords: churn, retention, baseline'"
                    ),
                },
            },
            "required": ["goal"],
            "additionalProperties": False,
        },
    },
]

terminate_function = {
    "type": "function",
    "name": "terminate",
    "description": "Call this function to immediately and completely terminate the agent.",
    "strict": False,
    "parameters": {
        "type": "object",
        "properties": {
            "reason": {
                "type": "string",
                "description": "reason for termination",
            }
        },
        "required": ["reason"],
        "additionalProperties": False,
    },
}


def process_tool_calls(*, msg, messages, reporter, tool_handlers):
    tool_calls = getattr(msg, "tool_calls", []) or []
    if not tool_calls:
        return False
    messages.append(msg)
    reporter.tool_calls(step=0, calls=tool_calls)
    for call in tool_calls:
        fn = call.function.name
        args = json.loads(call.function.arguments or "{}")
        handler = tool_handlers.get(fn)
        if handler is None:
            result = f"Error: unknown function {fn}"
        else:
            try:
                result = handler(args)
            except Exception as e:
                result = f"Error running {fn}: {type(e).__name__}: {e}"
        messages.append({"role": "tool", "tool_call_id": call.id, "content": result})
        reporter.tool_result(call.id, result)
    return True


# Defensive preamble injected ahead of every sandboxed Python snippet. It keeps
# pandas column lookups tolerant to suffixes, coerces float(None) -> NaN, and
# resolves shorthand SQLite filenames to the repo-local databases.

_PY_SANITY_PATCH = """
import builtins as __sbx_builtins
import numpy as __sbx_np
import pandas as __sbx_pd
import sqlite3 as __sbx_sqlite3
import pathlib as __sbx_pathlib
import os as __sbx_os

if not hasattr(__sbx_pd.DataFrame, "__sbx_original_getitem__"):
    __sbx_pd.DataFrame.__sbx_original_getitem__ = __sbx_pd.DataFrame.__getitem__

    def __sbx_safe_getitem(self, key):
        try:
            return __sbx_pd.DataFrame.__sbx_original_getitem__(self, key)
        except KeyError:
            if isinstance(key, str):
                fallback = []
                for suffix in ("_x", "_y"):
                    alt = f"{key}{suffix}"
                    if alt in self.columns:
                        fallback.append(__sbx_pd.DataFrame.__sbx_original_getitem__(self, alt))
                if fallback:
                    combined = fallback[0].copy()
                    for series in fallback[1:]:
                        combined = combined.combine_first(series)
                    combined.name = key
                    return combined
                return __sbx_pd.Series(__sbx_np.nan, index=self.index, name=key)
            raise

    __sbx_pd.DataFrame.__getitem__ = __sbx_safe_getitem

if not hasattr(__sbx_builtins, "__sbx_original_float"):
    __sbx_builtins.__sbx_original_float = __sbx_builtins.float

    def __sbx_safe_float(value):
        if value is None:
            return __sbx_np.nan
        return __sbx_builtins.__sbx_original_float(value)

    __sbx_builtins.float = __sbx_safe_float

if not hasattr(__sbx_sqlite3, "__sbx_original_connect"):
    __sbx_sqlite3.__sbx_original_connect = __sbx_sqlite3.connect
    __sbx_repo_root = __sbx_pathlib.Path(
        __sbx_os.getenv("RESEARCH_AGENT_ROOT", __sbx_pathlib.Path.cwd())
    )

    def __sbx_normalize_sqlite_path(path):
        if isinstance(path, str):
            normalized = path.strip()
            # If a bare filename is provided, prefer runtime/data/<filename> when present.
            if normalized and ("/" not in normalized and "\\\\" not in normalized):
                candidate = __sbx_repo_root / "runtime" / "data" / normalized
                if candidate.exists():
                    return str(candidate)
        return path

    def __sbx_safe_sqlite_connect(database, *args, **kwargs):
        return __sbx_sqlite3.__sbx_original_connect(
            __sbx_normalize_sqlite_path(database), *args, **kwargs
        )

    __sbx_sqlite3.connect = __sbx_safe_sqlite_connect
"""


def run_python_code_handler(args: dict[str, Any]) -> str:
    """
    Fire-and-forget Python execution inside sandbox-exec (analogous to run_r_once_sandbox + run_r_code).
    Writes the code to a temp file and executes it. Returns a single string of stdout + stderr.
    """

    def run_python_once(code: str, timeout: int = 540):
        """
        Returns (stdout, stderr, returncode, duration_secs).
        """
        import sys

        base_dir = os.path.dirname(os.path.abspath(__file__))

        # Write the user code to a temp runner file
        tmp_dir = tempfile.mkdtemp(prefix="py_sbx_", dir="/tmp")
        runner_path = os.path.join(tmp_dir, "_runner.py")
        with open(runner_path, "w") as f:
            f.write(code)

        print("TOOL INPUT:")
        print(code)

        # Choose the Python executable
        py_exec = sys.executable or "python3"

        args_list = [
            py_exec,
            "-u",  # unbuffered stdout/stderr for timely logs
            runner_path,
        ]

        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        env.setdefault("RESEARCH_AGENT_ROOT", base_dir)

        t0 = time.time()
        try:
            cp = subprocess.run(
                args_list,
                capture_output=True,
                text=True,
                timeout=timeout,
                env=env,
            )
            duration = time.time() - t0
            return cp.stdout, cp.stderr, cp.returncode, duration
        except subprocess.TimeoutExpired:
            return "", "Timeout error.", -1, time.time() - t0
        except Exception as e:
            return "", f"Python session error: {e}", 1, time.time() - t0
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    # ---- wrapper (mirrors run_r_code) ----
    code = args.get("code", "")
    if _PY_SANITY_PATCH not in code:
        code = _PY_SANITY_PATCH + "\n" + code
    timeout = int(args.get("timeout", 540))
    stdout, stderr, rc, duration = run_python_once(code, timeout=timeout)

    # limit stdout to be less than 20,000 chars
    if len(stdout) > 20000:
        stdout = f"{stdout[:20000]}...TRUNCATED_FOR_LENGTH"

    combined = "\n".join(part for part in (stdout, stderr) if part).strip()

    if rc == -1:  # timeout sentinel
        return "Timeout error."
    if rc != 0 and not combined:
        return f"Python exited with code {rc} but produced no output."

    print("TOOL OUTPUT:")
    print(combined)

    return combined or ""  # always a string


def plan_literature_queries_handler(args: dict[str, Any]) -> str:
    """Return a structured offline literature-search plan tailored to the request."""

    raw_goal = args.get("goal")
    goal_text = raw_goal.strip() if isinstance(raw_goal, str) else ""

    primary_goal = ""
    focus = ""
    keywords: list[str] = []

    if goal_text:
        for line in goal_text.splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            lower = stripped.lower()
            if lower.startswith("focus:"):
                focus = stripped.split(":", 1)[1].strip()
            elif lower.startswith("keywords:"):
                keyword_blob = stripped.split(":", 1)[1]
                keywords = [entry.strip() for entry in keyword_blob.split(",") if entry.strip()]
            elif not primary_goal:
                primary_goal = stripped

    if not primary_goal:
        primary_goal = goal_text

    context_parts: list[str] = []
    if primary_goal:
        context_parts.append(primary_goal)
    if focus:
        context_parts.append(f"Focus: {focus}")
    if keywords:
        context_parts.append("Keywords: " + ", ".join(keywords))

    combined_goal = " | ".join(context_parts)
    summary = plan_queries(goal=combined_goal or None)
    payload = {
        "input": {"goal": primary_goal, "focus": focus, "keywords": keywords},
        "plan": summary.plan or summary.sources,
        "sources": summary.sources,
        "insights": summary.insights,
        "notes": summary.notes,
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)




# ----------------------------- LLM helpers ----------------------------- #

_CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)
_JSON_SNIPPET_RE = re.compile(r"({[\s\S]*})|([\[][\s\S]*[\]])")


def extract_json_from_text(text: str | None) -> Any | None:
    """Extract the first valid JSON object or array embedded in text.

    Tries raw parse, then strips Markdown fences, then searches for a JSON-looking
    substring. Returns None if nothing parses.
    """

    if not text:
        return None
    candidates: list[str] = []
    stripped = text.strip()
    if stripped:
        candidates.append(stripped)

    def _strip_fences(value: str) -> str:
        if value.startswith("```") and value.endswith("```"):
            inner = _CODE_FENCE_RE.sub("", value)
            return inner.strip()
        return value

    fenced = _strip_fences(stripped)
    if fenced and fenced not in candidates:
        candidates.append(fenced)

    for match in _JSON_SNIPPET_RE.finditer(stripped):
        snippet = match.group(0)
        if snippet and snippet not in candidates:
            candidates.append(snippet)

    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    return None


def _flatten_response_content(obj: Any) -> str:
    if obj is None:
        return ""
    if isinstance(obj, str):
        return obj
    if isinstance(obj, Mapping):
        if "text" in obj and isinstance(obj["text"], str):
            return obj["text"]
        if "value" in obj and isinstance(obj["value"], str):
            return obj["value"]
        if "content" in obj:
            return _flatten_response_content(obj["content"])
        if "output_text" in obj:
            return _flatten_response_content(obj["output_text"])
    if isinstance(obj, Sequence) and not isinstance(obj, (bytes, bytearray)):
        return "".join(_flatten_response_content(item) for item in obj)
    for attr in ("text", "value", "content"):
        if hasattr(obj, attr):
            return _flatten_response_content(getattr(obj, attr))
    return ""


def responses_output_text(response: Any) -> str:
    """Return the textual content from an OpenAI Responses API result."""

    if response is None:
        return ""
    if isinstance(response, str):
        return response

    text_attr = getattr(response, "output_text", None)
    if isinstance(text_attr, str):
        return text_attr
    if isinstance(text_attr, Sequence) and not isinstance(text_attr, (bytes, bytearray)):
        flattened = _flatten_response_content(text_attr)
        if flattened:
            return flattened

    output = getattr(response, "output", None)
    flattened = _flatten_response_content(output)
    if flattened:
        return flattened

    data = getattr(response, "data", None)
    flattened = _flatten_response_content(data)
    if flattened:
        return flattened

    if isinstance(response, Mapping):
        flattened = _flatten_response_content(response.get("output_text"))
        if flattened:
            return flattened
        flattened = _flatten_response_content(response.get("output"))
        if flattened:
            return flattened
        flattened = _flatten_response_content(response.get("data"))
        if flattened:
            return flattened

    return str(response)
