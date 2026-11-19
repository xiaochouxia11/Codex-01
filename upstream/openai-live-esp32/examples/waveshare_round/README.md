# Round Waveshare Live Voice

> **Experimental project. Not officially supported by OpenAI.**

This standalone example targets the **Waveshare ESP32-S3-Touch-AMOLED-1.75**:
240 MHz dual-core ESP32-S3, 16 MB flash, 8 MB octal PSRAM, a round 466 × 466
CO5300 AMOLED with CST9217 touch, ES7210 microphones, and an ES8311 speaker codec.
The bare board needs a separate speaker connected to its **SPK** MX1.25 two-pin
socket; do not confuse it with the battery connector. Enclosure kits may include
a fitted speaker. Disconnect USB before attaching the speaker.

It is a different board from the rectangular 1.8 V2 in
[`examples/waveshare`](../waveshare). Their firmware images are not interchangeable.

It uses the same `live`, `live_esp32`, and `live_peer` SDK components as the other
examples: HTTPS preconnection, WebRTC, Opus, the 120 ms playback reserve, colored
captions, and usage accounting. Wi-Fi selection, text simplification, pagination,
Roboto fonts, and usage formatting come from `examples/common`. Only board
initialization, audio wiring, and the round layout live here. The app replaces
the vendor launcher; Brookesia, Xiaozhi apps, and downloaded media are not needed.

The initial Start button is 260 × 100 pixels. During a session it becomes a
compact Stop button, with a visible color change when connected and 16 pixels
of extra touch padding. Cyan user captions and sand assistant captions use
28-pixel Roboto in a fixed rectangle inside the circle. A full page clears and
continues from the top. After stopping, the screen shows model names, voice
seconds, and backend token usage.

## Build and flash

Activate **ESP-IDF 5.5.2** with ESP32-S3 tools. Use its Python environment and
`idf-component-manager==2.5.2`, as in CI. Keep credentials outside the checkout:

- `api-key`: your API key on one line, with file permissions `600`.
- `wifi.json`: `{"networks":[{"ssid":"YOUR_SSID","password":"YOUR_PASSWORD"}]}`.

One to eight saved Wi-Fi profiles are supported. The app picks the strongest
available saved network, retries alternatives after failures, and avoids scans
while a voice session is running.

From the repository root:

```sh
python tools/prepare_waveshare_round.py \
  --key-file "$HOME/.config/openai-live-esp32/api-key" \
  --wifi-file "$HOME/.config/openai-live-esp32/wifi.json"
export LIVE_VOICE_PRIVATE_DIR="$HOME/.cache/openai-live-waveshare-round/private"
export LIVE_PEER_DEPS_DIR="$HOME/.cache/openai-live-waveshare-round/vendor/peer"
idf.py -C examples/waveshare_round build
```

The preparation script also accepts `OPENAI_API_KEY`. Set `LIVE_MODEL` and
`LIVE_RESPONSES_MODEL` before preparation to override `gpt-live-1` and
`gpt-6-luna`. The example enables priority Responses delegation and web search;
see the [core configuration guide](../../docs/core.md) for customization.

Identify this board's USB serial port and save a private backup if you want to
restore its existing apps. Flashing replaces the app and partition layout:

```sh
umask 077
python -m esptool --port YOUR_PORT read_flash 0 0x1000000 \
  "$HOME/.cache/openai-live-waveshare-round/private/factory-backup.bin"
idf.py -C examples/waveshare_round -p YOUR_PORT flash monitor
```

If automatic reset fails, hold BOOT, briefly press RESET, then release BOOT and
retry. A complete backup can be restored on the same board with
`esptool --port YOUR_PORT write_flash 0 factory-backup.bin`.
Never publish credentials, private logs, generated headers, build directories,
flash backups, or firmware containing secrets.

## Use and diagnostics

With a speaker attached and Wi-Fi connected, tap **Start**, speak into the built-in microphones, and
listen through the speaker. **Stop** gracefully ends the session and displays
usage. The app does not start recording automatically.

| USB command | Action |
| --- | --- |
| `live start`, `live stop` | Start or stop a real Live voice session |
| `live mute`, `live unmute` | Control microphone transmission |
| `live status` | Session, audio, packet, and Wi-Fi counters |
| `live timing` | Startup stage timing |
| `live diagnostics` | Heap, task, and transport diagnostics |
| `live audio-test` | Opus speaker test, measured by the microphones |
| `live jitter-test` | Deterministic local playout test |
| `live burst-test` | Local 480 ms arrival stalls and 25-packet bursts; no API session |
| `live peer-test` | Five local transport create/destroy cycles |
| `live wifi-next` | Try another saved Wi-Fi profile after the call |
| `live screenshot` | Capture the current screen while idle; decode with `tools/decode_screen.py` |

Use [`tools/device_console.py`](../../tools/device_console.py) with ESP-IDF's
Python environment to log and send these commands. The burst test checks that
received audio is retained; its intentional long stalls may still cause pauses.
The SDK has a bounded 64-packet receive queue in PSRAM and this board reserves
32 UDP receive slots. Normal playback priming remains 120 ms. Sustained poor
delivery can increase playback delay or still exceed these bounds.
Continuous screen mirroring
is not enabled on this example.

Both codecs share I²S clocks: MCLK GPIO42, BCLK GPIO9, and WS GPIO45. Speaker
output is GPIO8, microphone input GPIO10, and amplifier enable GPIO46. The ES7210
selects front microphones MIC1/MIC2 in stereo I²S; the app takes MIC1 and copies
mono output to both speaker slots. It does not use the vendor's four-slot AEC
profile or mix the playback-reference channel into microphone input.

Audio is full-duplex 24 kHz, signed 16-bit PCM. Six 20 ms DMA descriptors retain
the SDK's playback reserve. Codec and I²S resources are allocated once and
reopened across sessions. Reads/writes have bounded timeouts and reject partial
transfers. Speaker volume is 100%; acoustic echo cancellation is not implemented.
The display task runs below the audio workers. Two internal 12-line draw buffers
are allocated at boot; display transfers do not need the large temporary DMA
buffers used by the BSP convenience initializer. UI updates run on the LVGL
task, leaving the USB command loop responsive. SD card, IMU, battery management,
wake words, and OTA are outside this example's scope.

## Dependencies and validation

Registry dependencies are version/hash pinned in
[`dependencies.lock`](dependencies.lock). See the
[round-board inventory](../../THIRD_PARTY_NOTICES.md#round-waveshare-integration)
for board, display, codec, and optional adapter dependencies. All device-only
Espressif terms apply to this ESP32 target; they do not change the portable
transport's license.

The round example builds with ESP-IDF 5.5.2 and has been flashed to a physical
board. Display/touch initialization and Wi-Fi have been exercised. The offline
Opus/I²S diagnostic transferred all 72,000 samples over three seconds; this
checks digital transfers, not audible output from the speaker. The local
jitter test submitted 300 packets / 144,000 samples with no queue drops, DMA
starvation events, or rebuffering. Fifteen transport create/destroy
cycles returned to 14 tasks with stable free heap. These short tests do not
establish long-duration leak freedom. A user confirmed a real Live conversation
with both user and assistant captions. After the display buffer fix, three
reconnects completed in 1.4–1.7 seconds each and delivered final usage events.
Each returned to 14 tasks, with 97.5–98.7 KB of free internal heap; no display
transfer failures occurred. The local jitter test also passed with the new
display buffers. A stale idle HTTPS connection was observed closing during a
request; cached connections now expire after 10 seconds, with a host regression
covering that boundary. Requests are never retried after sending the POST body.
With the ordinary touchscreen Start/Stop configuration, a user confirmed the
test tone was audible and a real assistant reply was loud enough
at a normal listening distance. Speaker volume is set to 100%; the diagnostic
tone itself uses a much lower sample amplitude than full scale.

The same change fixes the shared Wi-Fi worker cancelling local diagnostics when
offline and prevents an interrupted audio test from reporting completion.
Existing M5Stack and Sonatino firmware builds pass. Host validation covers 14
ASan/UBSan suites and 32 Python tests; the round-board PCM regression checks
channel isolation, signed extrema, and output bounds. CI builds all three
standalone examples.
