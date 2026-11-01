"""Utilities that execute the research agent workflow (generic)."""

from __future__ import annotations

import importlib
import shutil
from pathlib import Path

from .prompts import DEFAULT_PROMPT_IDS, get_prompt_content


def _import_orchestrator():
    """Import or reload the generic orchestrator module.

    The orchestrator is expected to expose ``configure_session`` and ``main``.
    This function avoids retaining global state across runs in the API process.
    """
    module = importlib.import_module("research_agent.orchestrator")
    return importlib.reload(module)


def run_agent(record, database: Path, cancel_event, reporter) -> None:
    """Execute the analysis workflow for a single run.

    Parameters mirror :class:`backend.jobs.JobManager` expectations.
    ``database`` is the resolved filesystem path to the dataset selected for the
    run. ``cancel_event`` is a threading.Event used for cooperative shutdowns.
    ``reporter`` is an optional extra reporter supplied by the job manager (for
    example, a streaming bridge).
    """

    orchestrator = _import_orchestrator()

    session = record.run_id
    record.session_id = session
    orchestrator.configure_session(session)

    tmp_dir = Path(orchestrator.tmp_dir)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    database = Path(database)
    tmp_db_path = tmp_dir / database.name
    shutil.copy2(database, tmp_db_path)

    extra_reporters = []
    if reporter is not None:
        extra_reporters.append(reporter)

    prompt_overrides = {
        "agent": get_prompt_content(getattr(record, "prompt_agent", None) or DEFAULT_PROMPT_IDS["agent"]),
        "literature": get_prompt_content(getattr(record, "prompt_literature", None) or DEFAULT_PROMPT_IDS["literature"]),
        "supervisor": get_prompt_content(getattr(record, "prompt_supervisor", None) or DEFAULT_PROMPT_IDS["supervisor"]),
    }

    orchestrator.main(
        port=0,
        database_path=str(tmp_db_path),
        extra_reporters=extra_reporters or None,
        cancel_event=cancel_event,
        session_id_override=session,
        prompt_overrides=prompt_overrides,
        goal=getattr(record, "goal", None),
    )
