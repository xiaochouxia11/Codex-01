from __future__ import annotations

import sqlite3
import threading

from research_agent.backend.jobs import JobManager, RunStatus
from research_agent.backend.storage import RunStore
from research_agent.config import BackendSettings


def test_job_manager_run_lifecycle(tmp_path):
    data_root = tmp_path / "data"
    runs_root = tmp_path / "runs"
    events_db = tmp_path / "events.db"
    data_root.mkdir()
    runs_root.mkdir()

    fixture_db = data_root / "fixture.db"
    connection = sqlite3.connect(fixture_db)
    connection.execute("CREATE TABLE example (id INTEGER)")
    connection.close()

    settings = BackendSettings(
        data_root=data_root,
        runs_root=runs_root,
        events_db=events_db,
        prompts_store=tmp_path / "prompts_store.json",
    )

    executed = threading.Event()

    def executor(record, database, cancel_event, reporter):
        executed.set()

    manager = JobManager(cfg=settings, executor=executor)

    assert fixture_db.resolve() in list(manager.available_databases())

    record = manager.launch_run(database="fixture.db", name="Initial", notes="Notes")
    manager._workers[record.run_id].thread.join(timeout=5)

    assert executed.is_set()
    run = manager.get_run(record.run_id)
    assert run is not None
    assert run.status == RunStatus.COMPLETED

    updated = manager.update_run(record.run_id, name="Updated", notes="New notes")
    assert updated is not None
    assert updated.name == "Updated"
    assert updated.notes == "New notes"

    archived = manager.set_archived(record.run_id, archived=True)
    assert archived is not None
    assert archived.archived is True

    store = RunStore(events_db)
    payloads = list(store.load_all())

    assert payloads
    payload = payloads[0]
    assert payload["run_id"] == record.run_id
    assert payload["database"] == "fixture.db"
    assert payload["status"] == RunStatus.COMPLETED.value
    assert payload["name"] == "Updated"
    assert payload["notes"] == "New notes"
    assert payload["archived"] is True
