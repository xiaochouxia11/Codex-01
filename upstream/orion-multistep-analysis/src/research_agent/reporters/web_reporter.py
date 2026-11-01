"""web_reporter.py
A drop-in WebReporter that mirrors the ConsoleReporter API and serves logs over HTTP.

Usage:
    from research_agent.reporters import WebReporter
    reporter = WebReporter(port=5000)
    # use reporter.* inside your loop exactly like ConsoleReporter

Open http://127.0.0.1:5000/ to watch logs live.
"""

from __future__ import annotations

import json
import sqlite3
import threading
import time
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Iterable
import os

from flask import Flask, Response, jsonify, request

# ----------------------------- Data Model ----------------------------- #


@dataclass
class Event:
    id: int
    session_id: str
    timestamp: str  # ISO8601 UTC
    type: str  # e.g. "main_agent", "supervisor", "tool_calls" ...
    data: dict[str, Any]


from typing import Callable


class MultiReporter:
    """
    A thread-safe reporter that *distributes* each report call to multiple
    underlying reporters (e.g., WebReporter + SQLiteReporter).

    Example
    -------
    web = WebReporter()
    sql = SQLiteReporter("runtime/events.db", session_id="run-123")
    reporter = MultiReporter(web, sql, fail_fast=False)

    reporter.main_agent(step=1, text="hello")
    reporter.terminated()
    reporter.close()  # calls close() on children that implement it
    """

    def __init__(
        self,
        *reporters: Any,
        fail_fast: bool = False,
        on_error: Callable[[Exception, str, tuple, dict], None] | None = None,
    ) -> None:
        """
        Parameters
        ----------
        reporters : Any
            Reporter instances that implement the same WebReporter API.
        fail_fast : bool
            If True, raise immediately on the first reporter error.
            If False, swallow and continue broadcasting to others.
        on_error : callable | None
            If provided, called as on_error(exc, method_name, args, kwargs) for each failure.
        """
        self._reporters = list(reporters)
        self._fail_fast = fail_fast
        self._on_error = on_error
        self._lock = threading.Lock()

    # ---------- Public API mirrored from WebReporter ---------- #

    def main_agent(self, step: int, text: str) -> None:
        self._broadcast("main_agent", step, text)

    def supervisor(self, step: int, text: str) -> None:
        self._broadcast("supervisor", step, text)

    def tool_calls(self, step: int, calls: Iterable[Any]) -> None:
        self._broadcast("tool_calls", step, calls)

    def tool_result(self, call_id: str, result: str) -> None:
        self._broadcast("tool_result", call_id, result)

    def reset_r(self) -> None:
        self._broadcast("reset_r")

    def terminated(self) -> None:
        self._broadcast("terminated")

    def log(self, kind: str, **data: Any) -> None:
        self._broadcast("log", kind, **data)

    # Optional helper—forward if a child implements it. You can add others similarly.
    def fetch_events(self, *args, **kwargs):
        """
        If you want a merged view, implement it here. For now we just
        call fetch_events on reporters that implement it and return a dict
        keyed by reporter object.
        """
        results = {}
        with self._lock:
            for r in self._reporters:
                fn = getattr(r, "fetch_events", None)
                if callable(fn):
                    try:
                        results[r] = fn(*args, **kwargs)
                    except Exception as e:
                        self._handle_error(e, "fetch_events", args, kwargs)
                        if self._fail_fast:
                            raise
        return results

    def close(self) -> None:
        """Close child reporters that implement close()."""
        with self._lock:
            for r in self._reporters:
                fn = getattr(r, "close", None)
                if callable(fn):
                    try:
                        fn()
                    except Exception as e:
                        self._handle_error(e, "close", tuple(), {})
                        if self._fail_fast:
                            raise

    # ---------- Management helpers ---------- #

    def add_reporter(self, reporter: Any) -> None:
        with self._lock:
            self._reporters.append(reporter)

    def remove_reporter(self, reporter: Any) -> None:
        with self._lock:
            self._reporters.remove(reporter)

    # ---------- Internal ---------- #

    def _broadcast(self, method: str, *args, **kwargs) -> None:
        with self._lock:
            for r in self._reporters:
                fn = getattr(r, method, None)
                if not callable(fn):
                    # Skip silently; you could also raise if you want strictness.
                    continue
                try:
                    fn(*args, **kwargs)
                except Exception as e:
                    self._handle_error(e, method, args, kwargs)
                    if self._fail_fast:
                        raise

    def _handle_error(self, exc: Exception, method: str, args: tuple, kwargs: dict) -> None:
        if self._on_error is not None:
            try:
                self._on_error(exc, method, args, kwargs)
            except Exception:
                # Avoid recursive explosions — swallow on_error failures.
                pass


# -------------------------- SQLiteReporter --------------------------- #


class SQLiteReporter:
    """
    A thread-safe reporter that logs events to a SQLite table, grouped by session_id.
    """

    def __init__(
        self,
        db_path: str = "runtime/events.db",
        session_id: str | None = None,
    ) -> None:
        self.db_path = db_path
        self.session_id = session_id or str(uuid.uuid4())

        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()

        self._init_db()
        self._next_id = self._get_next_id()

    # ---------------------- Public API ---------------------- #

    def main_agent(self, step: int, text: str) -> None:
        self._add_event("main_agent", {"step": step, "text": text})

    def supervisor(self, step: int, text: str) -> None:
        self._add_event("supervisor", {"step": step, "text": text})

    def tool_calls(self, step: int, calls: Iterable[Any]) -> None:
        simplified = []
        for c in calls:
            try:
                simplified.append(
                    {
                        "id": getattr(c, "id", None),
                        "function": getattr(getattr(c, "function", None), "name", None),
                        "arguments": getattr(getattr(c, "function", None), "arguments", None),
                    }
                )
            except Exception:
                simplified.append(str(c))
        self._add_event("tool_calls", {"step": step, "calls": simplified})

    def tool_result(self, call_id: str, result: str) -> None:
        self._add_event("tool_result", {"call_id": call_id, "result": result})

    def reset_r(self) -> None:
        self._add_event("reset_r", {})

    def terminated(self) -> None:
        self._add_event("terminated", {})

    def log(self, kind: str, **data: Any) -> None:
        self._add_event(kind, data)

    # ------------------- Helper Methods -------------------- #

    def fetch_events(
        self, since: int = 0, limit: int | None = None, session_id: str | None = None
    ) -> list[Event]:
        sid = session_id or self.session_id
        with self._lock:
            cur = self._conn.cursor()
            if limit is None:
                cur.execute(
                    "SELECT id, session_id, timestamp, type, data "
                    "FROM events WHERE session_id=? AND id > ? ORDER BY id ASC",
                    (sid, since),
                )
            else:
                cur.execute(
                    "SELECT id, session_id, timestamp, type, data "
                    "FROM events WHERE session_id=? AND id > ? ORDER BY id ASC LIMIT ?",
                    (sid, since, limit),
                )
            rows = cur.fetchall()

        return [
            Event(
                id=r["id"],
                session_id=r["session_id"],
                timestamp=r["timestamp"],
                type=r["type"],
                data=json.loads(r["data"]),
            )
            for r in rows
        ]

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    def save_session_info(
        self,
        agent_model: str,
        supervisor_model: str,
        agent_system_prompt: str,
        supervisor_system_prompt: str,
        agent_prompt: str,
        session_id: str | None = None,
    ) -> None:
        """
        Insert a new row into the sessions table for the given session_id.
        Assumes session_id is unique (UUID) and no conflicts will occur.
        """
        sid = session_id or self.session_id
        with self._lock, self._conn:
            self._conn.execute(
                """
                INSERT INTO sessions (
                    session_id,
                    agent_model,
                    supervisor_model,
                    agent_system_prompt,
                    supervisor_system_prompt,
                    agent_prompt
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    sid,
                    agent_model,
                    supervisor_model,
                    agent_system_prompt,
                    supervisor_system_prompt,
                    agent_prompt,
                ),
            )

    # ------------------- Internal Helpers ------------------- #

    def _init_db(self) -> None:
        with self._conn:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    agent_model TEXT,
                    supervisor_model TEXT,
                    agent_system_prompt TEXT,
                    supervisor_system_prompt TEXT,
                    agent_prompt TEXT
                )
                """
            )

            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    type TEXT NOT NULL,
                    data TEXT NOT NULL
                )
                """
            )
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id)"
            )

    def _get_next_id(self) -> int:
        cur = self._conn.cursor()
        cur.execute(
            "SELECT COALESCE(MAX(id), 0) FROM events WHERE session_id = ?",
            (self.session_id,),
        )
        return cur.fetchone()[0] + 1

    def _get_count(self) -> int:
        cur = self._conn.cursor()
        cur.execute(
            "SELECT COUNT(*) FROM events WHERE session_id = ?",
            (self.session_id,),
        )
        return int(cur.fetchone()[0])

    def _add_event(self, kind: str, data: dict[str, Any]) -> None:
        ts = datetime.now(timezone.utc).isoformat()
        payload = json.dumps(data, ensure_ascii=False)

        with self._lock, self._conn:
            self._conn.execute(
                "INSERT INTO events (session_id, timestamp, type, data) VALUES (?, ?, ?, ?)",
                (self.session_id, ts, kind, payload),
            )


# -------------------------- FileReporter ----------------------------- #


class FileReporter:
    """Persist events to structured files on disk, organized by type.

    Files created under ``root_dir``:
      - main_agent.log (timestamped text)
      - supervisor.log (timestamped text)
      - tool_calls.jsonl
      - tool_result.jsonl
      - events.jsonl (generic kind→data log)
      - manifest.json (session metadata)
    """

    def __init__(self, root_dir: str, session_id: str | None = None) -> None:
        self.root = os.path.abspath(root_dir)
        os.makedirs(self.root, exist_ok=True)
        self.session_id = session_id or "session"
        self._lock = threading.Lock()
        self._write_json(
            "manifest.json",
            {
                "session_id": self.session_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            overwrite=False,
        )

    # ------------- public API mirrored from WebReporter ------------- #

    def main_agent(self, step: int, text: str) -> None:
        self._append_text("main_agent.log", step, text)
        self._append_jsonl("events.jsonl", {"type": "main_agent", "step": step, "text": text})

    def supervisor(self, step: int, text: str) -> None:
        self._append_text("supervisor.log", step, text)
        self._append_jsonl("events.jsonl", {"type": "supervisor", "step": step, "text": text})

    def tool_calls(self, step: int, calls: Iterable[Any]) -> None:
        payload = []
        for c in calls:
            try:
                payload.append(
                    {
                        "id": getattr(c, "id", None),
                        "function": getattr(getattr(c, "function", None), "name", None),
                        "arguments": getattr(getattr(c, "function", None), "arguments", None),
                    }
                )
            except Exception:
                payload.append(str(c))
        self._append_jsonl("tool_calls.jsonl", {"step": step, "calls": payload})
        self._append_jsonl("events.jsonl", {"type": "tool_calls", "step": step, "calls": payload})

    def tool_result(self, call_id: str, result: str) -> None:
        self._append_jsonl("tool_result.jsonl", {"call_id": call_id, "result": result})
        self._append_jsonl("events.jsonl", {"type": "tool_result", "call_id": call_id, "result": result})

    def reset_r(self) -> None:
        self._append_jsonl("events.jsonl", {"type": "reset_r"})

    def terminated(self) -> None:
        self._append_jsonl("events.jsonl", {"type": "terminated"})

    def log(self, kind: str, **data: Any) -> None:
        self._append_jsonl("events.jsonl", {"type": str(kind), **data})

    def close(self) -> None:
        # No persistent handles kept open
        pass

    # -------------------------- helpers ----------------------------- #

    def _append_text(self, filename: str, step: int, text: str) -> None:
        line = f"[{datetime.now(timezone.utc).isoformat()}] step={step} \n{text}\n\n"
        path = os.path.join(self.root, filename)
        with self._lock, open(path, "a", encoding="utf-8") as f:
            f.write(line)

    def _append_jsonl(self, filename: str, obj: dict) -> None:
        path = os.path.join(self.root, filename)
        line = json.dumps(obj, ensure_ascii=False)
        with self._lock, open(path, "a", encoding="utf-8") as f:
            f.write(line + "\n")

    def _write_json(self, filename: str, obj: dict, overwrite: bool = True) -> None:
        path = os.path.join(self.root, filename)
        if not overwrite and os.path.exists(path):
            return
        with self._lock, open(path, "w", encoding="utf-8") as f:
            json.dump(obj, f, indent=2)

# -------------------------- WebReporter Class ------------------------- #


class WebReporter:
    """
    A thread-safe reporter that:
      * collects events in memory
      * serves them via a tiny Flask app on /logs (JSON) and / (HTML viewer)
    Implements the same public methods as ConsoleReporter.
    """

    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 5000,
        max_events: int = 10_000,
        serve_html: bool = True,
        allow_cors: bool = False,
    ) -> None:
        self.host = host
        self.port = port
        self.max_events = max_events
        self.serve_html = serve_html
        self.allow_cors = allow_cors

        self._events: list[Event] = []
        self._lock = threading.Lock()
        self._next_id = 1

        self.app = Flask(__name__)
        self._register_routes()

        # Run Flask in a daemon thread so it doesn't block main loop
        self._server_thread = threading.Thread(
            target=self._run_flask,
            daemon=True,
            name="WebReporterHTTPServer",
        )
        self._server_thread.start()

    # ------------------------- Public API (same as ConsoleReporter) --- #

    def main_agent(self, step: int, text: str) -> None:
        print("MAIN AGENT")
        print(text)
        self._add_event("main_agent", {"step": step, "text": text})

    def supervisor(self, step: int, text: str) -> None:
        print("SUPERVISOR")
        print(text)
        self._add_event("supervisor", {"step": step, "text": text})

    def tool_calls(self, step: int, calls: Iterable[Any]) -> None:
        # Convert tool_calls to safe printable dicts/strings
        simplified = []
        for c in calls:
            try:
                simplified.append(
                    {
                        "id": getattr(c, "id", None),
                        "function": getattr(getattr(c, "function", None), "name", None),
                        "arguments": getattr(getattr(c, "function", None), "arguments", None),
                    }
                )
            except Exception:
                simplified.append(str(c))
        self._add_event("tool_calls", {"step": step, "calls": simplified})

    def tool_result(self, call_id: str, result: str) -> None:
        self._add_event("tool_result", {"call_id": call_id, "result": result})

    def reset_r(self) -> None:
        self._add_event("reset_r", {})

    def terminated(self) -> None:
        self._add_event("terminated", {})

    # You may optionally expose a generic log method
    def log(self, kind: str, **data: Any) -> None:
        self._add_event(kind, data)

    # ------------------------- Internal Helpers ----------------------- #

    def _add_event(self, kind: str, data: dict[str, Any]) -> None:
        with self._lock:
            evt = Event(
                id=self._next_id,
                session_id=0,
                timestamp=datetime.now(timezone.utc).isoformat(),
                type=kind,
                data=data,
            )
            self._events.append(evt)
            self._next_id += 1
            # Trim buffer if needed
            if len(self._events) > self.max_events:
                # Drop the oldest half to avoid constant shifting
                self._events = self._events[len(self._events) // 2 :]

    def _run_flask(self) -> None:
        # Disable werkzeug banner
        import logging

        logging.getLogger("werkzeug").setLevel(logging.ERROR)
        self.app.run(host=self.host, port=self.port, debug=False, use_reloader=False)

    def _register_routes(self) -> None:
        @self.app.route("/logs")
        def logs_endpoint():
            """Return events since a given id to minimize payload.
            Query params:
                since: int (exclusive). If provided, only events with id > since are returned.
            """
            since_param = request.args.get("since")
            try:
                since_id = int(since_param) if since_param is not None else 0
            except ValueError:
                since_id = 0

            with self._lock:
                new_events = [asdict(e) for e in self._events if e.id > since_id]
            resp = jsonify({"events": new_events})
            if self.allow_cors:
                resp.headers.add("Access-Control-Allow-Origin", "*")
            return resp

        @self.app.route("/healthz")
        def healthz():
            return {"ok": True, "event_count": len(self._events)}

        if self.serve_html:

            @self.app.route("/")
            def index_page():
                return Response(_INDEX_HTML, mimetype="text/html")

            @self.app.route("/favicon.ico")
            def favicon():
                return Response("", status=204)


# ----------------------------- HTML Template --------------------------- #

_INDEX_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Agent Logs</title>
  <style>
    :root {
      --bg: #f5f5f5;
      --fg: #111;
      --card: #fff;
      --muted: #666;
      --mono: "Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    body { font-family: system-ui, sans-serif; margin: 0; background: var(--bg); color: var(--fg); }
    header { background: #222; color: #fff; padding: 12px 20px; box-shadow: 0 2px 4px rgba(0,0,0,.2); }
    h1 { margin: 0; font-size: 20px; letter-spacing: .5px; }
    #logs { padding: 16px 20px; max-width: 960px; margin: 0 auto; }
    .event {
      background: var(--card);
      margin-bottom: 12px;
      border-radius: 8px;
      padding: 12px 16px;
      box-shadow: 0 2px 4px rgba(0,0,0,.08);
      transition: transform .08s ease-in-out;
      border-left: 4px solid transparent;
    }
    .event:hover { transform: scale(1.01); }
    .event .meta {
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 6px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .event .type { font-weight: 700; text-transform: uppercase; color: var(--fg); }
    .event pre {
      white-space: pre-wrap;
      word-break: break-word;
      font-family: var(--mono);
      background: #f9f9f9;
      border-radius: 4px;
      padding: 8px 10px;
      margin: 0;
      font-size: 13px;
      line-height: 1.4em;
    }
    summary {
      cursor: pointer;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .main_agent   { border-left-color: #4caf50; }
    .supervisor   { border-left-color: #2196f3; }
    .tool_calls   { border-left-color: #ff9800; }
    .tool_result  { border-left-color: #9c27b0; }
    .reset_r      { border-left-color: #795548; }
    .terminated   { border-left-color: #f44336; }
  </style>
</head>
<body>
  <header><h1>Agent Logs</h1></header>
  <div id="logs"></div>

  <script>
    let lastId = 0;

    async function fetchLogs() {
      try {
        const res = await fetch('/logs?since=' + lastId);
        if (!res.ok) return;
        const json = await res.json();
        const events = json.events || [];
        if (events.length) {
          render(events);
          lastId = events[events.length - 1].id;
        }
      } catch (e) {
        console.error('fetch failed', e);
      }
    }

    function textFromEvent(e) {
      if (e.data && typeof e.data.text === 'string') {
        return e.data.text.replace(/\\\\n/g, "\\n").replace(/\\\\\\\\n/g, "\\n").replace(/\\\\n/g, "\\n");
      }
      try {
        return JSON.stringify(e.data, null, 2);
      } catch {
        return String(e.data);
      }
    }

    function render(events) {
      const container = document.getElementById('logs');
      const frag = document.createDocumentFragment();

      for (const e of events) {
        const div  = document.createElement('div');
        div.className = 'event ' + e.type;

        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.innerHTML = `
          <span class="type">${e.type}</span>
          <span>#${e.id}</span>
          <span>${e.timestamp}</span>
        `;

        const content = textFromEvent(e);

        // Only collapse tool_calls and tool_result by default
        if (e.type === 'tool_calls' || e.type === 'tool_result') {
          const details = document.createElement('details'); // collapsed by default
          const summary = document.createElement('summary');
          summary.textContent = `${e.type} #${e.id}`;

          const pre = document.createElement('pre');
          pre.textContent = content;

          details.appendChild(summary);
          details.appendChild(pre);

          div.appendChild(meta);
          div.appendChild(details);
        } else {
          const pre = document.createElement('pre');
          pre.textContent = content;

          div.appendChild(meta);
          div.appendChild(pre);
        }

        frag.appendChild(div);
      }

      container.appendChild(frag);
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }

    // Poll every second
    setInterval(fetchLogs, 1000);
    fetchLogs();
  </script>
</body>
</html>
"""


# ----------------------------- CLI helper ----------------------------- #

if __name__ == "__main__":
    # Simple manual test
    rep = WebReporter()
    for i in range(3):
        rep.main_agent(i, f"Hello from main agent step {i}")
        time.sleep(0.2)
        rep.supervisor(i, f"Supervisor feedback {i}")
    rep.terminated()
    print(f"Server running at http://{rep.host}:{rep.port}/  (Ctrl+C to quit)")
    while True:
        time.sleep(1)
