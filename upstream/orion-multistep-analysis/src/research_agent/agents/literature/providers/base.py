from __future__ import annotations

from typing import Protocol

from research_agent.agents.contracts import LiteratureSummary


class Provider(Protocol):
    def search(self, *, query: str) -> LiteratureSummary:  # pragma: no cover - interface
        ...
