"""Offline regression checks for discovery and Git tree mirroring."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

SPEC = importlib.util.spec_from_file_location(
    "org_sync", Path(__file__).resolve().parents[1] / "scripts/sync_openai_org.py")
SYNC = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SYNC)


def repository(number):
    """Build one public API fixture."""
    return {"id": number, "name": f"repo-{number}", "owner": {"login": "openai"},
            "private": False, "default_branch": "main"}


class DiscoveryTests(unittest.TestCase):
    """Check discovery boundaries without network access or credentials."""

    def test_pagination_and_grouping(self):
        """Every discovered repository appears exactly once in the matrix."""
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "output"
            batches = [[repository(i) for i in range(100)], [repository(100)]]
            with patch.dict(os.environ, {"GITHUB_OUTPUT": str(output)}), \
                    patch.object(SYNC, "request", side_effect=batches) as request:
                SYNC.discover()
            matrix = json.loads(output.read_text(encoding="utf-8").split("=", 1)[1])
            names = [repo["name"] for group in matrix["include"] for repo in group["repos"]]
            self.assertEqual(len(matrix["include"]), 8)
            self.assertEqual(len(names), 101)
            self.assertEqual(len(set(names)), 101)
            self.assertIn("page=2", request.call_args.args[0])

    def test_empty_discovery_fails(self):
        """An empty API response must not silently create an empty workflow."""
        with patch.object(SYNC, "request", return_value=[]):
            with self.assertRaisesRegex(RuntimeError, "no public repositories"):
                SYNC.discover()

    def test_request_exhausts_retries(self):
        """Network errors remain visible after three attempts."""
        with patch.object(SYNC.urllib.request, "urlopen",
                          side_effect=urllib.error.URLError("offline fixture")) as request, \
                patch.object(SYNC.time, "sleep") as sleep:
            with self.assertRaises(urllib.error.URLError):
                SYNC.request("https://example.invalid")
        self.assertEqual(request.call_count, 3)
        self.assertEqual(sleep.call_count, 2)


class MirrorTests(unittest.TestCase):
    """Run actual Git operations against disposable local repositories."""

    def test_import_repeat_and_update(self):
        """Imports preserve tree identity and deletions without extra commits."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source"
            destination = root / "destination.git"
            source.mkdir()

            def git(*args):
                return subprocess.check_output(
                    ["git", *map(str, args)], stderr=subprocess.STDOUT, text=True).strip()

            git("init", source)
            git("-C", source, "config", "user.name", "Regression test")
            git("-C", source, "config", "user.email", "test@example.invalid")
            (source / "old").write_text("initial", encoding="utf-8")
            git("-C", source, "add", ".")
            git("-C", source, "commit", "-m", "initial")
            git("init", "--bare", destination)
            original = SYNC.git

            def local_git(workdir, *args, authenticated=False, stdin=None):
                # Never forward credentials or use a remote network endpoint in tests.
                del authenticated
                replacements = {
                    "https://github.com/openai/fixture.git": str(source),
                    "https://github.com/xiaochouxia11/Codex-01.git": str(destination)}
                return original(workdir, *(replacements.get(arg, arg) for arg in args),
                                stdin=stdin)

            def mirror(number):
                workdir = root / str(number)
                workdir.mkdir()
                return SYNC.mirror({"name": "fixture"}, workdir)

            with patch.dict(os.environ, {"GITHUB_REPOSITORY": "xiaochouxia11/Codex-01"}), \
                    patch.object(SYNC, "git", side_effect=local_git):
                self.assertTrue(mirror(1).startswith("updated "))
                first = git("--git-dir", destination, "rev-parse", "refs/heads/sync/fixture")
                self.assertEqual(mirror(2), "unchanged")
                self.assertEqual(first, git("--git-dir", destination, "rev-parse",
                                            "refs/heads/sync/fixture"))
                (source / "old").unlink()
                (source / "new").write_text("updated", encoding="utf-8")
                git("-C", source, "add", "-A")
                git("-C", source, "commit", "-m", "update")
                self.assertTrue(mirror(3).startswith("updated "))
            self.assertEqual(
                git("--git-dir", destination, "rev-parse",
                    "refs/heads/sync/fixture:upstream/fixture"),
                git("-C", source, "rev-parse", "HEAD^{tree}"))
            self.assertEqual(
                git("--git-dir", destination, "rev-parse", "refs/heads/sync/fixture^"), first)

    def test_invalid_name_fails_before_git(self):
        """Reject paths that could escape the imported repository prefix."""
        with patch.object(SYNC, "git") as git:
            with self.assertRaisesRegex(ValueError, "Invalid repository name"):
                SYNC.mirror({"name": "../escape"}, ".")
            git.assert_not_called()

    def test_worker_continues_and_reports_failure(self):
        """One failed import must not prevent the next assigned import."""
        with tempfile.TemporaryDirectory() as directory:
            summary = Path(directory) / "summary"
            variables = {"SYNC_REPOS": json.dumps([{"name": "bad"}, {"name": "good"}]),
                         "GITHUB_STEP_SUMMARY": str(summary)}
            with patch.dict(os.environ, variables), \
                    patch.object(SYNC, "mirror", side_effect=[RuntimeError("fixture"),
                                                             "unchanged"]) as mirror:
                with self.assertRaisesRegex(SystemExit, "Failed repositories: bad"):
                    SYNC.worker()
            self.assertEqual(mirror.call_count, 2)
            self.assertIn("good: unchanged", summary.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
