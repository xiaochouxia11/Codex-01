#!/usr/bin/env python3
"""Build and verify the skills-only customer ZIP with Python's standard library."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import tempfile
import zipfile


PROJECT = Path(__file__).resolve().parents[1]
MARKETPLACE = "openai-codemod"
PREFIX = f"{MARKETPLACE}/plugins/codemod/"
SKILLS = {
    "codemod", "workflow", "initialize", "preflight", "assess", "behaviors",
    "brief", "transform", "verify-target", "status",
}
DOCUMENTS = {"README.md", "docs/UPGRADES.md"}
MAX_ARCHIVE_BYTES = 256 * 1024 * 1024
MAX_EXTRACTED_BYTES = 512 * 1024 * 1024
INSTALL = """# Install CodeMod

This package contains CodeMod workflow skills, references, and templates. Codex
loads the skills directly; there is no CodeMod server or dashboard to start.

Extract the ZIP, then register the extracted marketplace:

```text
codex plugin marketplace add ./openai-codemod
codex plugin add codemod@openai-codemod
```

Restart Codex and ask `@codemod help me start a migration`.
Use the [CodeMod guide](plugins/codemod/README.md) for Git source requirements,
record-provider access, and the selected execution environment's tooling.
Python and Git are required to build this archive, not to load its skills.
Local installation does not make the plugin available in a cloud task.

For an existing CodeMod installation, read the
[upgrade guidance](plugins/codemod/docs/UPGRADES.md) before continuing old work.
The previous local database and dashboard are not supported by this version.
"""


def git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=root, check=True, capture_output=True, text=True
    ).stdout.rstrip("\n")


def json_bytes(value: dict) -> bytes:
    return (json.dumps(value, indent=2, sort_keys=True) + "\n").encode()


def json_object(data: bytes) -> dict:
    if len(data) > 1024 * 1024:
        raise ValueError("Oversized package JSON metadata")
    value = json.loads(data)
    if not isinstance(value, dict):
        raise ValueError("Package JSON metadata must be an object")
    return value


def include(relative: str) -> bool:
    path = PurePosixPath(relative)
    if any(part.startswith(".") or part in {"AGENTS.md", "OWNERS", "__pycache__"}
           for part in path.parts):
        return relative == ".codex-plugin/plugin.json"
    return relative in DOCUMENTS or relative.startswith(("skills/", "assets/"))


def marketplace() -> dict:
    return {
        "name": MARKETPLACE,
        "interface": {"displayName": "OpenAI CodeMod"},
        "plugins": [{
            "name": "codemod",
            "source": {"source": "local", "path": "./plugins/codemod"},
            "policy": {"installation": "AVAILABLE", "authentication": "ON_INSTALL"},
            "category": "Engineering",
        }],
    }


def validate_manifest(manifest: dict) -> str:
    version = manifest.get("version")
    if (manifest.get("name") != "codemod" or manifest.get("skills") != "./skills/"
            or not isinstance(version, str)
            or not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.+-]+)?", version)
            or any(key in manifest for key in ("mcpServers", "hooks"))):
        raise ValueError("Expected a versioned skills-only codemod manifest")
    return version


def source_payload(project: Path, repository: Path) -> dict[str, bytes]:
    prefix = project.relative_to(repository).as_posix()
    payload = {}
    for name in sorted(git(repository, "ls-files", "-z", "--", prefix).split("\0")):
        if not name:
            continue
        path = repository / name
        relative = path.relative_to(project).as_posix()
        if not include(relative):
            continue
        if any(parent.is_symlink() for parent in (path, *path.parents)
               if parent != repository and parent.is_relative_to(repository)):
            raise ValueError(f"Package sources must not be symbolic links: {relative}")
        if not path.exists():
            continue
        if not stat.S_ISREG(path.stat().st_mode):
            raise ValueError(f"Package source must be a regular file: {relative}")
        payload[PREFIX + relative] = path.read_bytes()
    required = DOCUMENTS | {".codex-plugin/plugin.json"}
    required |= {f"skills/{name}/SKILL.md" for name in SKILLS}
    missing = sorted(required - {name.removeprefix(PREFIX) for name in payload})
    if missing:
        raise ValueError("Required package sources must be tracked: " + ", ".join(missing))
    return payload


def build(project: Path, output: Path, *, allow_dirty: bool = False) -> dict:
    project = project.resolve(strict=True)
    repository = Path(git(project, "rev-parse", "--show-toplevel"))
    commit = git(repository, "rev-parse", "HEAD")
    if not re.fullmatch(r"[a-f0-9]{40}", commit):
        raise ValueError("Expected a full Git commit identity")
    relative = project.relative_to(repository).as_posix()
    status = git(repository, "status", "--porcelain", "--untracked-files=all", "--", relative)
    if status and not allow_dirty:
        raise ValueError("CodeMod sources are dirty; commit them or use --allow-dirty for a preview")
    payload = source_payload(project, repository)
    manifest = json_object(payload[PREFIX + ".codex-plugin/plugin.json"])
    version = validate_manifest(manifest)
    # Keep the established customer identity without repository-only metadata.
    manifest.pop("homepage", None)
    manifest.pop("repository", None)
    for key, field in (("author", "name"), ("interface", "developerName")):
        if isinstance(manifest.get(key), dict):
            manifest[key][field] = "OpenAI"
    payload[PREFIX + ".codex-plugin/plugin.json"] = json_bytes(manifest)
    provenance = {
        "plugin": "codemod", "marketplace": MARKETPLACE, "version": version,
        "source_commit": commit, "dirty": bool(status),
    }
    payload[PREFIX + "distribution.json"] = json_bytes({
        "mode": "distribution", "source_commit": commit,
        "plugin_version": version, "dirty": bool(status),
    })
    payload[f"{MARKETPLACE}/.agents/plugins/marketplace.json"] = json_bytes(marketplace())
    payload[f"{MARKETPLACE}/INSTALL.md"] = INSTALL.encode()
    provenance["files"] = {name: hashlib.sha256(data).hexdigest()
                           for name, data in sorted(payload.items())}
    payload[f"{MARKETPLACE}/RELEASE.json"] = json_bytes(provenance)
    if (git(repository, "rev-parse", "HEAD") != commit
            or git(repository, "status", "--porcelain", "--untracked-files=all", "--", relative) != status):
        raise ValueError("CodeMod sources changed while preparing the package; retry from a stable checkout")

    output = output.expanduser().absolute()
    if output.suffix != ".zip" or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*\.zip", output.name):
        raise ValueError("Output must use a simple .zip filename")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".codemod-package-", dir=output.parent) as temporary:
        staged = Path(temporary) / output.name
        with zipfile.ZipFile(staged, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, data in sorted(payload.items()):
                entry = zipfile.ZipInfo(name)
                entry.create_system = 3
                entry.external_attr = (stat.S_IFREG | 0o644) << 16
                entry.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(entry, data)
        (staged.parent / "RELEASE.json").write_bytes(json_bytes(provenance))
        digest = hashlib.sha256(staged.read_bytes()).hexdigest()
        (staged.parent / "SHA256SUMS").write_text(f"{digest}  {output.name}\n", encoding="utf-8")
        result = verify(staged, allow_dirty=allow_dirty)
        for name in (output.name, "RELEASE.json", "SHA256SUMS"):
            os.replace(staged.parent / name, output.parent / name)
    return {**result, "archive": str(output)}


def validate_contents(archive: zipfile.ZipFile, provenance: dict) -> None:
    entries = archive.infolist()
    if len(entries) > 20_000 or sum(entry.file_size for entry in entries) > MAX_EXTRACTED_BYTES:
        raise ValueError("Customer archive exceeds extraction limits")
    seen = set()
    root_files = {f"{MARKETPLACE}/{name}" for name in (
        "INSTALL.md", "RELEASE.json", ".agents/plugins/marketplace.json",
    )}
    for entry in entries:
        name, mode = entry.filename, entry.external_attr >> 16
        if (name in seen or "\\" in name or ":" in name
                or any(part in {"", ".", ".."} for part in name.split("/"))
                or not name.startswith(MARKETPLACE + "/")
                or not stat.S_ISREG(mode) or mode & 0o111 or entry.flag_bits & 1):
            raise ValueError(f"Unsafe, duplicate, or non-regular archive entry: {name}")
        seen.add(name)
        if name not in root_files and not (
            name.startswith(PREFIX) and (include(name.removeprefix(PREFIX))
                                         or name == PREFIX + "distribution.json")
        ):
            raise ValueError(f"Unexpected customer payload: {name}")
    expected = provenance.get("files")
    if not isinstance(expected, dict) or set(expected) != seen - {f"{MARKETPLACE}/RELEASE.json"}:
        raise ValueError("Customer file inventory differs from provenance")
    for name, digest in expected.items():
        if not isinstance(digest, str) or hashlib.sha256(archive.read(name)).hexdigest() != digest:
            raise ValueError(f"Customer file checksum mismatch: {name}")
    required = root_files | {PREFIX + name for name in DOCUMENTS}
    required |= {PREFIX + name for name in (".codex-plugin/plugin.json", "distribution.json")}
    required |= {PREFIX + f"skills/{name}/SKILL.md" for name in SKILLS}
    if required - seen:
        raise ValueError("Missing required customer content: " + ", ".join(sorted(required - seen)))
    if json_object(archive.read(f"{MARKETPLACE}/RELEASE.json")) != provenance:
        raise ValueError("Embedded and external provenance differ")
    if json_object(archive.read(f"{MARKETPLACE}/.agents/plugins/marketplace.json")) != marketplace():
        raise ValueError("Customer marketplace identity differs")
    manifest = json_object(archive.read(PREFIX + ".codex-plugin/plugin.json"))
    if validate_manifest(manifest) != provenance["version"]:
        raise ValueError("Customer manifest version differs from provenance")
    distribution = json_object(archive.read(PREFIX + "distribution.json"))
    if distribution != {
        "mode": "distribution", "source_commit": provenance["source_commit"],
        "plugin_version": provenance["version"], "dirty": provenance["dirty"],
    }:
        raise ValueError("Customer distribution metadata differs from provenance")
    skill_names = {name.removeprefix(PREFIX + "skills/").split("/")[0] for name in seen
                   if name.startswith(PREFIX + "skills/") and name.endswith("/SKILL.md")}
    if skill_names != SKILLS:
        raise ValueError("Customer archive contains an unexpected workflow skill")
    for field in ("composerIcon", "logo"):
        asset = manifest.get("interface", {}).get(field)
        if asset is not None and (not isinstance(asset, str) or not asset.startswith("./")
                                  or PREFIX + asset[2:] not in seen):
            raise ValueError(f"Customer manifest references a missing asset: {field}")


def verify(path: Path, *, allow_dirty: bool = False) -> dict:
    path = path.expanduser().absolute()
    for source in (path, path.parent / "RELEASE.json", path.parent / "SHA256SUMS"):
        if source.is_symlink() or not source.is_file():
            raise ValueError(f"Missing or non-regular package artifact: {source.name}")
    if path.stat().st_size > MAX_ARCHIVE_BYTES:
        raise ValueError("Customer archive exceeds the size limit")
    if (path.parent / "SHA256SUMS").stat().st_size > 1024:
        raise ValueError("Oversized customer checksum file")
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    checksum = (path.parent / "SHA256SUMS").read_text(encoding="utf-8")
    if checksum != f"{digest}  {path.name}\n":
        raise ValueError("Customer archive checksum mismatch")
    provenance = json_object((path.parent / "RELEASE.json").read_bytes())
    if (provenance.get("plugin") != "codemod"
            or provenance.get("marketplace") != MARKETPLACE
            or not isinstance(provenance.get("source_commit"), str)
            or not re.fullmatch(r"[a-f0-9]{40}", provenance["source_commit"])
            or not isinstance(provenance.get("version"), str)
            or type(provenance.get("dirty")) is not bool
            or (provenance["dirty"] and not allow_dirty)):
        raise ValueError("Invalid or dirty customer provenance")
    with zipfile.ZipFile(path) as archive:
        validate_contents(archive, provenance)
        # Check the exact shipped documents using trusted checkout code, never ZIP code.
        with tempfile.TemporaryDirectory(prefix="codemod-verify-") as temporary:
            root = Path(temporary)
            for entry in archive.infolist():
                target = root / entry.filename
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(entry))
            checked = subprocess.run(
                [sys.executable, str(PROJECT / "tests/check-package.py"),
                 "--package-root", str(root / MARKETPLACE / "plugins/codemod"),
                 "--extra-markdown", str(root / MARKETPLACE / "INSTALL.md")],
                capture_output=True, text=True, check=False,
            )
            if checked.returncode:
                raise ValueError("Packaged references failed validation:\n" + checked.stdout + checked.stderr)
    return {"archive": str(path), "source_commit": provenance["source_commit"],
            "version": provenance["version"], "dirty": provenance["dirty"], "sha256": digest}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    build_parser = commands.add_parser("build", help="Build a tracked, verified customer artifact")
    build_parser.add_argument("--output", type=Path, required=True)
    build_parser.add_argument("--allow-dirty", action="store_true", help="Allow an unreleasable local preview")
    verify_parser = commands.add_parser("verify", help="Verify a ZIP and its adjacent release evidence")
    verify_parser.add_argument("--archive", type=Path, required=True)
    verify_parser.add_argument("--allow-dirty", action="store_true", help="Verify an unreleasable local preview")
    args = parser.parse_args()
    try:
        result = (build(PROJECT, args.output, allow_dirty=args.allow_dirty) if args.command == "build"
                  else verify(args.archive, allow_dirty=args.allow_dirty))
    except (OSError, ValueError, KeyError, zipfile.BadZipFile, subprocess.CalledProcessError) as exc:
        parser.exit(1, f"CodeMod package: {exc}\n")
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
