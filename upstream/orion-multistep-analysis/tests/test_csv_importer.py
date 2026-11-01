import sqlite3
import zipfile
from pathlib import Path

import pytest

from research_agent.backend.services import csv_importer


def _table_names(con: sqlite3.Connection) -> list[str]:
    return [row[0] for row in con.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()]


def _table_columns(con: sqlite3.Connection, table: str) -> list[str]:
    return [row[1] for row in con.execute(f"PRAGMA table_info({table})").fetchall()]


def test_create_sqlite_from_csvs_and_schema(tmp_path: Path) -> None:
    csv_path = tmp_path / "people-data.csv"
    csv_path.write_text("First Name,Age\nAlice,30\nBob,25\n", encoding="utf-8")

    db_path = tmp_path / "out.db"
    csv_importer.create_sqlite_from_csvs(db_path, [csv_path])

    with sqlite3.connect(db_path) as con:
        assert _table_names(con) == ["people_data"]
        assert _table_columns(con, "people_data") == ["First_Name", "Age"]
        assert con.execute("SELECT COUNT(*) FROM people_data").fetchone()[0] == 2


def test_extract_csvs_from_zip_and_import(tmp_path: Path) -> None:
    csv_a = tmp_path / "alpha.csv"
    csv_b = tmp_path / "bravo.csv"
    csv_a.write_text("a,b\n1,2\n", encoding="utf-8")
    csv_b.write_text("x,y\n3,4\n5,6\n", encoding="utf-8")

    zip_path = tmp_path / "bundle.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.write(csv_a, arcname="alpha.csv")
        zf.write(csv_b, arcname="nested/bravo.csv")
        zf.writestr("__MACOSX/._alpha.csv", "")
        zf.writestr("empty.csv", "")

    extracted = csv_importer.extract_csvs_from_zip(zip_path, tmp_path / "extracted")
    extracted_names = sorted(p.name for p in extracted)
    assert extracted_names == ["alpha.csv", "bravo.csv"]

    db_path = tmp_path / "zip.db"
    csv_importer.create_sqlite_from_csvs(db_path, extracted)

    with sqlite3.connect(db_path) as con:
        assert _table_names(con) == ["alpha", "bravo"]
        assert con.execute("SELECT COUNT(*) FROM alpha").fetchone()[0] == 1
        assert con.execute("SELECT COUNT(*) FROM bravo").fetchone()[0] == 2


def test_create_sqlite_from_csvs_bad_input(tmp_path: Path) -> None:
    bad_csv = tmp_path / "bad.csv"
    bad_csv.write_bytes(b"")

    with pytest.raises(ValueError):
        csv_importer.create_sqlite_from_csvs(tmp_path / "bad.db", [bad_csv])
