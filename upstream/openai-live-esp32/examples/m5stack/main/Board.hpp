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
esp_err_t capture_photo(void *, uint8_t *, size_t, size_t *);
void view_init(const char *title = "Live Voice");
void view_update();
esp_err_t view_brightness(int percent);
esp_err_t view_display_profile(bool vivid);
esp_err_t view_display_test();
/* Transfer ownership of one 320x240 native-endian RGB565 PSRAM image to the
 * GUI. It replaces any pending preview and is freed after two seconds. */
void view_photo(uint8_t *rgb565);
// Optional silent movie surface. The caller retains two RGB565 buffers until
// the next successful publication, and clears the surface before freeing them.
bool view_movie_frame(const uint8_t *rgb565, unsigned slot = 0,
                      uint32_t *receipt = nullptr);
// Check a specific frame's GUI render receipt, rather than a queued image.
bool view_movie_presented(uint32_t receipt, int64_t &at_us);
bool view_movie_visible();
void view_movie_stats(uint32_t &rendered, int64_t &max_gap_us);
void view_movie_diagnostics();
} // namespace board
