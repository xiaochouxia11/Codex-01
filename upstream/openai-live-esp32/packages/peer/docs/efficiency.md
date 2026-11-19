# Efficiency validation

Measured on the Waveshare ESP32-S3 Touch AMOLED 1.8 V2, ESP-IDF 5.5.2,
on 2026-10-09. Each variant ran two real Live sessions with a 35-second
task-runtime sampling interval per call. USB mirroring and idle HTTPS
preconnection were disabled; microphone input was predominantly quiet.
The device, credentials, configured models, audio settings, and network were
unchanged. These are short device comparisons, not isolated crypto benchmarks
or worst-case speech measurements.

| Variant | Peer/control CPU (% of one core) | Whole-device CPU (% of two cores) | Call-related heap |
| --- | --- | --- | --- |
| Before | 24.12–24.91% | 35.21–36.99% | 280.6 KiB |
| Smaller SCTP/SDP state and no redundant queue-buffer clearing | 23.14–23.33% | 34.61–35.14% | 206.5–206.7 KiB |
| Plus nonblocking receive and microphone/control wakeups | 13.31–14.96% | 29.71–32.13% | 206.4–206.5 KiB |
| Plus optional Mbed TLS SRTP backend | 13.54–13.69% | 29.67–29.84% | 205.7 KiB |

Call-related heap is the difference between the active snapshot and cleanup
snapshot for the same call; it includes codecs, audio stacks, and transport
allocations. It is not the library's isolated allocation count or a peak-heap
measurement. All eight calls reached final usage, returned from 22 active tasks
to 19 idle tasks, and had zero microphone/playback queue drops or send errors.
Cleanup heap varied by a few KiB; two calls per variant do not establish
long-term leak freedom.

The default optimizations saved approximately 74 KiB per active call and reduced
peer/control CPU by about 42% using the pair means. Most of the measured CPU
improvement appeared after removing the redundant `select()` before an already
nonblocking `recvmsg()`. The hardware-crypto CPU ranges overlapped the software
variant, so the software backend remains the default; hardware acceleration is
available for platform-specific testing rather than assumed to be faster.

## Changes and preserved behavior

- **SCTP indexing:** 128 global buckets and 32 endpoint buckets, configurable at
  build time. On a 32-bit target the three principal global tables plus one
  endpoint table fall from 74,752 to 9,344 bytes. These settings do not limit
  connections, channels, or messages. Regressions exercised 128 simultaneous
  endpoints, a 128-entry collision chain, bidirectional fragmented data, and
  three complete teardown/reinitialization cycles.
- **Retained SDP state:** the MCU peer object falls from 44,096 to 33,120 bytes,
  plus a separate offer allocation sized to the text. The borrowed offer pointer
  stays valid until close/destruction. The full answer is validated before
  copying the required runtime state; candidate and credential storage, DTLS
  fingerprints, and authenticated SSRC selection keep their existing checks.
  Allocation-failure tests cover both offer allocations and verify credential
  buffers are wiped before release.
- **Audio scratch buffer:** a successful queue receive overwrites all 1,508
  bytes. An empty receive exits without reading the buffer, so clearing it on
  every poll served no purpose. Producers still initialize their queue items.
- **Scheduling:** microphone and control events signal the owner's existing
  binary semaphore. Its maximum 2 ms wait replaces the old 1 ms readiness wait
  plus one 1 kHz tick. UDP receive remains bounded to one datagram per poll;
  STUN gathering still waits rather than busy-spinning. Consent checks and
  expiry, DTLS/SCTP timers, packet authentication, and the eight-packet/40 ms
  reorder buffer are unchanged. The semaphore remains separate from the
  notification slot used by ESP-IDF's `pthread_join`.
- **Optional crypto backend:** the pinned upstream libSRTP Mbed TLS adapter
  supplies AES-CM and HMAC. The negotiated SRTP profile, tag lengths, replay
  windows, and DTLS identity checks are unchanged. GCM is not enabled. No new
  cryptographic implementation was authored.

## Validation and limits

All 12 native transport test groups passed under ASan/UBSan, including the new
allocation/lifetime, collision/routing, and nonblocking-receive tests. The
Mbed TLS backend also passed all 12 groups and independent aiortc/Chromium media
and data-channel interoperability. Seven SDK test groups and fourteen Python
tests passed. A standalone release-mode consumer built and ran successfully.

One loss-injection browser run exposed a harness timing issue: the six-second
test could end before the first randomized 4–6 second consent probe after ICE
setup. The fault-injection driver now runs for twelve seconds and still requires
all four injected losses (ICE, DTLS, SCTP, consent) to occur. This changes only
the test window, not production timers or failure handling.
The aiortc harness waits up to fifteen seconds for that intentionally delayed
result; its channel-open and individual-message deadlines are unchanged.

Fuzz smoke runs of the Mbed TLS variant completed 237,813 parser inputs, 2,529
DTLS inputs, and 8,248 SCTP inputs without sanitizer failures. These are bounded
smokes, not exhaustive security coverage. No human listening assessment was
performed; transport counters and CPU headroom do not prove glitch-free speech.
Logs, captures, credentials, and compiled firmware remain private and untracked.

The final default firmware also completed a longer call reporting 154 seconds
of final usage, followed by two 20-second reconnects with mirroring enabled.
Three 30-second caption animations completed 24 page clears without overflow.
All calls received final usage and returned to 19 idle tasks, with zero audio
queue drops/send errors, USB stalls, or mirror decode errors. Cleanup free heap
was 5,165,108 / 5,168,012 / 5,165,500 bytes, including the retained mirror buffers.
Preconnection and mirroring were restored after testing.
