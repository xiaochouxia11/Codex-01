"""Exercise the shipped skills and release evidence in disposable Git repositories."""

import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile
import unittest
import zipfile


PROJECT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("codemod_package", PROJECT / "scripts/package.py")
package = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(package)


class DistributionTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="codemod-distribution-test-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.project = self.root / "source"
        self.project.mkdir()
        for source in PROJECT.rglob("*"):
            relative = source.relative_to(PROJECT)
            if source.is_file() and package.include(relative.as_posix()):
                target = self.project / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, target)
        self.git("init", "-q")
        # Prove retained developer tooling and removed runtime files cannot enter the ZIP.
        for relative in ("scripts/package.py", "tests/private.md", "backend/codemod/api.py", ".mcp.json"):
            target = self.project / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("excluded fixture\n", encoding="utf-8")
        self.git("add", ".")
        self.git("-c", "user.name=Package Test", "-c", "user.email=package@example.invalid",
                 "commit", "-qm", "Package fixture")
        self.commit = self.git("rev-parse", "HEAD")
        self.archive = self.root / "artifact" / f"openai-codemod-{self.commit}.zip"

    def git(self, *args):
        return subprocess.run(["git", *args], cwd=self.project, check=True,
                              capture_output=True, text=True).stdout.strip()

    def build(self, **kwargs):
        return package.build(self.project, self.archive, **kwargs)

    def checksum(self):
        digest = hashlib.sha256(self.archive.read_bytes()).hexdigest()
        (self.archive.parent / "SHA256SUMS").write_text(
            f"{digest}  {self.archive.name}\n", encoding="utf-8")

    def rewrite(self, changes, *, inventory=False):
        with zipfile.ZipFile(self.archive) as archive:
            files = {entry.filename: (entry, archive.read(entry)) for entry in archive.infolist()}
        for name, value in changes.items():
            if value is None:
                files.pop(name)
            else:
                entry = files[name][0] if name in files else zipfile.ZipInfo(name)
                entry.create_system = 3
                entry.external_attr = (stat.S_IFREG | 0o644) << 16
                files[name] = (entry, value)
        if inventory:
            release_name = "openai-codemod/RELEASE.json"
            release = json.loads(files[release_name][1])
            release["files"] = {name: hashlib.sha256(data).hexdigest()
                                for name, (_, data) in files.items() if name != release_name}
            encoded = json.dumps(release).encode()
            files[release_name] = (files[release_name][0], encoded)
            (self.archive.parent / "RELEASE.json").write_bytes(encoded)
        with zipfile.ZipFile(self.archive, "w") as archive:
            for entry, data in files.values():
                archive.writestr(entry, data)
        self.checksum()

    def test_complete_reproducible_skills_package_preserves_release_contract(self):
        result = self.build()
        original = self.archive.read_bytes()
        self.assertEqual(package.verify(self.archive), result)
        self.assertEqual(result["source_commit"], self.commit)
        self.assertIs(result["dirty"], False)
        self.assertEqual({path.name for path in self.archive.parent.iterdir()},
                         {self.archive.name, "RELEASE.json", "SHA256SUMS"})
        with zipfile.ZipFile(self.archive) as archive:
            names = set(archive.namelist())
            self.assertIn(package.PREFIX + "skills/workflow/assets/migration-progress-view.html", names)
            self.assertIn(package.PREFIX + "docs/UPGRADES.md", names)
            self.assertFalse(any("/backend/" in name or "/tests/" in name or "/scripts/" in name
                                 or name.endswith("/.mcp.json") for name in names))
            release = json.loads(archive.read("openai-codemod/RELEASE.json"))
            self.assertEqual(release, json.loads((self.archive.parent / "RELEASE.json").read_bytes()))
            distribution = json.loads(archive.read(package.PREFIX + "distribution.json"))
            self.assertEqual(distribution, {
                "mode": "distribution", "source_commit": self.commit,
                "plugin_version": result["version"], "dirty": False,
            })
        self.build()
        self.assertEqual(self.archive.read_bytes(), original)

    def test_dirty_preview_is_explicit_and_never_includes_untracked_files(self):
        untracked = self.project / "skills/codemod/private-notes.md"
        untracked.write_text("unreviewed\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "sources are dirty"):
            self.build()
        result = self.build(allow_dirty=True)
        self.assertIs(result["dirty"], True)
        with self.assertRaisesRegex(ValueError, "dirty customer provenance"):
            package.verify(self.archive)
        package.verify(self.archive, allow_dirty=True)
        with zipfile.ZipFile(self.archive) as archive:
            self.assertNotIn(package.PREFIX + "skills/codemod/private-notes.md", archive.namelist())

    def test_build_rejects_tracked_symbolic_link_and_missing_stage(self):
        stage = self.project / "skills/transform/SKILL.md"
        contents = stage.read_bytes()
        stage.unlink()
        stage.symlink_to(self.project / "README.md")
        with self.assertRaisesRegex(ValueError, "symbolic links"):
            self.build(allow_dirty=True)
        stage.unlink()
        with self.assertRaisesRegex(ValueError, "Required package sources"):
            self.build(allow_dirty=True)
        stage.write_bytes(contents)

    def test_archive_and_individual_file_tampering_fail(self):
        self.build()
        self.archive.write_bytes(self.archive.read_bytes() + b"tampered")
        with self.assertRaisesRegex(ValueError, "archive checksum mismatch"):
            package.verify(self.archive)
        self.build()
        self.rewrite({package.PREFIX + "skills/codemod/SKILL.md": b"changed instructions\n"})
        with self.assertRaisesRegex(ValueError, "file checksum mismatch"):
            package.verify(self.archive)

    def test_missing_required_stage_fails_even_with_updated_inventory(self):
        self.build()
        self.rewrite({package.PREFIX + "skills/transform/SKILL.md": None}, inventory=True)
        with self.assertRaisesRegex(ValueError, "Missing required customer content"):
            package.verify(self.archive)

    def test_rejects_traversal_symlinks_and_removed_runtime(self):
        self.build()
        original = self.archive.read_bytes()
        for name, mode in (
            ("openai-codemod/../escape", stat.S_IFREG | 0o644),
            (package.PREFIX + "skills/codemod/link.md", stat.S_IFLNK | 0o777),
            (package.PREFIX + "backend/codemod/api.py", stat.S_IFREG | 0o644),
        ):
            with self.subTest(name=name):
                self.archive.write_bytes(original)
                with zipfile.ZipFile(self.archive, "a") as archive:
                    entry = zipfile.ZipInfo(name)
                    entry.create_system = 3
                    entry.external_attr = mode << 16
                    archive.writestr(entry, "unexpected")
                self.checksum()
                with self.assertRaisesRegex(ValueError, "Unsafe|Unexpected customer payload"):
                    package.verify(self.archive)

    def test_identity_and_embedded_provenance_must_agree(self):
        self.build()
        with zipfile.ZipFile(self.archive) as archive:
            manifest = json.loads(archive.read(package.PREFIX + ".codex-plugin/plugin.json"))
        manifest["version"] = "999.0.0"
        self.rewrite({package.PREFIX + ".codex-plugin/plugin.json": json.dumps(manifest).encode()}, inventory=True)
        with self.assertRaisesRegex(ValueError, "manifest version differs"):
            package.verify(self.archive)
        self.build()
        sidecar = self.archive.parent / "RELEASE.json"
        provenance = json.loads(sidecar.read_bytes())
        provenance["source_commit"] = "a" * 40
        sidecar.write_text(json.dumps(provenance), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Embedded and external provenance differ"):
            package.verify(self.archive)

    def test_checks_references_in_exact_shipped_payload(self):
        self.build()
        self.rewrite({package.PREFIX + "README.md": b"# CodeMod\n[Missing](missing.md)\n"}, inventory=True)
        with self.assertRaisesRegex(ValueError, "Packaged references failed validation"):
            package.verify(self.archive)


if __name__ == "__main__":
    unittest.main()
