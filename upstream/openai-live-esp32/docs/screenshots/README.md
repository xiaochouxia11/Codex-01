# Device screenshots

These PNGs are direct framebuffer captures from Live Voice running on a physical
Waveshare ESP32-S3-Touch-AMOLED-1.8 V2. They show the full
368 × 448 display with the Dot rail layout, 36-pixel Roboto captions, and an
enlarged 260 × 112-pixel opening Start button. The current app hides the launcher
status bar and bottom white indicator while retaining navigation gestures.
They are not camera photographs and do not
measure physical display brightness.

- `ready.png`: ready to start a session, captured October 26, 2026.
- `conversation.png`: synthetic user and assistant captions from the local
  `live captions-test` workload, captured October 26, 2026. This demonstrates
  the larger text, wrapping, colors, and turn markers. No Live session was active,
  so the button shows Start; the sample text was not sent to the API.
- `usage.png`: model names, voice duration, and delegated backend token usage
  after a completed, microphone-muted session, captured October 15, 2026.
  No backend response was requested,
  so the token counts are zero. This older capture still shows the bottom white
  indicator, which is hidden in the current firmware; the usage layout is unchanged.

The captures were taken during device tests using the USB screen mirror.
Displayed usage is illustrative and is not a pricing estimate. The mirror's
RGB565 frames were decoded with [`decode_screen.py`](../../tools/decode_screen.py). The decoder
expands RGB565 to RGB888 without changing the layout or text and writes no log
text or PNG metadata. No UI elements were composited or retouched.

See the [USB capture instructions](../../examples/waveshare/README.md#usb-diagnostics-and-screenshots)
to capture your own device. Review the pixels for private conversation content
before sharing; keep the original USB logs local.
