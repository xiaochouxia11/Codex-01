#include "ScreenMirror.hpp"
#include "ScreenMirrorWire.hpp"
#include "esp_err.h"

#include "bsp/display.h"
#include "bsp/esp-bsp.h"
#include "driver/usb_serial_jtag.h"
#include "driver/usb_serial_jtag_vfs.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_rom_crc.h"
#include "esp_timer.h"
#include "freertos/idf_additions.h"
#include "lvgl.h"
#include <algorithm>
#include <atomic>
#include <fcntl.h>
#include <unistd.h>

namespace live_mirror {
namespace {
constexpr const char *TAG = "mirror";
std::atomic<bool> wanted{false}, force_key{false}, running{false};
std::atomic<uint32_t> heartbeat{0};
std::atomic<uint32_t> copied{0}, sent{0}, bytes{0}, stalled{0}, copy_max_us{0};
std::atomic<uint32_t> unchanged{0};
uint8_t *shadow = nullptr, *stripe = nullptr, *compressed = nullptr;
bool dirty[STRIPES]{}; // shadow/dirty/capturing are protected by the LVGL lock.
bool capturing = false;
lv_display_t *display = nullptr;
uint32_t sequence = 0;
size_t burst_bytes = 0;
uint32_t last_yield = 0;

uint32_t now_ms() { return esp_timer_get_time() / 1000; }
bool leased() { return wanted && uint32_t(now_ms() - heartbeat.load()) < 5000; }

void flush(lv_event_t *e) {
  if (!capturing)
    return;
  const int64_t started = esp_timer_get_time();
  auto area = *static_cast<lv_area_t *>(lv_event_get_param(e));
  area.x1 -= lv_display_get_offset_x(display);
  area.x2 -= lv_display_get_offset_x(display);
  area.y1 -= lv_display_get_offset_y(display);
  area.y2 -= lv_display_get_offset_y(display);
  const auto *buf = lv_display_get_buf_active(display);
  const unsigned w = lv_area_get_width(&area), h = lv_area_get_height(&area);
  // The pinned Waveshare port uses LVGL 9 partial RGB565 buffers. Read before
  // its flush callback swaps bytes for the panel. No allocation, USB, or
  // render.
  if (!buf || buf->header.cf != LV_COLOR_FORMAT_RGB565 || area.x1 < 0 ||
      area.y1 < 0 || area.x2 >= int(WIDTH) || area.y2 >= int(HEIGHT) ||
      buf->header.w != w || buf->header.h != h)
    return;
  for (unsigned row = 0; row < h; ++row) {
    auto *dest = shadow + ((area.y1 + row) * WIDTH + area.x1) * 2;
    const auto *source = buf->data + row * buf->header.stride;
    if (!memcmp(dest, source, w * 2)) {
      ++unchanged;
      continue;
    }
    memcpy(dest, source, w * 2);
    dirty[(area.y1 + row) / ROWS] = true;
  }
  ++copied;
  const uint32_t elapsed = esp_timer_get_time() - started;
  copy_max_us = std::max(copy_max_us.load(), elapsed);
}

bool begin() {
  shadow = static_cast<uint8_t *>(
      heap_caps_calloc(WIDTH * HEIGHT, 2, MALLOC_CAP_SPIRAM));
  stripe =
      static_cast<uint8_t *>(heap_caps_malloc(STRIPE_BYTES, MALLOC_CAP_SPIRAM));
  compressed =
      static_cast<uint8_t *>(heap_caps_malloc(STRIPE_BYTES, MALLOC_CAP_SPIRAM));
  if (!shadow || !stripe || !compressed)
    return false;
  if (!bsp_display_lock(50))
    return false;
  display = lv_display_get_default();
  const bool supported =
      display && lv_display_get_horizontal_resolution(display) == WIDTH &&
      lv_display_get_vertical_resolution(display) == HEIGHT &&
      lv_display_get_color_format(display) == LV_COLOR_FORMAT_RGB565;
  if (supported) {
    memset(dirty, 0, sizeof(dirty));
    force_key =
        true; // Include initially black rows, even if they never change.
    const uint32_t index = lv_display_get_event_count(display);
    lv_display_add_event_cb(display, flush, LV_EVENT_FLUSH_START, nullptr);
    capturing = lv_display_get_event_count(display) == index + 1;
    if (capturing)
      lv_obj_invalidate(lv_display_get_screen_active(display));
  }
  bsp_display_unlock();
  running = capturing;
  return capturing;
}

void end() {
  // Keep memory alive until the hook is detached; never free after a lock
  // timeout.
  while (!bsp_display_lock(50))
    vTaskDelay(1);
  if (capturing)
    lv_display_remove_event_cb_with_user_data(display, flush, nullptr);
  capturing = false;
  bsp_display_unlock();
  heap_caps_free(shadow);
  heap_caps_free(stripe);
  heap_caps_free(compressed);
  shadow = stripe = compressed = nullptr;
  running = false;
}

bool send_stripe(unsigned index) {
  const size_t packed = rle(stripe, STRIPE_BYTES, compressed, STRIPE_BYTES);
  const auto *data = packed ? compressed : stripe;
  const size_t size = packed ? packed : STRIPE_BYTES;
  const uint32_t id = ++sequence;
  uint8_t packet[HEADER_BYTES + CHUNK_BYTES + 4];
  uint8_t encoded[sizeof(packet) + sizeof(packet) / 254 + 4];
  for (size_t offset = 0; offset < size;) {
    if (!leased())
      return false;
    const size_t count = std::min(CHUNK_BYTES, size - offset);
    memcpy(packet, "LVM1", 4);
    put32(packet + 4, id);
    put16(packet + 8, WIDTH);
    put16(packet + 10, HEIGHT);
    put16(packet + 12, index * ROWS);
    put16(packet + 14, ROWS);
    put16(packet + 16, packed ? 1 : 0);
    put16(packet + 18, size);
    put16(packet + 20, offset);
    put16(packet + 22, count);
    memcpy(packet + HEADER_BYTES, data + offset, count);
    put32(packet + HEADER_BYTES + count,
          esp_rom_crc32_le(0, packet, HEADER_BYTES + count));
    encoded[0] = 0;
    const size_t length =
        cobs(packet, HEADER_BYTES + count + 4, encoded + 1) + 2;
    encoded[length - 1] = 0;
    // The pinned driver enqueues all bytes or none. Retry the same packet under
    // backpressure, outside the GUI lock, with a bounded wait and no extra
    // queue. Audio tasks preempt this priority-1 worker throughout
    // encoding/transmit.
    const uint32_t started = now_ms();
    while (usb_serial_jtag_write_bytes(encoded, length, 0) != int(length)) {
      if (!leased() || uint32_t(now_ms() - started) >= 20) {
        ++stalled;
        return false;
      }
      vTaskDelay(1);
    }
    burst_bytes += length;
    if (burst_bytes >= 3 * CHUNK_BYTES ||
        uint32_t(now_ms() - last_yield) >= 5) {
      vTaskDelay(1);
      burst_bytes = 0;
      last_yield = now_ms();
    }
    bytes += length;
    offset += count;
  }
  ++sent;
  return true;
}

void worker(void *) {
  for (;;) {
    if (!leased()) {
      if (running) {
        end();
        ESP_LOGI(TAG, "stopped; capture buffers released");
      }
      vTaskDelay(pdMS_TO_TICKS(100));
      continue;
    }
    if (!running && !begin()) {
      end();
      wanted = false;
      ESP_LOGW(TAG, "unavailable: display format or memory");
      continue;
    }
    const auto pass_started = now_ms();
    if (force_key.exchange(false)) {
      if (bsp_display_lock(10)) {
        memset(dirty, 1, sizeof(dirty));
        bsp_display_unlock();
      } else
        force_key = true;
    }
    for (unsigned i = 0; i < STRIPES && leased(); ++i) {
      bool ready = false;
      // Copy at most 16 rows while holding the display lock, then encode and
      // transmit entirely outside it. Changes arriving during TX stay dirty.
      if (bsp_display_lock(1)) {
        ready = dirty[i];
        if (ready) {
          memcpy(stripe, shadow + i * STRIPE_BYTES, STRIPE_BYTES);
          dirty[i] = false;
        }
        bsp_display_unlock();
      }
      if (ready && !send_stripe(i)) {
        // The next keyframe also repairs any failed stripe if lock is busy.
        if (bsp_display_lock(10)) {
          dirty[i] = true;
          bsp_display_unlock();
        } else
          force_key = true;
        break;
      }
    }
    const uint32_t elapsed = now_ms() - pass_started;
    // Responsive dirty updates, with a mandatory yield even for a slow pass.
    vTaskDelay(std::max(TickType_t(1),
                        pdMS_TO_TICKS(elapsed < 40 ? 40 - elapsed : 1)));
  }
}
} // namespace

bool init() {
  usb_serial_jtag_driver_config_t cfg{};
  cfg.tx_buffer_size = 4096;
  cfg.rx_buffer_size = 256;
  if (!usb_serial_jtag_is_driver_installed() &&
      usb_serial_jtag_driver_install(&cfg) != ESP_OK)
    return false;
  usb_serial_jtag_vfs_use_driver();
  fcntl(STDIN_FILENO, F_SETFL, O_NONBLOCK);
  return xTaskCreatePinnedToCoreWithCaps(
             worker, "screen_mirror", 8192, nullptr, 1, nullptr, 1,
             MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT) == pdPASS;
}
void enable(bool on) {
  heartbeat = now_ms();
  wanted = on;
}
void keyframe() { force_key = true; }
void status() {
  ESP_LOGI(TAG,
           "active=%d flushes=%lu stripes=%lu bytes=%lu stalls=%lu "
           "copy_max_us=%lu unchanged_rows=%lu",
           int(running.load()), (unsigned long)copied.load(),
           (unsigned long)sent.load(), (unsigned long)bytes.load(),
           (unsigned long)stalled.load(), (unsigned long)copy_max_us.load(),
           (unsigned long)unchanged.load());
}
} // namespace live_mirror
