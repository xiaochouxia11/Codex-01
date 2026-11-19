// SPDX-License-Identifier: Apache-2.0
#pragma once
#include "esp_err.h"
#include <cstddef>
#include <cstdint>

namespace stackchan {
// Shared by the caption and cinema apps. Quiet mode defaults off and is
// volatile.
bool diagnostic_command(const char *line);
esp_err_t read_audio(void *ctx, int16_t *data, size_t samples);
esp_err_t write_audio(void *ctx, const int16_t *data, size_t samples);
esp_err_t capture_photo(void *ctx, uint8_t *jpeg, size_t capacity,
                        size_t *length);
// Cinema requests additional RX space for SD uploads; both use buffered TX.
esp_err_t init_console(size_t rx_buffer_size = 256);
} // namespace stackchan
