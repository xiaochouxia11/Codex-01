"""Backend service package for the Multistep Research & Analysis Agentic Framework.

Currently exposes a FastAPI application that fronts the existing
agent orchestration utilities. The module intentionally keeps the
surface area small so downstream code can import the app directly
into ASGI servers (uvicorn, hypercorn, etc.).
"""

from .main import app

__all__ = ["app"]
