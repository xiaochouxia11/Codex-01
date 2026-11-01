from __future__ import annotations

import sqlite3
import threading
from types import SimpleNamespace

import openai

from research_agent import config as core_config
from research_agent.agents import runtime as runtime_module
from research_agent.backend.executor import run_agent
from research_agent.supervisor import orchestrator as supervisor_orchestrator


class _FakeResponse:
    def __init__(self, text: str):
        self.output_text = text
        self.output = [SimpleNamespace(type="message", role="assistant")]


class _FakeResponses:
    def __init__(self, text: str):
        self._text = text

    def create(self, **_kwargs):
        return _FakeResponse(self._text)


class FakeOpenAI:
    def __init__(self, *args, **kwargs):
        del args, kwargs
        self.responses = _FakeResponses("Fully met.")


def _make_sqlite_fixture(path):
    conn = sqlite3.connect(path)
    try:
        conn.execute("CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT)")
        conn.executemany(
            "INSERT INTO sample (value) VALUES (?)",
            [("alpha",), ("beta",)],
        )
        conn.commit()
    finally:
        conn.close()


def test_run_agent_writes_artifacts_and_logs(tmp_path, monkeypatch):
    runs_root = tmp_path / "runs"
    monkeypatch.setattr(core_config.settings, "runs_root", runs_root)

    monkeypatch.setattr(openai, "OpenAI", FakeOpenAI)
    monkeypatch.setattr(runtime_module, "OpenAI", FakeOpenAI)
    monkeypatch.setattr(supervisor_orchestrator, "OpenAI", FakeOpenAI)

    db_path = tmp_path / "fixture.db"
    _make_sqlite_fixture(db_path)

    record = SimpleNamespace(
        run_id="test-run-123",
        prompt_agent=None,
        prompt_literature=None,
        prompt_supervisor=None,
        goal="Check deterministic orchestration.",
    )

    run_agent(record, db_path, threading.Event(), reporter=None)

    run_dir = runs_root / record.run_id
    analysis_dir = run_dir / "analysis"

    assert (analysis_dir / "analysis_summary.json").exists()
    assert (analysis_dir / "main_agent_conversation.jsonl").exists()
    assert (analysis_dir / "supervisor_conversation.jsonl").exists()
