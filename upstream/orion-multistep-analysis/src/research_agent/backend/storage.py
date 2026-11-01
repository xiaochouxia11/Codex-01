"""Persistence helpers for backend run records."""

from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import Dict, Iterable


class RunStore:
    """Lightweight SQLite-backed storage for run metadata."""

    _TABLE = "backend_runs"

    def __init__(self, db_path: Path) -> None:
        self._db_path = Path(db_path)
        self._conn = sqlite3.connect(self._db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        self._init_db()

    def _init_db(self) -> None:
        ddl = f"""
        CREATE TABLE IF NOT EXISTS {self._TABLE} (
            run_id TEXT PRIMARY KEY,
            database TEXT NOT NULL,
            status TEXT NOT NULL,
            name TEXT,
            notes TEXT,
            error TEXT,
            session_id TEXT,
            artifacts TEXT,
            prompt_agent TEXT,
            prompt_literature TEXT,
            prompt_supervisor TEXT,
            goal TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            archived INTEGER NOT NULL DEFAULT 0
        )
        """
        with self._conn:
            self._conn.execute(ddl)
            self._ensure_column("archived", "INTEGER NOT NULL DEFAULT 0")
            self._ensure_column("name", "TEXT")
            self._ensure_column("prompt_agent", "TEXT")
            self._ensure_column("prompt_literature", "TEXT")
            self._ensure_column("prompt_supervisor", "TEXT")
            self._ensure_column("goal", "TEXT")

    def _ensure_column(self, column: str, definition: str) -> None:
        info = self._conn.execute(f"PRAGMA table_info({self._TABLE})").fetchall()
        if not any(row["name"] == column for row in info):
            self._conn.execute(f"ALTER TABLE {self._TABLE} ADD COLUMN {column} {definition}")

    def load_all(self) -> Iterable[Dict[str, str]]:
        query = f"SELECT * FROM {self._TABLE} ORDER BY created_at DESC"
        with self._lock:
            rows = self._conn.execute(query).fetchall()
        for row in rows:
            payload = dict(row)
            artifacts_raw = payload.get("artifacts")
            if artifacts_raw:
                try:
                    payload["artifacts"] = json.loads(artifacts_raw)
                except json.JSONDecodeError:
                    payload["artifacts"] = {}
            else:
                payload["artifacts"] = {}
            payload["archived"] = bool(payload.get("archived", 0))
            payload["name"] = payload.get("name")
            yield payload

    def upsert(self, payload: Dict[str, object]) -> None:
        record = dict(payload)
        artifacts = record.get("artifacts")
        if artifacts is None:
            record["artifacts"] = None
        else:
            record["artifacts"] = json.dumps(artifacts)

        columns = [
            "run_id",
            "database",
            "status",
            "name",
            "notes",
            "error",
            "session_id",
            "artifacts",
            "prompt_agent",
            "prompt_literature",
            "prompt_supervisor",
            "goal",
            "created_at",
            "updated_at",
            "archived",
        ]
        placeholders = ", ".join([":" + col for col in columns])
        assignments = ", ".join([f"{col}=excluded.{col}" for col in columns if col != "run_id"])
        query = f"""
            INSERT INTO {self._TABLE} ({', '.join(columns)})
            VALUES ({placeholders})
            ON CONFLICT(run_id) DO UPDATE SET {assignments}
        """
        record["archived"] = int(bool(record.get("archived", 0)))
        with self._lock:
            with self._conn:
                self._conn.execute(query, record)
