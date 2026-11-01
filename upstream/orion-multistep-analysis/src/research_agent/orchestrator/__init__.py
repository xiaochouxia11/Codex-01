"""Package-level orchestrator shim for backend.executor import.

This module delegates to supervisor.orchestrator while exposing the expected
symbols: configure_session, tmp_dir, main.
"""

from research_agent.supervisor.orchestrator import configure_session, tmp_dir, main  # noqa: F401
