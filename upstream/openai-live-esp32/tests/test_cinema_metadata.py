import copy
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from cinema_metadata import film_context
from enrich_cinema_catalog import enrich


class MetadataTests(unittest.TestCase):
    def record(self):
        return {
            "archive": {
                "id": "clip-a",
                "sourceSlug": "film-a",
                "sourceTitle": "Harbor",
                "sourceYear": 1949,
            },
            "caption": {"description": "A boat", "mood": "calm"},
            "provenance": {
                "page": "https://example.org/film",
                "synopsis": "Documentary about a harbor.\nIncludes a sports festival.",
                "metadata": {
                    "creator": "A filmmaker",
                    "original_collection": "Archive",
                },
            },
        }

    def test_film_scope_is_distinct_and_missing_synopsis_is_explicit(self):
        row = self.record()
        context = film_context(row)
        self.assertIn("not a description of every frame", context)
        self.assertIn("Year: 1949", context)
        self.assertIn(
            "Archive synopsis: Documentary about a harbor. Includes a sports festival.",
            context,
        )
        self.assertNotIn("A boat", context)
        self.assertLess(context.index("Archive synopsis:"), context.index("Creator:"))
        self.assertLess(
            context.index("Archive synopsis:"), context.index("Archive page:")
        )
        del row["provenance"]["synopsis"]
        self.assertIn("unavailable", film_context(row))

    def test_utf8_bounded_excerpt_and_no_hidden_nuls(self):
        row = self.record()
        for field in ("sourceTitle", "sourceYear"):
            row["archive"][field] = "船🙂" * 512
        row["provenance"]["synopsis"] = "café 船🙂 " * 4096
        context = film_context(row)
        self.assertLessEqual(len(context.encode()), 4096)
        self.assertIn("synopsis excerpt; full text at archive page", context)
        self.assertNotIn("\ufffd", context)
        for invalid in (True, 0, [], {"text": "hello"}, "\0", "\ud800"):
            row["provenance"]["synopsis"] = invalid
            with self.assertRaises((ValueError, UnicodeError)):
                film_context(row)

    def test_enrichment_deduplicates_films_and_preserves_identity(self):
        row = self.record()
        other = copy.deepcopy(row)
        other["archive"]["id"] = "clip-b"
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "pack").mkdir()
            (root / "selected.json").write_text(json.dumps([row, other]))
            catalog = {"pack_digest": "a" * 64, "clips": [row, other]}
            (root / "pack/catalog.json").write_text(json.dumps(catalog))
            rights = row["provenance"] | {"synopsis": "An updated source synopsis."}
            with patch(
                "enrich_cinema_catalog.provenance", return_value=rights
            ) as fetch:
                enrich(root)
                self.assertEqual(fetch.call_count, 1)
            result = json.loads((root / "pack/catalog.json").read_text())
            self.assertEqual(result["pack_digest"], catalog["pack_digest"])
            self.assertEqual(result["clips"][1]["provenance"], rights)
            text = (root / "pack/CinemaMetadata.hpp").read_text()
            # Shared film text has a single copy in flash, not one per clip.
            self.assertIn("uint32_t film_context", text)
            table = text.split("CATALOG_TEXT[] =\n", 1)[1].split(";\n", 1)[0]
            raw = bytes(int(n, 8) for n in re.findall(r"\\([0-7]{3})", table)).decode()
            self.assertEqual(raw.count(film_context(result["clips"][0])), 1)
            for key in ("archive", "caption"):
                self.assertEqual(result["clips"][0][key], row[key])
            changed = copy.deepcopy(result)
            changed["clips"][0]["caption"]["description"] = "Different caption"
            (root / "pack/catalog.json").write_text(json.dumps(changed))
            before = (root / "pack/CinemaMetadata.hpp").read_bytes()
            with patch("enrich_cinema_catalog.provenance") as fetch:
                with self.assertRaises(ValueError):
                    enrich(root)
                fetch.assert_not_called()
            self.assertEqual((root / "pack/CinemaMetadata.hpp").read_bytes(), before)
            result["clips"].reverse()
            (root / "pack/catalog.json").write_text(json.dumps(result))
            before = (root / "pack/CinemaMetadata.hpp").read_bytes()
            with patch("enrich_cinema_catalog.provenance") as fetch:
                with self.assertRaises(ValueError):
                    enrich(root)
                fetch.assert_not_called()
            self.assertEqual((root / "pack/CinemaMetadata.hpp").read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
