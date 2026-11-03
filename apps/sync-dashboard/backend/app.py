"""FastAPI endpoints for a local, read-only GitHub dashboard."""
import os
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles

from .github import fetch_runs
from .store import initialize, save_snapshot, snapshot


def default_database():
    """Prefer the persisted cloud workspace, with a writable local-user fallback."""
    workspace = Path("/workspace")
    base = (workspace / ".data" if workspace.is_dir() and os.access(workspace, os.W_OK)
            else Path.home() / ".local/share")
    return str(base / "codex-01-dashboard/status.sqlite3")


def create_app(database=None, fetcher=fetch_runs):
    """Create an app with an injectable database and reader for offline tests."""
    database = database or os.environ.get("SYNC_DASHBOARD_DB", default_database())
    initialize(database)
    application = FastAPI(title="Codex Sync", docs_url="/api/docs", redoc_url=None,
                          openapi_url="/api/openapi.json")

    @application.get("/api/health")
    def health():
        """Verify both the app and its persisted database can be read."""
        snapshot(database, "demo")
        return {"status": "ok", "repository": "xiaochouxia11/Codex-01"}

    @application.get("/api/runs")
    def runs(mode: Literal["demo", "live"] = "demo"):
        """Return explicitly selected demo or cached live data."""
        return snapshot(database, mode)

    @application.post("/api/refresh")
    def refresh(request: Request):
        """Refresh local cache via a read-only remote request."""
        origin = request.headers.get("origin")
        allowed = {f"http://{host}:{port}" for host in ("127.0.0.1", "localhost")
                   for port in (5173, 8000)}
        if origin and origin not in allowed:
            raise HTTPException(status_code=403, detail="This is a local development app.")
        try:
            save_snapshot(database, fetcher())
        except RuntimeError as error:
            raise HTTPException(status_code=502, detail=str(error)) from error
        return snapshot(database, "live")

    frontend = Path(__file__).resolve().parents[1] / "frontend/dist"
    if frontend.is_dir():
        application.mount("/", StaticFiles(directory=frontend, html=True), name="frontend")
    return application


app = create_app()
