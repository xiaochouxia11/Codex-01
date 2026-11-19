# Upstream issue comparison — 2026-10-07

Version-specific findings below record the reviewed revisions. The current pins
are Mbed TLS 3.6.8 and 4.1.2; see [current provenance](provenance.md) and
[security review](security-review.md) for the maintained dependency/test scope.

This review compares public issue reports, maintainer comments, release notes,
and the actual pinned sources with this portable package. An issue report is a
review lead, not an independently confirmed CVE or a claim about every upstream
version. “Covered” below describes our implementation and named tests, not an
attestation that libpeer, esp_peer, or every dependency is free of vulnerabilities.

The [cross-implementation survey](cross-implementation-review.md) expands this
comparison to Chromium/libwebrtc, Firefox, Pion, libdatachannel, GStreamer,
Janus/PJSIP, aiortc and str0m, with explicit distinctions between existing evidence,
source checks, excluded features and new test gaps.

## libpeer reports

The reference remains libpeer commit
`5b849de378545c31d34759a145413846953e1366`. The public repository's advisory
endpoint returned no published advisories, but its issue tracker contains
substantial security reports. An empty advisory list was not treated as clearance.

| Reports | Applicability and evidence in this package |
| --- | --- |
| [#283: unauthenticated RTP / H.264 corruption](https://github.com/sepfy/libpeer/issues/283), [#274: ignored SRTP failures](https://github.com/sepfy/libpeer/issues/274) | Covered: selected-source filtering, mandatory SRTP/SRTCP authentication and replay checks before delivery, bounded RTP parsing. H.264/video decoders are absent. Unit crypto tests and live forged/replayed packets verify rejection and continued valid traffic; no RCE exploit was run. |
| [#264: STUN attribute overflow](https://github.com/sepfy/libpeer/issues/264), [#191: excessive candidates](https://github.com/sepfy/libpeer/issues/191) | Covered: datagram/TLV/string/candidate bounds, exact fixed-size attributes, duplicate checks, atomic SDP parse. Mutation, truncation, oversized-attribute and candidate-limit regressions plus parser fuzzing. |
| [#287: predictable/colliding ICE credentials](https://github.com/sepfy/libpeer/issues/287) | Covered: Mbed TLS entropy, 16-character ufrag and 32-character password, fresh random transaction IDs. No time-seeded `rand()` fallback. Tests check successive values differ; that is not an entropy-quality certification for future hardware ports. |
| [#277: incomplete ICE validation](https://github.com/sepfy/libpeer/issues/277) | Pending transaction, source tuple, HMAC/fingerprint, and a valid XOR-MAPPED-ADDRESS are required. Initial nomination may learn one local IPv4 peer-reflexive mapping for NAT; after selection, a changed mapping is rejected. Tests cover direct/NAT cases and reject invalid mapping, wrong key/source/transaction, and replay. Remote peer-reflexive candidates are unsupported. |
| [#281: fingerprint mismatch cleanup](https://github.com/sepfy/libpeer/issues/281), [#275: SRTP profile mismatch](https://github.com/sepfy/libpeer/issues/275) | Covered: certificate fingerprint and negotiated profile checked before enabling SRTP/SCTP; failures release state. Both DTLS roles and both negative-fingerprint sessions are exercised. |
| [#272: DTLS association identity](https://github.com/sepfy/libpeer/issues/272), [#276: reset on old transport](https://github.com/sepfy/libpeer/issues/276) | Added random 192-bit `tls-id` offers and validation of supplied IDs. An existing peer cannot renegotiate or replace its accepted answer; a new peer gets new credentials, certificate and socket. The OS chooses ephemeral ports; this package does not maintain a history preventing recently used port reuse. |
| [#273: DCEP parity](https://github.com/sepfy/libpeer/issues/273), [#279: message limit](https://github.com/sepfy/libpeer/issues/279), [#280: SCTP port](https://github.com/sepfy/libpeer/issues/280) | Role-bound stream IDs, negotiated message limits, and remote SCTP port are enforced. This pass extends the limit to DCEP control messages. A real in-memory DTLS/SCTP pair tests limits; live interop uses remote port 6000 and opens channels from both sides. |
| [#169: cleanup/thread leaks](https://github.com/sepfy/libpeer/issues/169), [#162: ring-buffer alignment](https://github.com/sepfy/libpeer/issues/162) | HTTP/MQTT signaling and the old ring buffer are absent. No-thread usrsctp is shut down explicitly; repeated sessions verify descriptor stability and successful global teardown. |
| [#266](https://github.com/sepfy/libpeer/issues/266), [#268](https://github.com/sepfy/libpeer/issues/268): RTP bitfield layout | Covered: explicit wire-byte reads/writes, no compiler bitfield layout dependency; decoded two-way Opus on macOS and Linux. |
| [#62: candidate priority](https://github.com/sepfy/libpeer/issues/62) | Fixed in this pass: sort the bounded checklist using controlling-role pair priorities; test priority order and fallback after timeout. |
| [#228: TLS write retry](https://github.com/sepfy/libpeer/issues/228) | The referenced signaling wrapper is absent, but the same API rule mattered in our DTLS adapter: a failed/pending write now terminates the context rather than permitting a different SCTP buffer on the next call. Real DTLS pairs inject fatal and WANT_WRITE results and check that the context is never reused. UDP sends are nonblocking. The subsequent device follow-up treats temporary UDP queue pressure as datagram loss inside the BIO, so it never creates a pending TLS write; real TLS failures and WANT_WRITE results remain terminal. See the [regression sweep](regression-sweep.md#udp-backpressure-follow-up). |

The [bulk protocol report #282](https://github.com/sepfy/libpeer/issues/282)
was also reviewed:

- C12/C14/C20/C21/C23: actpass offers, authenticated ICE usernames, port-9
  placeholders, required RTCP mux, and exact Opus payload matching are covered.
- C17: fixed by rejecting `ice-mismatch`; non-ICE fallback is unsupported.
- C15: this API consumes a complete candidate list once and has a bounded check
  deadline; trickle ICE and its completion state machine are unsupported.
- C16/C19/C24/C29/C30/C33/C34: offer answering, renegotiation, multiple RTP media,
  video, feedback negotiation and MID-based multi-track routing are outside the
  accepted subset. RTP extension lengths are still validated before skipping.
- C38: local SSRCs are random and remote SSRC allocation is bounded to one.
  SSRC collision recovery and RTCP BYE-driven source replacement remain unsupported.
- C13/C18: `ice2` is deliberately not advertised. This is still a limited,
  aggressively nominated ICE implementation, not full RFC 8445 ICE: role-conflict
  handling, triggered checks and peer-reflexive discovery remain future work.

## Espressif reports and release notes

The [esp_peer changelog](https://github.com/espressif/esp-webrtc-solution/blob/main/components/esp_peer/CHANGELOG.md)
was reviewed through v1.5.6. No vendor implementation was imported.

| Reports / change categories | Applicability and evidence |
| --- | --- |
| [#175: fragmented ClientHello](https://github.com/espressif/esp-webrtc-solution/issues/175), v1.5.2–1.5.3 DTLS changes | Pinned Mbed TLS 3.6.7 source handles reassembly. The live test splits both initial and cookied ClientHello into separate DTLS records; both complete successfully. This is a protocol regression, not a Chrome/device compatibility certification. |
| [#205: early ClientHello and malformed keepalive](https://github.com/espressif/esp-webrtc-solution/issues/205), v1.5.6 | Added a two-datagram ClientHello cache, restricted to the current candidate, released only after authenticated ICE success and cleared on candidate change. Unit tests verify the gate and bound. Consent requests already include USERNAME, PRIORITY and MESSAGE-INTEGRITY. |
| [#163: RTT >400 ms](https://github.com/espressif/esp-webrtc-solution/issues/163) | Initial retransmissions preserve the transaction ID; a unit test simulates a 600 ms retry before accepting the original response. The current 1.5-second per-pair and 20-second total deadlines still limit high-latency networks. |
| [#181](https://github.com/espressif/esp-webrtc-solution/issues/181), [#190](https://github.com/espressif/esp-webrtc-solution/issues/190): reconnect leaks; [#131: reused data-channel state](https://github.com/espressif/esp-webrtc-solution/issues/131) | No peer reuse/re-setup path. Cleanup and lifecycle tests cover repeated fresh peers. SCTP restart/loss/partial-delivery abort is now terminal rather than reusing old DCEP state. |
| [#121: early SCTP crash](https://github.com/espressif/esp-webrtc-solution/issues/121), [#174: close-time STUN crash](https://github.com/espressif/esp-webrtc-solution/issues/174) | SCTP requires an authenticated DTLS connection and configured data media; no concurrent receive task. Closing detaches sockets and callbacks before freeing transport state. Audio-only and repeated-close tests cover these boundaries. |
| [#186: SCTP retry flood](https://github.com/espressif/esp-webrtc-solution/issues/186), [#187: SCTP queue spin](https://github.com/espressif/esp-webrtc-solution/issues/187) | Vendor queue code is absent; pinned usrsctp owns association timers/queues. Stateful fuzzing and repeated sessions cover our integration. Multi-hour loss/congestion soak tests remain outstanding. |
| [#167: Mbed TLS ABI mismatch](https://github.com/espressif/esp-webrtc-solution/issues/167) | Dependencies build from pinned sources; no precompiled peer archive. The adapter rejects incompatible Mbed TLS major versions at compile time. |
| TURN, TCP, video feedback, audio resampling fixes | Those implementations are absent from this package. They remain relevant to the separate device firmware and any future port/feature expansion. |

## Dependency checks

- **Mbed TLS 3.6.7:** reviewed the [release's security fixes](https://github.com/Mbed-TLS/mbedtls/releases/tag/mbedtls-3.6.7), including extended-master-secret failure handling, DTLS renegotiation corruption, ECDH buffer bounds, ECC key parsing, and incomplete DTLS session reset. The pinned release contains those fixes. We negotiate DTLS 1.2 ECDHE-ECDSA only, disable renegotiation, and bind identity to the signaling fingerprint. Enabling other suites, resumption, TLS 1.3 or context serialization requires a fresh review.
- **libSRTP 2.8.1:** [#817](https://github.com/cisco/libsrtp/issues/817) / [fix #818](https://github.com/cisco/libsrtp/pull/818) concerns the version-3 out-of-place AEAD SRTCP API. Our version-2 in-place AES-CM/HMAC-SHA1-80 path does not contain that copy operation and does not negotiate GCM. This is an applicability finding, not a local patch or a general claim about AEAD safety.
- **usrsctp `c625e219…`:** the pin includes the historical [fix `939d48f…`](https://github.com/sctplab/usrsctp/commit/939d48f9632d69bf170c7a84514b312b6b42257d) referenced in [CVE-2022-46871 discussion #672](https://github.com/sctplab/usrsctp/issues/672); GitHub ancestry comparison confirms 348 commits ahead, zero behind. [#735](https://github.com/sctplab/usrsctp/issues/735) documents callback ownership: our callback frees received allocations on every path. [#697](https://github.com/sctplab/usrsctp/issues/697) and [#745](https://github.com/sctplab/usrsctp/issues/745) describe concurrency/locking concerns. Input and timers run on one application owner; upstream retains an internal iterator thread, with real locks and a shutdown join. This reduces concurrency but is not proof that every upstream interleaving is safe. The ESP-IDF port must pass NULL default rwlock attributes because non-NULL attributes return ENOSYS.

## Other local findings fixed in this pass

- Consent expiry was enforced in polling but not in every send path, and an
  authenticated STUN 403 was ignored. All transport sends now check a latched
  30-second consent deadline; an authenticated matching 403 immediately revokes
  it. Tests cover expiry, a forged source, revocation and refusal to resume.
  Intervals are independently randomized between 4 and 6 seconds, following
  [RFC 7675](https://www.rfc-editor.org/rfc/rfc7675.html).
- Four-record DTLS work budgeting could strand further buffered records until a
  later datagram, or discard a not-yet-consumed datagram. Polling now drains
  buffered records without overwriting queued input. A seven-record datagram
  times out against the previous executable and passes against the fix.
- Duplicate STUN address/priority attributes and attribute-order-dependent
  address selection were accepted. The parser rejects duplicates and prefers
  XOR-MAPPED-ADDRESS independent of order.
- RTP send failures were hidden by the encoder callback. The public audio send
  now returns failure when encryption/UDP transmission fails. Partial message
  allocations and received SCTP plaintext are wiped before release.

Remaining limitations are explicit in [the security review](security-review.md)
and [validation record](validation.md). Public searches, short fuzz campaigns,
and source inspection cannot establish that all unknown issues are fixed.
