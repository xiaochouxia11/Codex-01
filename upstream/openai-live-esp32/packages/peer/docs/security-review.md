# Security review and validation

This is a bounded implementation review and test campaign, **not a guarantee that
all vulnerabilities are fixed**. It covers the portable transport and its documented follow-up reviews. It is
not a security attestation for upstream libpeer, esp_peer, the Waveshare firmware,
or a complete browser-compatible WebRTC stack.

The [second-pass upstream comparison](upstream-issues.md) maps libpeer,
Espressif, Mbed TLS, libSRTP, and usrsctp reports to implementation checks,
regressions, fixes, or explicit limitations. It also records additional local
findings in consent handling, buffered DTLS reads, send failures and SCTP state.

The [SDP follow-up review](sdp-review.md) fixes fingerprint-set inheritance and
BUNDLE transport selection, with atomic-rejection and real-peer regressions.
That pass's CI also found undefined zero-length X.509 Name comparisons in Mbed
TLS 3.6.7; both pinned source builds now apply the guarded comparison patch and
a deterministic empty-chain regression.

## Threat model and trust boundaries

Assume arbitrary UDP input, hostile SDP, and a malicious authenticated peer that
can send valid encrypted records containing malformed RTP, RTCP, SCTP, or DCEP.
Applications must authenticate and integrity-protect signaling: the remote SDP
fingerprint and ICE credentials are the peer's identity binding. This library
cannot protect a fingerprint supplied by an attacker-controlled signaling path.

Only the selected source tuple can feed DTLS/media. ICE responses require a
pending transaction, matching source and transaction ID, and a valid HMAC. DTLS
uses the SDP SHA-256 fingerprint and must finish authentication before SRTP keys,
SCTP, or application callbacks are enabled. RTP/RTCP authentication and replay
checks precede payload parsing and effects. SCTP validation precedes DCEP handling.

An authenticated signaling peer can request outbound ICE probes to numeric
unicast IPv4 addresses. Applications accepting arbitrary remote peers should
apply deployment-specific destination policy before supplying SDP; private and
loopback destinations remain supported for local devices and tests. UDP flooding
and resource exhaustion above the bounded per-peer limits require application/
network-level controls. Application callbacks and the application-owned event
loop are trusted.

## Changes made during review

| Area | Problem addressed | Result and regression evidence |
| --- | --- | --- |
| STUN framing | Attribute lengths and copies could exceed input/output bounds; unaligned wire casts | Exact datagram length, bounded TLV traversal/building, explicit byte reads, duplicate/ordering checks; mutation, truncation, overflow, and unaligned-input tests |
| ICE authentication | Weak/randomly seeded credentials and transaction IDs; insufficient source/response checks | Mbed TLS entropy, transaction/source/HMAC binding, one tie-breaker per agent, retransmission of the same check, consent response replay rejection |
| Datagram demultiplexing | Broad top-bit STUN detection also consumed DTLS packets | RFC 7983 ranges; real UDP regression checks DTLS delivery, wrong-source rejection, and rejection before ICE selection |
| UDP truncation | Oversized datagrams could be silently shortened | `recvmsg` truncation detection and drop; real-socket regression |
| SDP | Unbounded/inconsistent attributes and unsupported negotiation could enter transport state | Atomic bounded parse, effective per-section transport checks, matching BUNDLE mids/order, codec/role/fingerprint validation; malformed SDP tests |
| DTLS identity and lifecycle | Certificate/role changes, callback state, entropy ordering, and unchecked crypto results | Stable offered certificate, both answer roles, per-peer timers, terminal failure, fingerprint check before SRTP activation; live fingerprint-mismatch tests produce zero media/messages |
| SRTP/SRTCP | Authentication failures could be ignored and failed buffers parsed | Require successful unprotect, replay checks, and structural validation before effects; live forged/replayed RTP and RTCP rejected while valid media continues |
| Media resource bounds | Arbitrary SSRCs can create wildcard libSRTP streams | Require the signaled SSRC or pin the first authenticated sender, including before accepting subsequent RTP/RTCP SSRCs |
| RTP/RTCP framing | Extensions, CSRC lists, padding, and compound lengths could be trusted | Bounded payload/report traversal after authentication; short/overlong/unaligned cases tested; no unsafe video depacketizer included |
| SCTP boundary | Lightweight/custom SCTP parsing expanded unaudited attack surface | Use pinned usrsctp for checksum/tag/chunk/association handling; only authenticated DTLS input reaches it; stateful post-authentication SCTP fuzzer |
| DCEP/messages | Unbounded labels, malformed headers/PPIDs/UTF-8, stream confusion, and unbounded reassembly | Enforce IDs/parity, sizes, state, UTF-8 and reliability mode; channel/message/buffer limits; malformed message tests |
| Fragment recovery | Rejected fragment tails could become messages, and an oversized message disabled an otherwise usable channel | Discard through EOR, then recover; no partial DCEP tails parsed; unit and live 64 KiB/oversize-message tests |
| Cleanup/global state | Socket zero handling, repeat init/shutdown, and freeing global state with live peers | Idempotent close, tracked initialization, refuse shutdown with peers, zeroize peer storage; repeated sessions verify stable descriptor counts and successful usrsctp shutdown |
| Concurrency | Background SCTP callbacks raced application lifetime | Input and timers driven by the owner loop; explicit single-owner-thread/callback contract. Upstream still has a locked internal iterator thread, joined during shutdown; no claim of eliminating all dependency concurrency. |
| Crypto dependencies | Older Mbed TLS releases lacked maintenance/security fixes | Pinned 3.6.8 (host/S3) and 4.1.2 (optional host/S31), with explicit ESP hardware compatibility patches; DTLS 1.2 ECDHE-ECDSA/AES-GCM only, anti-replay on, renegotiation off |

These are local findings and fixes, not newly assigned CVEs or claims that every
upstream product is exploitable. Reports about libpeer were treated as review
leads, then checked against the local implementation.

## Dependency advisory check

The current pins are [Mbed TLS 3.6.8](https://github.com/Mbed-TLS/mbedtls/releases/tag/mbedtls-3.6.8)
and [4.1.2](https://github.com/Mbed-TLS/mbedtls/releases/tag/mbedtls-4.1.2),
including their bundled crypto updates. The full maintenance releases are used,
rather than relying on protocol configuration to avoid individual advisory triggers.
Their fixes cover TLS state/lifetime errors, X.509/CRL handling and crypto issues.
A TLS 1.3 advisory does not directly establish exposure in our DTLS 1.2 transport;
the device HTTPS client is a separate consumer of the same updated component.
See [provenance](provenance.md) for exact archives and the retained ESP hardware ports.

The local empty-X.509-Name guard remains necessary. Its regression demonstrates
undefined behavior when comparing initialized empty certificate objects. It does
not establish acceptance of a hostile wire certificate, authentication bypass or
remote code execution. Local mitigations and test results are not evidence of
upstream disclosure, acceptance or a vendor fix.

The exact libSRTP/usrsctp revisions and public upstream advisory/release pages
were checked during this review. No security completeness claim is inferred from
an empty advisory response. Their entire codebases have not received an
independent line-by-line audit here.

## Reproducible tests

See the package README and `.github/workflows/peer.yml` for commands.

- ASan/UBSan build includes Mbed TLS, libSRTP, usrsctp, and local C sources.
- Unit tests cover STUN authentication/framing, ICE source/transaction checks,
  UDP boundaries, SDP validation, RTP/RTCP bounds, replay/tag rejection,
  DCEP/UTF-8/fragment recovery, and repeated object/global lifecycle operations.
- Independent aiortc integration uses loopback only, bidirectional decoded Opus,
  channels opened from both sides, empty/UTF-8/64 KiB messages, and both DTLS roles.
- Live negative tests inject replayed and tag-corrupted media, validly encrypted
  malformed RTCP, invalid SCTP, invalid UTF-8/PPIDs, and oversized messages. The
  session must remain usable and report rejection counters.
- Chromium integration covers bidirectional audio, data channels, reconnects and
  injected UDP backpressure in both DTLS roles.
- Deliberately incorrect fingerprints must fail with zero delivered audio/messages.
- Repeated sessions within the same process check descriptor stability and require
  successful global SCTP shutdown, not just process exit.
- Parser, DTLS-handshake, and post-authentication SCTP fuzz harnesses are included.
  The DTLS harness bypasses cookies only in the test configuration. The SCTP
  harness uses an in-memory association pair and repairs tag/checksum/initial TSN
  to reach deeper chunk parsing. These are not deployed bypasses.
- Clang static analysis is run over the local transport translation units.

Local campaign results and limitations are recorded in [validation.md](validation.md).

## Remaining work and limits

No finite test campaign proves absence of vulnerabilities. Sustained fuzzing with
coverage targets, independent review, allocation-failure tests, more certificate/
handshake fixtures, and interoperability beyond the tested aiortc/Chromium
versions are still needed. Tests do not establish arbitrary NAT traversal, TURN,
long-duration congestion behavior, process-wide allocation budgets, arbitrary
concurrent application use, hardware entropy quality, side-channel resistance,
or performance on untested MCU/configuration combinations. The application must promptly service the loop and obey the
callback lifetime rules. macOS ASan does not provide Linux LeakSanitizer's heap-leak
coverage; descriptor/global-shutdown checks are narrower evidence.

Porting to a device or adding protocol features changes the reviewed surface.
Rerun the suite and revisit the threat model before using this transport for
untrusted production peers. The ESP-IDF adapter and all seven device examples now use this transport.
Recorded hardware smoke tests are evidence for those tested builds, not a blanket
security or performance attestation for later changes.
