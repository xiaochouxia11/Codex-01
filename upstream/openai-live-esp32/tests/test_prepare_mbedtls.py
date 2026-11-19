"""A failed crypto upgrade must preserve the usable cache and IDF checkout."""

import hashlib
import io
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import prepare_mbedtls as prepare


class CryptoPreparationTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.idf = self.root / "idf"
        component = self.idf / "components/mbedtls"
        (component / "mbedtls").mkdir(parents=True)
        (component / "CMakeLists.txt").write_text("original wrapper\n")
        (component / "mbedtls/source.c").write_text("original IDF crypto\n")
        self.dest = self.root / "deps"
        self.dest.mkdir()
        for name in ("mbedtls-source", "mbedtls"):
            (self.dest / name).mkdir()
            (self.dest / name / "old").write_text(name)
        self.patches = self.root / "patches"
        self.patches.mkdir()
        (self.patches / "mbedtls-fixture-esp.patch").write_text(
            "--- a/source.c\n+++ b/source.c\n@@ -1 +1 @@\n-before\n+after\n"
        )
        (self.patches / "mbedtls-empty-name.cmake").write_text("# fixture\n")
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w:bz2") as archive:
            data = b"before\n"
            info = tarfile.TarInfo("mbedtls-fixture/source.c")
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data))
        self.archive = buf.getvalue()
        self.pin = ("fixture", hashlib.sha256(self.archive).hexdigest())
        for context in (
            patch.object(prepare, "PATCHES", self.patches),
            patch.dict(prepare.RELEASES, {3: self.pin, 4: self.pin}),
        ):
            context.start()
            self.addCleanup(context.stop)

    def run_prepare(self, major=3):
        with patch.object(
            prepare.urllib.request, "urlopen", return_value=io.BytesIO(self.archive)
        ) as fetch:
            prepare.prepare_crypto(self.dest, self.idf, major=major)
        return fetch.call_count

    def assert_old_cache(self):
        for name in ("mbedtls-source", "mbedtls"):
            self.assertEqual((self.dest / name / "old").read_text(), name)

    def test_upgrade_idempotence_and_isolation(self):
        for major in (3, 4):
            with self.subTest(major=major):
                self.assertEqual(self.run_prepare(major), 1 if major == 3 else 0)
                self.assertEqual((self.dest / "mbedtls/mbedtls/source.c").read_text(), "after\n")
                self.assertEqual(self.run_prepare(major), 0)
                self.assertEqual(
                    (self.idf / "components/mbedtls/mbedtls/source.c").read_text(),
                    "original IDF crypto\n",
                )

    def test_bad_hash_preserves_cache(self):
        self.archive += b"changed"
        with self.assertRaisesRegex(ValueError, "Hash mismatch"):
            self.run_prepare()
        self.assert_old_cache()

    def test_patch_drift_preserves_cache(self):
        port = self.patches / "mbedtls-fixture-esp.patch"
        port.write_text(port.read_text().replace("-before", "-wrong"))
        with self.assertRaises(subprocess.CalledProcessError):
            self.run_prepare()
        self.assert_old_cache()

    def test_patch_update_invalidates_cache(self):
        self.run_prepare()
        port = self.patches / "mbedtls-fixture-esp.patch"
        port.write_text(port.read_text().replace("+after", "+updated"))
        self.assertEqual(self.run_prepare(), 1)
        self.assertEqual((self.dest / "mbedtls-source/source.c").read_text(), "updated\n")

    def test_wrapper_failure_preserves_cache(self):
        with patch.object(prepare.shutil, "copytree", side_effect=OSError("fixture")):
            with self.assertRaises(OSError):
                self.run_prepare()
        self.assert_old_cache()

    def test_install_failure_rolls_back_both_trees(self):
        rename = Path.rename

        def fail_wrapper(path, target):
            if path.name == "mbedtls" and path.parent.name.startswith(".crypto-"):
                raise OSError("fixture installation failure")
            return rename(path, target)

        with patch.object(Path, "rename", fail_wrapper), self.assertRaises(OSError):
            self.run_prepare()
        self.assert_old_cache()


if __name__ == "__main__":
    unittest.main()
