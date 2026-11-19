# Correctness review — 2026-10-07

This pass reviewed ordinary connection setup, packet loss, RTP/SCTP delivery,
API return values, and the Waveshare controller/audio teardown paths. It is
separate from the [security review](security-review.md). Findings below are
correctness fixes, not new vulnerability claims.

## Findings fixed

| Finding | Observable effect | Fix and regression |
| --- | --- | --- |
| Failed peers returned success on later polls | An application checking `peer_connection_loop()` could observe failure once, then incorrectly treat the terminal peer as healthy. | Keep returning `-1` while the state is `FAILED`. The real negative-fingerprint interoperability tests poll three more times and require failure on each call. This test failed against the previous implementation. |
| Unsupported hostname candidates invalidated the entire answer | An answer containing an mDNS hostname plus a usable numeric IPv4 candidate was rejected, even though no hostname resolution was necessary. | Validate and skip unsupported hostname candidates, retaining numeric candidates. The mixed-candidate test failed before the fix and now passes; malformed names and answers with no usable candidates still fail. No DNS lookup is performed for remote SDP. |
| STUN URIs without an explicit port were silently ignored | Configuring `stun:host` produced no server-reflexive candidate instead of using the default port. Malformed configuration was also accepted at creation and ignored later. | Share URI validation between peer creation and gathering; default to port 3478 and reject malformed/unsupported forms early. Tests cover the default, an explicit port, case-insensitive scheme, and invalid forms. |
| STUN gathering never retransmitted | A single lost request or response prevented candidate discovery for that server. | Retransmit the same transaction once after 500 ms within the existing one-second window. A loopback server deliberately discards the first request, verifies the repeated transaction/source, and then returns a simulated NAT mapping. |
| Server-reflexive SDP omitted the related address and port | Generated candidates lacked required `raddr`/`rport` fields, risking rejection by stricter peers. | Retain the local base address during discovery and serialize it on non-host candidates. The discovery test distinguishes the simulated NAT mapping from the loopback base and checks the emitted fields. Candidate serialization also fails cleanly if its output buffer is too short. |
| RTP delivered in arrival order | A reordered or very late packet could reach the Opus decoder after a newer packet. | Queue up to eight authenticated packets, wait at most 40 ms for a missing sequence, and discard packets behind playback. Deterministic tests cover order, idle expiry, duplicates, overflow, invalid framing, and sequence/clock wrap. Independent aiortc tests send original authenticated packets out of order and after the deadline. |
| RTP timestamps ignored microphone capture gaps | Frames dropped from the microphone queue compressed the media timeline because timestamps advanced only on send. | Add `peer_connection_send_audio_at()` with a 48 kHz capture clock; the Waveshare queue retains that clock across drops. Tests cover a dropped frame, invalid/backward timestamps, wraparound and API-mode mixing. aiortc inspects transmitted RTP headers and verifies the deliberate 1,920-sample gap among ordinary 960-sample increments. |

The URI behavior follows [RFC 7064 §3.2](https://www.rfc-editor.org/rfc/rfc7064#section-3.2).
Skipping unsupported FQDN candidates and including related addresses follow
[RFC 8839 §5.1](https://www.rfc-editor.org/rfc/rfc8839#section-5.1).
This is still an IPv4/UDP implementation, not added mDNS, IPv6, or TURN support.

## Initial correctness-pass validation

- Transport unit/regression tests passed with ASan/UBSan, including simulated
  NAT discovery with and without a lost initial STUN request.
- Six independent aiortc interoperability sessions passed: three in each DTLS
  role. Each deliberately dropped the first outgoing DTLS datagram, recovered,
  exchanged Opus and data-channel messages, and exercised the existing malformed
  traffic, fragmentation, and coalesced-record regressions.
- Both negative-fingerprint sessions passed, including repeated terminal-error
  polling. Descriptor checks and global teardown completed successfully.
- All six native core SDK tests passed.
- A 31-second parser fuzz smoke run completed 619,616 executions without a
  sanitizer finding. This is bounded regression evidence, not exhaustive testing.
- The Waveshare ESP-IDF firmware rebuilt successfully and fit its app partition.
  This pass did not flash the device or run another physical voice session.

## Audio follow-up validation

The audio regression executable passes 114 checks under ASan/UBSan. The existing
1,049 security assertions and six core SDK tests also pass. Six adversarial
aiortc sessions (three per DTLS role) verify reordered/late authenticated RTP and
capture-clock gaps while continuing to exchange decoded Opus and messages.
Both fingerprint-rejection tests and audio-only/data-only modes pass. A bounded
31-second parser/reorder-queue fuzz run completed 492,216 executions without a
sanitizer finding. Hardware results are recorded separately in the
[device validation record](../../../docs/waveshare-validation.md).

## Limits and unresolved behavior

The new discovery retry remains deliberately short; prolonged loss or a slow
STUN response can still exhaust the one-second window. DNS resolution itself is
synchronous. More general asynchronous discovery and retry policy remain future
work.

The audio follow-up adds bounded receive reordering and capture-clock sends,
but not adaptive jitter buffering, packet-loss concealment, or acoustic echo
cancellation. A packet that misses the reorder deadline remains lost. These fixes
address two concrete timing defects; they do not by themselves establish that
all reported choppiness is gone.

The [device validation record](../../../docs/waveshare-validation.md) now includes
five connected media sessions, graceful reconnects, active-call CPU intervals and
stable cleanup memory/task counts. A human listening result, a spoken exchange,
forced network-loss recovery and longer soak testing remain unverified. Host
regressions and quiet-room media runs cannot substitute for those checks.
