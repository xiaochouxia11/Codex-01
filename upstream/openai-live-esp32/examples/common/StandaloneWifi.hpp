#pragma once

// Shared Wi-Fi ownership for standalone ESP-IDF examples. Launcher-based apps
// can continue using their own network manager and notify live_esp32 directly.
namespace board {
void wifi_init();
bool wifi_ready();
void wifi_next();
void wifi_status();
} // namespace board
