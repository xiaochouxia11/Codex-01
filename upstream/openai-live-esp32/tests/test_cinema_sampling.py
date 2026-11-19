import copy
import json
import sys
import tempfile
import unittest
import io
from contextlib import redirect_stdout
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import sample_cinema_catalog as sampling


class SamplingTests(unittest.TestCase):
    def catalog(self):
        return {
            "captured_at": "test",
            "total_sources": 3,
            "total_clips": 10,
            "sources": [
                {"slug": "empty", "shotCount": 0},
                {"slug": "long", "shotCount": 9},
                {"slug": "short", "shotCount": 1},
            ],
        }

    def test_unique_reproducible_extendable_draw(self):
        a = sampling.draw_positions(100, 20, "saved seed")
        self.assertEqual(a, sampling.draw_positions(100, 20, "saved seed"))
        self.assertEqual(a[:5], sampling.draw_positions(100, 5, "saved seed"))
        self.assertEqual(len(set(a)), 20)
        self.assertNotEqual(a, sampling.draw_positions(100, 20, "another seed"))
        self.assertEqual(set(sampling.draw_positions(100, 100, "x")), set(range(100)))
        for count in (0, -1, 101):
            with self.assertRaises(ValueError):
                sampling.draw_positions(100, count, "x")

    def test_global_positions_weight_films_by_clip_count(self):
        p = sampling.plan(self.catalog(), 10, "x")
        self.assertEqual(sum(d["source_slug"] == "long" for d in p["draws"]), 9)
        self.assertEqual(sum(d["source_slug"] == "short" for d in p["draws"]), 1)
        self.assertFalse(any(d["source_slug"] == "empty" for d in p["draws"]))
        self.assertEqual(
            {d["source_position"] for d in p["draws"] if d["source_slug"] == "long"},
            set(range(9)),
        )

    def test_catalog_must_be_complete_and_counts_reconciled(self):
        sources = self.catalog()["sources"]
        calls = []

        def fetch(url):
            offset = int(parse_qs(urlsplit(url).query)["offset"][0])
            calls.append(offset)
            return json.dumps(
                dict(
                    total=3,
                    totalClips=10,
                    sources=sources[offset : offset + 2],
                    hasMore=offset == 0,
                )
            ).encode()

        self.assertEqual(sampling.read_catalog(fetch)["sources"], sources)
        self.assertEqual(calls, [0, 2])
        for page in (
            dict(total=3, totalClips=11, sources=sources, hasMore=False),
            dict(total=4, totalClips=10, sources=sources, hasMore=False),
            dict(total=3, totalClips=10, sources=sources, hasMore=True),
            dict(total=3, totalClips=10, sources=[], hasMore=True),
            dict(total=3, totalClips=10, sources=sources),
        ):
            with self.assertRaises(ValueError):
                sampling.read_catalog(lambda _: json.dumps(page).encode())

    def test_capped_or_mutating_pagination_is_rejected(self):
        page = dict(
            total=2, totalClips=2, sources=[{"slug": "a", "shotCount": 1}], hasMore=True
        )
        with self.assertRaisesRegex(ValueError, "Repeated"):
            sampling.read_catalog(lambda _: json.dumps(page).encode())
        calls = 0

        def changed(_):
            nonlocal calls
            calls += 1
            p = copy.deepcopy(page)
            if calls == 2:
                p["totalClips"] = 3
            return json.dumps(p).encode()

        with self.assertRaisesRegex(ValueError, "changed"):
            sampling.read_catalog(changed)

    def test_source_count_identity_and_cache(self):
        source = {"slug": "film", "shotCount": 2}
        clips = [
            {"id": f"{i:08x}-0000-0000-0000-000000000000", "sourceSlug": "film"}
            for i in (2, 1)
        ]
        payload = {"sourceSlug": "film", "clips": clips, "metadata": {}}
        calls = 0

        def fetch(*args, **kwargs):
            nonlocal calls
            calls += 1
            return b"0:" + json.dumps(payload).encode() + b"\n"

        with tempfile.TemporaryDirectory() as tmp:
            cache = Path(tmp)
            first = sampling.read_source(source, cache, fetch)
            self.assertEqual(first[0]["id"], clips[1]["id"])
            self.assertEqual(first, sampling.read_source(source, cache, fetch))
            self.assertEqual(calls, 1)
            with self.assertRaisesRegex(ValueError, "Incomplete"):
                sampling.read_source({**source, "shotCount": 3}, cache, fetch)
            payload["clips"] = [clips[0], clips[0]]
            (cache / "film.json").unlink()
            with self.assertRaisesRegex(ValueError, "duplicate"):
                sampling.read_source(source, cache, fetch)

    def test_resolve_and_import_preserve_the_exact_draw(self):
        from prepare_stackchan_cinema import random_candidates

        catalog = self.catalog()
        sample = sampling.plan(catalog, 10, "saved")
        calls = []

        def fetch(url, **kwargs):
            slug = url.rsplit("/", 1)[-1]
            calls.append(slug)
            n = 9 if slug == "long" else 1
            clips = [
                {
                    "id": f"{i + (100 if slug == 'short' else 0):08x}-0000-0000-0000-000000000000",
                    "sourceSlug": slug,
                }
                for i in range(n)
            ]
            return (
                b"0:"
                + json.dumps(
                    {"sourceSlug": slug, "clips": list(reversed(clips))}
                ).encode()
                + b"\n"
            )

        with tempfile.TemporaryDirectory() as tmp, redirect_stdout(io.StringIO()):
            root = Path(tmp)
            result = sampling.resolve(sample, catalog, root / "sources", fetch)
            self.assertEqual(set(calls), {"long", "short"})
            for draw in result["draws"]:
                expected = draw["source_position"] + (
                    100 if draw["source_slug"] == "short" else 0
                )
                self.assertEqual(int(draw["clip"]["id"][:8], 16), expected)
            sample_path = root / "sample.json"
            sampling.save_json(root / "population.json", catalog)
            sampling.save_json(sample_path, result)
            out = root / "prepared"
            out.mkdir()
            with self.assertRaisesRegex(ValueError, "rechecked"):
                random_candidates(sample_path, out)
            result["population_rechecked_at"] = "test"
            sampling.save_json(sample_path, result)
            clips = random_candidates(sample_path, out)
            self.assertEqual(
                [c["id"] for c in clips], [d["clip"]["id"] for d in result["draws"]]
            )
            self.assertEqual(random_candidates(sample_path, out), clips)
            result["draws"][0]["global_position"] = -1
            sampling.save_json(sample_path, result)
            with self.assertRaisesRegex(ValueError, "positions"):
                random_candidates(sample_path, out)


if __name__ == "__main__":
    unittest.main()
