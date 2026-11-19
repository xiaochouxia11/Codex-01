# Portable WebRTC device validation

The Waveshare example now builds `packages/peer` from source through the
`live_peer` ESP-IDF component. It does not link `esp_peer`. This is experimental:
the evidence below is a bounded engineering check, not a security certification
or a claim that live audio is production-ready.

## Checks performed

Hardware: Waveshare ESP32-S3-Touch-AMOLED-1.8 V2, ESP-IDF 5.5.2, 16 MB flash,
8 MB PSRAM. Local checks were run on 2026-10-07.

| Check | Result and limits |
| --- | --- |
| ESP-IDF source build and USB app flash | Passed; approximately 6.32 MB app in an 8 MB partition. Flash hash verified. |
| Local audio diagnostic | Passed 150 frames through Opus encode/decode and board audio I/O. The microphone's 500 Hz component rose substantially during the speaker tone. This does not measure conversational quality, echo cancellation, or network jitter. |
| Device peer lifecycle stress | After the wakeup fix, 100 consecutive init/offer/destroy/shutdown cycles passed while app wakeups were triggered every 100 ms. Every cleanup returned to 19 tasks. Free heap stayed between 5,527,080 and 5,532,836 bytes; internal free heap stayed between 63,851 and 68,779 bytes during Wi-Fi retries. Final heap exceeded the initial reading. These cycles do not establish a DTLS/SCTP association or run audio. |
| Core tests | Six native tests and 11 Python tests passed. |
| Portable peer security tests | Passed with AddressSanitizer and UndefinedBehaviorSanitizer, including NAT mapping authentication, mixed ICE candidates, and strict DCEP ACK compatibility cases. |
| Local peer interoperability | Repeated audio/data sessions passed in both DTLS roles, including malformed/replayed packet tests and padded DCEP ACKs. |
| Fuzz smoke tests | 961,364 parser inputs and 12,729 stateful SCTP inputs completed without a sanitizer failure. These are short smoke runs, not exhaustive fuzzing. |
| Live API from a laptop | Three successive sessions in one process passed, with global peer shutdown/reinit between calls. Each received `session.started` and authenticated audio; two graceful stops received `session.closed`, and the middle call was closed locally. Descriptor counts returned to baseline and sanitizers reported no failure. This does not validate the ESP32 scheduler or radio path. |
| Connected media on the device | Five successive Live sessions completed after switching to a nearby access point. The first lasted five minutes; four reconnects lasted at least 25 seconds each. All reached authenticated playback and graceful final usage. A spoken exchange/listening assessment is still unverified. |

During porting, an early build leaked a worker after shutdown because ESP-IDF
rejects non-NULL rwlock attributes with `ENOSYS`. The port now uses supported
default attributes with real locks. Longer lifecycle stress also reproduced an
intermittent initialization hang. The adapter used FreeRTOS notification slot
zero for app/network wakeups, while ESP-IDF's `pthread_join` uses that same slot
to wait for thread exit. An unrelated wakeup could prematurely satisfy the join.
App wakeups now use a dedicated binary semaphore. The debugger could not
reliably unwind the affected task, so the diagnosis rests on the conflicting
wait/wakeup code paths and subsequent stress testing, not a captured call stack.

The shared usrsctp preparation patch also clears worker termination flags before
reinitialization after a joined shutdown. The adapter retains runtime ownership
if shutdown fails, preventing subsequent attempts from accumulating init
references. Audio tasks stop before codec and peer resources are destroyed.

## Audio and connected-session follow-up

The follow-up firmware adds bounded RTP receive reordering and capture-clock
sends. Its app image is 6,319,312 bytes and was flashed over USB with hash
verification. SHA-256:
`9efb552e30d8c58c6b58cd246820985110ae789f44a2d8d925fd3068de04d190`.
The portable library passed 114 audio and 1,049 security assertions under
ASan/UBSan, six adversarial aiortc sessions, both negative DTLS roles, and isolated
audio/data modes. [Linux CI passed](https://github.com/openai/openai-live-esp32/actions/runs/37701295144).

A nearby access point improved signal to roughly −56 to −58 dBm. Idle HTTPS
preconnection was disabled during the resource comparison to avoid measuring its
allocations as a call leak. All five calls received `session.started`, authenticated
RTP, first playback, and a graceful final usage event. The first startup took
3,736 ms to session start and 4,175 ms to playback; subsequent session starts took
2,448, 2,451, 2,501 and 2,539 ms.

| Completed call | Free heap after close (bytes) | Internal free heap (bytes) | Largest internal block (bytes) | Tasks |
| --- | ---: | ---: | ---: | ---: |
| Five-minute call | 5,534,720 | 72,783 | 29,696 | 19 |
| Reconnect 1 | 5,531,964 | 70,735 | 29,696 | 19 |
| Reconnect 2 | 5,533,800 | 72,783 | 29,696 | 19 |
| Reconnect 3 | 5,531,564 | 70,735 | 29,696 | 19 |
| Reconnect 4 | 5,533,716 | 72,911 | 29,696 | 19 |

Before the first call, free heap was 5,531,272 bytes and internal free heap was
68,575 bytes, with the same largest block and 19 tasks. This bounded run showed
no monotonic heap decline or accumulating tasks; it is not a long-duration leak
proof. Active media used about 5.25 MB free heap and 22 tasks. Three CPU intervals
showed 58.5–58.8% idle on core 0 and 72.7–73.2% idle on core 1. These samples were
predominantly silence and do not bound worst-case speech encoding cost.

The first call sent over 15,000 microphone packets and received over 15,000 audio
packets with zero transmit/receive queue drops, send errors, rejected RTP or
reorder-buffer overflow. Encode/decode maxima were 9.986/10.193 ms. One sequence
was lost. An incoming RTP gap reached **827 ms**, without a corresponding owner
poll stall; the only poll exceeding 20 ms was during initial connection setup.
There were 41 playback queue waits over 50 ms by the last periodic sample. This
points to late media delivery on that path rather than CPU saturation; device
counters alone cannot distinguish radio, upstream network and server causes.

A sixth session ran for 61 seconds with the USB screen mirror enabled and also
closed gracefully, returning to 19 tasks. A 20.5-second CPU comparison showed
58.18%/71.59% idle and 0.70% of one core in the mirror worker. It had zero audio
queue drops, send errors, rejected RTP, sequence loss or reorder overflow; the
largest RTP arrival gap was 129 ms. The viewer reported zero decoder errors and
USB stalls; the maximum display-copy duration was 576 microseconds. This was a
mostly static transcript screen, so dynamic transcript rendering and audible
conversation still need comparison. The mirror's retained frame buffers account
for its lower free heap and are separate from call resources.

**Audible quality remains unverified.** No speech transcript or delegated response
was observed. A laptop-generated prompt did not register at the board microphone,
and no human listening result was available. Continuous authenticated audio and
codec/playback activity validate the transport path, not a spoken conversation or
absence of choppiness. A 40 ms reorder deadline cannot hide an 827 ms media outage;
there is still no adaptive jitter playout, packet-loss concealment or acoustic echo
cancellation.

## Remaining device acceptance test

Keep private logs outside the checkout and use one USB monitor.

1. Speak and listen during a sustained call; record an audible sample or a human
   listening assessment. Exercise speech, interruptions and conversation, not
   only continuous quiet-room media.
2. Interrupt Wi-Fi during a call, wait for cleanup and network recovery, and
   start another call. Check last-reported usage on hard disconnect. The four
   reconnects above exercised graceful stops, not a network outage.
3. Compare the USB mirror during an audible conversation, including queue drops,
   CPU intervals and speech quality.
4. Extend connected-call soak testing and memory comparisons well beyond five
   sessions. Restore `live preconnect-on` after controlled resource comparisons.
