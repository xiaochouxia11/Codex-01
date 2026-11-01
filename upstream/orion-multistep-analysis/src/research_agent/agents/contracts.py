from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Mapping, Optional, Protocol


@dataclass(slots=True)
class AnalysisResult:
    """Structured result from the data analysis agent.

    - summary: free-form, but should be JSON-serializable and transparent.
    - artifacts: list of file paths written during analysis (relative to run root).
    """

    summary: Dict[str, Any] = field(default_factory=dict)
    artifacts: List[str] = field(default_factory=list)


@dataclass(slots=True)
class LiteratureSummary:
    """Structured result from the literature agent.

    - plan: list of planned search objectives (objective, query, rationale, etc.).
    - sources: list of evidence items discovered (title, url, summary, metadata).
    - insights: synthesized takeaways that connect findings to the goal.
    - notes: optional free-form commentary (e.g., offline mode disclaimer).
    """

    plan: List[Mapping[str, Any]] = field(default_factory=list)
    sources: List[Mapping[str, Any]] = field(default_factory=list)
    insights: List[str] = field(default_factory=list)
    notes: str = ""


@dataclass(slots=True)
class SupervisorVerdict:
    """Supervisor's final verdict on alignment and quality."""

    aligned: bool
    issues: List[str] = field(default_factory=list)
    next_steps: List[str] = field(default_factory=list)
    notes: str = ""


class DataAnalysisAgent(Protocol):
    def analyze(self, *, database_path: str, goal: Optional[str] = None) -> AnalysisResult:  # pragma: no cover - interface
        ...


class LiteratureAgent(Protocol):
    def search(self, *, goal: str) -> LiteratureSummary:  # pragma: no cover - interface
        ...


class Supervisor(Protocol):
    def supervise(
        self,
        *,
        goal: Optional[str],
        analysis: AnalysisResult,
        literature: Optional[LiteratureSummary] = None,
    ) -> SupervisorVerdict:  # pragma: no cover - interface
        ...
