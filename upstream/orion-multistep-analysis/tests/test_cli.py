from __future__ import annotations

import threading
from unittest.mock import ANY, Mock

import research_agent.interface.cli as cli
import research_agent.orchestrator as orchestrator


def test_cli_invokes_orchestrator_with_expected_arguments(monkeypatch):
    main_mock = Mock()
    configure_mock = Mock()
    monkeypatch.setattr(orchestrator, "main", main_mock)
    monkeypatch.setattr(orchestrator, "configure_session", configure_mock)

    result = cli.main(["--database", "example.db", "--goal", "Research goal"])

    assert result == 0
    configure_mock.assert_called_once_with("cli-session")
    main_mock.assert_called_once_with(
        port=0,
        database_path="example.db",
        extra_reporters=None,
        cancel_event=ANY,
        session_id_override="cli-session",
        prompt_overrides=None,
        goal="Research goal",
    )
    assert isinstance(main_mock.call_args.kwargs["cancel_event"], threading.Event)
