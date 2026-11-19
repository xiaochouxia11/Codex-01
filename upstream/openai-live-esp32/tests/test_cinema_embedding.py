import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import cinema_embedding as embedding


class EmbeddingTests(unittest.TestCase):
    def model(self):
        return {
            "words": {
                "cats": {"q": [127, 0] + [0] * 48, "scale": 1.0, "norm": 127.0},
                "dogs": {"q": [0, 127] + [0] * 48, "scale": 2.0, "norm": 127.0},
            }
        }

    def test_bounded_ascii_tokenization(self):
        self.assertEqual(embedding.tokens("CATS\x00dogs"), ["cats"])
        self.assertEqual(
            embedding.tokens("🙂 CATS " + "x" * 49 + " 123"), ["cats", "123"]
        )
        self.assertNotIn("cats", embedding.tokens(" " * 2048 + "cats"))

    def test_weighted_normalization_and_unknowns(self):
        v = embedding.embed("CATS, dogs! unknown", self.model())
        self.assertAlmostEqual(v[0], 1 / math.sqrt(5))
        self.assertAlmostEqual(v[1], 2 / math.sqrt(5))
        self.assertAlmostEqual(sum(x * x for x in v), 1)
        for text in ("", "unknown", "你好"):
            with self.assertRaises(ValueError):
                embedding.embed(text, self.model())

    def test_keyword_reranking_limits_duplicates(self):
        m = self.model()
        self.assertEqual(
            embedding.keywords("dogs cats dogs unknown", m), ["dogs", "cats"]
        )
        self.assertEqual(embedding.keyword_similarity(["cats"], ["cats", "dogs"], m), 1)
        self.assertEqual(embedding.keyword_similarity(["cats"], ["dogs"], m), 0)
        self.assertEqual(embedding.keyword_similarity([], ["dogs"], m), 0)

    def test_full_caption_and_subject_salience(self):
        cap = {
            "description": "A swimming pool. People are competing in sports.",
            "mood": "energetic",
        }
        self.assertIn("sports", embedding.caption_text(cap))
        self.assertNotIn("sports", embedding.caption_text(cap, "v1"))
        m = self.model()
        m["model"] = embedding.MODEL
        self.assertEqual(embedding.keywords("cats dogs cats", m, 1), ["dogs"])
        self.assertAlmostEqual(
            embedding.exact_coverage(["cats", "dogs"], ["dogs"], m), 2 / 3
        )
        self.assertAlmostEqual(
            embedding.keyword_similarity(["cats", "dogs"], ["dogs"], m), 2 / 3
        )
        for word in ("like", "what", "watching", "sequential", "palette"):
            self.assertIn(word, embedding.STOP)

    def test_index_topics_preserve_literal_descriptions_and_legacy_packs(self):
        cap = {"description": "A person sports a blue denim jacket.", "mood": "calm"}
        original = cap.copy()
        self.assertNotIn("sports", embedding.tokens(embedding.caption_text(cap)))
        self.assertEqual(cap, original)
        self.assertEqual(
            embedding.caption_text(cap, "glove.6B.50d-weighted-int8-v2"),
            original["description"] + ". calm",
        )
        cap["description"] = "Athletes play basketball on a court."
        self.assertIn("sports", embedding.tokens(embedding.caption_text(cap)))
        self.assertNotIn(
            "sports", embedding.caption_text(cap, "glove.6B.50d-weighted-int8-v2")
        )
        cap["description"] = "A cricket insect on a leaf."
        self.assertNotIn("sports", embedding.tokens(embedding.caption_text(cap)))
        cap["description"] = "A cricket game; a player bats on the field."
        self.assertIn("sports", embedding.tokens(embedding.caption_text(cap)))
        cap["description"] = "Workers are boxing items for shipment."
        self.assertNotIn("sports", embedding.tokens(embedding.caption_text(cap)))


if __name__ == "__main__":
    unittest.main()
