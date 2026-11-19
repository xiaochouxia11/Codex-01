# M5Stack StackChan Live Voice

> **Experimental project. Not officially supported by OpenAI.**

This standalone ESP-IDF example targets the **commercial M5Stack StackChan
K151 / K151-R**, with a CoreS3 head and the factory two-servo base. It adds
voice-directed pan/tilt and camera questions to the shared Live SDK. It is not
a firmware profile for every DIY Stack-chan or alternate servo base.

The head supplies an ESP32-S3 (240 MHz, 16 MB flash, 8 MB quad PSRAM),
320 × 240 touch LCD, ES7210 microphones, AW88298 speaker, and GC0308 camera.
The base's feedback servos use UART1 TX GPIO6 / RX GPIO7 at 1 Mbps. A PY32 I/O
expander at I²C address `0x6f` controls motor power. See the
[official hardware documentation](https://docs.m5stack.com/en/StackChan).

## Build and flash

Use **ESP-IDF 5.5.2** and `idf-component-manager==2.5.2`, as in the
[CoreS3 setup guide](../m5stack/README.md#build-and-flash). Keep your API key and
Wi-Fi profiles outside the repository. `wifi.json` accepts one to eight saved
networks, for example `{"networks":[{"ssid":"YOUR_SSID","password":"YOUR_PASSWORD"}]}`.

From the repository root:

```sh
python tools/prepare_stackchan.py \
  --key-file "$HOME/.config/openai-live-esp32/api-key" \
  --wifi-file "$HOME/.config/openai-live-esp32/wifi.json"
export LIVE_VOICE_PRIVATE_DIR="$HOME/.cache/openai-live-stackchan/private"
export LIVE_PEER_DEPS_DIR="$HOME/.cache/openai-live-stackchan/vendor/peer"
idf.py -C examples/stackchan build
```

`LIVE_MODEL` and `LIVE_RESPONSES_MODEL` before preparation select the frontend
and backend models (defaults `gpt-live-1` and `gpt-6-luna`). The app requests
priority Responses delegation and hosted web search. Prompts and optional tool
callbacks are configured in [`main/main.cpp`](main/main.cpp).

Connect USB to the **base**, place the robot upright with room for its head to
move, and identify its serial port. M5Stack recommends the base port so head
movement does not pull a cable attached to the head. Save the original flash
before replacing the factory application and partition layout:

```sh
umask 077
python -m esptool --chip esp32s3 --port YOUR_PORT \
  read_flash 0 0x1000000 "$LIVE_VOICE_PRIVATE_DIR/factory-backup.bin"
idf.py -C examples/stackchan -p YOUR_PORT flash monitor
```

The partition table keeps the factory NVS region at `0x9000`, size `0x4000`,
including `servo/zero_pos_1` and `servo/zero_pos_2`. **Do not erase flash/NVS**:
that loses calibration and saved factory settings. Initialization never erases
NVS on an error. If calibration keys are absent, the driver uses M5Stack's
nominal raw zeros (yaw 460, pitch 620), checks them, and reports them over USB;
custom assemblies must validate their own alignment before enabling movement.
No boot-time homing movement or automatic recalibration occurs.

A full private backup can restore factory firmware with
`esptool write_flash 0 factory-backup.bin`. Backups and built firmware may
contain credentials; never publish them. Do not flash this example onto an
unrelated board. The RST/download-mode instructions in the CoreS3 guide also
apply here.

## Using the app

Tap **Start** after Wi-Fi connects. Talk normally; cyan user and gold assistant
captions paginate without scrolling. Tap **Stop** to close the session, cancel
an outstanding tool movement, and display usage. A captured photo appears for
two seconds before captions return. The camera is off between snapshots. A
transient cold-start capture timeout is retried once after 100 ms, after the
sensor has been torn down; other errors return immediately.

Try:

- “What am I showing you?”
- “Look a little left, take a photo, and describe what you see.”
- “Look around and tell me what's on the desk.”
- “Bring your head back to the center.”

Only the head moves; this base has no drive wheels. There is no continuous
camera tracking, autonomous roaming, wake-word detection, or acoustic echo
cancellation. NFC, infrared, and the top touch panel are not initialized.

## Transcript lights

The base's 12 RGB LEDs (six on each side) flow with the conversation. User
chunks use cyan/teal and assistant chunks use warm gold, with staggered hues
and breathing across both rows. New chunks accelerate the flow smoothly;
pauses settle back to a slower rhythm. Connecting is soft amber, microphone
mute is muted red, and Stop fades the lights off. Camera previews do not pause
the animation.

The caption app and [cinema app](../stackchan_cinema/README.md) compile the
same [`Lights.cpp`](main/Lights.cpp) driver and allocation-free Mosaico animation,
scaled to 12 LEDs. The caption app uses the conversation/status colors above;
cinema also selects violet while wandering through its video library.
The base controller generates LED signaling; the app sends one bounded RGB565
frame over I²C at most 20 times/second, only when its quantized colors change.
Brightness is capped at 64/255 before RGB565 conversion. No audio callback,
additional animation task, motor-power write, or calibration change is involved.
Repeated I²C failures disable lighting until reboot without stopping voice.

## Tools and motion behavior

| Tool | Arguments | Result |
| --- | --- | --- |
| `capture_photo` | `{}` | Fresh QVGA JPEG sent to the backend, with a local two-second preview |
| `get_head_pose` | `{}` | Measured yaw/pitch, temperatures, and load; no movement |
| `look_at` | Integer `yaw_degrees` −40…40, `pitch_degrees` 10…60 | Absolute pose relative to factory zeros; waits for feedback-confirmed arrival |
| `center_head` | `{}` | Forward yaw 0, gentle pitch 15; waits for arrival |

These angles use M5Stack's calibrated servo coordinates. Pitch is upward tilt;
yaw is relative to forward, positive left and negative right from the robot's perspective. Limits deliberately leave travel margin and avoid
continuous rotation. Smoothstep interpolation limits nominal peak speed to
45 degrees/second. The tool rejects fractional, unknown, duplicate, missing,
out-of-range, or malformed arguments rather than silently changing the request.
It also checks the servo's stored position limits and refuses continuous-
rotation mode or invalid calibration. It never unlocks or writes servo EEPROM,
rotation mode, IDs, or calibration.

Motor traffic uses bounded UART transactions with checked sender, length,
checksum, and servo error status. Feedback is checked during movement and at
arrival. Arrival requires three stationary samples within five degrees of the
request; this is an application tolerance for the loaded head, not an encoder
accuracy claim. Results always report the measured position. Excessive load, temperature, failed communication, or failure to settle
releases torque and disables motor power until reboot. A stopped/superseded
request releases torque, and its result cannot continue a newer session.
Normal completed movement also releases torque, matching the factory BSP's
resting behavior; measured pose can drift afterward, so use `get_head_pose`
when current orientation matters. Do not manually force a powered servo.

Camera and board tools share one low-priority worker. The bounded tool queue
lives in PSRAM and is not allocated on examples without client function tools. Audio capture/playout
and WebRTC polling retain their existing tasks and the 120 ms playback reserve.
Tools are optional additions to `live_esp32_config_t`, so other examples keep
their existing behavior. There are at most eight calls per response, 32 photos
and 64 other tool executions per session; arguments and text results are
bounded to 512 and 1024 bytes. Motion callbacks poll cancellation and finish
within five seconds. The prompts use short sequential moves followed by fresh
photos, never claim continuous sight, and treat image text as untrusted content.

## USB diagnostics

Use [`tools/device_console.py`](../../tools/device_console.py). The normal
[CoreS3 commands](../m5stack/README.md#audio-and-diagnostics) remain available.
The additional commands are:

| Command | Action |
| --- | --- |
| `live quiet on` / `live quiet off` | Enable/disable silent diagnostic audio: zero microphone and speaker PCM while keeping capture, encoding, transport, decoding and I²S writes running |
| `live lights` | Report LED availability, transcript activity, writes/errors, timing and controller RAM readback |
| `live lights-demo` | Idle-only 18-second silent cyan/gold preview; cancels if a voice session starts |
| `live lights off` / `live lights on` | Disable/enable transcript lighting; off fades to black |
| `live head pose` | Read feedback without moving |
| `live head look 10 15` | Small absolute move using the same validation and limits as model tools |
| `live head center` | Move to yaw 0, pitch 15 |
| `live head stop` | Cancel a USB or model-issued movement |

Quiet mode defaults off at boot and is not saved. Use `live quiet off` before
a normal listening test. Zero microphone input can be cheaper to encode than
speech, so a quiet run is not a complete audio-quality or CPU benchmark.
USB replies use a shared 1 KiB transmit buffer and flush after each command.

Diagnostics run off the UI thread, and overlapping motion requests return busy.
`live stop` cancels motion and the Live session. Local `live photo-test` while
idle prints a JPEG over USB; keep those logs private. During calls it logs only
capture timing. No photos are saved to device flash.

## Implementation and verification

The example compiles the existing `examples/m5stack/main` audio, camera, and
view sources directly; it does not maintain a fork of those drivers. Its own
application prompts, servo protocol, motion policy, and diagnostics are in
`main/`. [`AppSupport.cpp`](main/AppSupport.cpp) is compiled by both StackChan
apps for the camera timeout retry, quiet audio diagnostics, and buffered USB
console. Cinema wraps the shared capture callback in its video/SD pause barrier.
The caption app keeps its 120 ms playout reserve; cinema requests 240 ms for its
additional video workload. Shared transport and audio behavior live in
`components/`.

Host regressions cover motion argument validation, calibration/travel bounds,
interpolation speed and endpoint behavior, packet checksums/status/length/IDs,
combined tool declarations, cancellation generations, continuation handling,
LED color/transition behavior, bounded camera retries and silent PCM batch/error
handling.
CI builds StackChan alongside the other standalone boards. Physical-device
validation and any limits are recorded in the implementation PR.

Dependencies match the CoreS3's pinned graph in
[`dependencies.lock`](dependencies.lock). Register/protocol adaptations retain
M5Stack and FTServo MIT notices. See the
[StackChan inventory](../../THIRD_PARTY_NOTICES.md#m5stack-stackchan-integration)
and [source provenance](../../third_party/stackchan/README.md).
