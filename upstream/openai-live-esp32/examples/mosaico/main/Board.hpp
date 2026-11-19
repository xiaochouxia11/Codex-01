#pragma once
#include "StandaloneWifi.hpp"
#include "live_esp32.h"

namespace board {
void audio_init();
esp_err_t audio_open(void *);
void audio_close(void *);
esp_err_t audio_read(void *, int16_t *, size_t);
esp_err_t audio_write(void *, const int16_t *, size_t);
uint32_t audio_starvations(void *);
void hardware_init();
void hardware_poll();
esp_err_t light_demo(); // Quiet, idle-only demonstration of transcript flow.
void light_status();
void toggle_session();
const char *tools_json();
esp_err_t execute_tool(void *, const char *, const char *, char *, size_t,
                       bool (*)(void *), void *);
void camera_init();
esp_err_t capture_photo(void *, uint8_t *, size_t, size_t *);
void view_init();
void view_update();
void view_photo(uint16_t *pixels); // Transfers ownership of 320x240 RGB565.
} // namespace board
