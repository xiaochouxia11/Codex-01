"""Never apply Mosaico's native-crypto patches to the S3 SDK checkout."""

import hashlib
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import prepare_mosaico


class MosaicoPreparationTest(unittest.TestCase):
    def test_requires_activated_idf(self):
        with patch.dict(os.environ, {}, clear=True), self.assertRaises(ValueError):
            prepare_mosaico.validate_idf()

    def test_rejects_wrong_checkout_before_patching(self):
        with (
            patch.dict(os.environ, {"IDF_PATH": "/fixture/idf"}),
            patch.object(subprocess, "check_output", return_value="wrong\n"),
            self.assertRaises(ValueError),
        ):
            prepare_mosaico.validate_idf()

    def test_accepts_reviewed_checkout(self):
        with (
            patch.dict(os.environ, {"IDF_PATH": "/fixture/idf"}),
            patch.object(
                subprocess,
                "check_output",
                return_value=prepare_mosaico.IDF_COMMIT + "\n",
            ) as git,
        ):
            prepare_mosaico.validate_idf()
            self.assertEqual(
                git.call_args.args[0],
                ["git", "-C", "/fixture/idf", "rev-parse", "HEAD"],
            )

    def test_rejects_missing_git_checkout(self):
        with (
            patch.dict(os.environ, {"IDF_PATH": "/fixture/idf"}),
            patch.object(
                subprocess,
                "check_output",
                side_effect=subprocess.CalledProcessError(128, "git"),
            ),
            self.assertRaises(ValueError),
        ):
            prepare_mosaico.validate_idf()


class DisplayQueuePatchTest(unittest.TestCase):
    def test_idempotent_bounded_queue_and_refuses_unreviewed_source(self):
        source = b"before\n    io_config.flags.psram_dma_direct = false;\nafter\n"
        with tempfile.TemporaryDirectory() as tmp:
            bsp = Path(tmp)
            path = bsp / "components/esp-mosaico-bsp/onboard/display.c"
            path.parent.mkdir(parents=True)
            path.write_bytes(source)
            with patch.object(
                prepare_mosaico, "BSP_DISPLAY_SHA256", hashlib.sha256(source).hexdigest()
            ):
                prepare_mosaico.patch_display_queue(bsp)
                expected = path.read_bytes()
                self.assertEqual(expected.count(b"io_config.trans_queue_depth = 2;"), 1)
                self.assertIn(b"io_config.flags.psram_dma_direct = false;", expected)
                prepare_mosaico.patch_display_queue(bsp)
                self.assertEqual(path.read_bytes(), expected)
                for changed in (source + b"manual change", expected + b"manual change"):
                    path.write_bytes(changed)
                    with self.assertRaises(ValueError):
                        prepare_mosaico.patch_display_queue(bsp)
                    self.assertEqual(path.read_bytes(), changed)
