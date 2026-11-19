import hashlib
import io
import json
import math
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import cinema_potion as potion
import prepare_stackchan_cinema as prepare


def fixture_model():
    words = {}
    for name, axis, flags in [
        ("##s", None, 1),
        ("a", 0, 1),
        ("cat", 0, 1),
        ("cats", 0, 0),
        ("dog", 1, 1),
        ("dogs", 1, 0),
        ("hello", 0, 3),
        ("kitten", 0, 1),
        ("kittens", 0, 0),
        ("not", 0, 3),
        ("z", 2, 1),
    ]:
        values = [0.0] * 128
        if axis is not None:
            values[axis] = 1.0
        words[name] = potion.quantized(values, flags)
    return {
        "model": potion.MODEL,
        "dimensions": 128,
        "stop_words": ["hello", "not"],
        "words": dict(sorted(words.items())),
    }


class PotionTests(unittest.TestCase):
    def test_wordpiece_rollback_bounds_and_cached_lexemes(self):
        m = fixture_model()
        self.assertEqual(
            potion.token_names("CAT, kittens!", m), ["cat", "kitten", "##s"]
        )
        self.assertEqual(potion.pieces("ax", m), [])
        self.assertEqual(potion.token_names("ax cat", m), ["cat"])
        self.assertEqual(potion.token_names("a" * 101, m), [])
        self.assertEqual(potion.token_names(" " * 2048 + "cat", m), [])
        self.assertEqual(potion.token_names("cat\0dog", m), ["cat"])
        self.assertEqual(len(potion.token_names("cat " * 300, m)), 256)
        self.assertEqual(potion.token_names("猫 CAT🙂dog", m), ["cat", "dog"])

    def test_pooling_and_whole_word_evidence(self):
        m = fixture_model()
        v = potion.embed("cat dog", m)
        self.assertAlmostEqual(v[0], 1 / math.sqrt(2), places=6)
        self.assertAlmostEqual(v[1], v[0])
        q, terms, threshold, weights = potion.query("hello kittens kittens", m)
        self.assertEqual(q[0], 1)
        self.assertEqual(len(terms), 1)
        self.assertEqual(threshold, [0.9])
        self.assertGreater(weights[0], 0)
        self.assertEqual(potion.query("cat", m)[2], [0.65])
        for text in (
            "",
            "hello",
            "ax",
            "猫",
            "cat not dog",
            "cat without dog",
            "cat don't",
            "cat can ' t",
            "cat cannot",
        ):
            with self.assertRaises(ValueError):
                potion.query(text, m)
        m["words"]["morning"] = m["words"]["cat"]
        m["stop_words"].append("good")
        with self.assertRaises(ValueError):
            potion.query("Good morning", m)
        self.assertEqual(
            len(potion.query("good " + "x" * 101 + " morning cats", m)[1]), 1
        )

    def test_caption_scope_and_no_quoted_subject_evidence(self):
        text = "Three black-and-white frames show a tabby kitten. It turns its head. Visual associations include outer space."
        primary, context = potion.document_parts(text)
        self.assertEqual(primary, "a tabby kitten.")
        self.assertIn("turns its head", context)
        self.assertNotIn("outer space", context)
        keys = potion.keywords('A black title card with text reading "cats in space".')
        self.assertNotIn("cats", keys)
        self.assertNotIn("space", keys)
        self.assertNotIn("hello", potion.content_words("hello cat"))

    def test_confidence_uses_caption_evidence(self):
        m = fixture_model()
        docs = [potion.embed("cat", m), potion.embed("dog", m), potion.embed("z", m)]
        keys = [["kitten"], ["dog"], []]
        self.assertEqual(potion.rank("kittens", m, docs, keys)[0]["index"], 0)
        self.assertEqual(potion.rank("dogs", m, docs, keys)[0]["index"], 1)
        self.assertEqual(potion.rank("z", m, docs, keys), [])
        # Neither candidate shows both equally salient subjects. Matching one
        # must not average away the missing evidence for the other.
        self.assertEqual(potion.rank("cat dog", m, docs, keys), [])

    def test_model_digest_rejected_before_loading(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)
            (p / "model.safetensors").write_bytes(b"not a trusted model")
            with self.assertRaisesRegex(ValueError, "digest mismatch"):
                potion.build(p, [], p / "encoder.json")
            self.assertFalse((p / "encoder.json").exists())

    def test_potion_export_keeps_media_ids_and_inspector_parity(self):
        from stackchan_cinema import Pack

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            records = []
            for subject in ("cats", "dogs"):
                folder = root / "clips" / subject
                folder.mkdir(parents=True)
                movie = prepare.make_film([b"\xff\xd8test\xff\xd9"])
                (folder / "film.scf").write_bytes(movie)
                records.append(
                    {
                        "archive": {"id": subject, "sourceId": subject},
                        "caption": {"description": subject, "mood": "calm"},
                        "bytes": len(movie),
                        "sha256": hashlib.sha256(movie).hexdigest(),
                    }
                )
            (root / "README.md").write_text(
                "Synthetic model fixture; no pretrained assets."
            )

            def build(_source, _texts, output):
                m = fixture_model()
                output.write_text(json.dumps(m, separators=(",", ":")))
                return m

            with (
                patch.object(potion, "build", side_effect=build),
                redirect_stdout(io.StringIO()),
            ):
                prepare.export(records, root, None, 1, root)
            pack = Pack(root / "pack")
            self.assertEqual(pack.catalog["dimensions"], 128)
            self.assertEqual(pack.search("kittens")[0]["index"], 0)
            self.assertEqual(pack.search("dogs")[0]["index"], 1)
            self.assertIn(
                "CINEMA_ENCODER_POTION", (root / "pack/CinemaAssets.hpp").read_text()
            )
            for i, clip in enumerate(pack.catalog["clips"]):
                self.assertEqual(clip["archive"]["id"], records[i]["archive"]["id"])
                self.assertEqual(clip["sha256"], records[i]["sha256"])
            for v in pack.embeddings["vectors"]:
                self.assertEqual(len(v), 128)
                self.assertAlmostEqual(sum(x * x for x in v), 1)


if __name__ == "__main__":
    unittest.main()
