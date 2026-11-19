# Cross-implementation WebRTC review leads — 2026-10-08

Version-specific findings below record the reviewed revisions. The current pins
are Mbed TLS 3.6.8 and 4.1.2; see [current provenance](provenance.md) and
[security review](security-review.md) for the maintained dependency/test scope.

This survey expands the [libpeer/Espressif comparison](upstream-issues.md) to
Chromium/libwebrtc, Firefox, Pion, libdatachannel, GStreamer, Janus/PJSIP and
aiortc, plus str0m's Rust testing architecture. It compares public advisories, patches and test strategies against the
implementation after PR #8. The initial survey did not confirm a new local
vulnerability. The follow-up [regression sweep](regression-sweep.md) implements
selected tests, records newly confirmed local bugs and fixes, and distinguishes
them from upstream-only findings. Neither pass claims exhaustive coverage.

A browser integration, a shared library and a codec wrapper are different attack
surfaces. Firefox and Chromium also share some upstream code, so overlapping
reports are not necessarily independent discoveries. The comparisons below are
our applicability assessments; linked sources establish the upstream behavior.

Status terms:

- **Existing evidence:** a local control and relevant regression already exist;
  the complete upstream exploit has not necessarily been replayed.
- **Source checked:** the relevant control was inspected in our exact pinned
  source; stronger adversarial or resource measurements remain useful.
- **Test gap:** a transferable failure pattern lacks a dedicated regression here.
- **Excluded path:** the specific implementation/feature is absent; this is not
  proof that the general failure class is absent elsewhere.

## Chromium/libwebrtc and Firefox

| Primary source / issue | Applicability and next check |
| --- | --- |
| [Project Zero's WebRTC investigation](https://projectzero.google/2018/12/adventures-in-video-conferencing-part-1.html): stateful RTP processing, codec dispatch, index checks and FEC bounds | **Excluded paths / test gap.** We omit video and RTP FEC, so those specific VP8/VP9/H.264/FEC paths are absent. The reusable technique is to mutate media before authentication/encryption and replay packet sequences together with their negotiated SDP. Our standalone RTP parser fuzzing does not cover the device Opus decoder. |
| [Chrome CVE-2022-2294 advisory](https://chromereleases.googleblog.com/2022/07/extended-stable-channel-update-for.html): WebRTC heap overflow, exploited in the wild | **Review lead, not an applicability verdict.** The release advisory establishes severity/history but does not expose enough implementation detail to identify an equivalent path here. Do not turn a browser-wide CVE label into a claim that our library is affected or fixed. |
| [libwebrtc's fuzzer manifest](https://webrtc.googlesource.com/src/%2B/main/test/fuzzers/BUILD.gn) | **Test strategy.** Separate targets exercise SDP parsing and SDP integration, STUN parsing and validation, RTP, RTCP, audio processing and codecs. Expand our current combined parser harness with protocol dictionaries, semantic invariants and state-machine tests; differential parsing must account for our smaller supported subset. |
| [Firefox CVE-2015-7210](https://www.mozilla.org/en-US/security/advisories/mfsa2015-138/) and [CVE-2016-5258](https://www.mozilla.org/en-US/security/advisories/mfsa2016-72/): data-channel/DTLS shutdown use-after-free | **Existing controls / test gap.** Our owner-thread contract, deferred teardown and joined audio tasks reduce these races. Repeated idle and connected calls are narrower evidence than forced teardown during callbacks, partial messages, timer output and allocation failures. Add scheduled interleaving tests obeying the public API contract. |
| [Firefox CVE-2024-4764](https://www.mozilla.org/en-US/security/advisories/mfsa2024-21/): multiple consumers claiming an audio input | **Analogous app-layer lead.** We do not use Firefox's device manager. Audit Waveshare audio ownership when another launcher app, diagnostics, capture and cleanup overlap; transport-only host sanitizers cannot validate the board driver. |

[WebRTC's security guidance](https://webrtc.github.io/webrtc-org/bugs/security/)
notes that only a subset of standalone libwebrtc is used by Chromium. Track the
library's fixes and its dependencies, not only Chrome release announcements.
[Project Zero's concluding recommendations](https://projectzero.google/2018/12/adventures-in-video-conferencing-part-5.html)
also emphasize replay tooling, keeping unused features disabled, and maintaining
an explicit patch strategy for copied/forked code.

## Authentication and handshake state

| Primary source / issue | Applicability and next check |
| --- | --- |
| [Pion CVE-2021-28681](https://github.com/pion/webrtc/security/advisories/GHSA-74xm-qj29-cq8p): data channels continued after certificate verification failed | **Existing evidence.** Fingerprint verification precedes SRTP activation and SCTP creation; negative-fingerprint tests in both roles deliver zero audio/messages and repeated polls remain failed. Extend this to queued early application records and every send path after failure. |
| [Pion CVE-2022-29222](https://github.com/pion/dtls/security/advisories/GHSA-w45j-f832-hxvh): client certificates accepted without CertificateVerify | **Source checked / high-priority test gap.** Mbed TLS's `ssl_parse_certificate_verify` checks the handshake message and signature when a peer certificate is present; our final pin check also rejects absent certificate data. Add a peer presenting the expected public certificate while omitting, replaying or corrupting proof of private-key possession. A fingerprint-mismatch test does not test this property. |
| [Pion CVE-2026-26014](https://github.com/pion/dtls/security/advisories/GHSA-9f3f-wv7r-qc8r): random AES-GCM nonces could repeat | **Source checked.** Our Mbed TLS 3.6.7 AEAD path derives the dynamic nonce from the record counter (`rec->ctr`), rather than sampling each nonce randomly. Add wire-level nonce/counter checks across retransmissions, reconnects and new keys. This concerns DTLS GCM; our SRTP profile is AES-CM/HMAC-SHA1-80. |
| [GStreamer CVE-2026-14935](https://gstreamer.freedesktop.org/security/sa-2026-0061.html): inverted SDP fingerprint-presence validation | **Existing evidence / expand truth table.** Our SDP follow-up requires an effective SHA-256 fingerprint, implements media-set replacement and rejects unsupported-only overrides atomically. Add an explicit absent/session/media/both matrix across active sections and roles, including conflicting or malformed alternatives. This is analogous to, not the same implementation as, the GStreamer bug. |
| [GStreamer CVE-2026-59692](https://gstreamer.freedesktop.org/security/sa-2026-0062.html): oversized certificate subject formatting overflow | **Excluded wrapper / test gap.** We do not format a remote Subject DN into that buffer; we hash certificate DER. Mbed TLS still parses certificates before the pin check. Expand certificate fixtures to large/empty DNs, long chains, unsupported keys and malformed extensions, with allocation and CPU budgets. |
| [libdatachannel #1554](https://github.com/paullouisageneau/libdatachannel/pull/1554): ClientHello arrived before the receive handler was registered | **Existing evidence.** Our bounded early-ClientHello cache is restricted to the current candidate and released only after authenticated ICE. Test hello-before-ICE, repeated hellos, candidate changes, old-session datagrams and both DTLS roles together. This is also a startup-latency issue. |

## Resource limits, parsing and ownership

| Primary source / issue | Applicability and next check |
| --- | --- |
| [Pion CVE-2022-29189](https://github.com/pion/dtls/security/advisories/GHSA-cx94-mrg9-rq4j): unbounded inbound DTLS fragment buffer | **Source checked / test gap.** Mbed TLS checks a total reassembly/future-message budget; its host default is 32 KiB. Our early cache holds two datagrams. Measure actual host and ESP configurations under incomplete/overlapping fragments and many future message numbers, including failed allocation and eventual cleanup. A per-datagram size cap alone is insufficient. |
| [Pion CVE-2022-29190](https://github.com/pion/dtls/security/advisories/GHSA-cm8f-h6j3-p25c): reconstruction loop without progress | **Test gap.** Fuzz repeated/overlapping/zero-length fragments and coalesced records while checking bounded progress. Our four-record poll budget and fuzzer timeout help, but do not establish a bound inside every crypto/library call. |
| [Pion STUN CVE-2026-54909](https://github.com/pion/stun/security/advisories/GHSA-34rh-wp3j-6cxc) and [DTLS CVE-2026-54908](https://github.com/pion/dtls/security/advisories/GHSA-wg4g-wm44-ch5j): malformed field lengths | **Existing evidence / excluded cipher.** Our STUN parser validates address-family-specific lengths with byte reads and truncation tests. ECDHE-PSK is not enabled. Reuse the general nested-length test pattern for every enabled handshake message, rather than importing an inapplicable PSK test verbatim. |
| [libdatachannel #1564](https://github.com/paullouisageneau/libdatachannel/pull/1564): receive callback returned capacity instead of actual bytes | **Source checked.** `recv_dtls` returns the copied datagram length and refuses oversize input. Add alternating short/long/coalesced datagrams with poisoned unused tails to prevent stale-buffer parsing regressions. |
| [libdatachannel #1546](https://github.com/paullouisageneau/libdatachannel/pull/1546): full DTLS input queue | **Existing bounds / test gap.** Our app queues, reorder queue and SCTP message buffers are bounded. Test overload with an active slow consumer, not just quiet calls: allocation high-water, latency, drops, recovery and owner-loop responsiveness. Also measure aggregate memory across all partial channels. |
| [libdatachannel #1567](https://github.com/paullouisageneau/libdatachannel/pull/1567): in-flight receive callback survives detach | **Analogous lifetime lead.** Detaching a callback is not necessarily a join. We do not use libnice's callback thread, but usrsctp retains an iterator thread and the app has audio tasks. Review each shutdown barrier and test delayed callback/timer completion. The linked PR is a report/patch lead, not a claim about every released libdatachannel version. |
| [libdatachannel #1531](https://github.com/paullouisageneau/libdatachannel/pull/1531) and [#1555](https://github.com/paullouisageneau/libdatachannel/pull/1555): RTP/RTCP and REMB size checks | **Existing evidence / excluded interpretation.** Our code validates RTP extensions/padding and RTCP outer lengths plus implemented report minima. It does not interpret REMB or SDES items. Add authenticated compound RTCP with contradictory counts/lengths/padding and assert no unsupported-report effects. Do not describe outer framing checks as complete semantic SDES/REMB validation. |
| [GStreamer-SA-2026-0074](https://gstreamer.freedesktop.org/security/sa-2026-0074.html): unbounded RTP source table | **Existing control / test gap.** We pin one authenticated remote SSRC. Stress thousands of new SSRCs, with both invalid and valid tags, and measure libSRTP allocation behavior before and after pinning. Packet and per-message bounds do not establish a global resource budget. |
| [Janus SDP candidate replacement advisory](https://github.com/meetecho/janus-gateway/security/advisories/GHSA-fc3v-cp6h-jfw5): 16-bit length truncation during string expansion | **Excluded path.** We do not resolve/rewrite trickled candidate strings; complete SDP is below 8 KiB and lines below 1,024 bytes. Retain boundary tests around conversions between `size_t`, signed sizes and protocol widths when adding features. |
| [PJSIP legacy STUN response advisory](https://github.com/pjsip/pjproject/security/advisories/GHSA-893w-fmvw-qvg7): forged mapping responses | **Existing evidence, distinct trust levels.** Our discovery path checks transaction and source; ICE connectivity/consent checks additionally authenticate using peer credentials. Public STUN discovery is not equivalent to authenticated ICE. Retain wrong-source/transaction tests and add delayed responses from previous discovery attempts. |

## SCTP cookie-pointer lead: checked, not reproduced

[Janus #2302](https://github.com/meetecho/janus-gateway/pull/2302) replaced opaque
application pointers with IDs because older usrsctp integrations exposed pointers
in SCTP cookies. Our adapter also passes `Sctp *` as the AF_CONN address, so this
was worth checking against the exact dependency, not dismissing by library name.

The pinned usrsctp `c625e21950600460cb5c6075616eb1622df2b06a`
[output code](https://github.com/sctplab/usrsctp/blob/c625e21950600460cb5c6075616eb1622df2b06a/usrsctplib/netinet/sctp_output.c)
clears AF_CONN address fields in the serialized cookie after signing, and the
receiver reconstructs them for verification. A local in-memory association probe,
based on our existing SCTP fuzz bridge, inspected two INIT-ACK state-cookie
parameters before DTLS encryption and found **zero occurrences of either
emitting association pointer**. Both associations connected and shut down.

This source check and narrow probe do not establish absence of every pointer
leak, but they do establish that merely finding `sconn_addr = s` is not sufficient
to claim the old cookie disclosure in this pin. The follow-up
`peer_sctp_cookies` regression now checks both address fields
against the pinned upstream layout and replays cookies across teardown/reinit.
Opaque IDs could still be considered separately for lifetime hardening.

## Audio and packet-sequence leads

| Primary source / issue | Applicability and next check |
| --- | --- |
| [aiortc changelog](https://aiortc.readthedocs.io/en/latest/changelog.html): early RTP sequence wrap broke SRTP; RTCP counters overflowed | **Test gap.** Our audio tests cover RTP sequence/timestamp wrap, but not SRTP rollover-counter synchronization when the first packets near wrap are lost. Force starts near 65,535, drop initial packets and reorder across wrap through real libSRTP. RTCP sender reports are currently not emitted; preserve this case for future support. |
| [GStreamer CVE-2026-18297](https://gstreamer.freedesktop.org/security/sa-2026-0053.html): excessive Opus channel count overflowed wrapper arrays | **Excluded wrapper / device test gap.** The reported stream-header/channel-mapping path is not used here; our board decoder is configured mono at 24 kHz. The actual Espressif decoder still needs malformed raw Opus tests, including duration/channel-mode changes and 120 ms output capacity, with guard buffers and failure recovery. Passing the host transport suite does not validate this decoder. |

## Rust implementation: str0m testing ideas

[str0m](https://github.com/algesten/str0m) keeps network I/O and scheduling outside
its `Rtc` object, with no internal threads/tasks. That is a useful reference for
deterministic packet/time simulation even though adopting a different transport
is not proposed here. Its [nightly fuzz workflow](https://github.com/algesten/str0m/blob/main/.github/workflows/fuzz.yml)
runs each listed target for ten minutes, illustrating a sustained campaign beyond
our short CI smoke runs. This is a testing/architecture reference, not a claim
that Rust or str0m eliminates authentication, state-machine or resource bugs.

## Highest-value next tests

This was the initial test backlog. The [follow-up evidence table](regression-sweep.md)
records implemented coverage and the remaining gaps; the items below are broader
than the tests completed so far.

1. **Handshake authentication matrix.** Matching public certificate with missing,
   corrupted or replayed CertificateVerify; absent certificate; early SCTP/media;
   queued data on fingerprint failure. Assert zero delivery and no accepted sends
   after a terminal failure, in both DTLS roles.
2. **Resource and progress budgets.** Fragment floods, sparse/overlapping fragments,
   future epochs, channel fragmentation, SSRC churn, queue pressure and allocation
   failures. Measure peak/retained memory, work per poll, timeout and cleanup on
   both host and device; cap aggregate allocations, not only individual packets.
3. **Stateful authenticated media replay.** Mutate RTP/RTCP before SRTP protection,
   preserve negotiated SDP and timing, exercise sequence/ROC wrap and reconnect
   epochs, and run valid traffic after malformed traffic. Add a target-side Opus
   replay harness so malformed payloads reach the real decoder.
4. **Lifecycle fault injection.** Cancel at each ICE/DTLS/SCTP stage; defer close
   from callbacks as required by our API; delay task completion and timer output;
   repeat after injected allocation/send failures. Check callbacks, tasks, sockets
   and memory after each teardown.
5. **Broader interoperability and differential checks.** Add Pion and an actual
   Chromium browser alongside aiortc, then libdatachannel. Compare parse results
   only within our supported SDP profile. A parser accepting more legal SDP is
   not automatically a security failure in the stricter implementation.

Use long-lived, minimized regression corpora and retain complete reproductions:
negotiated SDP, packet sequence/timing, library/configuration versions and seed.
Keep credentials and captured user audio out of public corpora. No other
implementation's code or corpus was imported in this pass.

## Evidence limits

Public advisory pages, release notes and issue discussions occasionally disagree
about patch versions or merge status. This document uses them as bug-pattern
sources and names actual local controls; it does not prescribe those projects'
upgrade versions. Empty advisory lists do not imply a clean implementation.
Browser-only permission UI, DOM/JavaScript lifetime, video/FEC/RTX, TURN/TCP,
renegotiation and server-plugin/file/URL features should remain outside the
current package unless deliberately added with new review and tests.

The initial documentation-only survey performed the cookie probe and source
checks above. See the [follow-up validation](regression-sweep.md) for the new
regressions, actual fixes, sanitizer/fuzz results and remaining exclusions.
No physical-device security certification is implied.
