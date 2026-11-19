"""Prepare upstream Mbed TLS maintenance releases with pinned ESP-IDF ports."""

import hashlib
import io
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request
from pathlib import Path

PATCHES = Path(__file__).resolve().parents[1] / "packages/peer/patches"
RELEASES = {
    3: ("3.6.8", "bc54b818e87f49c0b3281dd85d24adaede0e63b4e822e3fbd49c005a38b9595b"),
    4: ("4.1.2", "392215e5e4846df04e2f4c4516079303bd73edde837d8f3e68fb4d4d7ddf0126"),
}


def prepare_crypto(destination: Path, idf: Path, *, major: int = 3):
    """Stage and verify both trees before replacing a working dependency cache.

    The IDF component wrapper supplies entropy, hardware crypto and certificate
    bundles. Neither this wrapper nor the nested IDF crypto checkout is modified.
    Callers must serialize preparation and must not build from this cache during
    replacement.
    """
    version, digest = RELEASES[major]
    destination = destination.resolve()
    idf_component = idf.resolve() / "components/mbedtls"
    port = PATCHES / f"mbedtls-{version}-esp.patch"
    empty_name = PATCHES / "mbedtls-empty-name.cmake"
    pin = hashlib.sha256(
        (version + digest).encode() + port.read_bytes() + empty_name.read_bytes()
    ).hexdigest()
    destination.mkdir(parents=True, exist_ok=True)
    source = destination / "mbedtls-source"
    marker = source / ".live-peer-pin"
    cached = marker.is_file() and marker.read_text() == pin
    with tempfile.TemporaryDirectory(prefix=".crypto-", dir=destination) as tmp:
        stage = Path(tmp)
        if not cached:
            url = (
                "https://github.com/Mbed-TLS/mbedtls/releases/download/"
                f"mbedtls-{version}/mbedtls-{version}.tar.bz2"
            )
            with urllib.request.urlopen(url, timeout=90) as response:
                data = response.read()
            if hashlib.sha256(data).hexdigest() != digest:
                raise ValueError(f"Hash mismatch for Mbed TLS {version}")
            with tarfile.open(fileobj=io.BytesIO(data), mode="r:bz2") as archive:
                archive.extractall(stage, filter="data")
            extracted = stage / f"mbedtls-{version}"
            subprocess.run(
                ["git", "apply", "--check", str(port)], cwd=extracted, check=True
            )
            subprocess.run(
                ["git", "apply", "--whitespace=nowarn", str(port)],
                cwd=extracted,
                check=True,
            )
            subprocess.run(
                ["cmake", f"-DPEER_MBEDTLS_SOURCE_DIR={extracted}", "-P", str(empty_name)],
                check=True,
            )
            extracted.rename(stage / "mbedtls-source")
            (stage / "mbedtls-source/.live-peer-pin").write_text(pin)
        shutil.copytree(
            idf_component,
            stage / "mbedtls",
            ignore=lambda path, names: (
                {"mbedtls", ".git"} if Path(path) == idf_component else {".git"}
            ),
        )
        (stage / "mbedtls/mbedtls").symlink_to(source, target_is_directory=True)
        names = ["mbedtls"] if cached else ["mbedtls-source", "mbedtls"]
        installed, backups = [], []
        try:
            for name in names:
                target = destination / name
                if target.exists() or target.is_symlink():
                    target.rename(stage / f"old-{name}")
                    backups.append(name)
                (stage / name).rename(target)
                installed.append(name)
        except BaseException:
            for name in reversed(installed):
                target = destination / name
                if target.is_symlink():
                    target.unlink()
                else:
                    shutil.rmtree(target)
            for name in reversed(backups):
                (stage / f"old-{name}").rename(destination / name)
            raise
