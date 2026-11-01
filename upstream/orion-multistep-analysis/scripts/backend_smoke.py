"""Minimal smoke checks for the backend API using TestClient.

These checks provide quick feedback while developing the FastAPI service
without needing to stand up a running server. The script does **not** launch
any long-running jobs so it is safe to execute during development:

    python scripts/backend_smoke.py
"""

from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from fastapi.testclient import TestClient

from research_agent.backend.main import app


def main() -> None:
    client = TestClient(app)

    health = client.get("/api/system/health")
    print("/system/health:", health.status_code, health.json())

    databases = client.get("/api/databases/")
    print("/databases/:", databases.status_code, len(databases.json()))

    runs = client.get("/api/runs/")
    print("/runs/:", runs.status_code, len(runs.json()))


if __name__ == "__main__":
    main()
