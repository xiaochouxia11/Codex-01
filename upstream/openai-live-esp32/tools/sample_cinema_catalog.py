#!/usr/bin/env python3
"""Uniform clip sampling from the archive's complete public film catalog.

The /api/clips browse feed caps offsets. Instead, enumerate /api/sources,
reconcile its shot counts with totalClips, and sample global clip positions.
Only selected films need their public source pages fetched. No search queries,
per-film caps, duration filters, or caption judgments influence the raw draw.
"""

import argparse
import bisect
import hashlib
import json
import random
import re
import secrets
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

from prepare_stackchan_cinema import ARCHIVE, read_rsc, request, save_json


def digest(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def read_catalog(fetch=request):
    sources, seen = [], set()
    expected = None
    for _ in range(1000):
        params = urlencode(
            dict(sort="alpha", direction="asc", offset=len(sources), limit=100)
        )
        page = json.loads(fetch(ARCHIVE + "/api/sources?" + params))
        totals = (page.get("total"), page.get("totalClips"))
        if any(type(n) is not int or n < 1 for n in totals):
            raise ValueError("Missing catalog population counts")
        if expected is not None and totals != expected:
            raise ValueError(
                "Catalog changed during enumeration; retry a fresh snapshot"
            )
        expected = totals
        batch = page.get("sources")
        if not isinstance(batch, list) or not batch or len(batch) > 100:
            raise ValueError("Incomplete or invalid catalog page")
        for source in batch:
            slug, count = source.get("slug"), source.get("shotCount")
            if (
                not isinstance(slug, str)
                or not re.fullmatch(r"[a-zA-Z0-9_-]{1,200}", slug)
                or type(count) is not int
                or count < 0
            ):
                raise ValueError("Invalid source identity/count")
            if slug in seen:
                raise ValueError("Repeated source: pagination is unstable or capped")
            seen.add(slug)
            sources.append(source)
        if type(page.get("hasMore")) is not bool:
            raise ValueError("Missing pagination completion marker")
        if not page["hasMore"]:
            if (
                len(sources) != expected[0]
                or sum(s["shotCount"] for s in sources) != expected[1]
            ):
                raise ValueError("Source counts do not reconcile with the full catalog")
            # Canonical order does not depend on gallery curation or tie ordering.
            return {
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "total_sources": expected[0],
                "total_clips": expected[1],
                "sources": sorted(sources, key=lambda s: s["slug"]),
            }
        if len(sources) >= expected[0]:
            raise ValueError("Catalog hasMore disagrees with total")
    raise ValueError("Catalog exceeds enumeration bound; refusing a partial sample")


def population(catalog):
    return [(s["slug"], s["shotCount"]) for s in catalog["sources"]]


def draw_positions(total, count, seed):
    if not 1 <= count <= min(total, 30000):
        raise ValueError("Sample size must be 1..min(population, 30000)")
    # Rejection sampling without replacement: every remaining position has
    # equal probability. Extending a sample preserves its earlier prefix.
    rng = random.Random(seed)
    positions, seen = [], set()
    while len(positions) < count:
        n = rng.randrange(total)
        if n not in seen:
            positions.append(n)
            seen.add(n)
    return positions


def plan(catalog, count, seed):
    sources = catalog["sources"]
    ends, total = [], 0
    for source in sources:
        total += source["shotCount"]
        ends.append(total)
    if total != catalog["total_clips"]:
        raise ValueError("Population does not match catalog")
    draws = []
    for position in draw_positions(total, count, seed):
        source_index = bisect.bisect_right(ends, position)
        draws.append(
            {
                "global_position": position,
                "source_slug": sources[source_index]["slug"],
                "source_position": position
                - (ends[source_index - 1] if source_index else 0),
            }
        )
    return {
        "schema": 1,
        "method": "uniform-clip-positions-without-replacement-v1",
        "seed": seed,
        "population_sha256": digest(population(catalog)),
        "total_sources": len(sources),
        "total_clips": total,
        "catalog_captured_at": catalog["captured_at"],
        "draws": draws,
        "resolved": False,
    }


def read_source(source, cache, fetch=request):
    slug = source["slug"]
    path = cache / (slug + ".json")
    fingerprint = digest(source)
    value = json.loads(path.read_text()) if path.exists() else None
    if not value or value.get("source_sha256") != fingerprint:
        url = ARCHIVE + "/sources/" + slug
        nodes = read_rsc(fetch(url, headers={"RSC": "1"}, limit=16 * 1024 * 1024))
        found = None
        while nodes:
            node = nodes.pop()
            if isinstance(node, dict):
                if node.get("sourceSlug") == slug and isinstance(
                    node.get("clips"), list
                ):
                    found = node
                    break
                nodes.extend(node.values())
            elif isinstance(node, list):
                nodes.extend(node)
        if found is None:
            raise ValueError(f"No complete source page: {slug}")
        value = {"source_sha256": fingerprint, "source": found}
    clips = value["source"]["clips"]
    ids = [c.get("id") for c in clips]
    if (
        len(clips) != source["shotCount"]
        or any(
            not isinstance(i, str)
            or not re.fullmatch(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}", i)
            for i in ids
        )
        or len(set(ids)) != len(ids)
        or any(c.get("sourceSlug") != slug for c in clips)
    ):
        raise ValueError(f"Incomplete, duplicate or changed source clips: {slug}")
    save_json(path, value)
    # Position is within the film's canonical ID order, not a search rank.
    return sorted(clips, key=lambda c: c["id"])


def resolve(sample, catalog, cache, fetch=request):
    if sample["population_sha256"] != digest(population(catalog)):
        raise ValueError("Sample population changed")
    by_source = defaultdict(list)
    for draw in sample["draws"]:
        by_source[draw["source_slug"]].append(draw)
    sources = {s["slug"]: s for s in catalog["sources"]}
    seen = set()
    for n, (slug, draws) in enumerate(by_source.items(), 1):
        clips = read_source(sources[slug], cache, fetch)
        for draw in draws:
            clip = clips[draw["source_position"]]
            if clip["id"] in seen:
                raise ValueError("Duplicate clip ID across source films")
            seen.add(clip["id"])
            draw["clip"] = clip
        print(
            f"Resolved films {n}/{len(by_source)}; clips {len(seen)}/{len(sample['draws'])}",
            flush=True,
        )
    sample["resolved"] = True
    sample["resolved_at"] = datetime.now(timezone.utc).isoformat()
    return sample


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--count", type=int, default=250)
    parser.add_argument(
        "--seed", help="Omit to generate and save a random seed; reruns reuse it"
    )
    parser.add_argument(
        "--plan-only",
        action="store_true",
        help="Draw positions without fetching selected film pages",
    )
    args = parser.parse_args()
    root = args.output.expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    catalog_path, sample_path = root / "population.json", root / "sample.json"
    catalog = (
        json.loads(catalog_path.read_text())
        if catalog_path.exists()
        else read_catalog()
    )
    save_json(catalog_path, catalog)
    previous = json.loads(sample_path.read_text()) if sample_path.exists() else {}
    seed = (
        args.seed
        if args.seed is not None
        else previous.get("seed", secrets.token_hex(16))
    )
    sample = plan(catalog, args.count, seed)
    save_json(sample_path, sample)  # Save the exact draw before any fetch can fail.
    print(
        f"Population: {catalog['total_clips']} clips / {catalog['total_sources']} films; seed={seed}",
        flush=True,
    )
    if not args.plan_only:
        sample = resolve(sample, catalog, root / "sources")
        fresh = read_catalog()
        if population(fresh) != population(catalog):
            raise ValueError(
                "Catalog population changed; raw draw retained, not certified complete"
            )
        sample["population_rechecked_at"] = fresh["captured_at"]
        save_json(sample_path, sample)
    print(f"Saved {sample_path}", flush=True)


if __name__ == "__main__":
    main()
