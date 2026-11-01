from __future__ import annotations

from dataclasses import asdict
from pathlib import Path
from typing import Optional

import pandas as pd

from .contracts import AnalysisResult
from research_agent.analysis.ingestion import list_tables, read_table, schema_snapshot
from research_agent.analysis.eda import quick_summary
from research_agent.analysis.stats import class_balance


def run_basic_analysis(database_path: str | Path, *, goal: Optional[str] = None) -> AnalysisResult:
    """Perform a minimal, domain-agnostic analysis over a SQLite .db.

    Currently:
    - list tables and row counts
    - capture schema snapshot
    - if a small table exists (<= 50 rows), compute a quick summary
    """
    tables = list_tables(database_path)
    schema = schema_snapshot(database_path)

    small_table_summary = None
    for t in tables:
        if t.row_count is not None and t.row_count <= 50:
            df = read_table(database_path, t.name)
            small_table_summary = {
                "table": t.name,
                "row_count": t.row_count,
                "summary": quick_summary(df),
            }
            break

    payload = {
        "tables": [asdict(t) for t in tables],
        "schema": schema,
        "small_table_summary": small_table_summary,
        "goal": goal or "",
    }
    return AnalysisResult(summary=payload, artifacts=[])
