"""System level diagnostics."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from ..config import settings

router = APIRouter()


@router.get("/health", response_model=dict)
def healthcheck() -> dict:
    """Basic health probe for readiness/liveness checks."""

    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data_root": str(settings.data_root),
        "runs_root": str(settings.runs_root),
    }

