# Cross-implementation regression sweep — 2026-10-08

This implements selected leads from the [upstream comparison](upstream-issues.md)
and [cross-implementation survey](cross-implementation-review.md). Tests and
applicability decisions are based on the code we actually ship: an IPv4/UDP,
Opus-only offerer with Mbed TLS, libSRTP and usrsctp. An upstream advisory is a
source of attack patterns, not evidence that its exact vulnerability exists here.

## Confirmed local findings

| Finding | Before / after | Regression evidence |
| --- | --- | --- |
| First authenticated malformed RTP pinned the audio SSRC | An unsupported payload type or invalid RTP padding selected a source before decoder validation, preventing subsequent valid audio from another SSRC. Check payload type before unprotect, validate plaintext framing before binding, and remove a newly cloned wildcard stream when that first packet is malformed. Preserve replay state for established sources. | `peer_media` fails on the previous receive loop; invalid first packets are now followed by successful valid audio. 2,000 bad-tag sources, 2,000 authenticated malformed sources and 2,000 authenticated alternate sources leave no unwanted libSRTP stream, verified through its stream lookup API. |
| RTCP could select the audio SSRC | A malformed or unrelated RTCP report arriving first bound the audio source. RTCP now requires the source already selected by SDP or valid authenticated RTP. This package does not implement RTCP-driven source replacement. | Authenticated undersized and valid unrelated RR packets cannot choose the source; subsequent valid RTP works. RTCP for a bound source still passes interoperability. |
| SRTP startup close to sequence wrap | Following the [aiortc early-wrap lead](https://aiortc.readthedocs.io/en/latest/changelog.html), a random initial RTP sequence of 65,535 followed by startup loss made the receiver assume ROC 0 while the sender used ROC 1. Start randomly in the lower half of the sequence space. | Deterministic maximum-entropy input failed the old encoder initialization. Real libSRTP tests reproduce the old authentication failure, test startup loss with headroom, then successful loss/reordering across an established rollover. This mitigates early wrap; arbitrary very late joins are unsupported. |
| Incomplete RTCP compound framing checks | Subsequent compound members could carry non-RTCP packet types; padding counts need not be multiples of four. Check every member's type and padding alignment. No out-of-bounds read was demonstrated in our parser. | The old validator fails the new matrix: all 256 member type values, seven report minima with all 32 count values, truncation, padding alignment and padding that consumes required logical data. Rules follow [RFC 3550 §6.4.1](https://www.rfc-editor.org/rfc/rfc3550.html#section-6.4.1). |

The wildcard-stream cleanup is necessary alongside the source-binding fix:
simply moving the assignment would allow repeated authenticated malformed SSRCs
to retain libSRTP allocations. Tests check that unsuccessful authentication does
not create streams, malformed authenticated streams are removed, and an accepted
stream remains usable. This measures retained stream state, not total process RSS
or a global bound across an unlimited number of application-created peers.

## Chromium/libwebrtc patch review

| Public fix / pattern | Applicability and tests here |
| --- | --- |
| [RemoteEstimate padding-length fix `a72d583`](https://webrtc.googlesource.com/src/%2B/a72d5832710b4967f61b8878ef5d73cb91c0b0a6), Chromium 987507 | Wire length included padding, allowing a logical-payload bound to pass incorrectly. We do not implement RemoteEstimate, but apply the pattern to RTCP APP/report minima. `peer_media` sends a correctly authenticated APP packet whose padding leaves too little logical data, plus malformed compound lengths; valid RTP continues afterward. |
| [Excessive RIDs / SetupCodec fix `7e9559f`](https://webrtc.googlesource.com/src/%2B/7e9559f8b08e61b4cf065ad891f132bccd580fc5%5E%21/), Chromium 486536241 | Negotiated simulcast counts exceeded fixed storage. Video/RID/simulcast are absent here. `peer_sdp` now explicitly rejects extra media/video sections and tests every candidate count through the ten-candidate boundary and first overflow, without publishing partial state. This tests the analogous count boundary, not Chromium's absent video encoder. |
| [NetEq crossfade bounds fix `ff1be2e`](https://webrtc.googlesource.com/src/%2B/ff1be2e8524fe63069fc2406d5e3f3ddccafee1a%5E%21/), Chromium 502661101 | Both source and destination vector lengths must bound mixing. This transport contains no NetEq, CNG mixing or PCM decoder. Existing RTP timing/reorder tests and the new authenticated media tests cover transport buffers; they do **not** validate the separate Espressif Opus decoder or board audio pipeline. |
| [Project Zero stateful media testing](https://projectzero.google/2018/12/adventures-in-video-conferencing-part-1.html) | Malformed media must receive valid authentication tags to reach deeper parsing. The new UDP/SRTP harness mutates plaintext before protection and preserves packet sequences. Fuzz seeds add short padded APP packets, invalid padding alignment and invalid compound member types. |

The broader browser CVEs in the survey remain leads when their public advisory
does not reveal a matching implementation path. We did not infer local impact
from an exploit severity label, import browser video code, or claim that an
excluded codec has been patched here.

## Authentication, resources and lifecycle

| Upstream lead | New coverage / result |
| --- | --- |
| [Pion missing CertificateVerify](https://github.com/pion/dtls/security/advisories/GHSA-w45j-f832-hxvh) | `peer_handshake` uses real Mbed TLS peers and matching expected certificates. Corrupted/replayed client CertificateVerify, a wrong handshake type in its place, and corrupted/replayed server ServerKeyExchange all fail at the proof-verification state, before a later Finished-MAC failure could mask the issue. An absent client certificate is also rejected. No SRTP contexts or SCTP association are activated in the failed endpoint. Existing controls pass; no crypto-library patch was needed. |
| [Pion data after fingerprint failure](https://github.com/pion/webrtc/security/advisories/GHSA-74xm-qj29-cq8p) | Wrong fingerprints in both roles; all internal crypto read/write/protect/unprotect paths and SCTP creation denied after failure. The independent aiortc negative tests now also check every public audio/data send variant and repeated polls remain failed. |
| [Pion GCM nonce reuse](https://github.com/pion/dtls/security/advisories/GHSA-9f3f-wv7r-qc8r) | Both directions' actual DTLS encrypted records carry epoch/sequence nonces with strictly increasing counters in the tested flights and application records. Re-handshaking with the same certificates rejects old SRTP ciphertext and accepts fresh ciphertext at the same RTP sequence. This does not prove uniqueness for every retransmission/resumption mode; resumption and renegotiation are not exposed. |
| [Pion unbounded fragments](https://github.com/pion/dtls/security/advisories/GHSA-cx94-mrg9-rq4j) / [reconstruction loop](https://github.com/pion/dtls/security/advisories/GHSA-cm8f-h6j3-p25c) | 2,000 sparse/repeated/overlapping fragments and future message sequences remain incomplete without spinning. The source-build test inspects Mbed TLS's cumulative reassembly accounting: observed peak 18,012 bytes, limit 32,768. CTest bounds runtime and sanitizers cover accesses. Test-only cookie disabling reaches the reassembler; production keeps cookie checks. System-MbedTLS builds omit the private accounting test. This is not a measurement of total crypto heap or every allocation-failure point. |
| [GStreamer fingerprint presence](https://gstreamer.freedesktop.org/security/sa-2026-0061.html) | A 90-case matrix covers absent, SHA-256 and unsupported-only fingerprints at session/tag/non-tag scope, both DTLS answer roles, and audio/data/bundled media profiles. Effective fingerprint selection and atomic rejection pass. |
| [libdatachannel receive-length bug](https://github.com/paullouisageneau/libdatachannel/pull/1564) | Real adapter callback tests alternate long/short datagrams with poisoned output tails, require actual received length, and reject undersized/over-capacity datagrams. |
| [libdatachannel queue pressure](https://github.com/paullouisageneau/libdatachannel/pull/1546) / [Firefox teardown UAF](https://www.mozilla.org/en-US/security/advisories/mfsa2016-72/) | `peer_sctp_resources` fills all five accepted channels, checks the adapter's aggregate partial-message allocation bound (320 KiB), overflow discard-through-EOR, completion/recovery, injected allocation failure and repeated/double cleanup. Twenty rounds release all 100 tracked allocations. The shim measures adapter buffers, not all usrsctp queues. |
| [Janus/usrsctp cookie pointers](https://github.com/meetecho/janus-gateway/pull/2302) | `peer_sctp_cookies` reads the exact pinned upstream cookie layout in a separate translation unit. Both address fields are zero in 20 cookies. Ten full SCTP init/connect/queued-output teardown/deinit cycles pass; previous association cookies cannot establish a new one. This replaces the survey's temporary pointer-byte scan with a permanent field-level regression. |
| [libpeer/Espressif issues](upstream-issues.md) | Existing STUN authenticity, early ClientHello, consent, fragmentation, DCEP limits, RTP replay, SDP and lifecycle regressions remain enabled. New tests extend those boundaries; they do not substitute for dependency updates or full ICE support. |

## Independent browser interoperability

A new stdlib-only launcher runs a real Chromium browser with a disposable profile,
a synthetic capture device, a generated audio source, muted receive playback and
local HTTP signaling. It checks incoming non-concealed audio samples and messages
on channels opened from both sides, across three fresh connections per DTLS role.
The C driver also checks audio/message delivery and descriptor stability.

Use an installed Chromium/Chrome binary (or supply `--browser`):

```sh
python3 packages/peer/tests/interop/chromium.py ./build-peer/peer_interop --rounds 3
python3 packages/peer/tests/interop/chromium.py ./build-peer/peer_interop --server --rounds 3
```

`--server` selects the browser's DTLS role. `--bind-address` optionally selects a
local numeric IPv4 interface for the C peer. HTTP binds loopback, and no remote
STUN/TURN servers are configured; browser ICE may use other local interfaces.
Chromium's fake-device permission allows numeric host candidates for this test;
mDNS resolution remains unsupported in the library. No real microphone or user
browser profile is used. The test does not use DevTools/remote debugging.

Local Chrome 156 passed all six sessions. Linux CI runs the browser regression as
well as the existing independent aiortc attacks. This provides protocol/codec
interoperability evidence, not a replay of browser-specific memory exploits or a
test of the device's Opus implementation.

## Reproduction and limits

The normal source-built sanitizer suite runs all new regressions:

```sh
cmake -S packages/peer -B build-peer -G Ninja -DCMAKE_BUILD_TYPE=Debug
cmake --build build-peer -j 4
ctest --test-dir build-peer --output-on-failure
```

New tests use synthetic certificates, media bytes and local peers. No API key,
service endpoint, captured user audio or private network configuration is in the
fixtures. Test-only internal access and allocator/transport shims are confined to
host test executables; production authentication is unchanged.

Remaining coverage gaps include exhaustive crypto allocation failure injection,
large/malformed certificate chains beyond existing X.509 tests/fuzzing, global
memory budgets across multiple peers, slow-consumer/packet-loss soaks, MCU heap
measurements, and malformed raw Opus through the actual device decoder. Browser
video/DOM/permission bugs are outside this library's implemented surface. Fuzzing
and source inspection do not establish that all known or unknown bugs are fixed.


## UDP backpressure follow-up

A device smoke test initially disconnected after 61 and 219 seconds while
reporting `sendto` failures. A diagnostic build reproduced the failure after
468 seconds and identified its exact cause: **one consent probe failed locally
with `ENOMEM`, and `peer_connection_loop` treated that as fatal**. The last
valid consent response was only 5,123 ms old, consent was not revoked, and
DTLS/SCTP were still healthy. Previous replies passed the source, transaction,
authentication and local-mapping checks, with round trips around 35–50 ms.

[ESP-IDF 5.5.2 documents](https://docs.espressif.com/projects/esp-idf/en/v5.5.2/esp32s3/api-guides/lwip.html#limitations)
that full lower-layer UDP transmit buffers can return `ENOMEM`. That error is
not evidence of a whole-process heap leak. The device recovered its idle heap
and 19 tasks after failure. This investigation identifies the erroneous
**disconnect trigger**, not the precise RF/driver condition that caused the
queue pressure.

The fix treats `ENOMEM`, `ENOBUFS`, `EAGAIN` and `EWOULDBLOCK` as local datagram
loss for control traffic:

- Initial ICE checks keep their existing bounded retry/check deadlines.
- An established consent probe can be lost without killing the call. A later
  probe gets a fresh transaction ID at the normal randomized interval.
- The DTLS datagram BIO completes a temporarily dropped write without leaving
  a pending SSL buffer. Handshake flights and SCTP recover through their own
  retransmission mechanisms. This also avoids turning a lost SCTP packet into
  a fatal TLS error.
- RTP still reports send failure to its caller. No stale audio retry, blocking
  sleep, extra packet queue, certificate bypass or consent extension is added.
- Invalid sockets and real TLS errors remain terminal. Authentication,
  revocation and the [RFC 7675 30-second expiry](https://www.rfc-editor.org/rfc/rfc7675.html#section-5.1)
  remain enforced. Merely sending a probe does not renew consent.

`peer_backpressure` reproduces the old premature disconnect with only one second
since valid consent, then checks the fixed behavior, pacing, initial ICE retries,
RTP error reporting, successful subsequent sends, fatal socket errors, and
expiry despite a stale temporary error. The original TLS WANT_WRITE/fatal-write
regressions remain enabled.

A separate test executable replaces only its own socket translation unit and
injects one local send failure in each of ICE setup, DTLS handshake, SCTP traffic
and consent. Both aiortc roles pass three connections, with decoded audio and
working channels after loss. The real Chromium harness also passes both roles
with these injected errors. No fault injection is compiled into the library or
the device firmware. Optional ICE diagnostics log only validation flags/timing.
Physical recovery results are recorded with the device validation evidence in
PR #9; passing these tests does not prove loss-free audio or diagnose radio
conditions.
