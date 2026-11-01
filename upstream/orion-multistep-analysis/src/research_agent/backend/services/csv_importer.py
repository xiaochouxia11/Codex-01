"""Generic CSV → SQLite importer.

Supports either a single CSV upload or a .zip containing one or more CSV files.
Creates tables named from the CSV filenames (sanitized), replacing if they
already exist in the target database.
"""

from __future__ import annotations

import re
import shutil
import sqlite3
import tempfile
import zipfile
from pathlib import Path
from typing import Iterable, List, Optional, Tuple
import csv as _csv

import pandas as pd


_SAFE_TABLE_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _sanitize_identifier(raw: str, *, prefix: str) -> str:
    """Return a SQLite-safe identifier (table/column name).

    - strips control/NUL characters
    - replaces non-alnum/underscore with underscores
    - collapses duplicate underscores
    - ensures it starts with a letter or underscore; prefixes otherwise
    - falls back to e.g. f"{prefix}_1" if empty
    """
    s = str(raw or "").strip()
    # Remove control characters (including NUL)
    s = re.sub(r"[\x00-\x1f\x7f]", "", s)
    # Normalize separators
    s = s.replace("-", "_").replace(" ", "_")
    # Replace any remaining non [A-Za-z0-9_]
    s = re.sub(r"[^A-Za-z0-9_]", "_", s)
    # Collapse multiple underscores
    s = re.sub(r"_+", "_", s)
    s = s.strip("_")
    if not s:
        return f"{prefix}_1"
    if not (s[0].isalpha() or s[0] == "_"):
        s = f"{prefix}_{s}"
    return s


def _sanitize_table_name(name: str) -> str:
    base = _sanitize_identifier(Path(name).stem, prefix="t")
    if not _SAFE_TABLE_RE.fullmatch(base):
        base = _sanitize_identifier(base, prefix="t")
    return base


def _detect_delimiter_and_header(text: str, *, candidates: Iterable[str] = (",", "\t", ";", "|")) -> Tuple[Optional[str], int]:
    """Heuristic delimiter + header row detection from a text sample.

    Returns (delimiter, header_row_index). Delimiter None means let pandas sniff.
    Header row index is 0-based line index where header appears; -1 if unknown.
    """
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return None, -1
    # Try csv.Sniffer first
    try:
        sniff = _csv.Sniffer().sniff("\n".join(lines[:10]))
        delim = sniff.delimiter
        # Find first line with at least 2 fields under this delimiter
        for idx, ln in enumerate(lines[:20]):
            if len(ln.split(delim)) >= 2:
                return delim, idx
    except Exception:
        pass
    # Fallback: score candidates by field count stability over first K lines
    K = min(20, len(lines))
    best: Tuple[Optional[str], int, int] = (None, 0, -1)  # (delim, stable_count, header_idx)
    for cand in candidates:
        counts = [len(ln.split(cand)) for ln in lines[:K]]
        # pick target count as mode over first K
        from collections import Counter
        ctr = Counter(counts)
        target, stable = ctr.most_common(1)[0]
        if target >= 2 and stable >= 3:  # require at least 3 lines agreeing
            # header row is first line matching target count
            header_idx = next((i for i, c in enumerate(counts) if c == target), 0)
            if stable > best[1]:
                best = (cand, stable, header_idx)
    if best[0] is not None:
        return best[0], best[2]
    return None, -1


def _read_csv_with_fallback(csv_path: Path) -> pd.DataFrame:
    """Read a CSV trying a few common encodings and separators.

    Falls back across encodings: utf-8, utf-8-sig, latin-1, cp1252.
    Uses Python engine with sep=None to sniff delimiters.
    """
    encodings = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]
    last_err: Exception | None = None
    for enc in encodings:
        try:
            sample = csv_path.read_text(encoding=enc, errors="replace")[:10000]
        except Exception:
            sample = ""
        delim, header_idx = _detect_delimiter_and_header(sample)
        # Try explicit delimiter candidates + pandas sniff (None)
        for sep_opt in ([delim] if delim else []) + [",", "\t", ";", "|", None]:
            # Try header at detected index and 'no header'
            for header_mode in (header_idx if header_idx >= 0 else 0, None):
                try:
                    df = pd.read_csv(
                        csv_path,
                        engine="python",
                        sep=sep_opt,
                        encoding=enc,
                        on_bad_lines="skip",
                        header=header_mode,
                        skiprows=(list(range(header_idx)) if (header_idx > 0 and header_mode == 0) else None),
                    )
                    # If zero rows, retry without skipping bad lines
                    if df.shape[0] == 0:
                        try:
                            df2 = pd.read_csv(
                                csv_path,
                                engine="python",
                                sep=sep_opt,
                                encoding=enc,
                                header=header_mode,
                                skiprows=(list(range(header_idx)) if (header_idx > 0 and header_mode == 0) else None),
                            )
                            if df2.shape[0] > 0 or df2.shape[1] > 0:
                                df = df2
                        except Exception:
                            pass
                    if df.shape[1] > 0:
                        return df
                except UnicodeDecodeError as exc:
                    last_err = exc
                    continue
                except Exception as exc:
                    last_err = exc
                    continue
    # If all attempts failed, raise a helpful error
    if last_err is None:
        last_err = RuntimeError("Unknown CSV read error")
    raise ValueError(f"Failed to read CSV '{csv_path.name}': {last_err}")


def _write_csv_to_sqlite(csv_path: Path, con: sqlite3.Connection, *, table_name: str | None = None) -> str:
    tname = table_name or _sanitize_table_name(csv_path.name)
    df = _read_csv_with_fallback(csv_path)
    # Sanitize column names to avoid invalid SQLite identifiers
    cols = list(df.columns)
    sanitized: list[str] = []
    seen: dict[str, int] = {}
    for c in cols:
        base = _sanitize_identifier(str(c), prefix="c")
        # De-duplicate if needed
        if base in seen:
            seen[base] += 1
            uniq = f"{base}_{seen[base]}"
        else:
            seen[base] = 0
            uniq = base
        sanitized.append(uniq)
    df.columns = sanitized
    df.to_sql(tname, con, if_exists="replace", index=False)
    return tname


def create_sqlite_from_csvs(target_path: Path, csv_paths: Iterable[Path]) -> Path:
    if target_path.exists():
        target_path.unlink()
    parent = target_path.parent
    parent.mkdir(parents=True, exist_ok=True)

    con = sqlite3.connect(target_path)
    try:
        created: List[str] = []
        for csv_path in csv_paths:
            created.append(_write_csv_to_sqlite(csv_path, con))
        con.execute("VACUUM;")
        con.commit()
    except Exception:
        try:
            con.close()
        finally:
            target_path.unlink(missing_ok=True)
        raise
    finally:
        con.close()
    return target_path


def _safe_extract_zip_member(
    archive: zipfile.ZipFile, member: zipfile.ZipInfo, dest_dir: Path
) -> Path:
    dest_root = dest_dir.resolve()
    relative_path = Path(member.filename)
    target_path = (dest_root / relative_path).resolve()
    try:
        target_path.relative_to(dest_root)
    except ValueError as exc:
        raise ValueError(f"Zip archive contains unsafe path '{member.filename}'") from exc

    target_path.parent.mkdir(parents=True, exist_ok=True)
    with archive.open(member) as source, target_path.open("wb") as destination:
        shutil.copyfileobj(source, destination, length=1 << 20)
    return target_path


def extract_csvs_from_zip(
    zip_path: Path,
    dest_dir: Path,
    *,
    max_members: int,
    max_uncompressed_bytes: int,
) -> List[Path]:
    dest_dir.mkdir(parents=True, exist_ok=True)
    extracted: List[Path] = []
    with zipfile.ZipFile(zip_path) as zf:
        csv_members: List[zipfile.ZipInfo] = []
        total_uncompressed = 0
        for member in zf.infolist():
            if member.is_dir():
                continue
            member_path = Path(member.filename)
            if member_path.suffix.lower() != ".csv":
                continue
            parts = set(member_path.parts)
            if "__MACOSX" in parts or member_path.name.startswith("._"):
                continue
            csv_members.append(member)
            total_uncompressed += max(member.file_size, 0)

        if len(csv_members) > max_members:
            raise ValueError(
                f"Zip archive contains too many CSV files ({len(csv_members)} > {max_members})."
            )
        if total_uncompressed > max_uncompressed_bytes:
            raise ValueError(
                "Zip archive uncompressed CSV size exceeds "
                f"{max_uncompressed_bytes} bytes."
            )

        for member in csv_members:
            extracted.append(_safe_extract_zip_member(zf, member, dest_dir))

    out: List[Path] = []
    for p in extracted:
        if not p.is_file():
            continue
        try:
            if p.stat().st_size == 0:
                continue
            # Skip AppleDouble files by magic text, if present
            head = p.open("rb").read(512)
            if b"Mac OS X" in head and b"ATTR" in head:
                continue
        except Exception:
            pass
        out.append(p)
    return out
