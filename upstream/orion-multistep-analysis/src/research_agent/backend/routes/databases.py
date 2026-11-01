"""Database discovery endpoints."""

from __future__ import annotations

import re
import sqlite3
import tempfile
from pathlib import Path
from typing import List

from fastapi import APIRouter, File, Form, HTTPException, Query, Response, UploadFile, status
from fastapi.concurrency import run_in_threadpool

from ..jobs import job_manager

router = APIRouter()


def _db_payload(path: Path) -> dict:
    return {
        "name": path.name,
        "path": str(path),
        "size_bytes": path.stat().st_size if path.exists() else 0,
    }


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=dict)
async def create_database(
    name: str = Form(...),
    file: UploadFile = File(...),
) -> dict:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload must include a file.")
    lower_name = file.filename.lower()
    allowed = lower_name.endswith(".db") or lower_name.endswith(".csv") or lower_name.endswith(".zip")
    if not allowed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supported uploads: .db, .csv, or .zip containing CSVs.")

    try:
        with tempfile.TemporaryDirectory(prefix="database-upload-") as temp_dir:
            # Preserve the uploaded file extension so downstream import logic can branch.
            orig_ext = Path(file.filename).suffix.lower() if file.filename else ""
            ext = orig_ext if orig_ext in {".db", ".csv", ".zip"} else ".db"
            temp_path = Path(temp_dir) / f"uploaded{ext}"
            total_bytes = 0
            with temp_path.open("wb") as buffer:
                while True:
                    chunk = await file.read(1 << 20)
                    if not chunk:
                        break
                    total_bytes += len(chunk)
                    if total_bytes > job_manager.settings.max_upload_bytes:
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=(
                                "Upload exceeds the configured size limit "
                                f"({job_manager.settings.max_upload_bytes} bytes)."
                            ),
                        )
                    buffer.write(chunk)

            if temp_path.stat().st_size == 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

            try:
                created_path = await run_in_threadpool(
                    job_manager.create_database_from_upload,
                    name=name,
                    file_path=temp_path,
                )
            except FileExistsError as exc:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
            except ValueError as exc:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
            except Exception as exc:  # pragma: no cover - defensive
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to register database.") from exc

        return _db_payload(created_path)
    finally:
        await file.close()


@router.get("/", response_model=List[dict])
def list_databases() -> List[dict]:
    """Return candidate SQLite databases for new runs."""

    return [_db_payload(path) for path in job_manager.available_databases()]


@router.delete("/{database_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_database(database_name: str) -> Response:
    try:
        job_manager.delete_database(database_name)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Database not found")
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Deletion not permitted")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _resolve_database(name: str) -> Path:
    try:
        return job_manager.resolve_database_path(name)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Database not found")


def _quote_identifier(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


@router.get("/{database_name}/tables", response_model=List[dict])
def list_database_tables(database_name: str) -> List[dict]:
    db_path = _resolve_database(database_name)
    connection = sqlite3.connect(db_path)
    try:
        cursor = connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        tables: List[dict] = []
        for (table_name,) in cursor.fetchall():
            try:
                count = connection.execute(f"SELECT COUNT(*) FROM {_quote_identifier(table_name)}").fetchone()[0]
            except sqlite3.DatabaseError:
                count = None
            tables.append({"name": table_name, "row_count": count})
        return tables
    finally:
        connection.close()


_TABLE_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


@router.get("/{database_name}/tables/{table_name}", response_model=dict)
def preview_table(
    database_name: str,
    table_name: str,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> dict:
    if not _TABLE_NAME_RE.match(table_name):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid table name")

    db_path = _resolve_database(database_name)
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    try:
        quoted_table = _quote_identifier(table_name)
        total_row = connection.execute(f"SELECT COUNT(*) AS total FROM {quoted_table}").fetchone()
        if total_row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Table not found")
        total = int(total_row["total"])
        rows_cursor = connection.execute(
            f"SELECT * FROM {quoted_table} LIMIT ? OFFSET ?",
            (limit, offset),
        )
        rows = [dict(row) for row in rows_cursor.fetchall()]
        columns = list(rows[0].keys()) if rows else [col[1] for col in connection.execute(f"PRAGMA table_info({quoted_table})").fetchall()]
        return {
            "table": table_name,
            "columns": columns,
            "rows": rows,
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    except sqlite3.OperationalError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    finally:
        connection.close()
