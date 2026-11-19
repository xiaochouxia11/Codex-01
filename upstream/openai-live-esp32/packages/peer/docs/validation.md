# Validation record — 2026-10-07

The campaign below records historical results on its stated revisions. Current
source pins are Mbed TLS 3.6.8 and 4.1.2; the maintained CI matrix runs both paths
through sanitizers, both DTLS roles, aiortc and Chromium interoperability, negative
authentication/media tests, reconnects, backpressure and bounded fuzzing. See
[security review](security-review.md) and [provenance](provenance.md) for current
scope and limits. Historical timings and hardware results are not automatically
revalidated by a dependency version update.

Initial local campaign on macOS arm64 with Clang, ASan/UBSan, Mbed TLS 3.6.7,
libSRTP 2.8.1, the pinned usrsctp revision, and aiortc 1.15.0. These are measured
results for the bounded implementation, not a security guarantee.

| Check | Result |
| --- | --- |
| Security regressions | 625 assertions pass, including local UDP and STUN-server fixtures |
| Independent interoperability | Two-way decoded Opus; channels opened by either peer; both DTLS roles pass |
| Message behavior | Empty, UTF-8, and 64 KiB messages round-trip; oversized/invalid messages rejected and subsequent messages work |
| Live packet rejection | Each adversarial session rejects at least 2 invalid/replayed RTP and 3 invalid/replayed/malformed RTCP packets; valid media continues |
| Fingerprint mismatch | Both roles fail with zero delivered audio/messages |
| Media subsets | Audio-only and data-only sessions pass |
| Lifecycle | Repeated sessions within one process, stable open-descriptor counts, successful global SCTP shutdown; repeated create/close/destroy/init/deinit tests |
| CMake embedding | Separate public-header-only release consumer builds, links, creates an offer, and shuts down |
| Clang static analyzer | No diagnostics in 14 local transport translation units |
| Parser fuzzing | 4,028,973 total inputs over four bounded runs; no sanitizer failure |
| DTLS fuzzing | 17,357 inputs over two bounded runs; no sanitizer failure |
| Stateful SCTP fuzzing | 44,753 inputs over two bounded runs; no sanitizer failure |
| Repository checks | C/Python formatting, Python lint, diff whitespace, and package private-detail scan pass |

Each fuzz run was approximately 61 seconds. Runs were made as the hardening
changes evolved, with affected tests and fuzz targets rerun after changes. The
last parser run, after discovery hardening, processed 699,555 inputs. The last
DTLS and SCTP runs processed 10,591 and 22,223 inputs respectively. Longer campaigns
can expose states these short runs did not reach.

Combined source coverage from unit, integration, and fuzz runs is **85.75% of
local-library lines and 69.45% of branches**. This excludes dependencies and is
not a coverage claim for the entire cryptographic/SCTP stack. Selected local
source line coverage:

| Source | Lines covered |
| --- | ---: |
| SDP | 96.76% |
| STUN | 95.77% |
| ICE agent | 87.50% |
| DTLS/SRTP integration | 89.31% |
| SCTP/DCEP integration | 90.72% |
| RTP framing | 93.18% |
| RTCP framing | 100.00% |

Uncovered branches include allocation/system-call failures, unsupported platform
paths, and compatibility helpers. 100% RTCP line coverage does not mean all
possible report structures are supported or verified; unimplemented report types
have no behavior beyond framing checks/counting.

The [completed Linux run](https://github.com/openai/openai-live-esp32/actions/runs/37685577029)
passed sanitizer regressions, embedding, interoperability, fingerprint rejection,
media subsets, and all three fuzz smoke tests. Its logs contain no ASan, UBSan,
or LeakSanitizer diagnostics. This run added 986,438 parser, 1,570 DTLS, and 7,691
SCTP fuzz inputs (not included in the local counts above).

Sanitizer builds make undefined-behavior reports fatal, so future tests cannot
pass merely because UBSan recovered after a diagnostic.

The Linux GitHub Actions workflow reproduces sanitizer regressions, embedding,
interoperability, both fingerprint failures, media subsets, and three fuzz smoke
tests. Local macOS validation alone does not establish Linux/MCU support. The PR's
completed CI result is the source of truth for Linux execution.

To collect local-source coverage, configure with `LIVE_PEER_COVERAGE=ON` using
Clang, set `LLVM_PROFILE_FILE` to a per-process path (`%p.profraw`) while running
tests, merge with `llvm-profdata merge -sparse`, and use `llvm-cov report` with the
unit, interop, and fuzz executables as objects. Keep raw generated corpora, logs,
profiles, and binaries outside the committed package.

## Second review pass — 2026-10-07

The [upstream issue comparison](upstream-issues.md) records the reviewed reports
and the corresponding applicability decisions. This pass adds:

- **901 passing assertions**, including real in-memory DTLS/SCTP peers, injected
  fatal/pending TLS writes, DCEP control-message limits, SCTP restart rejection,
  consent expiry/403 revocation, STUN mapping validation/duplicates, delayed ICE
  retransmission, checklist priority, and bounded early ClientHello buffering.
- Three adversarial sessions per DTLS role, using non-default remote SCTP port
  6000. Initial and cookied ClientHello fragmentation succeeds with Mbed TLS as
  server. All sessions retain working bidirectional Opus and data after malformed
  packets; fingerprint rejection and audio-only/data-only tests also pass.
- A coalesced seven-record DTLS datagram must deliver its final application
  message before SCTP retransmission. The test times out on the prior executable
  and succeeds after the buffered-read fix.
- Clang analysis over all 14 local translation units reports no diagnostics.
- Separate 61-second ASan/UBSan fuzz runs processed **1,006,156 parser inputs,
  12,841 DTLS inputs, and 22,916 stateful SCTP inputs**, with no sanitizer failure.
  The standalone release consumer also rebuilt and ran successfully.

The earlier coverage percentages apply to the first campaign only; they were
not recomputed for the additional branches in this pass. Host tests do not
establish MCU performance, real NAT behavior, or complete WebRTC conformance.

## Cross-implementation regression sweep — 2026-10-08

See the [finding/test matrix](regression-sweep.md) for exact applicability and
remaining gaps. New source-built ASan/UBSan test groups cover authenticated media
source selection and source churn, RTCP report/count/padding boundaries, SRTP
startup rollover, DTLS private-key proof and nonce behavior, bounded fragment
retention, SCTP partial-message allocation failure and cookie/lifecycle behavior.
All **eight transport CTest groups** and **six SDK groups** pass locally.

- Six independent adversarial aiortc sessions (three per DTLS role) retain decoded
  audio and bidirectional data after malformed/replayed packets. Both fingerprint
  rejection cases pass, including every public send variant after failure.
- Real Chrome 156 passes three fresh connections per DTLS role, with received
  audio samples and messages on browser- and C-opened channels. The new browser
  harness and both roles are included in CI.
- Three 61-second sanitizer fuzz runs complete with **730,604 parser inputs,
  5,929 DTLS inputs and 22,815 SCTP inputs**, without sanitizer diagnostics.
- Clang static analysis of all 14 local transport translation units reports no
  diagnostics. The release embedding consumer builds and runs.
- The Waveshare ESP32-S3 firmware builds successfully with the media/RTCP fixes;
  image size is 6,323,152 bytes, with approximately 25% of its app partition free.
  This pass does not flash the device, run a physical voice session, fuzz the
  board's Opus decoder or remeasure device heap/audio performance.

The host DTLS fragment test uses the pinned source's internal reassembly counter,
not a total-heap measurement. The SCTP allocation shim covers only adapter-owned
partial-message buffers. The macOS sanitizer results do not substitute for Linux
LeakSanitizer or MCU memory testing; CI runs the same native regression suite on
Linux. Earlier coverage percentages were not recomputed for this pass.
