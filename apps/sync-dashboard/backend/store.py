"""Store independent demo and live snapshots in SQLite."""
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3

DEMO_RUNS = [
    {"id": 1, "name": "Pylint", "status": "completed", "conclusion": "success",
     "branch": "main", "updated_at": "2026-11-03T09:24:31Z", "url": None},
    {"id": 2, "name": "Sync Apple Design Skill", "status": "completed",
     "conclusion": "success", "branch": "main", "updated_at": "2026-11-03T09:17:08Z",
     "url": None},
    {"id": 3, "name": "Sync OpenAI repositories", "status": "completed",
     "conclusion": "failure", "branch": "main", "updated_at": "2026-11-03T09:05:22Z",
     "url": None},
]


def initialize(path):
    """Create the database and seed demo data without overwriting live data."""
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as connection:
        connection.execute(
            "CREATE TABLE IF NOT EXISTS snapshots "
            "(mode TEXT PRIMARY KEY, runs TEXT NOT NULL, cached_at TEXT NOT NULL)")
        connection.execute(
            "INSERT OR IGNORE INTO snapshots VALUES (?, ?, ?)",
            ("demo", json.dumps(DEMO_RUNS), "2026-11-03T09:30:00Z"))


def save_snapshot(path, runs):
    """Atomically replace the live snapshot after a successful GitHub request."""
    cached_at = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(path) as connection:
        connection.execute(
            "INSERT OR REPLACE INTO snapshots VALUES (?, ?, ?)",
            ("live", json.dumps(runs), cached_at))


def snapshot(path, mode):
    """Read a snapshot without implicitly making a network request."""
    with sqlite3.connect(path) as connection:
        row = connection.execute(
            "SELECT runs, cached_at FROM snapshots WHERE mode = ?", (mode,)).fetchone()
    return {"mode": mode, "repository": "xiaochouxia11/Codex-01",
            "runs": json.loads(row[0]) if row else [],
            "cached_at": row[1] if row else None}
