# Testing and emulation

Activate ESP-IDF 5.5.2 before running these commands from the repository root.

## Native tests

```sh
cmake -S . -B build-host -G Ninja -DCMAKE_BUILD_TYPE=Debug
cmake --build build-host
ctest --test-dir build-host --output-on-failure
python -m unittest discover -s tests -p 'test_*.py'
```

Thirteen CTest targets cover protocol handling, Wi-Fi selection, transcript buffering
and pagination, caption text, PCM priming, usage accounting, preconnection state,
mirror encoding, the ESP-IDF time shim, board PCM conversion/volume, and Sonatino
button debouncing. Python tests cover
credential configuration, framebuffer decoding, and fragmented/corrupted mirror
streams, including recovery and bounded malformed input. Tests use
synthetic inputs and never call the Live service. AddressSanitizer and
UndefinedBehaviorSanitizer are enabled by default.

Host CMake reads cJSON from `$IDF_PATH/components/json/cJSON`. Set
`-DCJSON_DIR=/path/to/cJSON` to exercise the parser used by another firmware build.

## ESP32-S3 protocol firmware

```sh
idf.py -C examples/protocol_smoke set-target esp32s3 build merge-bin
python tools/run_emulator.py qemu
python tools/run_emulator.py esp-emu
```

Install [Espressif QEMU](https://github.com/espressif/qemu) through IDF:

```sh
python "$IDF_PATH/tools/idf_tools.py" install qemu-xtensa
. "$IDF_PATH/export.sh"
```

Install [esp-emu](https://github.com/espressif/esp-emulator/releases) separately
and put its executable on `PATH`. The tested versions are Espressif QEMU
`esp_develop_9.2.2_20250817` and esp-emu `0.45.0` on macOS arm64. Follow the
emulator's platform dependency instructions as needed.

Both runners require `LIVE_TESTS_PASS` after the protocol assertions, 100 repeated
suites, and a heap-integrity check. A timeout, failure marker, or premature exit
fails the runner. Logs stay in the ignored firmware build directory. QEMU uses
a padded 4 MiB flash image; esp-emu uses the merged image directly.

These runs establish CPU/runtime and protocol-test behavior. They do not verify
Wi-Fi, I²S audio, touch input, or device displays. Use the physical device
for complete Live sessions.

## Physical device checks

Follow the setup guide for
[Waveshare](../examples/waveshare/README.md),
[M5Stack](../examples/m5stack/README.md), or
[Sonatino](../examples/sonatino/README.md), then:

1. Confirm Wi-Fi has acquired an IP. On Waveshare, open Live Voice from the
   launcher; on M5Stack, wait for Start. On Sonatino, press and release BOOT
   only while idle, or issue USB `live start`.
2. Start a call and check HTTP 201, `session.started`, and advancing audio counters.
3. Speak and verify audible replies. Check both transcript colors on screen,
   or use `live transcripts` on Sonatino.
4. Ask for a web lookup and inspect nested Responses lifecycle events.
5. Request graceful close using Stop or USB `live stop`. Check `finalized=1`,
   final duration, and backend usage in the usage page or Sonatino USB log.
6. Test network-loss behavior separately: retained usage should be labeled
   "Last reported" where a usage page is available, and a new call should
   require Start. Sonatino RESET ends a call by rebooting, so it cannot retain
   RAM-only transcripts/usage or receive the final close event.

For Sonatino, also check BOOT start, RESET, Wi-Fi recovery, and a fresh BOOT
press-and-release. **Never press BOOT during a call or local audio test:** the
switch shares GPIO0 with the active audio clock. `live diagnostics` reports
whether GPIO0 is an idle input or an active clock output.

The [standalone-board CI workflow](../.github/workflows/m5stack.yml) builds
M5Stack and Sonatino with ESP-IDF 5.5.2 and synthetic credentials, verifies their
dependency-lock versions/hashes, and runs the host CTest and Python suites.
CI does not flash hardware or make Live calls. Board-specific hardware results
and limitations are in each example's README; the historical measurements
below apply to Waveshare.

Startup timing includes network transit. HTTPS connection time combines
DNS/TCP/TLS; it does not isolate API processing. First received audio can be
silence and is not the assistant's first spoken word.

## Initial validation

The standalone checkout passed all four native CTest targets with ASan/UBSan,
all five Python tests, and both emulator runs with 100 protocol suites and stable
heap usage. A fresh Waveshare build was flashed to the physical V2 device. It
completed a Live session, received assistant captions, ran a delegated web
search with `gpt-6-luna`, and closed gracefully with final voice and backend
usage. The [screenshots](screenshots/README.md) include that conversation and
its final usage page.

## USB mirror validation

The mirror passed the six native CTest targets with ASan/UBSan and all eleven
Python tests. On the physical Waveshare V2, its binary feed reconstructed the
368 × 448 display without CRC/decoder errors. Browser pause/resume and fullscreen
worked, and a roughly seven-minute VP9 WebM recording decoded successfully.
Five capture start/stop cycles returned to 19 idle tasks and a stable internal
heap; the 345 KiB pixel buffers were released each time.

During one established WebRTC session with mostly silent input, consecutive
28-second mirror-off and 22-second mirror-on CPU samples showed:

| Measurement | Mirror off | Mirror on |
| --- | --- | --- |
| Mirror worker (% of one core) | 0.03% | 0.83% |
| Core 0 idle | 58.7% | 58.4% |
| Core 1 idle | 79.6% | 79.0% |
| Microphone / playback queue drops | 0 / 0 | 0 / 0 |
| Audio send errors | 0 | 0 |

Forced screen resends and an eight-second host-process stall exercised
backpressure. The lease expired, capture buffers were released, and the feed
recovered after the viewer resumed. The largest observed flush-copy wall time
was 2.18 ms, including task preemption. Local microphone/Opus/speaker diagnostics
passed with mirroring off and with mirroring plus forced screen resends on.

A final repeat on the flashed build completed an 86-second WebRTC session with
zero microphone/playback queue drops and zero send errors, including forced
screen resends. Equal 20-second intervals measured 0.03% of one core in the
mirror worker while off and 0.90% while on. A 12.6-second interval containing a
7.5-second resend burst measured 5.24%; both cores remained at least 56% idle.
Eighteen peer sends exceeding 20 ms occurred before the comparison; that count
did not increase during either comparison interval or the resend burst. The
session closed gracefully and returned to 19 idle tasks. Input was mostly
silent, so this still does not replace a spoken-conversation listening check.

**Voice-quality limitation:** later in the longer WebRTC run, microphone queue
drops developed and persisted with mirroring disabled and its buffers freed.
CPU headroom remained substantial. Subsequent connection attempts also hit
TLS/HTTP connection failures. These observations do not establish the cause of
the send stalls, and the low mirror CPU cost is not proof of glitch-free audible
speech. A listening check and a longer comparison on a reliable network remain
necessary. The new `send_max_us` / `send_slow` diagnostics help distinguish
blocked peer sends from display CPU overhead during that follow-up.

To repeat the comparison, run the mirror helper with a private log and command
file, start a conversation on the device, and collect two `live diagnostics`
snapshots around equal intervals with `live mirror-off` and `live mirror-on`.
Compare per-task runtime deltas, audio queue drops, send durations, and audible
speech. Check `live mirror-status` and the viewer's `/status` endpoint for USB
stalls and decode errors. Keep logs and recordings out of the repository.

### Paged captions and faster mirror (2026-10-08)

The Waveshare V2 was flashed with fixed-page captions and individual line labels.
Two 30-second synthetic-caption workloads ran during the same real Live WebRTC
session, first with the mirror off, then on. Each completed eight page clears,
with no scrolling and no labels extending below the caption area.
Synthetic words update at approximately 10 Hz and stay local to the display;
they are never submitted as conversation input.

| Measurement (% of one core) | Mirror off | Mirror on |
| --- | --- | --- |
| LVGL + software drawing | 12.13% | 16.04% |
| Mirror worker | 0.03% | 4.09% |
| Core 0 idle | 46.64% | 46.04% |
| Core 1 idle | 61.65% | 56.30% |

An intermediate build that still redrew whole caption blocks used 48.82% / 62.37%
for LVGL plus drawing on the same off/on workload. Individual line labels reduced
that work by approximately 75%. The final animated mirror transferred 1.74 MB
over 31 seconds with zero decoder errors or device USB stalls. Maximum observed
flush-copy wall time was 2.92 ms, including preemption.

Three complete usage-screen resends took 84–107 ms on the final build, compared
with 690–812 ms before this change. The screens had different duration values and
encoded sizes (30–31 KB versus 37–38 KB); this is a similar-content hardware
comparison, not an identical-payload USB benchmark. Dirty updates are checked
every 40 ms, without a fixed sleep after every packet. The browser also polls at
40 ms and receives no pixel payload for unchanged frames.

Seven native ASan/UBSan test groups and fourteen Python tests passed. Pagination
regressions cover exact fits, long deltas, UTF-8, overlapping speakers, source
rollover, viewport changes, spacing, newlines, and session resets. HTTP tests
cover conditional frames, reconnects, paused/disconnected status, and loopback
Host/Origin guards. Browser recording produced a 368 × 448 VP9 WebM that decoded
without errors.

The final firmware completed a 71-second call and a 15-second reconnect, both
with final usage events and zero microphone/playback queue drops or audio send
errors. Both returned to 19 tasks; free heap recovered from 5,164,936 to 5,169,216
bytes after the respective calls, with no monotonic loss in this short check.
Suspending the viewer process for seven seconds expired the device's five-second
lease and released capture buffers. Resuming that same process restored a complete
frame with no decoder errors.

The live workload used mostly quiet microphone input. Queue/transport metrics
verify scheduling headroom; they do not replace a spoken-conversation listening
check for audible glitches.

### Playback reserve validation (2026-10-09)

The Waveshare V2 ran a local six-second Opus diagnostic with 300 packets and
144,000 decoded samples per test. Once per second after the first second, four
20 ms packets were held and then delivered with the next packet, adding 80 ms
of arrival delay. Synthetic captions exercised display updates concurrently.
This isolates receiver pacing from Wi-Fi, API behavior, and speech generation.

| Playback reserve | Mirror | TX DMA starvation events, two runs |
| --- | --- | --- |
| Disabled | On | 6, 5 |
| 120 ms | On | 0, 0 |
| Disabled | Off | 5, 6 |
| 120 ms | Off | 0, 0 |

The second set reversed the configuration order. Every run submitted all
144,000 decoded samples with zero receive queue drops. Buffered runs needed no
re-priming. An earlier 80 ms reserve still produced four DMA starvation events
per run on the same workload, so the default is 120 ms. These counters indicate
hardware-output starvation; this test does not measure analog speaker quality,
packet-loss concealment, or the behavior of the previous `esp_peer` binary.

Nine native test groups passed with ASan/UBSan, including PCM order, variable
packet duration, capacity bounds, disabled buffering, short-tail release, and
millisecond-counter wrap. Seventeen Python tests passed, and the Waveshare
firmware built and flashed successfully. Hardware telemetry now also reports
receive queue age, speaker write duration, decoded signal peaks, and complete
active controller-loop intervals; startup handshakes are excluded from the
latter metric. Keep device logs and session identifiers private.

The final firmware then completed a 43-second Live call with spoken input and
an assistant story, while USB mirroring remained enabled. The listener reported
smooth speaker audio. Two approximately 20-second CPU samples measured:

| Measurement (% of one core) | First interval | Second interval |
| --- | --- | --- |
| Core 0 idle | 54.54% | 55.69% |
| Core 1 idle | 75.58% | 79.55% |
| Playback task | 17.32% | 18.05% |
| Microphone task | 20.58% | 20.83% |
| Transport/controller | 14.57% | 14.67% |
| Mirror worker | 1.52% | 0.94% |

There were no microphone/playback queue drops, send errors, or authenticated
RTP sequence losses. Maximum active controller-cycle time was 8.010 ms; maximum
encode/decode calls were 9.452/11.622 ms. The call still recorded three re-primes
and 31 DMA empty events; these counters include quiet periods and are not a
count of audible glitches. No decoded samples were near full scale. This is a
single subjective listening check, not a claim that all delivery gaps are fixed.

A subsequent 20-second reconnect with mostly silent input also closed gracefully,
with zero queue drops, send errors, DMA empty events, or re-primes. Both calls
returned to 19 tasks. Immediate post-call free heap was 5,165,224 and 5,163,012
bytes with preconnection disabled; the few-KiB difference does not establish
or rule out a long-term leak. Playback stack headroom remained above 16 KiB.

### Receive-burst handling on the round Waveshare (2026-10-30)

A deterministic six-second test holds 24 consecutive 20 ms packets once per
second after the first second, then delivers those packets and the next packet
together. All 300 Opus packets are encoded before scheduling delivery, so
encoder work cannot accidentally spread out the simulated network burst.
The diagnostic creates no API session and frees its temporary PSRAM afterward.

| Same 480 ms arrival holds | Original 16-slot SDK queue | 64-slot SDK queue |
| --- | --- | --- |
| Received packets dropped by the SDK | 40 | 0 |
| Samples submitted to I²S | 124,800 / 144,000 | 144,000 / 144,000 |
| Playback re-primes | 5 | 1 |
| DMA empty notifications | 51 | 19 |

The regular 80 ms jitter test also passed with all 144,000 samples, no drops,
and no DMA empty events or re-primes. This isolates receive/playout behavior;
it is not a listening assessment or a test of radio packet loss. A 480 ms gap
still exceeds the normal 120 ms reserve. Extra queue capacity preserves the
recovered burst but can increase playback delay on poor links. The SDK queue
adds approximately 71 KiB of PSRAM. All four voice examples now configure
32 UDP receive slots, increased from 16. Neither queue grows without a bound.

Transport regressions cover a missing packet followed by a burst, sequence
rollover, duplicates at capacity, a nearer packet arriving into a full window,
the missing packet itself filling the hole, and expired noncontiguous packets.
When the eight-slot reorder window fills, it advances from the nearest received
packet and merges the incoming packet before releasing later packets. It can
declare a missing packet late earlier than the 40 ms timer, but retains received
audio instead of amplifying loss. Authentication, replay checks, payload limits,
and the eight-slot allocation bound remain unchanged. The audio executable
passed 472 assertions; all 12 transport ASan/UBSan suites, 14 SDK host suites,
and 32 Python tests passed.
