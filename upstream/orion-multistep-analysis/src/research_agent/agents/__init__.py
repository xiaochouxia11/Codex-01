"""Agent package for domain-agnostic research workflow."""

from .contracts import AnalysisResult, LiteratureSummary, SupervisorVerdict
from .data_analysis import run_basic_analysis
from .literature import plan_queries
from .runtime import agent_inner_loop, build_supervisor_context, chat

__all__ = [
    "AnalysisResult",
    "LiteratureSummary",
    "SupervisorVerdict",
    "run_basic_analysis",
    "plan_queries",
    "agent_inner_loop",
    "build_supervisor_context",
    "chat",
]
