# M5Stack CoreS3 LITE Live Voice

> **Experimental project. Not officially supported by OpenAI.**

This standalone ESP-IDF example targets the **M5Stack CoreS3 LITE**: ESP32-S3,
16 MB flash, 8 MB PSRAM, a 320 × 240 touch display, ES7210 microphones, an
AW88298 speaker amplifier, and a front-facing GC0308 camera. The BSP detects
ILI9342C and ILI9342E display revisions.
Other M5Stack models have not been validated by this example.

The app uses the same `live`, `live_esp32`, and `live_peer` components as the
Waveshare app. Networking, Opus, TLS preconnection, the 120 ms playback reserve,
transcripts, and usage accounting are shared. Only board initialization,
I²S conversion, camera capture, and the screen layout live here. The standalone
Wi-Fi manager is shared with Sonatino under `examples/common`.
It does not install the Waveshare launcher or use `esp_peer`.

The LCD uses a vivid cyan/gold palette with stronger control outlines and a
65% backlight by default. This reduces backlight glow indoors; the LCD still
cannot reproduce the black level of an AMOLED display. USB commands can adjust
the brightness or restore the previous pastel palette and 85% backlight for
comparison. These adjustments last until reboot.

The dark UI opens with a 240 × 80-pixel Start button and a 22-pixel label.
During calls and on the usage page, the control is a compact 156 × 40 pixels.
Connection progress and errors appear under the title. Both button sizes retain
10 pixels of additional invisible touch padding.
Cyan user captions and gold assistant captions fill a fixed page, then clear
and continue from the top. At session end, the screen shows model names, voice
seconds, and backend token counts. Captions preserve characters available in the
22-pixel [Roboto font](../common/fonts/README.md) and simplify unsupported Unicode
with the shared ASCII fallback. The original SDK transcript remains intact.

## Build and flash

Install and activate **ESP-IDF 5.5.2** with ESP32-S3 tools. Use its Python
environment and the component-manager version tested in CI:

```sh
python -m pip install 'idf-component-manager==2.5.2'
```

Credentials stay in private files outside this repository:

- `api-key`: your API key on a single line.
- `wifi.json`: `{"networks":[{"ssid":"YOUR_SSID","password":"YOUR_PASSWORD"}]}`.

The Wi-Fi list supports one to eight profiles. The app selects the strongest
available saved network and retries alternatives after failures. It does not
roam away from a working connection or scan during a voice call.

From the repository root:

```sh
python tools/prepare_m5stack.py \
  --key-file "$HOME/.config/openai-live-esp32/api-key" \
  --wifi-file "$HOME/.config/openai-live-esp32/wifi.json"
export LIVE_VOICE_PRIVATE_DIR="$HOME/.cache/openai-live-m5stack/private"
export LIVE_PEER_DEPS_DIR="$HOME/.cache/openai-live-m5stack/vendor/peer"
idf.py -C examples/m5stack build
```

The preparation tool creates a private credential header and downloads the same
hash-verified transport dependencies as Waveshare. ESP-IDF installs the board
components pinned in [`dependencies.lock`](dependencies.lock). `LIVE_MODEL` and
`LIVE_RESPONSES_MODEL` may be set before preparation; defaults are `gpt-live-1`
and `gpt-6-luna`, with priority Responses delegation and hosted web search.

Identify the **M5Stack's** USB serial port before flashing. Save the existing
firmware to a private directory if you want to restore its factory apps:

```sh
umask 077
python -m esptool --port YOUR_PORT read_flash 0 0x1000000 \
  "$HOME/.cache/openai-live-m5stack/private/factory-backup.bin"
idf.py -C examples/m5stack -p YOUR_PORT flash monitor
```

If automatic reset cannot enter the bootloader, hold the bottom RST button for
about three seconds until the green LED lights, then release it and retry. If a
verified flash leaves the console at `waiting for download`, briefly press RST,
or use ESP-IDF's esptool to restart from download mode:

```sh
python -m esptool --chip esp32s3 --port YOUR_PORT \
  --before no_reset --after watchdog_reset flash_id
```

Flashing replaces the factory app and partition layout. A full backup can be
restored using `esptool write_flash 0 factory-backup.bin` with the same board.
Never publish credential headers, build directories, flash backups, or firmware
images. Do not flash this profile to the Waveshare device.

## Audio and diagnostics

After Wi-Fi connects, tap **Start**, speak into the built-in microphones, and
listen through the speaker. Tap **Stop** to request graceful close and show
usage. The app does not start a session automatically. USB `live start` and
`live stop` provide the same session controls.

The board layer runs full-duplex, 24 kHz, signed 16-bit stereo I²S, selects the
first microphone channel, and duplicates SDK mono output into both speaker slots.
It uses microphone GPIO14 and amplifier GPIO13, matching the pinned BSP and
[M5Unified's CoreS3 implementation](https://github.com/m5stack/M5Unified/blob/e125e73f28b6b83e621e48df432af426bb2ff935/src/M5Unified.inl#L2664-L2678).
The product-page pin table reverses these two data pins.
Codec/I²S objects persist for the firmware lifetime; sessions reopen and close
them. Reads and writes have bounded timeouts and reject partial transfers.
The speaker starts at 100% volume. There is no acoustic echo cancellation.
Six 20 ms DMA descriptors retain the shared SDK's 120 ms playback reserve.

USB commands work with [`tools/device_console.py`](../../tools/device_console.py):

| Command | Action |
| --- | --- |
| `live start`, `live stop` | Start or stop a real Live session |
| `live mute`, `live unmute` | Control microphone transmission |
| `live status` | Session, packet, audio, and Wi-Fi counters |
| `live timing` | Startup stage timings |
| `live diagnostics` | Heap/task/transport diagnostics |
| `live audio-test` | Opus test tone through the speaker, measured by the microphone |
| `live jitter-test` | Local playback test with deterministic packet jitter |
| `live peer-test` | Five local transport create/destroy cycles |
| `live display vivid`, `live display original` | Select the LCD-tuned or previous display profile, including its brightness |
| `live brightness N` | Set the backlight from 0 to 100 without changing the palette |
| `live display-test` | Show RGB/white, grayscale, and caption samples for 30 seconds while idle; a session or photo ends the test |
| `live photo-test` | Capture/compress a photo locally; idle tests dump a base64 JPEG over USB, active tests log timing only |
| `live wifi-next` | Try another saved profile once the call ends |

The first version provides USB diagnostics; continuous screen mirroring remains
a Waveshare feature. SD card, IMU, wake-word detection, and OTA updates
are not initialized by this app.

## Camera questions

During a session, aim the front-facing camera at an object or a large printed
label and ask what it sees. The frontend delegates visual questions; the
Responses backend calls `capture_photo` and receives the JPEG directly in its
function result. A small **Photo** indicator appears during capture, then the
captured image fills the screen for two seconds before captions return. The
Stop button remains available over the preview. The camera
is powered down between snapshots; this is not a continuous video feed.

The example captures 320 × 240 RGB565 frames, lets exposure settle, and encodes
one JPEG on a separate low-priority task. It releases the camera/DMA resources
before encoding, uses PSRAM for image buffers, and reduces JPEG quality as
needed to stay within a 10 KiB image budget and the existing 16 KiB JSON-message
limit. The encoder uses a separate, conservative 904 KiB transient PSRAM
workspace: hardware tests found that it can write past the declared output
capacity. Only a successfully encoded JPEG whose actual length fits the upload
budget is copied into the upload buffer. The 150 KiB preview buffer is released
after two seconds. Small print and distant objects may require moving closer.
Capture failures are returned to the backend explicitly. Results from a stopped
session or superseded delegation are discarded. Captures are limited to 32 per
session.

The frontend and backend prompts are in [`main/main.cpp`](main/main.cpp). Other
boards remain voice-only unless they supply the optional `capture_photo`
callback and camera-aware prompts in `live_esp32_config_t`. The portable `live`
component exposes optional client function tools, `live_session_response_item`,
and `live_session_response_create`; capture hardware stays outside that core.

Photos are sent to the configured API during visual questions. The firmware
does not store them on flash or log them during calls. The explicit idle
`live photo-test` diagnostic prints its image over USB so developers can inspect
orientation, exposure, and color; keep those diagnostic logs private.

The shared UI helpers are under [`examples/common`](../common). Waveshare's
existing include paths forward to those same files, preserving its integration.

## Dependencies and validation

The BSP and its transitive registry packages are pinned in
[`dependencies.lock`](dependencies.lock). The shared adapter's audio codec and
the camera's `esp_video` and `esp_new_jpeg` dependencies have
Espressif-product restrictions. See the
[M5Stack dependency inventory](../../THIRD_PARTY_NOTICES.md#m5stack-cores3-lite-integration).

A physical CoreS3 LITE completed a Live camera question; the listener confirmed
a correct description and smooth audio. Repeated captures displayed the photo
for two seconds and released the preview buffer. A local playback test with
simultaneous capture/preview completed without drops or underruns. CI builds
all three standalone examples and runs shared host regressions, including
M5Stack PCM conversion, photo encoding bounds, and tool-result handling. These
checks do not establish long-duration leak freedom or audio quality on every
network. The repository's screenshots and USB screen
mirror demonstrate Waveshare, not this device.
