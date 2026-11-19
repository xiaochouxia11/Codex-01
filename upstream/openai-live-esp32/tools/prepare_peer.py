#!/usr/bin/env python3
"""Prepare pinned ESP-IDF source dependencies outside the SDK checkout."""

import hashlib
import io
import os
import shutil
import subprocess
import tarfile
import urllib.request
from pathlib import Path

from prepare_mbedtls import prepare_crypto

PINS = {
    "srtp": (
        "cisco/libsrtp",
        "6ff02afa8d2dc3f2e8896af391d137c1c66ff6fa",
        "1ef3e6315e0ea3cd05f4980c8b5f7a9df369e3d586f5e0616e6cc4c778401d4c",
    ),
    "usrsctp": (
        "sctplab/usrsctp",
        "c625e21950600460cb5c6075616eb1622df2b06a",
        "090b9d03bf068ce5989576c8e0ff6979d3031ea85e405acd263206f19166b41e",
    ),
}


def prepare(destination: Path, *, native_crypto: bool = False):
    idf = Path(os.environ["IDF_PATH"])
    destination.mkdir(parents=True, exist_ok=True)
    for name, (repo, commit, sha) in PINS.items():
        target = destination / name
        marker = target / ".live-peer-pin"
        if marker.exists() and marker.read_text() == commit:
            continue
        url = f"https://codeload.github.com/{repo}/tar.gz/{commit}"
        with urllib.request.urlopen(url, timeout=60) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != sha:
            raise ValueError(f"Hash mismatch for {name}")
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
            root = archive.getmembers()[0].name.split("/")[0]
            archive.extractall(destination, filter="data")
        if target.exists():
            shutil.rmtree(target)
        (destination / root).rename(target)
        marker.write_text(commit)
    prepare_crypto(destination, idf, major=4 if native_crypto else 3)
    prepare_sctp_srtp(destination)


def prepare_sctp_srtp(destination: Path):
    subprocess.run(
        [
            "cmake",
            f"-DSCTP_SOURCE_DIR={destination / 'usrsctp'}",
            "-P",
            str(
                Path(__file__).resolve().parents[1]
                / "packages/peer/patches/usrsctp-reinit.cmake"
            ),
        ],
        check=True,
    )
    # AF_CONN-only SCTP has no raw-IP sockets or address discovery. The platform
    # still supplies real pthread locks and cryptographic entropy.
    for name in ("crypto/include/cipher.h", "crypto/cipher/cipher.c"):
        path = destination / "srtp" / name
        text = path.read_text().replace(
            "uint32_t *num_octets_to_output", "unsigned int *num_octets_to_output"
        )
        # All underlying cipher functions use unsigned int lengths. Keep the
        # output wrapper's uint32_t API with an explicit value conversion.
        start = text.index("srtp_err_status_t srtp_cipher_output(")
        end = text.index("srtp_err_status_t srtp_cipher_encrypt(", start)
        section = text[start:end].replace(
            "unsigned int *num_octets_to_output", "uint32_t *num_octets_to_output"
        )
        section = section.replace(
            "return (((c)->type)->encrypt(((c)->state), buffer, num_octets_to_output));",
            "unsigned int n = *num_octets_to_output;\n"
            "    srtp_err_status_t result = c->type->encrypt(c->state, buffer, &n);\n"
            "    *num_octets_to_output = n;\n    return result;",
        )
        path.write_text(text[:start] + section + text[end:])
    source = destination / "usrsctp/usrsctplib"
    path = source / "netinet/sctp_os_userspace.h"
    text = path.read_text()
    text = text.replace(
        "#ifndef ESP_PLATFORM\n#include <netinet/in_systm.h>\n#include <netinet/ip.h>\n#endif",
        "#include <netinet/in_systm.h>\n#include <netinet/ip.h>",
    )
    text = text.replace(
        "#include <netinet/in_systm.h>\n#include <netinet/ip.h>",
        "#ifndef ESP_PLATFORM\n#include <netinet/in_systm.h>\n#include <netinet/ip.h>\n#endif",
    )
    text = text.replace(
        "#if defined(HAVE_NETINET_IP_ICMP_H)",
        "#if defined(ESP_PLATFORM)\n/* No raw IP/ICMP in the AF_CONN-only port. */\n#elif defined(HAVE_NETINET_IP_ICMP_H)",
    )
    text = text.replace("#define SCTP_IFNAMSIZ\t\tIFNAMSIZ", "#define SCTP_IFNAMSIZ 32")
    path.write_text(text)
    path = source / "usrsctp.h"
    text = path.read_text()
    if "defined(__NetBSD__) || defined(ESP_PLATFORM)" not in text:
        text = text.replace(
            "defined(__FreeBSD__) || defined(__OpenBSD__) || defined(__NetBSD__)",
            "defined(__FreeBSD__) || defined(__OpenBSD__) || defined(__NetBSD__) || defined(ESP_PLATFORM)",
        )
    path.write_text(text)
    # ESP-IDF implements rwlocks, but rejects every non-NULL attribute pointer
    # with ENOSYS. Upstream ignores that return value, leaving unusable locks.
    # These are default attributes; keep real locking by using the supported API.
    path = source / "netinet/sctp_process_lock.h"
    text = path.read_text().replace(
        "&SCTP_BASE_VAR(rwlock_attr)", "NULL /* ESP-IDF default rwlock attributes */"
    )
    path.write_text(text)
    path = source / "user_environment.c"
    text = path.read_text()
    if "#elif defined(ESP_PLATFORM)" in text:
        return
    text = text.replace(
        "#elif defined(SCTP_USE_OPENSSL_RAND)",
        "#elif defined(ESP_PLATFORM)\n#include <esp_random.h>\n"
        "void init_random(void) {}\nvoid finish_random(void) {}\n"
        "void read_random(void *buf, size_t size) { esp_fill_random(buf, size); }\n"
        "#elif defined(SCTP_USE_OPENSSL_RAND)",
    )
    path.write_text(text)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path)
    prepare(parser.parse_args().destination.resolve())
