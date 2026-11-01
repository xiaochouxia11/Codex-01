"""ASGI entry point for the backend service."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import api_router


def _default_origins() -> list[str]:
    return ["http://localhost:3000", "http://127.0.0.1:3000"]


app = FastAPI(
    title="Multistep Research & Analysis Agentic Framework API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_default_origins(),
    # Support local frontend dev servers on dynamic ports (e.g., Vite fallback to 3001/3002).
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/ping", tags=["system"])
def ping() -> dict:
    return {"status": "ok"}


app.include_router(api_router, prefix="/api")
