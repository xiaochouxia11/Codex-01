# Public references

## OpenAI Live API

- [Getting started](https://developers.openai.com/api/docs/guides/live)
- [WebRTC connections](https://developers.openai.com/api/docs/guides/voice-webrtc?api=live)
- [Create a Live session](https://developers.openai.com/api/reference/resources/live/methods/create)
- [Session events, captions, and graceful close](https://developers.openai.com/api/docs/guides/live-conversations)
- [Delegation and tools](https://developers.openai.com/api/docs/guides/live-delegation)
- [Usage accounting](https://developers.openai.com/api/docs/guides/voice-latency-cost#monitor-actual-usage)
- [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)
- [Fast mode](https://developers.openai.com/api/docs/guides/fast-mode)

## Hardware and dependencies

- [Waveshare device source and launcher](https://github.com/waveshareteam/ESP32-S3-Touch-AMOLED-1.8)
- [Waveshare ESP32 components](https://github.com/waveshareteam/Waveshare-ESP32-components)
- [ESP-IDF 5.5.6](https://docs.espressif.com/projects/esp-idf/en/v5.5.6/esp32s3/get-started/index.html)
- [Espressif WebRTC solution](https://github.com/espressif/esp-webrtc-solution)
- [Espressif OpenAI Realtime demo](https://github.com/espressif/esp-webrtc-solution/tree/main/solutions/openai_demo)
- [Peer 1.5.6 ICE nomination issue](https://github.com/espressif/esp-webrtc-solution/issues/208)
- [Espressif QEMU](https://github.com/espressif/qemu)
- [Espressif emulator](https://github.com/espressif/esp-emulator)

The Espressif Realtime demo is a useful embedded-media reference, but the Live
SDK uses a different signaling and event contract. Dependency revisions and
licenses are listed in [third-party notices](THIRD_PARTY_NOTICES.md).
