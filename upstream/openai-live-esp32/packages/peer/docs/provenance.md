# Provenance and dependency policy

This portable package derives from the MIT-licensed `src` implementation and C
interface in [sepfy/libpeer](https://github.com/sepfy/libpeer), commit
`5b849de378545c31d34759a145413846953e1366`. Its original notice is retained in
[LICENSE.libpeer](../LICENSE.libpeer). Locally maintained changes use the
[Apache License 2.0](../LICENSE), with attribution in [NOTICE](../NOTICE).
The package is independently buildable and carries its notices so it can be
separated from this repository. Upstream code retains its own licenses.

The source has been substantially changed: SDP/STUN/ICE parsing, DTLS identity
checks, crypto error handling, media dispatch, and SCTP/DCEP integration are
reviewable here. Unused HTTP/MQTT signaling, custom SCTP, mDNS, and video parsing
are excluded. This is not an assertion that unmodified upstream libpeer or any
Espressif release has the same fixes or security properties.

**No esp_peer source or binary is incorporated.** Espressif's
[Modified MIT license](https://github.com/espressif/esp-webrtc-solution/blob/main/components/esp_peer/LICENSE)
limits use to Espressif products, so it cannot be the source of a portable
implementation intended for other vendors. The separate ESP-IDF adapter builds
this portable source and does not link esp_peer.

CMake fetches complete release/source archives and verifies their SHA-256 hashes:

| Dependency | Pinned source | License |
| --- | --- | --- |
| Mbed TLS | [3.6.8 release archive](https://github.com/Mbed-TLS/mbedtls/releases/tag/mbedtls-3.6.8) | Apache-2.0 OR GPL-2.0-or-later; Apache-2.0 selected for this package |
| Mbed TLS / TF-PSA-Crypto (optional host path) | [4.1.2 release archive](https://github.com/Mbed-TLS/mbedtls/releases/tag/mbedtls-4.1.2), SHA-256 `392215e5e4846df04e2f4c4516079303bd73edde837d8f3e68fb4d4d7ddf0126` | Apache-2.0 selected; retain bundled subcomponent notices |
| libSRTP | [2.8.1, `6ff02afa8d2dc3f2e8896af391d137c1c66ff6fa`](https://github.com/cisco/libsrtp/tree/6ff02afa8d2dc3f2e8896af391d137c1c66ff6fa) | BSD-3-Clause |
| usrsctp | [`c625e21950600460cb5c6075616eb1622df2b06a`](https://github.com/sctplab/usrsctp/tree/c625e21950600460cb5c6075616eb1622df2b06a) | BSD-3-Clause and notices in individual source files |

The ESP-IDF preparation tool uses the same verified upstream releases: 3.6.8
for ESP32-S3 and 4.1.2/TF-PSA-Crypto for ESP32-S31. It applies explicit
[Espressif compatibility patches](../patches/README.md) derived from the
previously pinned device forks, retaining hardware crypto and PSA drivers.
The patches are adaptations by OpenAI under Apache-2.0; the underlying Mbed TLS,
TF-PSA-Crypto and Espressif source notices remain applicable. They are not
Espressif-issued releases. The IDF component wrappers retain hardware entropy
and certificate-bundle integration in isolated dependency directories. Preparation
never edits the original IDF Mbed TLS checkout, including on Mosaico.

ESP-IDF-only adaptations in `tools/prepare_peer.py` preserve dependency notices
and cover AF_CONN socket layout, default rwlock attributes, hardware randomness,
absent raw-IP headers, and Xtensa's distinct `uint32_t`/`unsigned int` types.
Host and device builds apply `patches/usrsctp-reinit.cmake` to clear the iterator's
exit flags before restarting it after a completed, joined global shutdown. They
also apply `patches/mbedtls-empty-name.cmake`, guarding zero-length X.509 Name
comparisons before calling `memcmp`. That sanitizer finding is not a demonstrated
wire-reachable certificate-authentication bypass. The patch is idempotent, fails
on source drift, and adds a modification notice without removing upstream notices.
System-Mbed-TLS builds require an equivalent fix supplied by that installation.

Mosaico retains its separate IDF 6.2 preview wrapper and PSA integration. The
adapter uses PSA random generation, HMAC, and a short-lived P-256 signing key
whose policy follows Mbed TLS's deterministic-ECDSA configuration. The key is
destroyed at peer teardown. Both crypto versions use the same negotiated
DTLS/SRTP restrictions and transport regression suite.

Both builds can select the pinned libSRTP tree's `aes_icm_mbedtls.c` and
`hmac_mbedtls.c` with `LIVE_PEER_MBEDTLS_SRTP=ON`. `src/srtp_mbedtls_aes.c` only provides the AES-192
type's forward declaration omitted by upstream headers when GCM is disabled;
the cipher implementation is included unchanged. GCM and extra negotiated
profiles stay disabled. The original software AES/HMAC sources remain available
as the default (`LIVE_PEER_MBEDTLS_SRTP=OFF`). Shared CMake configuration also selects
smaller usrsctp hash tables without changing protocol or message limits.

Copies of the top-level dependency licenses are in [licenses](../licenses).
Fetched source archives retain their additional per-file/subcomponent notices;
redistributors must preserve applicable notices for the actual linked build.
Mbed TLS includes third-party elliptic-curve implementations under their own
source-file notices. The package does not relicense those components.

Tests use aiortc 1.15.0 and its separately licensed Python dependencies, pinned in
`tests/interop/uv.lock`. Those are test tooling, not C runtime dependencies.
GitHub Actions are pinned to reviewed commit IDs. No binary transport library,
API key, Wi-Fi configuration, or device credentials are distributed here.

Dependency upgrades require checking upstream advisories and release notes,
updating archive hashes, and rerunning sanitizers, both DTLS roles, negative
fingerprint tests, malformed/replayed media tests, SCTP reassembly tests, and fuzz
smoke tests. An empty GitHub advisory list is not proof a dependency is secure.
