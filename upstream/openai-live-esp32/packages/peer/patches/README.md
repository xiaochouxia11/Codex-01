# Crypto device compatibility patches

Host builds use upstream Mbed TLS directly, plus the empty-X.509-Name guard.
Device builds use the same verified maintenance-release archives and apply:

| Upstream release | Espressif port source | Local patch |
| --- | --- | --- |
| 3.6.8 | [3.6.7 fork `2b96dd8e`](https://github.com/espressif/mbedtls/tree/2b96dd8eebe880f304c69976b3c2fa0c5100cbb6) | [S3 hardware port](mbedtls-3.6.8-esp.patch) |
| 4.1.2, including bundled TF-PSA-Crypto | [4.1.1 fork `ce3f3485`](https://github.com/espressif/mbedtls/tree/ce3f3485a121c100f58f36d700cb35b060f6e866) | [S31 PSA/hardware port](mbedtls-4.1.2-esp.patch) |

Modified by OpenAI to carry the previously used Espressif integration onto the
upstream maintenance releases. Apache-2.0 is selected for the Mbed TLS sources;
Espressif copyright notices and bundled per-file notices remain applicable.
See [LICENSE.mbedtls](../licenses/LICENSE.mbedtls), the repository Apache-2.0
license, and [provenance](../docs/provenance.md). These are locally maintained
compatibility patches, not releases or endorsements from Espressif.

The patches retain hardware MPI/ECP hooks, dynamic-buffer integration, and, for
S31, the PSA driver dispatch/context and build integration. They were constructed
by comparing each pinned fork with its corresponding upstream release, then
merging those port changes into the new upstream release. The overlapping prime
sieve changes use the **new upstream maintenance-release implementation**; the
older Espressif alternative is not carried over. Upstream intentionally revised
that code in these releases. Non-runtime vendor workflow/SBOM changes and local
Python cache files are excluded.

`tools/prepare_mbedtls.py` verifies the archive SHA-256, checks patch application,
applies the empty-name guard, and stages the source and matching IDF wrapper
before replacing the cache. A failed download, hash check, patch, or staging step
leaves the old cache usable. Preparation must not run concurrently with a build
using the same cache. The cache key includes both patch contents. Original IDF
checkouts remain untouched; component-manager lockfiles do not describe these
separately hash-pinned source dependencies.

The empty-name guard is still needed on 3.6.8 and 4.1.2. It prevents passing NULL
zero-length Name buffers to `memcmp`; it does not alter certificate validation
policy. The regression establishes undefined behavior on an initialized empty
certificate object, not an exploitable wire certificate or authentication bypass.
