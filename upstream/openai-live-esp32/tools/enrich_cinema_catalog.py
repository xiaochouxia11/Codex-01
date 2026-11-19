#!/usr/bin/env python3
"""Retain archive synopses and refresh readable metadata without changing movies.

Run after pack preparation, never concurrently with it. Missing source pages
are fetched once per film using the preparer's bounded, rate-limited requests.
No OpenAI API requests are made. Metadata remains external to the repository.
"""

import argparse
import json
from pathlib import Path

from prepare_stackchan_cinema import export_metadata, provenance, save_json


def enrich(root):
    records = json.loads((root / "selected.json").read_text())
    catalog = json.loads((root / "pack/catalog.json").read_text())
    if [r["archive"]["id"] for r in records] != [
        c["archive"]["id"] for c in catalog["clips"]
    ]:
        raise ValueError("Selection and pack clip IDs differ")
    for record, clip in zip(records, catalog["clips"]):
        if any(
            value != clip.get(key)
            for key, value in record.items()
            if key != "provenance"
        ):
            raise ValueError("Selection differs from the prepared media or captions")
    seen = {}
    for i, record in enumerate(records):
        slug = record["archive"]["sourceSlug"]
        if slug not in seen:
            rights = provenance(record["archive"], root)
            if "synopsis" not in rights:
                rights = provenance(record["archive"], root, refresh=True)
            seen[slug] = rights
        record["provenance"] = seen[slug]
        if i % 100 == 0:
            print(f"Enriched {i + 1}/{len(records)} clips", flush=True)
    export_metadata(records, root / "pack", catalog["pack_digest"])
    for clip, record in zip(catalog["clips"], records):
        clip["provenance"] = record["provenance"]
    save_json(root / "pack/catalog.json", catalog)
    save_json(root / "selected.json", records)
    print(
        f"Retained {sum(bool(r.get('synopsis')) for r in seen.values())}/{len(seen)} film synopses; movie files and index identity unchanged",
        flush=True,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    enrich(parser.parse_args().output)
