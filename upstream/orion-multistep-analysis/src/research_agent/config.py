"""Shared configuration for the research agent stack."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


def _get_first_env(*names: str) -> Optional[str]:
    """Return the first non-empty environment variable among names."""

    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    return None


def _env_bool(*names: str, default: bool) -> bool:
    raw = _get_first_env(*names)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(*names: str, default: int) -> int:
    raw = _get_first_env(*names)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


@dataclass(slots=True)
class Settings:
    """Base settings shared across CLI, API, and orchestration."""

    data_root: Path = Path(
        _get_first_env("ORION_DATA_ROOT", "MRDAA_DATA_ROOT") or "runtime/data"
    ).resolve()
    runs_root: Path = Path(
        _get_first_env("ORION_RUNS_ROOT", "MRDAA_RUNS_ROOT") or "runtime/runs"
    ).resolve()
    events_db: Path = Path(
        _get_first_env("ORION_EVENTS_DB", "MRDAA_EVENTS_DB") or "runtime/events.db"
    ).resolve()
    prompts_store: Path = Path(
        _get_first_env("ORION_PROMPTS_STORE", "MRDAA_PROMPTS_STORE")
        or "runtime/prompts_store.json"
    ).resolve()


@dataclass(slots=True)
class BackendSettings(Settings):
    """Service settings derived from environment variables."""

    max_concurrent_runs: int = max(
        1, _env_int("ORION_MAX_CONCURRENT_RUNS", "MRDAA_MAX_CONCURRENT_RUNS", default=1)
    )
    allow_parallel: bool = _env_bool(
        "ORION_ALLOW_PARALLEL", "MRDAA_ALLOW_PARALLEL", default=False
    )
    max_upload_bytes: int = max(
        1,
        _env_int(
            "ORION_MAX_UPLOAD_BYTES",
            "MRDAA_MAX_UPLOAD_BYTES",
            default=100 * 1024 * 1024,
        ),
    )
    max_zip_members: int = max(
        1,
        _env_int(
            "ORION_MAX_ZIP_MEMBERS",
            "MRDAA_MAX_ZIP_MEMBERS",
            default=1000,
        ),
    )
    max_zip_uncompressed_bytes: int = max(
        1,
        _env_int(
            "ORION_MAX_ZIP_UNCOMPRESSED_BYTES",
            "MRDAA_MAX_ZIP_UNCOMPRESSED_BYTES",
            default=500 * 1024 * 1024,
        ),
    )
    openai_api_key: Optional[str] = os.environ.get("OPENAI_API_KEY")


def load_settings() -> Settings:
    """Create a :class:`Settings` instance."""

    return Settings()


def load_backend_settings() -> BackendSettings:
    """Create a :class:`BackendSettings` instance."""

    return BackendSettings()


settings = load_settings()
backend_settings = load_backend_settings()
