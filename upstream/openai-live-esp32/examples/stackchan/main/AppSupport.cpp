// SPDX-License-Identifier: Apache-2.0
#include "AppSupport.hpp"
#include "AppPolicy.hpp"
#include "Board.hpp"
#include "driver/usb_serial_jtag.h"
#include "driver/usb_serial_jtag_vfs.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <atomic>

namespace stackchan {
namespace {
constexpr char TAG[] = "StackChanApp";
std::atomic<bool> quiet_test{false};
} // namespace
bool diagnostic_command(const char *line) {
  if (!strcmp(line, "live quiet on"))
    quiet_test = true;
  else if (!strcmp(line, "live quiet off"))
    quiet_test = false;
  else
    return false;
  ESP_LOGI(TAG, "Quiet audio test %s", quiet_test.load() ? "on" : "off");
  return true;
}
esp_err_t read_audio(void *ctx, int16_t *data, size_t samples) {
  return read_pcm(
      [] { return quiet_test.load(); }, data, samples,
      [ctx](int16_t *pcm, size_t n) { return board::audio_read(ctx, pcm, n); });
}
esp_err_t write_audio(void *ctx, const int16_t *data, size_t samples) {
  return write_pcm(quiet_test.load(), data, samples,
                   [ctx](const int16_t *pcm, size_t n) {
                     return board::audio_write(ctx, pcm, n);
                   });
}
esp_err_t capture_photo(void *ctx, uint8_t *jpeg, size_t capacity,
                        size_t *length) {
  return retry_capture(
      ESP_ERR_TIMEOUT,
      [&] { return board::capture_photo(ctx, jpeg, capacity, length); },
      [] {
        ESP_LOGW(TAG, "Retrying camera after a transient capture timeout");
        vTaskDelay(pdMS_TO_TICKS(100));
      });
}
esp_err_t init_console(size_t rx_buffer_size) {
  usb_serial_jtag_driver_config_t usb = USB_SERIAL_JTAG_DRIVER_CONFIG_DEFAULT();
  usb.rx_buffer_size = rx_buffer_size;
  usb.tx_buffer_size = 1024;
  const auto result = usb_serial_jtag_driver_install(&usb);
  if (result == ESP_OK)
    // Buffered writes retain logs across brief host scheduling delays and
    // still fail fast when USB is disconnected.
    usb_serial_jtag_vfs_use_driver();
  return result;
}
} // namespace stackchan
