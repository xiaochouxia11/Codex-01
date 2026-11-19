# Shared example helpers

These small, hardware-independent C++ helpers serve the display and networking
code in the device examples:

- `CaptionText.hpp`: bounded UTF-8 handling and readable font fallback.
- `TranscriptPage.hpp`: incremental, non-scrolling transcript pagination.
- `UsageSummary.hpp`: model, duration, and token formatting.
- `WifiSelection.hpp`: signal-strength selection and retry/DHCP timing policy.

They do not own hardware, threads, credentials, or networking. Board-specific
code supplies font measurements, UI objects, Wi-Fi events, and audio callbacks.
Waveshare and M5Stack use the caption/usage helpers; the screenless Sonatino app
exposes transcripts and usage through USB. The root host tests cover these
helpers under ASan/UBSan.

`StandaloneWifi.hpp` / `.cpp` provide the ESP-IDF network manager shared by
M5Stack and Sonatino: saved-profile selection, reconnects, DHCP grace periods,
SNTP, and SDK network-state notifications. This implementation owns a worker
and ESP-IDF Wi-Fi events; it is compiled by each standalone app with its private
credential header. Waveshare continues using its launcher-specific manager.

All four voice examples set `CONFIG_LWIP_UDP_RECVMBOX_SIZE=32` in their
`sdkconfig.defaults` to absorb UDP arrival bursts before the shared WebRTC
receiver drains the socket. ESP-IDF defaults do not override an existing
generated `sdkconfig`; update this setting there or through `menuconfig` when
upgrading an existing build. The Waveshare launcher preparation script
regenerates its cached configuration from the defaults.

The [shared Roboto fonts](fonts/README.md) provide the Waveshare and M5Stack UI
text. Generated bitmap C files are compiled only into the display examples; the
portable SDK and screenless Sonatino example do not depend on LVGL or fonts.
