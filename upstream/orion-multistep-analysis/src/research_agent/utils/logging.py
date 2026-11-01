from __future__ import annotations

from datetime import datetime, timezone


def ts() -> str:
    return datetime.now(timezone.utc).isoformat()

