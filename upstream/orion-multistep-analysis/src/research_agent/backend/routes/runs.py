"""Run management endpoints."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from ..jobs import RunConcurrencyLimitError, RunRecord, RunStatus, job_manager
from ..streams import event_broker

router = APIRouter()


class PromptSelection(BaseModel):
    agent: Optional[str] = None
    literature: Optional[str] = None
    supervisor: Optional[str] = None


class RunCreateRequest(BaseModel):
    database: str
    notes: Optional[str] = None
    name: Optional[str] = None
    prompts: Optional[PromptSelection] = None
    goal: Optional[str] = None


class RunUpdateRequest(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None


def _serialize_run(record: RunRecord) -> dict:
    return {
        "id": record.run_id,
        "database": record.database,
        "status": record.status.value,
        "created_at": record.created_at.isoformat(),
        "updated_at": record.updated_at.isoformat(),
        "name": record.name,
        "notes": record.notes,
        "error": record.error,
        "session_id": record.session_id,
        "archived": record.archived,
        "goal": record.goal,
        "prompts": {
            "agent": record.prompt_agent,
            "literature": record.prompt_literature,
            "supervisor": record.prompt_supervisor,
        },
    }


@router.get("/", response_model=List[dict])
def list_runs(include_archived: bool = Query(False, alias="include_archived")) -> List[dict]:
    """Return in-flight and historical runs tracked in memory."""

    return [
        _serialize_run(record)
        for record in job_manager.list_runs(include_archived=include_archived)
    ]


@router.get("/{run_id}", response_model=dict)
def get_run(run_id: str) -> dict:
    record = job_manager.get_run(run_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return _serialize_run(record)


@router.get("/{run_id}/events")
async def run_events(run_id: str):
    record = job_manager.get_run(run_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    root = job_manager.artifact_dir(record)
    if record.status not in {RunStatus.PENDING, RunStatus.RUNNING} and not event_broker.has_history(run_id):
        events_path = root / "events.jsonl"
        if events_path.exists():
            try:
                events: List[dict] = []
                with events_path.open("r", encoding="utf-8") as handle:
                    for line in handle:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            events.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue
                if events:
                    base_ts = record.updated_at
                    if base_ts.tzinfo is None:  # ensure aware
                        base_ts = base_ts.replace(tzinfo=timezone.utc)
                    normalized: List[dict] = []
                    total = len(events)
                    for idx, raw in enumerate(events):
                        event_type = raw.get("type", "log")
                        timestamp = raw.get("timestamp")
                        if not timestamp:
                            timestamp_dt = base_ts - timedelta(seconds=max(total - idx, 0))
                            timestamp = timestamp_dt.isoformat()
                        data = raw.get("data")
                        if not isinstance(data, dict):
                            data = {k: v for k, v in raw.items() if k not in {"type", "timestamp"}}
                        normalized.append({"type": event_type, "timestamp": timestamp, "data": data})
                    event_broker.seed_history(run_id, normalized)
            except Exception:
                pass

    loop = asyncio.get_running_loop()
    queue, history = event_broker.subscribe(run_id, loop)

    async def event_generator():
        try:
            for past in history:
                payload = json.dumps(past)
                yield f"data: {payload}\n\n"
            while True:
                event = await queue.get()
                payload = json.dumps(event)
                yield f"data: {payload}\n\n"
        finally:
            event_broker.unsubscribe(run_id, queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=dict)
def create_run(payload: RunCreateRequest) -> dict:
    databases = {path.name: path for path in job_manager.available_databases()}
    if payload.database not in databases:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown database '{payload.database}'",
        )

    prompt_payload = {}
    if payload.prompts:
        prompt_payload = {k: v for k, v in payload.prompts.dict().items() if v}
    # Normalize goal text (optional)
    goal = (payload.goal or "").strip() or None

    try:
        record = job_manager.launch_run(
            database=payload.database,
            notes=payload.notes,
            name=payload.name,
            prompts=prompt_payload,
            goal=goal,
        )
    except RunConcurrencyLimitError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    return _serialize_run(record)


@router.post("/{run_id}/cancel", status_code=status.HTTP_202_ACCEPTED, response_model=dict)
def cancel_run(run_id: str) -> dict:
    if not job_manager.cancel_run(run_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    record = job_manager.get_run(run_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return _serialize_run(record)


@router.post("/{run_id}/archive", response_model=dict)
def archive_run(run_id: str) -> dict:
    record = job_manager.set_archived(run_id, archived=True)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return _serialize_run(record)


@router.post("/{run_id}/unarchive", response_model=dict)
def unarchive_run(run_id: str) -> dict:
    record = job_manager.set_archived(run_id, archived=False)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return _serialize_run(record)


    


@router.patch("/{run_id}", response_model=dict)
def update_run(run_id: str, payload: RunUpdateRequest) -> dict:
    if payload is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No payload provided")
    record = job_manager.update_run(run_id, name=payload.name, notes=payload.notes)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return _serialize_run(record)


@router.get("/{run_id}/artifacts", response_model=List[dict])
def list_run_artifacts(run_id: str) -> List[dict]:
    record = job_manager.get_run(run_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    root = job_manager.artifact_dir(record)
    if not root.exists():
        return []

    files: List[dict] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(root).as_posix()
        stat = path.stat()
        files.append(
            {
                "path": rel,
                "size": stat.st_size,
                "updated_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            }
        )
    return files


@router.get("/{run_id}/artifacts/{artifact_path:path}")
def download_run_artifact(run_id: str, artifact_path: str):
    record = job_manager.get_run(run_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    root = job_manager.artifact_dir(record)
    if not root.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

    resolved_root = root.resolve()
    target = (root / artifact_path).resolve()
    if not str(target).startswith(str(resolved_root)) or not target.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

    return FileResponse(target, filename=target.name)
