# Waveshare Live Voice example

> **Experimental project. Not officially supported by OpenAI.**

This example adds Live Voice to the Brookesia launcher on the
**Waveshare ESP32-S3-Touch-AMOLED-1.8 V2**: CO5300 QSPI AMOLED (368 × 448),
CST816S-family touch, ES8311 audio, 16 MB flash, and 8 MB PSRAM.
The original SH8601 display revision needs a different BSP. **Do not flash this
profile to another board revision.**

See the [actual device screenshots](../../README.md#waveshare-screenshots).
The [portable transport validation record](../../docs/waveshare-validation.md)
distinguishes completed checks from remaining live-device acceptance tests.

## What the app does

Live Voice opens on boot. Start creates a new Live WebRTC session; Stop ends it.
The button is green when ready, amber while connecting, red while connected,
and disabled gray without an IP address. During a session, the title and status
hide, leaving the colored transcript and Stop button. Leaving the app ends the call.

The Dot rail layout uses a black background, cyan user captions, and warm
sand assistant captions. A narrow dotted rail marks each turn with one user dot
or two assistant dots; no speaker labels are needed. Wrapped lines have no extra
line spacing, and turns have a compact 4-pixel gap. Captions use 36-pixel Roboto.
The opening screen shows "Ready to talk." and a 260 × 112-pixel Start button
with a 28-pixel label. Status text appears for connection progress or errors.
During calls and on the usage page, the control is 180 × 56 pixels to preserve content space.
Both sizes use a tinted surface, a clearly colored label and dot, and 20 pixels
of additional invisible touch padding.
The launcher's clock/status strip and white bottom gesture indicator are hidden
while the app is open. The bottom navigation gesture remains available; the
indicator returns in the launcher and other apps.
Captions keep Unicode characters covered by the bundled font and fall back to
readable ASCII (or `?`) for unsupported characters. The SDK keeps the original
transcript. See [font coverage and regeneration](fonts/README.md).
Captions fill a fixed page
without scrolling. When the next wrapped line will not fit, the page clears and
that line continues at the top. Long utterances can span several pages.
Individual line labels keep completed lines unchanged as new words arrive,
reducing the work needed to render each update.
The UI reserves a 28-pixel
inset for the rounded corners and navigation gesture. Speaker volume is set to
100% when Live Voice opens the audio device; adjust `audio_open` for a lower level.

After a call, the usage page shows frontend/backend model names, voice seconds,
and backend total/input/output tokens. Whole seconds appear as `60 s`; fractional
reports retain one decimal place. It uses final `session.closed` duration
when available; otherwise it retains the last update and shows "Last reported".
Missing token reports remain unavailable. These values clear on the next call
or reboot. See [usage semantics](../../docs/core.md#status-captions-and-usage).

The defaults are `gpt-live-1.1` for voice and Responses delegation through
`gpt-6-luna`, `service_tier: "priority"`, with hosted `web_search`. Backend
instructions use search for current-information requests. Set `LIVE_MODEL` and
`LIVE_RESPONSES_MODEL` before preparation to choose other supported models.

## Prerequisites

- The named Waveshare **V2** device and a USB data cable.
- ESP-IDF **5.5.6**, installed with ESP32-S3 tools and an activated `export.sh`.
- A 2.4 GHz Wi-Fi network and an API key with access to the configured models.
- Python from the ESP-IDF environment, which includes pyserial for USB controls.

The shell instructions below target macOS/Linux. No dependency on another
repository checkout is required.

## Configure credentials locally

Keep credentials **outside** this checkout. Create a private configuration directory:

```sh
umask 077
mkdir -p "$HOME/.config/openai-live-esp32"
chmod 700 "$HOME/.config/openai-live-esp32"
```

Use your editor to create:

- `$HOME/.config/openai-live-esp32/api-key`: your API key as one line.
- `$HOME/.config/openai-live-esp32/wifi.json`: your own network profiles, for example:

```json
{
  "networks": [
    {"ssid": "YOUR_WIFI_SSID", "password": "YOUR_WIFI_PASSWORD"},
    {"ssid": "YOUR_OTHER_SSID", "password": "YOUR_OTHER_PASSWORD"}
  ]
}
```

Replace the placeholders locally. Supply one to eight profiles; an empty password
selects an open network. The original single-object `{"ssid": "...", "password": "..."}`
format is also accepted. If no Wi-Fi file is supplied, configure networking in
the launcher's Settings app.

```sh
chmod 600 "$HOME/.config/openai-live-esp32/api-key" \
  "$HOME/.config/openai-live-esp32/wifi.json"
```

Do not paste keys into shell commands or commit these files. Alternatively, the
preparation tool can read `OPENAI_API_KEY` from an already configured environment.

## Prepare and build

From the repository root, with ESP-IDF activated:

```sh
python tools/prepare_voice.py \
  --key-file "$HOME/.config/openai-live-esp32/api-key" \
  --wifi-file "$HOME/.config/openai-live-esp32/wifi.json"

export LIVE_VOICE_PRIVATE_DIR="$HOME/.cache/openai-live-esp32/private"
idf.py -C "$HOME/.cache/openai-live-esp32/vendor/waveshare/firmware/brookesia/v2" build
```

The tool downloads pinned public sources, checks Git blob or archive SHA-256 hashes, and
applies the integration patches in `~/.cache/openai-live-esp32`. `--cache` chooses
another external directory; set `LIVE_VOICE_PRIVATE_DIR` to its `private` subdirectory.
The generated header has mode `0600`, and the private directory has mode `0700`.
If GitHub reports an API rate limit, retry later or supply `GITHUB_TOKEN` through
your local credential manager. It is used only for the public repository tree
requests, is not printed, and is not stored in the generated header.

The patched launcher includes Live Voice alongside the other vendor apps. The
inherited file player supports **WAV only**: the overlay removes its Helix MP3
dependency and filters MP3 tracks out of the music list. The vendor's bundled
MP3 demo tracks cannot be played; supply your own WAV files on the SD card.
Live Voice uses a separate Opus codec and is unaffected by this restriction.
The overlay adds shared audio ownership, corrects QSPI display registration, applies
the V2 CO5300 initialization sequence, and serializes Wi-Fi scans with the
launcher reconnect worker. Re-running preparation restores pinned vendor files
before reapplying patches and regenerates the launcher configuration. Keep your
own changes in this repository, not in that generated cache.

**The private header, compiled objects, ELF, firmware image, and device backups
contain credentials. Never publish them.** This repository intentionally provides
source builds instead of downloadable firmware.

The app uses the source-built portable peer library, libSRTP, and usrsctp;
it no longer links `esp_peer`. Preparation also creates an isolated ESP-IDF
Mbed TLS component using the pinned upstream 3.6.8 release and Espressif hardware
compatibility patch. It does not modify your ESP-IDF installation. `LIVE_PEER_DEPS_DIR` can override the default
`vendor/peer` dependency directory next to `private`.

The vendor Xiaozhi assistant is excluded from this example. Preparation skips its
source and prompt audio, removes old copies from reused caches, and removes its
`xiaozhi-fonts` dependency and filesystem font. Live Voice uses the shared Roboto
fonts; the other launcher apps, including Settings, remain available. ESP-IDF
removes the unused managed dependencies when it resolves the updated project.
The build rejects a dependency graph that reintroduces Xiaozhi or its font package.

Other vendor apps, LVGL fonts, and media are downloaded into the external build
cache and retain their own terms. The repository license does not cover all
firmware components. See the
[dependency inventory](../../THIRD_PARTY_NOTICES.md) before redistributing any
vendor sources or build output.

To update an older installation, rerun preparation and build, then use **full
`flash`**, not only `app-flash`, to replace the storage image as well as the app.
Partition offsets are unchanged. The old, unused speech-model partition remains
reserved and is not flashed; historical backups and firmware images are not
rewritten by preparation.

## Back up and flash

Find your device's serial port using your OS or `python -m serial.tools.list_ports`.
Set `ESPPORT` to the actual port, such as `/dev/ttyACM0` on Linux or a
`/dev/cu.usbmodem...` path on macOS. Close any serial monitor before flashing.

Before the first installation, back up all 16 MB of flash to a private local file:

```sh
export ESPPORT=/dev/ttyACM0
python -m esptool --chip esp32s3 --port "$ESPPORT" read_flash \
  0 0x1000000 "$HOME/.config/openai-live-esp32/device-backup.bin"
```

Confirm the board revision and use the generated **full flash arguments** for the
first installation. This installs the bootloader, partition table, app, and vendor
assets. It replaces the installed launcher and partition layout. The pinned
layout places the app at `0x200000`; other factory layouts can differ.

```sh
idf.py -C "$HOME/.cache/openai-live-esp32/vendor/waveshare/firmware/brookesia/v2" \
  -p "$ESPPORT" -b 921600 flash
```

After the same layout is installed, subsequent app-only updates can use:

```sh
idf.py -C "$HOME/.cache/openai-live-esp32/vendor/waveshare/firmware/brookesia/v2" \
  -p "$ESPPORT" -b 921600 app-flash
```

Keep the board powered. Unplugging USB powers it off if no battery is attached.

## Saved Wi-Fi behavior

The app initially tries the last saved network. Both initial connections and
fallback attempts search all channels and prefer the strongest matching access
point. After a connection/DHCP failure, it selects the strongest available
eligible saved profile. Association gets up to 30 seconds, followed by a separate
20-second DHCP window; a connection that succeeds during a scan is retained.
Failed profiles have a cooldown so one bad network cannot prevent fallback. A working connection is
retained, and scans do not run during a call.

Persistent network loss stops the current session before selecting another
network. Start creates a new call after connectivity returns. The Settings Wi-Fi
off switch is respected after initial provisioning. Profile selection depends on
visible scan results; it is not an Internet-reachability or captive-portal test.

## USB diagnostics and screenshots

Run one monitor in a terminal:

```sh
python tools/device_console.py --port "$ESPPORT" \
  --log "$HOME/.cache/openai-live-esp32/device.log" \
  --commands "$HOME/.cache/openai-live-esp32/private/commands" --seconds 600
```

The monitor attaches without intentionally resetting the device, records host UTC
timestamps at connection boundaries, and automatically retries if USB disconnects.
It reads retained status and startup timings after each attach. Commands queued
before reconnecting are discarded so an old Start command cannot launch a call.
Keep the monitor running while reproducing a failure.

After it prints `USB console ready`, append commands from another terminal:

```sh
printf 'live status\n' >> "$HOME/.cache/openai-live-esp32/private/commands"
```

| Command | Purpose |
| --- | --- |
| `live start`, `live stop` | Start or gracefully stop a call |
| `live mute`, `live unmute` | Mute or resume microphone input |
| `live status` | Connection, packet counts, Wi-Fi/IP, RSSI/channel, disconnect count/reason, scan/power-save mode, and battery status |
| `live timing` | Retained startup timing checkpoints |
| `live diagnostics` | Free heap, largest internal block, task count, and optional task CPU counters |
| `live preconnect-on`, `live preconnect-off` | Enable/disable idle TLS warmup for startup comparisons |
| `live wifi-scan` | List visible networks while idle |
| `live wifi-reconnect`, `live wifi-next` | Retry or select a saved alternative |
| `live screen`, `live panel-reset` | Restore brightness or reset the display |
| `live screenshot` | Export an RGB565 framebuffer capture |
| `live audio-test` | Three-second local microphone/Opus/speaker diagnostic |
| `live jitter-test` | Six-second local Opus/speaker test with injected packet delays; no API call |
| `live playout-on`, `live playout-off` | Enable/disable the 120 ms priming reserve for the next session or test |
| `live captions-test` | Animate local synthetic captions for 30 seconds; can run during a call without sending the text to the API |
| `live glyphs-test` | Check and display quotes, accents, punctuation, and ASCII fallback on three local sample pages |
| `live peer-test` | Five local WebRTC init/offer/destroy/shutdown cycles; logs heap/task counts without signaling or audio |

To save an actual screen image, send `live screenshot`, wait for `LVGL_END` in
the log, then decode the latest complete capture:

```sh
python tools/decode_screen.py "$HOME/.cache/openai-live-esp32/device.log" \
  "$HOME/.cache/openai-live-esp32/screen.png"
```

This captures pixels rendered by the running firmware; it is not a camera photo
and cannot confirm physical panel brightness. Review screenshots before sharing.
Logs can contain private conversations and network details; keep them local.

## USB screen mirror and demo recording

With the current firmware flashed, stop `device_console.py`, IDF Monitor, and any
other program using the serial port. Activate the ESP-IDF Python environment,
then run:

```sh
python tools/screen_mirror.py --port "$ESPPORT"
```

The helper automatically opens an authenticated viewer at `http://127.0.0.1:8765`.
It creates a fresh access token for each run and passes it to your browser through
a temporary launch file readable only by your OS account. Frames, status, and
pause/resume requests require this token; it is not embedded in the public viewer
page or printed in the terminal. Use **Record screen** and
**Stop & save** to download a video, or **Fullscreen** for OBS window capture.
Chrome supports WebM recording; other browsers depend on their MediaRecorder
support. The recording preserves the device's 368 × 448 screen pixels, including
the actual transcripts, colors, and usage page. It includes **no audio**. Record
the conversation separately with your camera or microphone. The 30 fps video
timeline repeats unchanged frames; it does not imply 30 device updates per second.

The viewer does not start a voice session. Tap Start on the device as usual.
**Pause mirror** stops capture and releases its frame buffers; **Resume mirror**
starts it again. Closing the browser tab does not stop the helper. Ctrl-C stops
it and removes the private launch file. `--no-browser` suppresses opening a tab;
open the `file://` launch link printed in the terminal when ready. Opening the
bare HTTP address in a fresh tab does not grant access. Reloading an authenticated
tab works; after restarting the helper, use its new launch link.
`--listen-port` chooses another local port. The server binds only to loopback.
Use only one helper per device. Keep the launch file private: anyone with its
token can access the viewer while that helper instance runs. This protects
against other local OS accounts, not programs running as your own account or
an administrator who can read your files or browser state.

Optional private diagnostics can share the same USB connection:

```sh
python tools/screen_mirror.py --port "$ESPPORT" \
  --log "$HOME/.cache/openai-live-esp32/mirror.log" \
  --commands "$HOME/.cache/openai-live-esp32/private/commands"
```

The log contains text diagnostics, not binary pixels. The command file accepts
voice start/stop, mute/unmute, status, timing, diagnostics, audio-test, jitter-test,
playout-on/off, captions-test,
preconnect-on/off, and these mirror commands:

| Command | Purpose |
| --- | --- |
| `live mirror-on`, `live mirror-off` | Resume/pause mirroring through the helper |
| `live mirror-key` | Resend the complete cached screen |
| `live mirror-status` | Copied flushes, skipped unchanged rows, sent stripes/bytes, USB stalls, maximum copy time |

The device copies already-rendered RGB565 pixels at LVGL's flush event. It does
not take repeated snapshots or re-render the screen for each update. A priority-1
task copies dirty 16-row stripes under short display locks, then compresses and
sends them outside the lock. Identical rows are skipped. Dirty stripes are checked
every 40 ms; USB writes use short bursts, yielding to other tasks and retrying a
full queue for at most 20 ms before rescheduling the stripe. Pending updates
coalesce in a PSRAM shadow buffer; a slow host
does not grow a frame queue. A five-second viewer lease disables capture after a
host crash or disconnection. Active pixel buffers use 345 KiB of PSRAM. The
resident worker also has an 8 KiB PSRAM stack, and the USB driver uses a 4 KiB TX
buffer plus a 256-byte RX buffer and driver metadata.

Packets are COBS-delimited, CRC32-checked, and numbered, with raw RGB565 or
run-length encoding. The viewer requests a repair after decoding errors (at most
once per second), plus a complete cached screen every 30 seconds to cover silent
loss. The browser polls every 40 ms using a conditional frame request that also
carries connection status; unchanged frames have no pixel payload. Actual update
rate depends on the changed pixels and USB throughput. This is a screen mirror over USB Serial/JTAG, not a
USB webcam. The capture hook targets this pinned board's LVGL 9 partial RGB565
rendering configuration. Panel brightness, physical glass, and touch gestures
are not visible in the feed. Review recordings for private conversations before
sharing them.

## Troubleshooting

While Live Voice is open and Wi-Fi has an IP address, the SDK prepares one TLS
connection to the API in the background. It sends no HTTP request or API key,
creates no Live session, and opens no microphone until Start. Start consumes
that connection, or finishes its in-flight handshake; without a usable warm
connection it connects normally. `live timing` reports readiness and whether
the last session reused the connection. Startup times still begin at Start.

Warm connections are replaced after 45 seconds or when the peer closes them.
Failed warmups back off for five seconds. Wi-Fi changes and leaving the app
invalidate the cache. The TLS/HTTP resources are freed before audio starts;
warmup resumes after Stop. This improves tap-to-session latency when there is
time to prepare, but cannot hide a slow network if Start is tapped immediately.
For another device, call `live_esp32_preconnect(true)` while its voice UI is open
and `live_esp32_network_changed(...)` on every IP acquisition/change or loss.
Disable preconnection when leaving that UI. These calls are nonblocking.

Audio diagnostics on USB separate microphone queue drops (`tx_drop`), playback
queue drops (`rx_drop`), and peer send errors (`send_err`). `poll_max_us` and
`poll_slow` measure the longest peer-loop call and the number exceeding 20 ms
since Start, including handshake time. These are wall-clock durations, not CPU
utilization. `send_max_us` and `send_slow` similarly measure peer audio-send
calls, to distinguish a blocked sender from CPU saturation. Capture and playback
run on separate tasks; one controller owns transport polling and sends up to
four queued microphone packets per iteration.

`active_cycle_max_us` and `active_cycle_slow` measure complete controller-loop
intervals while the session is active, including scheduling and log output.
They exclude connection setup. `queue_age_max_us` measures time in the receive
queue before decode; `write_max_us` includes intentional blocking speaker pacing
and therefore is not CPU time.

Portable transport diagnostics also report authenticated RTP sequence gaps,
reordered packets, the longest packet-arrival gap, codec call durations, and
playback queue wait timeouts. Sequence gaps may later be filled by reordering;
arrival gaps and queue waits include silence, so they alone do not prove audible
dropouts. A bounded 120 ms PCM reserve now primes playback, and primes it again
after hardware starvation. This adds latency and about 11.3 KiB of active-call
PSRAM stack, but does not change RTP validation or cryptography. It is not an
adaptive jitter buffer or packet-loss concealment.

The `playout` log reports the target, rebuffer count, TX DMA completion-queue
overflow events (`dma_empty`), decoded peak magnitude, and samples near full
scale. DMA events indicate output starvation, including during intentional
silence; near-full-scale samples do not prove analog clipping. Startup events
before the first write are excluded. The firmware preparation overlay installs
the nonblocking I2S counter: rerun `tools/prepare_voice.py` using your normal
private configuration before rebuilding an existing vendor checkout.

For an API-independent comparison, run `live playout-off`, then
`live jitter-test`; repeat with `live playout-on`. Each test encodes the same
six-second tone and injects an 80 ms delay once per second. Compare `dma_empty`,
`rebuffers`, sample counts, and drops. Repeat with mirroring off/on, optionally
running `live captions-test` during the test. See the measured
[playback validation](../../docs/testing.md#playback-reserve-validation-2026-10-09).

For task CPU accounting, enable `CONFIG_FREERTOS_GENERATE_RUN_TIME_STATS` in
the generated launcher's `menuconfig`, rebuild, and take two `live diagnostics`
snapshots several seconds apart. Divide each task's runtime-counter delta by
the total-counter delta to obtain utilization of one core. On the dual-core
ESP32-S3, task percentages may sum to 200%. With the default ESP timer clock,
counter units are microseconds; account for counter wrap when comparing samples.
Sampling briefly suspends the scheduler, so use this command for diagnostics,
not continuous monitoring. Compare idle heap and task counts after repeated
Stop operations to check for accumulating resources. Disable background TLS
preconnection with `live preconnect-off` before comparing idle memory, and
restore it with `live preconnect-on` afterward.

- **Start stays gray:** wait for DHCP; check the network is 2.4 GHz and the profile
  is correct. Captive portals and enterprise authentication are not implemented.
- **HTTP 401/403:** check the key, project permissions, and model access. Do not
  paste your key into an issue.
- **Slow startup:** use `live timing` to distinguish HTTPS setup from peer setup.
  Weak Wi-Fi can dominate connection time.
- **Dark screen:** verify V2/CO5300 hardware and try `live panel-reset`. A successful
  USB command alone does not prove the panel is displaying pixels.
- **Echo or interruptions:** this prototype has no acoustic echo cancellation.
  Reduce volume or change the device's acoustic arrangement.
- **No final usage:** transport loss may prevent `session.closed` from arriving.
  The last report remains visible, explicitly marked as last reported.
