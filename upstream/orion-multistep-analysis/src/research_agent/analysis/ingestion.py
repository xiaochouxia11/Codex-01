from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd


@dataclass(slots=True)
class TableInfo:
    name: str
    row_count: Optional[int]


def list_tables(db_path: str | Path) -> List[TableInfo]:
    """Return non-internal tables and row counts (best-effort)."""
    path = str(db_path)
    con = sqlite3.connect(path)
    try:
        rows = con.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).fetchall()
        out: List[TableInfo] = []
        for (name,) in rows:
            try:
                qname = '"' + name.replace('"', '""') + '"'
                (count,) = con.execute(f"SELECT COUNT(*) FROM {qname}").fetchone()
                out.append(TableInfo(name=name, row_count=int(count)))
            except sqlite3.DatabaseError:
                out.append(TableInfo(name=name, row_count=None))
        return out
    finally:
        con.close()


def read_table(db_path: str | Path, table: str, *, limit: Optional[int] = None) -> pd.DataFrame:
    """Read a table into a pandas DataFrame (optionally limited)."""
    qname = '"' + table.replace('"', '""') + '"'
    query = f"SELECT * FROM {qname}"
    if isinstance(limit, int) and limit > 0:
        query += f" LIMIT {limit}"
    with sqlite3.connect(str(db_path)) as con:
        return pd.read_sql(query, con)


def schema_snapshot(db_path: str | Path) -> Dict[str, Dict[str, str]]:
    """Return a dict of {table: {column: type}} for quick auditing."""
    out: Dict[str, Dict[str, str]] = {}
    with sqlite3.connect(str(db_path)) as con:
        tables = con.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).fetchall()
        for (name,) in tables:
            cols: Dict[str, str] = {}
            for cid, cname, ctype, _, _, _ in con.execute(f"PRAGMA table_info('{name}')").fetchall():
                cols[str(cname)] = str(ctype or "")
            out[str(name)] = cols
    return out
