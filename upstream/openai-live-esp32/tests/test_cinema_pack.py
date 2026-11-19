import sys
import importlib.util
import math
import struct
import unittest
import json
import hashlib
import io
from contextlib import redirect_stdout
import tempfile
import threading
from unittest.mock import patch
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

spec = importlib.util.spec_from_file_location(
    "cinema", Path(__file__).resolve().parents[1] / "tools/prepare_stackchan_cinema.py"
)
cinema = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cinema)


class CinemaPackTests(unittest.TestCase):
    def test_readable_catalog_preserves_utf8_and_labels_evidence(self):
        import re

        records = [
            {
                "archive": {"sourceTitle": 'Harbor "film"'},
                "caption": {
                    "description": "A café, 船 and 🙂.\nA second view.",
                    "mood": "calm",
                    "model": "caption-model",
                },
                "duration_seconds": 8,
            },
            {
                "archive": {"sourceTitle": "Sports"},
                "caption": {
                    "description": "Coarse context only",
                    "mood": "archival",
                    "model": "archive-search-context",
                },
                "duration_seconds": 6,
            },
        ]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            cinema.export_metadata(records, path, "a" * 64)
            text = (path / "CinemaMetadata.hpp").read_text()
            self.assertIn('METADATA_DIGEST[] = "' + "a" * 64 + '"', text)
            table = text.split("CATALOG_TEXT[] =\n", 1)[1].split(";\n", 1)[0]
            raw = bytes(int(n, 8) for n in re.findall(r"\\([0-7]{3})", table))
            self.assertEqual(
                raw.decode().split("\0")[:-1],
                [
                    'Harbor "film"',
                    "A café, 船 and 🙂.\nA second view.",
                    "calm",
                    cinema.film_context(records[0]),
                    "Sports",
                    "Coarse context only",
                    "archival",
                    cinema.film_context(records[1]),
                ],
            )
            self.assertIn("8.000000f,1u", text)
            self.assertIn("6.000000f,2u", text)
            for description in ("\0", "a" * 4097, "\ud800"):
                records[0]["caption"]["description"] = description
                with self.assertRaises((ValueError, UnicodeError)):
                    cinema.export_metadata(records, path, "a" * 64)
            records[0]["caption"]["description"] = "valid"
            for duration in (-1, float("nan"), 145, True):
                records[0]["duration_seconds"] = duration
                with self.assertRaises(ValueError):
                    cinema.export_metadata(records, path, "a" * 64)
            with self.assertRaises(ValueError):
                cinema.export_metadata([], path, "a" * 64)
            with self.assertRaises(ValueError):
                cinema.export_metadata(records, path, '"; invalid C++')

    def test_exact_match_recalled_outside_semantic_shortlist(self):
        from collections import OrderedDict
        from stackchan_cinema import Pack
        from cinema_embedding import MODEL

        # The only sports clip is outside all 64 pooled-vector candidates.
        # Exact keyword recall must rescue it, then the confidence gate must
        # reject an absent subject instead of returning arbitrary footage.
        pack = Pack.__new__(Pack)
        pack.encoder = {
            "model": MODEL,
            "words": {
                "sports": {"q": [127, 0, 0] + [0] * 47, "norm": 127, "scale": 1},
                "office": {"q": [0, 127, 0] + [0] * 47, "norm": 127, "scale": 1},
                "basketball": {"q": [0, 0, 127] + [0] * 47, "norm": 127, "scale": 1},
            },
        }
        pack.catalog = {
            "clips": [{"keywords": ["office"]} for _ in range(70)]
            + [{"keywords": ["sports"]}]
        }
        pack.embeddings = {
            "vectors": [[1, 0, 0] + [0] * 47 for _ in range(70)]
            + [[0.1, 0.995, 0] + [0] * 47]
        }
        pack.cache, pack.lock = OrderedDict(), threading.Lock()
        result = pack.search("sports")
        self.assertEqual(result[0]["index"], 70)
        self.assertGreater(result[0]["score"], 0.72)
        self.assertEqual(pack.search("basketball"), [])

    @unittest.skipUnless(
        importlib.util.find_spec("numpy"), "optional preparation dependency"
    )
    def test_export_roundtrip_matches_local_viewer(self):
        from stackchan_cinema import Pack

        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            records = []
            words = {}
            for i, subject in enumerate(("cats", "dogs")):
                directory = root / "clips" / subject
                directory.mkdir(parents=True)
                film = cinema.make_film([b"\xff\xd8test\xff\xd9"])
                (directory / "film.scf").write_bytes(film)
                records.append(
                    {
                        "archive": {"id": subject, "sourceId": subject},
                        "caption": {"description": subject, "mood": "calm"},
                        "bytes": len(film),
                        "sha256": hashlib.sha256(film).hexdigest(),
                    }
                )
                q = [0] * 50
                q[i] = 127
                words[subject] = {"q": q, "norm": 127.0, "scale": 1.0}
            model = {"words": words}

            def build_model(_archive, _texts, output):
                Path(output).write_text(json.dumps(model, separators=(",", ":")))
                return model

            with (
                patch.object(cinema.cinema_embedding, "build", side_effect=build_model),
                redirect_stdout(io.StringIO()),
            ):
                cinema.export(records, root, root / "unused.zip", 1)
            pack = Pack(root / "pack")
            self.assertTrue((root / "pack/CinemaMetadata.hpp").exists())
            self.assertEqual(pack.search("cats")[0]["index"], 0)
            self.assertEqual(pack.search("dogs")[0]["index"], 1)
            self.assertEqual(sum(c["fallback"] for c in pack.catalog["clips"]), 1)
            self.assertEqual(
                (root / "pack/encoder.json").read_bytes(),
                (root / "local-encoder.json").read_bytes(),
            )
            model["words"]["cats"]["scale"] = 2.0
            (root / "pack/encoder.json").write_text(json.dumps(model))
            with self.assertRaisesRegex(ValueError, "Encoder does not match"):
                Pack(root / "pack")

    def test_fresh_discovery_and_cached_resume(self):
        clip = {
            "id": "12345678-1234-1234-1234-123456789abc",
            "durationSeconds": 8,
            "sourceId": "film",
        }
        with tempfile.TemporaryDirectory() as folder:
            with (
                patch.object(cinema, "THEMES", ["cats"]),
                patch.object(
                    cinema,
                    "request",
                    return_value=json.dumps(
                        {"clips": [clip], "hasMore": False}
                    ).encode(),
                ) as fetch,
            ):
                result = cinema.discover(Path(folder), 2)
                self.assertEqual([c["id"] for c in result], [clip["id"]])
                self.assertEqual(cinema.discover(Path(folder), 2), result)
                self.assertEqual(fetch.call_count, 1)

    def test_random_preparation_records_exclusions_without_replacement(self):
        clips = [{"id": str(i)} for i in range(3)]

        def prepare(c, *args):
            if c["id"] == "2":
                raise ValueError("download failed")
            return {
                "archive": c,
                "caption": {"usable": c["id"] == "0", "model": "test"},
            }

        with tempfile.TemporaryDirectory() as folder, redirect_stdout(io.StringIO()):
            root = Path(folder)
            with (
                patch.object(
                    sys,
                    "argv",
                    [
                        "prepare",
                        "--output",
                        folder,
                        "--sample",
                        "sample.json",
                        "--word-vectors",
                        "unused.zip",
                        "--metadata-only",
                    ],
                ),
                patch.object(cinema, "random_candidates", return_value=clips),
                patch.object(cinema, "prepare_one", side_effect=prepare) as work,
                patch.object(cinema, "discover") as discover,
                patch.object(cinema, "export") as export,
            ):
                cinema.main()
            discover.assert_not_called()
            self.assertEqual(work.call_count, 3)
            self.assertEqual(
                [r["archive"]["id"] for r in export.call_args.args[0]], ["0"]
            )
            report = json.loads((root / "selection-report.json").read_text())
            self.assertEqual(report["raw_draw_count"], 3)
            self.assertEqual(report["prepared_count"], 1)
            self.assertEqual(report["replacement_draws"], 0)
            self.assertEqual({r["id"] for r in report["excluded"]}, {"1", "2"})

    def test_container_offsets_and_crc(self):
        frames = [b"\xff\xd8abc\xff\xd9", b"\xff\xd8defgh\xff\xd9"]
        data = cinema.make_film(frames)
        header = struct.unpack_from("<8sHHHHIIII", data)
        self.assertEqual(header[:6], (b"SCFILM1\0", 320, 240, 12, 2, len(data)))
        self.assertEqual(struct.unpack_from("<IIII", data, 32), (48, 7, 55, 9))
        self.assertEqual(zlib.crc32(data[48:]), header[7])
        for invalid in (
            [],
            [b"not jpeg"],
            [b"\xff\xd8" + b"a" * 32768 + b"\xff\xd9"],
            frames * 73,
        ):
            with self.assertRaises(ValueError):
                cinema.make_film(invalid)
        with self.assertRaises(ValueError):
            cinema.make_film(frames, fps=60)

    def test_quantization_preserves_cosine(self):
        original = cinema.vector([math.sin(i * 0.17) for i in range(cinema.DIMENSIONS)])
        q, norm = cinema.quantize(original)
        self.assertEqual(max(map(abs, q)), 127)
        self.assertGreater(sum(a * b for a, b in zip(original, q)) / norm, 0.9999)
        for bad in (
            [0] * cinema.DIMENSIONS,
            [1] * (cinema.DIMENSIONS - 1),
            [float("nan")] * cinema.DIMENSIONS,
            [float("inf")] * cinema.DIMENSIONS,
        ):
            with self.assertRaises(ValueError):
                cinema.vector(bad)

    def test_rsc_text_cannot_inject_records(self):
        text = b'fake\na:{"injected":true}\n'
        data = (
            b'0:{"ok":1}\n1:T'
            + f"{len(text):x}".encode()
            + b","
            + text
            + b'2:["real"]\n'
        )
        self.assertEqual(cinema.read_rsc(data), [{"ok": 1}, ["real"]])
        with self.assertRaises(ValueError):
            cinema.read_rsc(b"1:T100,short")


if __name__ == "__main__":
    unittest.main()
