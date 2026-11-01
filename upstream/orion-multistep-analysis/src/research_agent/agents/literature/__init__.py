from __future__ import annotations

from typing import Optional

from research_agent.agents.contracts import LiteratureSummary


def plan_queries(*, goal: Optional[str]) -> LiteratureSummary:
    """Return an offline literature search plan when the live agent cannot run."""

    goal_text = (goal or "").strip() or "general research question"

    plan = [
        {
            "objective": "Establish background and key terms",
            "query": goal_text,
            "rationale": "Find surveys, reviews, or authoritative overviews to align terminology and scope.",
            "suggested_sources": ["Google Scholar", "Semantic Scholar", "arXiv", "SSRN"],
            "filters": ["last_5_years", "review|survey"],
        },
        {
            "objective": "Identify recent methods, baselines, and benchmarks",
            "query": f"{goal_text} benchmark OR baseline OR evaluation",
            "rationale": "Surface common datasets, metrics, and baselines so analysis choices match prior work.",
            "suggested_sources": ["arXiv", "OpenReview", "Conference proceedings"],
            "filters": ["last_3_years"],
        },
        {
            "objective": "Find implementations, datasets, and practical guidance",
            "query": f"{goal_text} dataset OR open-source OR github",
            "rationale": "Locate reference implementations, data schemas, or pipelines that can inform reproducible work.",
            "suggested_sources": ["GitHub", "Zenodo", "Documentation/blogs (for tools)"],
            "filters": ["open_source|open_data"],
        },
        {
            "objective": "Scan prior art and patents (if relevant)",
            "query": f"{goal_text} patent OR prior art",
            "rationale": "Surface patents that might affect reuse/commercialization and identify related prior art.",
            "suggested_sources": ["Google Patents", "USPTO", "EPO"],
            "filters": ["latest"],
        },
    ]

    return LiteratureSummary(
        plan=plan,
        sources=[],
        insights=[],
        notes="Offline mode: generated default literature plan.",
    )
