from __future__ import annotations

from typing import List, Optional

from research_agent.agents.contracts import AnalysisResult, LiteratureSummary, SupervisorVerdict


def basic_alignment_check(*, goal: Optional[str], analysis: AnalysisResult, literature: Optional[LiteratureSummary]) -> SupervisorVerdict:
    issues: List[str] = []
    next_steps: List[str] = []

    if not analysis.summary.get("tables"):
        issues.append("No tables discovered in database")
        next_steps.append("Verify the .db contains at least one non-internal table")

    if goal and len(goal.strip()) < 5:
        issues.append("Goal text seems too short; clarify objective")
        next_steps.append("Provide a more specific research goal (>= 5 chars)")

    aligned = len(issues) == 0
    return SupervisorVerdict(aligned=aligned, issues=issues, next_steps=next_steps, notes="Basic checks only")
