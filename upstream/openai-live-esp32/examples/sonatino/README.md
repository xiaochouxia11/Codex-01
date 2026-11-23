# Sonatino Live Voice

> **Experimental project. Not officially supported by OpenAI.**

A screenless ESP-IDF example for the **Sonatino revision 3.1.x** audio board,
with ESP32-S3, 16 MB flash, 8 MB octal PSRAM, a WM8782 ADC, WM8524 DAC, and
TPA6132A2 headphone amplifier. It uses the same protocol, source-built WebRTC,
Opus, TLS preconnection, playback reserve, and usage accounting as the M5Stack
and Waveshare examples. No display, launcher, Arduino runtime, or board BSP is
required. M5Stack and Sonatino also share the standalone Wi-Fi manager.

## Connect the hardware

- Connect the external antenna to the module's U.FL socket before using Wi-Fi.
- Plug a **CTIA 3.5 mm TRRS headset with a microphone** into the audio jack.
  Ordinary headphones work for playback but provide no microphone input.
- Set both level-selection DIP switches **ON**: microphone input and headphone
  output. Start with the microphone gain trimmer at its factory position.
- Power and program the board through USB-C. Check the revision printed on the
  board: revision 2 uses different amplifier pins and is not supported here.

See the manufacturer's [pinout and setup instructions](https://sonatino.com/docs/).
The BOOT button shares GPIO0 with the audio master clock. **Press and release
BOOT to start only while idle**, after Wi-Fi connects. **Use RESET to end a
session by rebooting**, or USB `live stop` to close gracefully. Do not press
BOOT during audio: it grounds the active clock output. Do not hold BOOT while
resetting or powering on unless you intend to enter the firmware downloader.

## Build and flash

Install and activate **ESP-IDF 5.5.6** with ESP32-S3 tools. In its Python
environment, use the component manager tested in CI:

```sh
python -m pip install 'idf-component-manager==2.5.2'
```

Keep credentials outside the checkout: an `api-key` text file and `wifi.json`
containing `{"networks":[{"ssid":"YOUR_SSID","password":"YOUR_PASSWORD"}]}`.
One to eight profiles are supported. From the repository root:

```sh
python tools/prepare_sonatino.py \
  --key-file "$HOME/.config/openai-live-esp32/api-key" \
  --wifi-file "$HOME/.config/openai-live-esp32/wifi.json"
export LIVE_VOICE_PRIVATE_DIR="$HOME/.cache/openai-live-sonatino/private"
export LIVE_PEER_DEPS_DIR="$HOME/.cache/openai-live-sonatino/vendor/peer"
idf.py -C examples/sonatino build
```

The preparation tool keeps the credential header and hash-verified peer sources
outside this repository. Set `LIVE_MODEL` and `LIVE_RESPONSES_MODEL` before
preparation to override `gpt-live-1.1` and `gpt-6-luna`. The example requests
priority Responses delegation with hosted web search. Availability depends on
your API account.

Identify the Sonatino's USB serial port. Save its factory firmware privately
before replacing the app and partition layout:

```sh
umask 077
python -m esptool --port YOUR_PORT read_flash 0 0x1000000 \
  "$LIVE_VOICE_PRIVATE_DIR/factory-backup.bin"
idf.py -C examples/sonatino -p YOUR_PORT flash monitor
```

If automatic download-mode entry fails, hold BOOT, press and release RESET,
then release BOOT and retry. If the console remains at `waiting for download`
after flashing, briefly press RESET. A full backup can be restored to the same
board with `esptool write_flash 0 factory-backup.bin`.

**Never publish credential files, build directories, flash backups, or firmware
images containing secrets.** The default build embeds the API key and Wi-Fi
profiles. See [credential handling](../../SECURITY.md).

## Use without a screen

The app connects to the strongest available saved network, then accepts a
BOOT press-and-release or USB `live start`. It does not automatically open the
microphone on boot. Hold BOOT for at least a brief tap (about 100 ms), then
release; starting happens after release. Presses while busy or offline are
discarded. RESET ends the call immediately and returns to idle after reboot;
it cannot deliver a graceful session-close usage event.

For graceful close and diagnostics, use a serial terminal or the foreground
console helper:

```sh
python tools/device_console.py --port YOUR_PORT \
  --log "$LIVE_VOICE_PRIVATE_DIR/console.log" \
  --commands "$LIVE_VOICE_PRIVATE_DIR/commands.txt" --seconds 3600
```

From another terminal, append a command, for example:

```sh
printf 'live start\n' >> "$LIVE_VOICE_PRIVATE_DIR/commands.txt"
```

| Command | Action |
| --- | --- |
| `live start`, `live stop` | Start a voice session or request graceful close |
| `live mute`, `live unmute` | Control microphone transmission |
| `live volume 20` | Set output amplitude to 0–100%; default 20% |
| `live status` | Session, packet, microphone, playout, and Wi-Fi counters |
| `live transcripts` | Print the current bounded transcript snapshot |
| `live timing`, `live diagnostics` | Startup timing, task, heap, and transport data |
| `live audio-test` | Three-second local Opus/audio test including a quiet 500 Hz tone |
| `live jitter-test` | Local playback test with deterministic packet jitter |
| `live peer-test` | Five local transport create/destroy cycles |
| `live wifi-next` | Try another saved network after the call ends |

Headphone hardware gain starts at −6 dB, with digital amplitude at 20%. Raise
it gradually if needed. USB logs include transcript deltas and session-end
usage; `live transcripts` prints a complete snapshot of the retained captions.
Logs can contain your speech and session identifiers; keep them private.

## Audio integration

The SDK receives signed 16-bit mono PCM at 24 kHz. Two I²S controllers handle
the separate receive and transmit clocks. Both use 32-bit stereo slots with
16-bit data; the transmit hardware zero-pads the remaining bits for the DAC.
GPIO0 supplies their shared 256fs master clock. The left ADC input supplies
microphone PCM; headphone output duplicates the attenuated mono signal into
both channels.

| Function | GPIO |
| --- | --- |
| Shared master clock | 0 |
| DAC mute; BCLK; WS; data | 14; 15; 16; 17 |
| ADC sample-rate range; word length | 18; 21 |
| ADC BCLK; WS; data | 38; 39; 40 |
| Headphone gain1; gain0; amplifier enable | 46; 47; 48 |

Six 20 ms output DMA descriptors retain the SDK's 120 ms playback reserve.
I²S objects live for the firmware lifetime; reconnects enable/disable them.
GPIO0 remains an input with a pull-up while idle. The audio driver checks that
BOOT stays released for 40 ms before routing the master clock to it; after
close or a failed open, it explicitly disconnects that output and restores the
input. Merely disabling I²S transfers does not stop the master's clock. Button
sampling and clock handoff share a mutex. `live diagnostics` reports the pin's
role and hardware input/output-enable state.
Playback buffers are cleared before each open, transfers have bounded timeouts,
and short transfers fail explicitly. There is no acoustic echo cancellation;
use the headset for simultaneous listening and speaking. SD storage, the RGB
LED, battery monitoring, wake words, and OTA updates are not initialized.

Dependency versions and component hashes are recorded in
[`dependencies.lock`](dependencies.lock). The audio driver is original code
based on the published board pinout and chip datasheets; it does not vendor the
manufacturer's Arduino sketches. See [third-party notices](../../THIRD_PARTY_NOTICES.md).

## Hardware validation

Tested on a Sonatino 3.1.x with a CTIA headset and external antenna:

- Five Live sessions connected and closed gracefully, including a conversation
  where the listener confirmed clear replies and three short reconnect checks.
  Start-to-session-ready times ranged from 1.17 to 2.75 seconds with TLS
  preconnection; the three reconnects took 1.21–1.28 seconds.
- The local six-second jitter test delivered all 300 frames / 144,000 samples
  with zero queue drops, DMA underruns, or rebuffers while holding packets for
  80 ms once per second. This tests local Opus/playback independently of Wi-Fi
  and server timing.
- GPIO0 hardware diagnostics confirmed input enabled and output disabled at
  idle, clock output during playback, and input restored after close. The same
  jitter test passed after adding the button/clock handoff. Host button tests
  cover contact bounce, held buttons, busy/offline cancellation, and timer wrap.
- A physical BOOT press-and-release started a headset conversation, confirmed
  by the listener. RESET returned the app to idle; a second BOOT release started
  another Live session in 1.27 seconds. No button press during active audio is
  required or supported.
- Five consecutive local peer create/destroy cycles returned exactly the same
  free heap and task count. Each Live close returned to 12 tasks.
- Both Sonatino and M5Stack firmware builds passed, along with the shared host
  regression suite and Sonatino PCM/volume checks under ASan/UBSan.

These are short hardware smoke tests, not a long-running soak. Live reception
included gaps up to 325 ms and occasional rebuffers even without packet loss;
the local test does not prove smooth playback through every network or server
stall. No CPU control-loop overruns or audio queue drops were observed during
these calls.
