from __future__ import annotations

import importlib
import io
import json
import sqlite3
import threading
import zipfile

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def runtime_env(tmp_path, monkeypatch):
    data_root = tmp_path / "data"
    runs_root = tmp_path / "runs"
    events_db = tmp_path / "events.db"
    data_root.mkdir()
    runs_root.mkdir()

    monkeypatch.setenv("ORION_DATA_ROOT", str(data_root))
    monkeypatch.setenv("ORION_RUNS_ROOT", str(runs_root))
    monkeypatch.setenv("ORION_EVENTS_DB", str(events_db))

    import research_agent.config as base_config
    import research_agent.backend.config as backend_config
    import research_agent.backend.jobs as backend_jobs
    import research_agent.backend.routes.databases as routes_databases
    import research_agent.backend.routes.runs as routes_runs
    import research_agent.backend.routes.system as routes_system
    import research_agent.backend.routes as routes_root
    import research_agent.backend.main as backend_main

    importlib.reload(base_config)
    importlib.reload(backend_config)
    importlib.reload(backend_jobs)
    importlib.reload(routes_databases)
    importlib.reload(routes_runs)
    importlib.reload(routes_system)
    importlib.reload(routes_root)
    importlib.reload(backend_main)

    backend_jobs.job_manager._executor = lambda *args, **kwargs: None

    db_path = data_root / "sample.db"
    connection = sqlite3.connect(db_path)
    try:
        connection.execute("CREATE TABLE widgets (id INTEGER PRIMARY KEY, name TEXT)")
        connection.executemany("INSERT INTO widgets (name) VALUES (?)", [("alpha",), ("beta",)])
        connection.commit()
    finally:
        connection.close()

    return {
        "app": backend_main.app,
        "data_root": data_root,
        "runs_root": runs_root,
        "events_db": events_db,
        "job_manager": backend_jobs.job_manager,
        "db_path": db_path,
    }


@pytest.fixture()
def client(runtime_env):
    with TestClient(runtime_env["app"]) as test_client:
        yield test_client


def test_healthcheck(client, runtime_env):
    response = client.get("/api/system/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["data_root"] == str(runtime_env["data_root"])
    assert payload["runs_root"] == str(runtime_env["runs_root"])


def test_database_listing_and_tables(client, runtime_env):
    response = client.get("/api/databases/")
    assert response.status_code == 200
    databases = response.json()
    assert any(item["name"] == runtime_env["db_path"].name for item in databases)

    tables_response = client.get(f"/api/databases/{runtime_env['db_path'].name}/tables")
    assert tables_response.status_code == 200
    tables = tables_response.json()
    assert tables == [{"name": "widgets", "row_count": 2}]


def test_table_preview(client, runtime_env):
    response = client.get(f"/api/databases/{runtime_env['db_path'].name}/tables/widgets")
    assert response.status_code == 200
    payload = response.json()
    assert payload["table"] == "widgets"
    assert payload["columns"] == ["id", "name"]
    assert payload["total"] == 2
    assert len(payload["rows"]) == 2


def test_runs_create_list_get_and_archive(client, runtime_env):
    create_response = client.post(
        "/api/runs/",
        json={"database": runtime_env["db_path"].name, "goal": "Assess widgets"},
    )
    assert create_response.status_code == 201
    created = create_response.json()
    run_id = created["id"]
    assert created["database"] == runtime_env["db_path"].name

    list_response = client.get("/api/runs/")
    assert list_response.status_code == 200
    runs = list_response.json()
    assert any(run["id"] == run_id for run in runs)

    get_response = client.get(f"/api/runs/{run_id}")
    assert get_response.status_code == 200
    assert get_response.json()["id"] == run_id

    missing_response = client.get("/api/runs/missing-run")
    assert missing_response.status_code == 404

    archive_response = client.post(f"/api/runs/{run_id}/archive")
    assert archive_response.status_code == 200
    assert archive_response.json()["archived"] is True

    unarchive_response = client.post(f"/api/runs/{run_id}/unarchive")
    assert unarchive_response.status_code == 200
    assert unarchive_response.json()["archived"] is False


def test_run_cancel(client, runtime_env):
    job_manager = runtime_env["job_manager"]

    def wait_for_cancel(_record, _db_path, cancel_event, _reporter):
        cancel_event.wait(5)

    job_manager._executor = wait_for_cancel

    response = client.post(
        "/api/runs/",
        json={"database": runtime_env["db_path"].name, "goal": "Cancelable run"},
    )
    assert response.status_code == 201
    run_id = response.json()["id"]

    cancel_response = client.post(f"/api/runs/{run_id}/cancel")
    assert cancel_response.status_code == 202
    assert cancel_response.json()["status"] == "cancelled"


def test_run_concurrency_limit_enforced(client, runtime_env):
    job_manager = runtime_env["job_manager"]
    release = threading.Event()

    def block_until_released(_record, _db_path, cancel_event, _reporter):
        while not cancel_event.is_set():
            if release.wait(0.05):
                return

    job_manager._executor = block_until_released

    first_response = client.post(
        "/api/runs/",
        json={"database": runtime_env["db_path"].name, "goal": "First run"},
    )
    assert first_response.status_code == 201

    second_response = client.post(
        "/api/runs/",
        json={"database": runtime_env["db_path"].name, "goal": "Second run"},
    )
    assert second_response.status_code == 409
    assert "ORION_ALLOW_PARALLEL" in second_response.json()["detail"]

    run_id = first_response.json()["id"]
    worker = job_manager._workers[run_id].thread
    release.set()
    worker.join(timeout=5)


def test_run_events_history(client, runtime_env):
    job_manager = runtime_env["job_manager"]
    record = job_manager.create_pending_run(database=runtime_env["db_path"].name)
    job_manager.update_status(record.run_id, status=type(record.status).COMPLETED)

    events_dir = job_manager.artifact_dir(record)
    events_dir.mkdir(parents=True, exist_ok=True)
    events_path = events_dir / "events.jsonl"
    event_payload = {
        "type": "log",
        "timestamp": "2024-01-01T00:00:00+00:00",
        "data": {"message": "hello"},
    }
    events_path.write_text(json.dumps(event_payload) + "\n", encoding="utf-8")

    with client.stream("GET", f"/api/runs/{record.run_id}/events") as response:
        assert response.status_code == 200
        first_line = next(line for line in response.iter_lines() if line)
        decoded = first_line.decode() if isinstance(first_line, bytes) else first_line
        assert decoded.startswith("data: ")
        payload = json.loads(decoded.removeprefix("data: ").strip())
        assert payload["type"] == "log"
        assert payload["data"]["message"] == "hello"


def test_database_upload_limit_enforced(client, runtime_env):
    runtime_env["job_manager"].settings.max_upload_bytes = 7

    response = client.post(
        "/api/databases/",
        data={"name": "oversized"},
        files={"file": ("oversized.csv", b"a,b\n1,2\n", "text/csv")},
    )

    assert response.status_code == 413
    assert "configured size limit" in response.json()["detail"]


def test_zip_uncompressed_limit_enforced(client, runtime_env):
    runtime_env["job_manager"].settings.max_zip_uncompressed_bytes = 8

    payload = io.BytesIO()
    with zipfile.ZipFile(payload, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("sample.csv", "a,b\n1,2\n3,4\n")
    payload.seek(0)

    response = client.post(
        "/api/databases/",
        data={"name": "zip-limit"},
        files={"file": ("sample.zip", payload.getvalue(), "application/zip")},
    )

    assert response.status_code == 400
    assert "uncompressed CSV size exceeds" in response.json()["detail"]
