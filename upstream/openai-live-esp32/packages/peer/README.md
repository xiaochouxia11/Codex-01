# Portable peer connection (experimental)

An independently buildable C WebRTC library for Opus audio and data channels.
**Unsupported experiment: not an officially supported OpenAI SDK, and not a
production security certification.** The API and supported protocol subset may
change. The Waveshare, M5Stack CoreS3 LITE, and Sonatino examples use this
transport through `components/live_peer`.

This package is derived from MIT-licensed
[libpeer](https://github.com/sepfy/libpeer/tree/5b849de378545c31d34759a145413846953e1366),
with extensive changes to parsing, authentication, state handling, and resource
limits. Original OpenAI code and modifications use [Apache-2.0](LICENSE);
upstream code retains its own licenses and attribution in [NOTICE](NOTICE) and
[LICENSE.libpeer](LICENSE.libpeer).
No esp_peer code or binaries are included: its Modified MIT license
restricts use to Espressif products. See [provenance and licenses](docs/provenance.md)
and the [security review](docs/security-review.md), including the
[comparison with published upstream issues](docs/upstream-issues.md).
The [correctness review](docs/correctness-review.md) records ordinary protocol
and lifecycle fixes, their regressions, and remaining timing limitations.
The [SDP review](docs/sdp-review.md) records identity scoping, BUNDLE selection,
input validation, and remaining negotiation limits.
The [cross-implementation survey](docs/cross-implementation-review.md) maps browser
and alternative-stack advisories to our controls and prioritized test gaps.
The [regression sweep](docs/regression-sweep.md) records follow-up fixes,
authenticated media/handshake/resource tests and remaining coverage limits.

## Scope and architecture

```text
Application: authenticated signaling + audio codec/capture/playback
                            |
                    Public peer C API
                            |
                    Bounded SDP parser
                            |
                  ICE checks / UDP socket
                            |
            DTLS 1.2 + pinned SHA-256 certificate
                     /                 \
               libSRTP                usrsctp
            Opus RTP / RTCP         DCEP / messages
```

The application sends the generated offer over its authenticated signaling
channel and supplies the complete SDP answer. ICE selects a source address;
DTLS verifies the answer's certificate fingerprint before enabling SRTP or SCTP.
Audio callbacks receive encoded Opus; this library does not encode, decode, mix,
resample, or play audio. Signaling, Live API messages, and credentials remain in
the application. The standalone host build has no ESP-IDF dependency.

Implemented and tested:

- Local offerer, complete bundled SDP answer, one audio track and/or data transport.
- IPv4 UDP host candidates and optional STUN server-reflexive gathering.
- ICE controlling role, source/transaction/HMAC checks, periodic consent checks.
- Both DTLS roles; ECDHE-ECDSA with AES-128-GCM, P-256 local certificate;
  SRTP AES128-CM/HMAC-SHA1-80, replay protection for RTP and RTCP.
- Opus payload 111, 48 kHz RTP clock, one 20 ms encoded packet per send.
- Capture timestamps preserve dropped-frame gaps; bounded receive reordering
  holds up to eight authenticated packets for a missing sequence, up to 40 ms.
  When that window fills, playback advances from the nearest received packet
  instead of discarding the rest of a recovered burst. A missing packet that
  arrives after that decision is considered late.
- Reliable ordered data channels, UTF-8 text or binary, bounded reassembly.
- POSIX host backend and an ESP-IDF/LwIP port shared by the device examples.
- One authenticated local peer-reflexive mapping learned during initial ICE
  nomination, allowing a NAT to change the local host address/port.

Explicitly unsupported: answering offers, renegotiation/ICE restart, trickle ICE,
ICE role conflicts, remote peer-reflexive candidate discovery, TURN allocations, TCP,
IPv6, mDNS resolution, video, other audio codecs, unordered/partial-reliability channels,
channel reopening/reset, unidirectional/inactive audio, RTP retransmission, congestion control, adaptive jitter buffering, packet-loss concealment,
and outbound RTCP reports. Authenticated incoming RTCP is validated and counted;
RTCP feedback does not yet adjust media behavior. This is a bounded framework,
not a complete WebRTC implementation. Valid unsupported TCP/IPv6/hostname
candidates in an answer are skipped without DNS lookups; at least one usable
numeric IPv4/UDP candidate is required.
Changes to the selected local mapping require a new connection.

STUN configuration accepts `stun:hostname[:port]` or numeric IPv4, with default
port 3478. Malformed and unsupported URI forms fail at peer creation. Each
configured server has a one-second gathering window with one retransmission
after 500 ms; this remains a bounded subset of STUN's full retry procedure.

Limits: SDP <8 KiB, lines <=1,023 bytes, 10 unique remote candidates, 1,536-byte
UDP datagrams, one authenticated remote audio SSRC, 5 channels with IDs <16,
31-byte labels/protocols, 64 KiB messages, 128 KiB SCTP send/receive buffers,
and two buffered early ClientHello datagrams (released only after ICE validation).
Fragmented DCEP control messages are rejected. Messages exceeding the limit are
discarded through their end marker so their tails cannot become new messages.
The adapter can allocate up to 320 KiB for partial messages across five channels,
in addition to usrsctp/DTLS buffers. Remote audio source selection comes from SDP
or structurally valid authenticated RTP; early RTCP cannot choose that source.

Remote SDP uses CRLF framing and UTF-8 text, with ASCII protocol tokens and ICE
credentials. Session defaults are overridden by the tagged media section; only
its ICE candidates feed the BUNDLE transport. Media fingerprint sets replace the
entire session set, and the effective set must include SHA-256. Identical legacy
transport repeats on non-tag media are tolerated; conflicts fail closed. Every
offered media section must still be accepted, in the offered order. General
Opus `fmtp`/`ptime` constraints are not propagated to the application codec.

The SDP parser has a 7,024-byte static frame with the Waveshare compiler settings,
excluding caller/callee frames. Budget owner-task stack accordingly; the example
uses 64 KiB. Other architectures and compiler settings may differ.

## Build and run

Requires CMake 3.24+, Ninja, Python 3, and Clang or GCC. CMake downloads SHA-256
verified source archives for **Mbed TLS 3.6.8, libSRTP 2.8.1, and usrsctp**. A
network connection is needed for the first build. No API key is needed for tests.

```sh
cmake -S packages/peer -B build-peer -G Ninja -DCMAKE_BUILD_TYPE=Debug
cmake --build build-peer -j 4
ctest --test-dir build-peer --output-on-failure
uv sync --locked --project packages/peer/tests/interop
uv run --locked --project packages/peer/tests/interop \
  packages/peer/tests/interop/run.py ./build-peer/peer_interop --attacks --rounds 3
uv run --locked --project packages/peer/tests/interop \
  packages/peer/tests/interop/run.py ./build-peer/peer_interop --server --reject
```

ASan/UBSan are enabled by default for the library **and all three dependencies**.
Set `LIVE_PEER_SANITIZE=OFF` for a normal build. To use a separately maintained
Mbed TLS 3.6.8+ (3.x) installation with DTLS-SRTP enabled, set
`LIVE_PEER_SYSTEM_MBEDTLS=ON` and `CMAKE_PREFIX_PATH`; sanitizer coverage then depends
on that installation. Bundled source builds apply an empty-X.509-name comparison
guard found by DTLS fuzzing; a system installation must carry that fix or an
equivalent upstream fix.

For the Mbed TLS 4.1.2/PSA path used by ESP32-S31, configure a separate host
build with `-DLIVE_PEER_MBEDTLS4=ON`. It fetches the hash-pinned 4.1.2 release,
applies the same X.509 guard, and runs the same tests. Mbed TLS 3 remains the
default. This option uses libSRTP's software AES/HMAC backend; do not combine it
with `LIVE_PEER_MBEDTLS_SRTP` or `LIVE_PEER_SYSTEM_MBEDTLS`. DTLS remains 1.2
with the same ECDHE-ECDSA/AES-128-GCM and SRTP profile restrictions.

The local harness uses pinned aiortc as an independent peer, restricts traffic to
loopback, sends audio in both directions, opens channels from both ends, and
checks authentication failures without disrupting valid traffic.

## Use as a separate package

Copy this directory with its license and NOTICE files, or embed it as a CMake
subdirectory. It builds without the rest of the repository:

```cmake
set(LIVE_PEER_SANITIZE OFF CACHE BOOL "")
set(LIVE_PEER_BUILD_EXAMPLES OFF CACHE BOOL "")
add_subdirectory(path/to/peer peer-build)
target_link_libraries(my_application PRIVATE live_peer::peer)
```

Call `peer_init()`, create a `PeerConfiguration` with `CODEC_OPUS` and/or a data
channel type, then `peer_connection_create()`. Register callbacks, create an offer,
and supply a complete answer using `peer_connection_set_remote_description_n()`.
Poll `peer_connection_loop()` every 1–5 ms on the owner thread. Send media only
when connected and messages only when the desired channel has opened. Destroy
all peers before `peer_deinit()`; shutdown returns an error while peer objects
remain. See [the driver](examples/interop.c) for a complete local example.

All API calls and all peers share **one owner thread**. Send operations from
callbacks are supported. Queue close/destroy operations until the callback and
current API call have returned; do not recursively poll. Callback data is borrowed
and length-delimited, with no implied NUL terminator. Configuration strings are
copied/consumed at creation; application `user_data` must outlive the peer.

For captured audio, use `peer_connection_send_audio_at(peer, data, size, timestamp)`.
The timestamp is a wrapping 32-bit capture clock in **48 kHz samples**, even when
the codec runs at another sample rate. Advance it by 960 for every captured 20 ms
frame, including frames discarded before sending. Calls may be batched; send
time does not change the media clock. The first capture time maps to a random
RTP origin. Later times must advance by at least 960 and less than 2^31 samples.
The older `peer_connection_send_audio()` advances by 960 on each send; do not mix
the two modes on one peer.

Receive callbacks deliver sequence order after SRTP authentication. A gap holds
subsequent packets for at most 40 ms, then advances past the missing packets;
packets behind playback are discarded. An eight-packet queue prefers the nearest
future sequences under overflow and adds about 12 KiB per peer. There is no
initial prefill, adaptive playout clock, concealment, or recovery of lost audio.
The owner must keep polling to enforce the deadline. Statistics distinguish
arrival reordering, late drops, queue overflow, and skipped playout sequences.

The host backend uses POSIX sockets, a monotonic clock, and Mbed TLS entropy.
UDP sends are nonblocking. Audio sends report encryption/transmission failures;
temporary UDP queue errors (`ENOMEM`, `ENOBUFS`, `EAGAIN`/`EWOULDBLOCK`) are
counted as packet loss for ICE and the DTLS datagram BIO. Initial ICE checks,
DTLS handshake flights and SCTP have their normal recovery timers. Consent
checks retain their 4–6 second cadence and the last authenticated response's
30-second expiry; a failed send never grants or extends consent. There is no
blocking retry or unbounded packet queue. Actual TLS write errors/pending writes
still terminate the context rather than reusing a different SCTP buffer.
Audio sends continue returning the actual transmission error. SCTP restart/reset is
unsupported and requires a fresh peer. Send paths enforce consent expiry even
between polls, but timely polling is still required for receiving revocations.
A non-POSIX port must implement those facilities and validate usrsctp's platform
configuration. Hardware entropy, thread constraints, memory/CPU limits, and
real-device audio timing need fresh validation on each device.

The ESP-IDF component uses LwIP, ESP-IDF network-interface accessors, and hardware
entropy while Wi-Fi is active. SCTP uses AF_CONN only: the owner drives input and
timers, with no raw-IP receive or timer threads. Upstream still creates one
internal iterator thread, protected by pthread locks and joined during shutdown.
The preparation tool adapts default rwlock attributes, socket layout, entropy,
and libSRTP length types for ESP-IDF. See the
[Waveshare](../../examples/waveshare/README.md),
[M5Stack](../../examples/m5stack/README.md), and
[Sonatino](../../examples/sonatino/README.md) build/validation instructions and
the [transport validation record](docs/validation.md).

## CPU and memory configuration

See the [measured device comparison and validation limits](docs/efficiency.md).

Host and ESP-IDF builds share a smaller usrsctp indexing profile: 128 global
hash buckets and 32 per-endpoint buckets. These are lookup-table sizes, not
limits on peers, associations, streams, or messages. On a 32-bit target, the
three main global tables plus one endpoint table use about 9.1 KiB instead of
73 KiB. `LIVE_PEER_SCTP_HASH_BUCKETS` and `LIVE_PEER_SCTP_ENDPOINT_BUCKETS` are
CMake cache settings; increase them for applications with many concurrent peers.
Values must be powers of two from 1 through 65536. The regression suite checks
128 simultaneous endpoints, including a 128-entry collision chain, routing,
fragmented messages, teardown, and global reinitialization.

Offers retain an allocation sized to their serialized text instead of reserving
8 KiB for the whole connection. The returned pointer still lives until close or
destruction. The complete remote answer is validated before retaining only its
needed runtime state; ICE credentials/candidates, certificate pinning, and audio
source binding are preserved. Temporary and retained offer buffers are wiped
before release, including allocation-failure paths.

UDP receive polls are nonblocking. Applications must continue servicing the
owner loop frequently; the Waveshare adapter waits at most 2 ms between polls,
and microphone/control events wake it immediately. STUN gathering retains its
bounded wait. Consent expiry, DTLS/SCTP retransmission, and the 40 ms audio reorder
deadline are unchanged. Empty microphone-queue polls no longer clear a 1.5 KiB
scratch buffer that a successful receive overwrites completely.

`LIVE_PEER_MBEDTLS_SRTP=ON` selects libSRTP's upstream Mbed TLS AES-CM/HMAC backend,
allowing ESP-IDF's hardware AES/SHA support to serve SRTP as well as DTLS. No new SRTP
profiles are enabled: the negotiated suite remains AES128-CM/HMAC-SHA1-80, with
the same authentication tags and replay protection. The default remains `OFF`:
the measured short-call CPU ranges overlapped, so hardware acceleration is an
option rather than an assumed performance improvement on every platform. The
small compatibility wrapper supplies a forward declaration required by the
upstream adapter when GCM is disabled; it implements no cryptographic operations.

## Fuzzing

Use Clang with libFuzzer installed (Apple's bundled Clang may lack that runtime).

```sh
cmake -S packages/peer -B build-peer-fuzz -G Ninja \
  -DCMAKE_C_COMPILER=clang -DCMAKE_BUILD_TYPE=Debug -DLIVE_PEER_FUZZ=ON
cmake --build build-peer-fuzz -j 4
python3 packages/peer/tests/interop/seed_fuzz.py build-peer-fuzz/corpus
./build-peer-fuzz/peer_fuzz build-peer-fuzz/corpus -max_total_time=60 -max_len=8193
./build-peer-fuzz/peer_fuzz_sctp build-peer-fuzz/corpus-sctp -max_total_time=60 -max_len=8192
uv run --locked --project packages/peer/tests/interop \
  packages/peer/tests/interop/run.py ./build-peer-fuzz/peer_interop \
  --corpus build-peer-fuzz/dtls-corpus
./build-peer-fuzz/peer_fuzz_dtls build-peer-fuzz/dtls-corpus -max_total_time=60 -max_len=16384
```

The DTLS fuzzer disables cookies **only in its test context** to reach deeper
parser states. The SCTP fuzzer connects two in-memory associations, then repairs
the verification tag/checksum of mutated chunks to exercise parsing after DTLS
authentication. Neither harness opens external sockets. Production behavior is
unchanged by these test-only stubs. Short runs are regression smoke tests; sustained
fuzzing, coverage review, and independent security review remain necessary.


ICE diagnostics can be enabled with `-DLIVE_PEER_TRACE_ICE=ON` for a host build
or `CONFIG_LIVE_PEER_TRACE_ICE=y` for ESP-IDF. They record response-validation
flags and timing, not addresses, transaction IDs or credentials. Peer failure
logs capture the call site, consent age, transport states and latest UDP error
before teardown. Repeated temporary send errors are logged at powers of two to
avoid saturating the serial console; the cumulative error count is retained.
