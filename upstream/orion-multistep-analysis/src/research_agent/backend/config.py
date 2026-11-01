"""Centralised configuration for the backend service.

The module purposely avoids third-party configuration helpers so the
service stays lightweight; environment variables are read directly and
converted into strongly-typed dataclasses. This keeps the eventual
FastAPI dependency surface minimal while still making it easy to mock
settings in unit tests.
"""

from __future__ import annotations

from research_agent.config import BackendSettings, backend_settings as settings

__all__ = ["BackendSettings", "settings"]
