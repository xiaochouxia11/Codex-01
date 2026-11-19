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
void view_init();
esp_err_t view_snapshot();
} // namespace board
