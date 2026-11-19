# ESP-Mosaico Live Voice

> **Experimental project. Not officially supported by OpenAI.**

A standalone Live voice app for Espressif's **ESP-Mosaico**, including its
camera and interaction expansion modules. Mosaico uses an **ESP32-S31**,
not an ESP32-S3: dual 320 MHz RISC-V cores, PSRAM, a 480 × 480 square
AMOLED, ES8311 audio, IMU, two magnetometers, a battery gauge, and a vibration
motor. This example uses the shared SDK and portable WebRTC transport.

See Espressif's [board guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s31/esp-mosaico/user_guide.html),
[camera guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s31/esp-mosaico/user_guide_camera.html),
and [interaction-module guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s31/esp-mosaico/user_guide_interact.html).
Connect the camera to the **left slot** and interaction module to the **right
slot**, following those guides. The BSP discovers the board revision and camera
model; this app does not hard-code an S3 pinout. Attach the modules before
boot; the interaction module is initialized during startup.

## Build and flash

Mosaico needs the preview S31 toolchain. Keep this installation separate from
the **ESP-IDF 5.5.2** installation used by the S3 examples. The tested source pin
is ESP-IDF `7b9cc1ac79f865983f59bb8ff3ff43eb74ff1dbe` (6.2 preview):

```sh
git clone --filter=blob:none https://github.com/espressif/esp-idf.git "$HOME/esp/esp-idf-mosaico"
git -C "$HOME/esp/esp-idf-mosaico" checkout 7b9cc1ac79f865983f59bb8ff3ff43eb74ff1dbe
git -C "$HOME/esp/esp-idf-mosaico" submodule update --init --recursive
export IDF_TOOLS_PATH="$HOME/.espressif-mosaico"
"$HOME/esp/esp-idf-mosaico/install.sh" esp32s31
. "$HOME/esp/esp-idf-mosaico/export.sh"
python -m pip install idf-component-manager==3.1.2
```

From this repository's root, with your API key and Wi-Fi profiles stored outside
the repository:

```sh
python tools/prepare_mosaico.py \
  --key-file "$HOME/.config/openai-live-esp32/api-key" \
  --wifi-file "$HOME/.config/openai-live-esp32/wifi.json"
export LIVE_VOICE_PRIVATE_DIR="$HOME/.cache/openai-live-mosaico/private"
export LIVE_PEER_DEPS_DIR="$HOME/.cache/openai-live-mosaico/vendor/peer"
idf.py --preview -C examples/mosaico build
```

Preparation checks source hashes, downloads the BSP and USB console into the
ignored `vendor/` directory, and writes credentials into the external private
cache. Keep the default vendor location for portable dependency-lock paths.
`LIVE_MODEL` and `LIVE_RESPONSES_MODEL` before preparation choose models;
prompts, priority-tier delegation, web search, and tools are configured in
[`main/main.cpp`](main/main.cpp).

Use a data-capable Type-C cable. **Back up the factory NOR flash before
replacing its application and partition layout**:

```sh
umask 077
python -m esptool --chip esp32s31 --port YOUR_PORT \
  read-flash 0 ALL "$LIVE_VOICE_PRIVATE_DIR/factory-backup.bin"
idf.py --preview -C examples/mosaico -p YOUR_PORT flash monitor
```

The application preserves a high-speed USB CDC console and esptool's software
download-mode reset. Entering ROM download mode can change the serial-port name;
if it does, select the newly enumerated port. Do not substitute the S3 native
USB Serial/JTAG settings: those pins are shared with this board's camera.
The app does not mount, format, or write the separate NAND storage.

Firmware, generated headers, factory backups, and device logs can contain
credentials or conversation content. Keep them private and outside the repo.

## Controls and tools

Tap **Start**, press the board's **AI** button, or press the interaction module's
**left button** to start/stop. The right module button toggles microphone mute
during a session. Cyan/gold captions paginate without scrolling. Stop shows
usage. A captured photo appears for two seconds before captions return.

The six interaction LEDs flow with transcript activity: user chunks have a
cyan base and assistant chunks have a warm gold base. The individual LEDs drift
through different teal/cyan/blue or amber/gold shades, with staggered, slow
breathing pulses that stay lit at their dimmest point. While transcript chunks
arrive, the color flow and pulses accelerate to roughly 2.5–3-second cycles;
pauses smoothly ease them back to the slower idle pace. Speaker changes
crossfade instead of flashing. Chunk bursts are
coalesced, movement is rate-limited, and the strip updates at most 20 times per
second outside the audio/peer tasks. Quiet passages retain a gentle drift.

Amber indicates connecting, red indicates microphone mute, and Stop fades the
lights off. Explicit `set_lights` effects take priority and blend back after
expiry. The light animation continues during the camera preview. Sensor events
do not automatically start recording.

| Tool | Inputs and behavior |
| --- | --- |
| `capture_photo` | Fresh 320 × 240 JPEG; camera runs only for capture; quality is reduced if needed to fit the SDK's 10 KiB image limit |
| `read_device_sensors` | Acceleration in g, angular velocity in degrees/second, two magnetic vectors, battery readings, button state, PIR motion, and relative light (0–100, not lux); missing sensors are reported unavailable |
| `set_lights` | LED index 0–5 or −1 for all; RGB bytes; duration 100–10,000 ms; brightness limited by the module driver; resets after expiry or Stop |
| `vibrate` | Strength 1–100 and duration 10–500 ms; cancellation stops the motor |
| `send_infrared` | One NEC 38 kHz frame with 8-bit address and command; only for explicitly requested, known codes |

Try “What am I showing you?”, “Read the motion and light sensors,” or
“Turn the lights purple for two seconds and give a short vibration.” The
backend prompt distinguishes a snapshot from continuous video, and PIR motion
from identity or certain occupancy. It treats text in images as untrusted data.

USB diagnostics include `live status`, `live start`, `live stop`, `live mute`,
`live unmute`, `live audio-test`, `live jitter-test`, `live peer-test`,
`live photo-test`, `live memory`, `live crypto-test`, `live lights`,
`live lights-demo`, and `live timing`. For a local sensor check:

```text
live tool read_device_sensors {}
```

`live lights-demo` runs an 18-second, silent demonstration with synthetic user
and assistant chunks; it starts no voice session and cancels if one starts.
`live lights` reports observed transcript updates, strip writes/errors and
maximum write time without logging transcript text.

The six RGB LEDs can also be exercised while idle, without a voice session:

```text
live tool set_lights {"index":-1,"red":255,"green":0,"blue":0,"duration_ms":2000}
```

Use indexes 0–5 for individual LEDs, or −1 for all six. Repeat with green and
blue to check every color channel. Idle effects expire after their duration;
effects requested during a session also end when that session stops. The BSP
limits overall brightness to 32/255.

Camera and hardware tools execute away from the audio/controller tasks. Camera
pixels and temporary JPEG buffers use PSRAM; I²S uses internal DMA memory.
Preparation applies a hash-checked BSP display change: two queued SPI
transfers instead of ten. This bounds internal DMA bounce buffers to about
16 KiB with the pinned driver, leaving room for Wi-Fi and hardware AES while
retaining tear-free full-screen rendering. Reducing the LVGL strip height
alone does not help: the BSP’s TE mode selects full-screen rendering.
The app retains the shared 120 ms playback reserve and 32-datagram UDP receive
mailbox. It does not implement wake-word activation, echo cancellation,
continuous video, infrared learning, or a NAND media library.

## Dependencies and verification

Board sources and the USB console are pinned and hash-checked by
[`prepare_mosaico.py`](../../tools/prepare_mosaico.py). Registry versions and
hashes are recorded in [`dependencies.lock`](dependencies.lock); see the
[third-party inventory](../../THIRD_PARTY_NOTICES.md#esp-mosaico-integration).
The [application manifest](main/idf_component.yml) also pins the transitive
font, image, and USB libraries that can otherwise be upgraded when Kconfig
discovery triggers a second dependency-resolution pass. CI checks the resolved
lock against the committed versions, hashes, sources, and dependency graph.

This example uses upstream Mbed TLS 4.1.2 with the ESP-IDF PSA/hardware
compatibility patch and the X.509 empty-name fix, in an isolated component.
See [crypto provenance](../../packages/peer/docs/provenance.md). S3 examples keep
Mbed TLS 3.6.8. Both paths retain fingerprint
verification, signed DTLS handshakes, SRTP authentication, and replay checks.
The SDK selects peer-certificate retention, which IDF 6 disables by default;
a compile-time guard prevents building without the certificate needed for
fingerprint verification.
Host tests exercise image bounds, pixel conversion, strict tool arguments,
and the same transport/security regressions with both crypto versions.

The idle-only `live crypto-test` command checks native PSA AES-GCM round trips
and tamper rejection for 115 length/alignment combinations in PSRAM, including
empty, partial-block and full TLS-record-sized inputs. It uses synthetic data
and does not activate the microphone or network. `live memory` reports DMA
capacity and failed-allocation details without logging keys or payloads.

### Bring-up status

The example builds with the pinned preview toolchain. A physical V1.2 board
completed three consecutive Live sessions with reconnects, seven camera
captures (including captures during speech), and sensor, LED and haptic tools.
The native AES-GCM diagnostic passed all 115 length/alignment/tamper cases
twice on hardware, with stable DMA memory on the second pass.

Combined camera/audio testing exposed a display DMA-memory exhaustion bug:
the BSP queued too many internal bounce buffers for a full-screen redraw,
starving Wi-Fi and hardware AES. The preparation-time queue limit fixes that
reproduction without changing cryptography or tear-free rendering. The three
repeat sessions had no allocation failures, panics or unexpected disconnects;
sampled DMA free memory stayed at or above 72,015 bytes. After Stop, all three
returned to 19 tasks and 176,871–178,055 bytes of free internal memory. These
short runs do not establish long-term leak freedom or loss-free audio.

A listener confirmed smooth baseline speaker audio. The final hands-on spoken
camera-question check remains unverified; automated camera tests used text
requests with the microphone muted. Camera registration is retried on demand
if startup discovery fails, but that recovery path has not been deliberately
fault-injected on hardware. Infrared transmission has not been checked against
a physical receiver.
