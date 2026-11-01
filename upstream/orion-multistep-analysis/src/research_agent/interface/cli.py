from __future__ import annotations

import argparse
import threading
from typing import Optional

from research_agent import orchestrator as orch


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Run the research orchestrator on a .db with an optional goal")
    parser.add_argument("--database", required=True, help="Path to the SQLite .db file")
    parser.add_argument("--goal", required=False, help="Free-text research goal", default=None)
    args = parser.parse_args(argv)

    cancel = threading.Event()
    orch.configure_session("cli-session")
    orch.main(
        port=0,
        database_path=args.database,
        extra_reporters=None,
        cancel_event=cancel,
        session_id_override="cli-session",
        prompt_overrides=None,
        goal=args.goal,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
