"""Route aggregation for the backend FastAPI app."""

from fastapi import APIRouter

from . import databases, prompts, runs, system

api_router = APIRouter()
api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(databases.router, prefix="/databases", tags=["databases"])
api_router.include_router(prompts.router, prefix="/prompts", tags=["prompts"])
api_router.include_router(runs.router, prefix="/runs", tags=["runs"])

__all__ = ["api_router"]
