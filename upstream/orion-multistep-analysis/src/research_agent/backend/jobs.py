"""Run orchestration primitives for the backend service."""

from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
import tempfile
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Callable, Dict, Iterable, Optional

from .config import BackendSettings, settings
from .prompts import DEFAULT_PROMPT_IDS, get_template
from .storage import RunStore
from .services import csv_importer


class RunStatus(str, Enum):
    """Lifecycle phases for an analysis run."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class RunConcurrencyLimitError(RuntimeError):
    """Raised when a new run would exceed configured concurrency limits."""


@dataclass(slots=True)
class RunRecord:
    """Lightweight in-memory record of a run's status."""

    run_id: str
    database: str
    status: RunStatus
    created_at: datetime
    updated_at: datetime
    name: Optional[str] = None
    notes: Optional[str] = None
    error: Optional[str] = None
    session_id: Optional[str] = None
    artifacts: Dict[str, Path] = field(default_factory=dict)
    archived: bool = False
    prompt_agent: str = DEFAULT_PROMPT_IDS["agent"]
    prompt_literature: str = DEFAULT_PROMPT_IDS["literature"]
    prompt_supervisor: str = DEFAULT_PROMPT_IDS["supervisor"]
    goal: Optional[str] = None


@dataclass(slots=True)
class _WorkerHandle:
    thread: threading.Thread
    cancel_event: threading.Event


ExecutorFunc = Callable[[RunRecord, Path, threading.Event, object | None], None]
ReporterFactory = Callable[[RunRecord], object]


class JobManager:
    """Book-keeping layer that will manage long-running agent jobs.

    The initial implementation purposefully keeps the functionality small; it
    is primarily responsible for tracking state transitions and exposing
    metadata to the FastAPI routes. Orchestration hooks (spawn processes,
    monitor reporters, etc.) will be layered on top in subsequent steps.
    """

    def __init__(
        self,
        cfg: BackendSettings | None = None,
        *,
        executor: ExecutorFunc | None = None,
        reporter_factory: ReporterFactory | None = None,
    ) -> None:
        self.settings = cfg or settings
        self._runs: Dict[str, RunRecord] = {}
        self._lock = threading.Lock()
        self._workers: Dict[str, _WorkerHandle] = {}
        self._executor = executor or self._default_executor
        self._reporter_factory = reporter_factory
        self._store = RunStore(self.settings.events_db)

        self._load_existing_runs()

    # ----------------------------- Run metadata ----------------------------- #

    def list_runs(self, *, include_archived: bool = False) -> Iterable[RunRecord]:
        with self._lock:
            runs = list(self._runs.values())
        if not include_archived:
            runs = [run for run in runs if not run.archived]
        runs.sort(key=lambda record: record.created_at, reverse=True)
        return runs

    def get_run(self, run_id: str) -> Optional[RunRecord]:
        with self._lock:
            return self._runs.get(run_id)

    def create_pending_run(
        self,
        *,
        database: str,
        notes: Optional[str] = None,
        name: Optional[str] = None,
        prompts: Optional[Dict[str, str]] = None,
        goal: Optional[str] = None,
    ) -> RunRecord:
        now = datetime.now(timezone.utc)
        prompts = prompts or {}
        record = RunRecord(
            run_id=str(uuid.uuid4()),
            database=database,
            status=RunStatus.PENDING,
            created_at=now,
            updated_at=now,
            name=name,
            notes=notes,
            prompt_agent=prompts.get("agent", DEFAULT_PROMPT_IDS["agent"]),
            prompt_literature=prompts.get("literature", DEFAULT_PROMPT_IDS["literature"]),
            prompt_supervisor=prompts.get("supervisor", DEFAULT_PROMPT_IDS["supervisor"]),
            goal=(goal.strip() if isinstance(goal, str) else None) or None,
        )
        with self._lock:
            active_runs = sum(
                1
                for run in self._runs.values()
                if run.status in {RunStatus.PENDING, RunStatus.RUNNING}
            )
            max_active_runs = (
                max(1, self.settings.max_concurrent_runs)
                if self.settings.allow_parallel
                else 1
            )
            if active_runs >= max_active_runs:
                if not self.settings.allow_parallel:
                    raise RunConcurrencyLimitError(
                        "A run is already active and ORION_ALLOW_PARALLEL is disabled."
                    )
                raise RunConcurrencyLimitError(
                    f"Maximum concurrent runs reached ({max_active_runs})."
                )
            self._runs[record.run_id] = record
            self._persist_record(record)
        return record

    def launch_run(
        self,
        *,
        database: str,
        notes: Optional[str] = None,
        name: Optional[str] = None,
        prompts: Optional[Dict[str, str]] = None,
        goal: Optional[str] = None,
    ) -> RunRecord:
        record = self.create_pending_run(database=database, notes=notes, name=name, prompts=prompts, goal=goal)

        cancel_event = threading.Event()
        worker = threading.Thread(
            target=self._run_worker,
            args=(record.run_id, cancel_event),
            name=f"run-{record.run_id[:8]}",
            daemon=True,
        )

        with self._lock:
            self._workers[record.run_id] = _WorkerHandle(
                thread=worker, cancel_event=cancel_event
            )

        worker.start()
        return record

    def update_status(
        self,
        run_id: str,
        *,
        status: RunStatus,
        error: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> Optional[RunRecord]:
        with self._lock:
            record = self._runs.get(run_id)
            if record is None:
                return None
            record.status = status
            record.updated_at = datetime.now(timezone.utc)
            if error is not None:
                record.error = error
            if session_id is not None:
                record.session_id = session_id
            self._persist_record(record)
            return record

    def cancel_run(self, run_id: str) -> bool:
        with self._lock:
            handle = self._workers.get(run_id)
            record = self._runs.get(run_id)
        if handle is None or record is None:
            return False
        handle.cancel_event.set()
        self.update_status(run_id, status=RunStatus.CANCELLED)
        return True

    def set_archived(self, run_id: str, *, archived: bool) -> Optional[RunRecord]:
        with self._lock:
            record = self._runs.get(run_id)
            if record is None:
                return None
            record.archived = archived
            record.updated_at = datetime.now(timezone.utc)
            self._persist_record(record)
            return record

    def update_run(self, run_id: str, *, name: Optional[str] = None, notes: Optional[str] = None) -> Optional[RunRecord]:
        with self._lock:
            record = self._runs.get(run_id)
            if record is None:
                return None
            changed = False
            if name is not None and name != record.name:
                record.name = name
                changed = True
            if notes is not None and notes != record.notes:
                record.notes = notes
                changed = True
            if not changed:
                return record
            record.updated_at = datetime.now(timezone.utc)
            self._persist_record(record)
            return record

    # ------------------------------ Data assets ----------------------------- #

    def available_databases(self) -> Iterable[Path]:
        roots = {self.settings.data_root, self.settings.runs_root.parent}
        seen: set[Path] = set()
        for root in roots:
            if not root.exists() or not root.is_dir():
                continue
            for path in sorted(root.glob("*.db")):
                real = path.resolve()
                if real in seen:
                    continue
                # Only expose datasets under the primary data directory
                try:
                    real_relative = real.relative_to(self.settings.data_root)
                except ValueError:
                    continue
                seen.add(real)
                yield real

    def resolve_database_path(self, name: str) -> Path:
        candidates = {path.name: path for path in self.available_databases()}
        if name not in candidates:
            raise FileNotFoundError(f"Database {name!r} not found")
        return candidates[name]

    def create_database_from_file(self, *, name: str, file_path: Path) -> Path:
        """Register an uploaded SQLite .db under the data directory.

        - Validates and normalizes the name to ``<name>.db``.
        - Verifies the file is a readable SQLite database.
        - Moves it into ``settings.data_root``.
        """
        normalized = self._normalize_db_name(name)
        target_dir = self.settings.data_root
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = (target_dir / normalized).resolve()
        if target_path.exists():
            raise FileExistsError(f"A database named '{normalized}' already exists.")

        # Basic SQLite sanity check
        import sqlite3

        try:
            con = sqlite3.connect(file_path)
            con.execute("SELECT name FROM sqlite_master LIMIT 1").fetchall()
        except Exception as exc:  # pragma: no cover - safety check
            try:
                con.close()
            except Exception:
                pass
            raise ValueError(f"Uploaded file is not a valid SQLite database: {exc}") from exc
        finally:
            try:
                con.close()
            except Exception:
                pass

        target_path.write_bytes(file_path.read_bytes())
        return target_path

    @staticmethod
    def _normalize_db_name(raw_name: str) -> str:
        name = (raw_name or "").strip()
        if not name:
            raise ValueError("Database name cannot be empty.")
        lower = name.lower()
        if lower.endswith(".sqlite"):
            name = name[: -len(".sqlite")]
        elif lower.endswith(".db"):
            name = name[: -len(".db")]
        name = name.strip().replace(" ", "_")
        # Restrict to a safe character set
        import re as _re

        if not _re.fullmatch(r"^[A-Za-z0-9][A-Za-z0-9._-]*$", name):
            raise ValueError("Name may only contain letters, numbers, dot, dash, or underscore.")
        return f"{name}.db"

    def delete_database(self, name: str) -> Path:
        path = self.resolve_database_path(name)
        try:
            path.unlink()
        except FileNotFoundError:
            raise FileNotFoundError(f"Database {name!r} not found")
        return path

    def create_database_from_upload(self, *, name: str, file_path: Path) -> Path:
        """Create or register a SQLite database from an uploaded file.

        - If ``file_path`` ends with .db → validate and register directly.
        - If ``.csv`` → create a db with one table from the CSV.
        - If ``.zip`` → extract and import all CSVs as tables.
        """
        ext = file_path.suffix.lower()
        if ext == ".db":
            return self.create_database_from_file(name=name, file_path=file_path)

        normalized = self._normalize_db_name(name)
        target_dir = self.settings.data_root
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = (target_dir / normalized).resolve()
        if target_path.exists():
            raise FileExistsError(f"A database named '{normalized}' already exists.")

        if ext == ".csv":
            try:
                return csv_importer.create_sqlite_from_csvs(target_path, [file_path])
            except Exception as exc:
                raise ValueError(f"Failed to import CSV: {exc}") from exc
        if ext == ".zip":
            with tempfile.TemporaryDirectory(prefix="csv-import-") as td:
                tmp_dir = Path(td)
                csvs = csv_importer.extract_csvs_from_zip(
                    file_path,
                    tmp_dir,
                    max_members=self.settings.max_zip_members,
                    max_uncompressed_bytes=self.settings.max_zip_uncompressed_bytes,
                )
                if not csvs:
                    raise ValueError("Zip archive did not contain any .csv files")
                try:
                    return csv_importer.create_sqlite_from_csvs(target_path, csvs)
                except Exception as exc:
                    raise ValueError(f"Failed to import one or more CSVs from ZIP: {exc}") from exc
        raise ValueError("Unsupported file type. Upload a .db, .csv, or .zip containing .csv files.")

    # ------------------------------ Execution ------------------------------ #

    def artifact_dir(self, record: RunRecord) -> Path:
        session = record.session_id or record.run_id
        return (self.settings.runs_root / session).resolve()

    def _persist_record(self, record: RunRecord) -> None:
        payload = {
            "run_id": record.run_id,
            "database": record.database,
            "status": record.status.value,
            "name": record.name,
            "notes": record.notes,
            "error": record.error,
            "session_id": record.session_id,
            "artifacts": {k: str(v) for k, v in record.artifacts.items()}
            if record.artifacts
            else None,
            "created_at": record.created_at.isoformat(),
            "updated_at": record.updated_at.isoformat(),
            "archived": record.archived,
            "prompt_agent": record.prompt_agent,
            "prompt_literature": record.prompt_literature,
            "prompt_supervisor": record.prompt_supervisor,
            "goal": record.goal,
        }
        self._store.upsert(payload)

    def _load_existing_runs(self) -> None:
        for payload in self._store.load_all():
            try:
                status = RunStatus(payload["status"])
            except ValueError:
                status = RunStatus.FAILED
            created = datetime.fromisoformat(payload["created_at"])
            updated = datetime.fromisoformat(payload["updated_at"])
            record = RunRecord(
                run_id=payload["run_id"],
                database=payload["database"],
                status=status,
                created_at=created,
                updated_at=updated,
                name=payload.get("name"),
                notes=payload.get("notes"),
                error=payload.get("error"),
                session_id=payload.get("session_id"),
                artifacts={k: Path(v) for k, v in (payload.get("artifacts") or {}).items()},
                archived=bool(payload.get("archived", False)),
                prompt_agent=payload.get("prompt_agent") or DEFAULT_PROMPT_IDS["agent"],
                prompt_literature=payload.get("prompt_literature") or DEFAULT_PROMPT_IDS["literature"],
                prompt_supervisor=payload.get("prompt_supervisor") or DEFAULT_PROMPT_IDS["supervisor"],
                goal=payload.get("goal"),
            )
            if record.status in {RunStatus.RUNNING, RunStatus.PENDING}:
                record.status = RunStatus.FAILED
                record.error = "Run incomplete due to service restart."
                record.updated_at = datetime.now(timezone.utc)
                self._store.upsert(
                    {
                        "run_id": record.run_id,
                        "database": record.database,
                        "status": record.status.value,
                        "name": record.name,
                        "notes": record.notes,
                        "error": record.error,
                        "session_id": record.session_id,
                        "artifacts": None,
                        "prompt_agent": record.prompt_agent,
                        "prompt_literature": record.prompt_literature,
                        "prompt_supervisor": record.prompt_supervisor,
                        "goal": record.goal,
                        "created_at": record.created_at.isoformat(),
                        "updated_at": record.updated_at.isoformat(),
                        "archived": record.archived,
                    }
                )
            self._runs[record.run_id] = record

    def _resolve_database(self, record: RunRecord) -> Path:
        candidates = {path.name: path for path in self.available_databases()}
        if record.database not in candidates:
            raise FileNotFoundError(f"Database {record.database!r} no longer available")
        return candidates[record.database]

    def _run_worker(self, run_id: str, cancel_event: threading.Event) -> None:
        record = self.get_run(run_id)
        if record is None:
            return

        self.update_status(run_id, status=RunStatus.RUNNING)

        reporter = None
        if self._reporter_factory is not None:
            try:
                reporter = self._reporter_factory(record)
            except Exception as exc:  # pragma: no cover - defensive, logs later
                self.update_status(run_id, status=RunStatus.FAILED, error=str(exc))
                return

        try:
            db_path = self._resolve_database(record)
            self._executor(record, db_path, cancel_event, reporter)
        except FileNotFoundError as exc:
            self.update_status(run_id, status=RunStatus.FAILED, error=str(exc))
        except Exception as exc:  # pragma: no cover - placeholder for future logging
            self.update_status(run_id, status=RunStatus.FAILED, error=str(exc))
        else:
            if cancel_event.is_set():
                self.update_status(run_id, status=RunStatus.CANCELLED)
            else:
                self.update_status(run_id, status=RunStatus.COMPLETED)
        finally:
            with self._lock:
                self._workers.pop(run_id, None)
            # Reporter cleanup hook if needed
            if reporter is not None:
                close_fn = getattr(reporter, "close", None)
                if callable(close_fn):
                    try:
                        close_fn()
                    except Exception:
                        pass

    @staticmethod
    def _default_executor(
        record: RunRecord,
        database: Path,
        cancel_event: threading.Event,
        reporter: object | None,
    ) -> None:
        """Placeholder executor.

        Until the orchestration logic is fully implemented we simulate minimal
        progress so the API can be exercised from the frontend. The loop checks
        for cancellation and otherwise completes after a short delay.
        """

        for _ in range(5):
            if cancel_event.wait(timeout=0.5):
                return
        # In the future, this method will call into the real agent pipeline
        # via a generic orchestrator module.


from .streams import StreamingReporter, event_broker
from .executor import run_agent


def _reporter_factory(record: RunRecord):
    return StreamingReporter(record.run_id, event_broker)


job_manager = JobManager(executor=run_agent, reporter_factory=_reporter_factory)
