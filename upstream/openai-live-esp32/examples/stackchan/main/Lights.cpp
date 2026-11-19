// SPDX-License-Identifier: Apache-2.0
// PY32 register protocol adapted from M5Stack StackChan-BSP (MIT).
// See third_party/stackchan/ for notices and source provenance.
#include "Lights.hpp"
#include "LightsPolicy.hpp"
#include "esp_log.h"
#include "esp_timer.h"
#include "live_esp32.h"
#include <cstring>

namespace stackchan {
namespace {
constexpr char TAG[] = "StackLights";
i2c_master_dev_handle_t device = nullptr;
lights::Animation flow;
lights::Packet written{};
lights::Mode current_mode = lights::Mode::off;
bool ready = false, enabled = true, valid = false;
uint32_t revision = 0, users = 0, assistants = 0, writes = 0, errors = 0;
uint32_t write_max_us = 0;
unsigned consecutive_errors = 0, demo_step = 0;
int64_t demo_start = -1, demo_next = 0;
esp_err_t read(uint8_t reg, uint8_t *data, size_t n) {
  return i2c_master_transmit_receive(device, &reg, 1, data, n, 10);
}
esp_err_t write(uint8_t reg, uint8_t value) {
  const uint8_t bytes[]{reg, value};
  return i2c_master_transmit(device, bytes, sizeof(bytes), 10);
}
esp_err_t pin13(uint8_t reg, bool set) {
  uint8_t value = 0;
  auto err = read(reg, &value, 1);
  return err == ESP_OK ? write(reg, set ? value | 0x20 : value & ~0x20) : err;
}
esp_err_t publish(const lights::Packet &packet) {
  const auto began = esp_timer_get_time();
  auto err = i2c_master_transmit(device, packet.data(), packet.size(), 10);
  if (err == ESP_OK)
    err = write(lights::CONFIG, lights::REFRESH);
  write_max_us = std::max(write_max_us, uint32_t(esp_timer_get_time() - began));
  if (err == ESP_OK) {
    written = packet;
    valid = true;
    consecutive_errors = 0;
    ++writes;
  } else {
    valid = false; // Retry the whole frame after any partial RAM/latch failure.
    ++errors;
    if (++consecutive_errors >= 3) {
      ready = false;
      ESP_LOGW(TAG,
               "LED communication failed; animation disabled until reboot");
    }
  }
  return err;
}
bool readback() {
  if (!ready || !valid)
    return false;
  lights::Packet actual{};
  actual[0] = lights::RAM;
  return read(lights::RAM, actual.data() + 1, actual.size() - 1) == ESP_OK &&
         actual == written;
}
} // namespace

void lights_init(i2c_master_dev_handle_t base) {
  device = base;
  // Only pin 13's high-bank bits change. Pin 0 drives the motors, separately.
  if (!device || pin13(0x04, true) != ESP_OK || pin13(0x0c, false) != ESP_OK ||
      pin13(0x0a, true) != ESP_OK || pin13(0x14, false) != ESP_OK ||
      write(lights::CONFIG, lights::COUNT) != ESP_OK)
    return;
  uint8_t config = 0;
  if (read(lights::CONFIG, &config, 1) != ESP_OK ||
      (config & 0x3f) != lights::COUNT)
    return;
  ready = publish(lights::encode(lights::Frame{})) == ESP_OK;
  ESP_LOGI(TAG, "ready=%d LEDs=12 brightness=%u/255 RAM_readback=%d", ready,
           lights::BRIGHTNESS, readback());
}

void lights_poll(bool wandering) {
  if (!ready)
    return;
  live_esp32_status_t state{};
  live_esp32_status(&state);
  const auto now = esp_timer_get_time();
  if (demo_start >= 0 && (state.busy || now - demo_start >= 18000000)) {
    demo_start = -1;
    flow.clear_activity();
    ESP_LOGI(TAG, "Silent LED demo ended");
  }
  if (demo_start >= 0) {
    const auto age = now - demo_start;
    if (age < 14000000 && now >= demo_next) {
      flow.chunk((age >= 4000000 && age < 8000000) || age >= 11000000, now);
      demo_next = now + 150000 + (demo_step++ % 4) * 100000;
    }
  } else if (enabled && state.active && !state.muted) {
    if (state.transcript_has_text && state.transcript_revision != revision) {
      const bool assistant = state.transcript_speaker == LIVE_SPEAKER_ASSISTANT;
      flow.chunk(assistant, now);
      ++(assistant ? assistants : users);
    }
  } else {
    flow.clear_activity();
  }
  revision = state.transcript_revision;
  const auto mode = lights::select_mode(enabled, demo_start >= 0, state.active,
                                        state.muted, state.busy, wandering);
  current_mode = mode;
  lights::Frame frame;
  if (!flow.step(now, mode, frame))
    return;
  const auto packet = lights::encode(frame);
  if (!valid || packet != written)
    publish(packet);
}

bool lights_command(const char *line) {
  if (!strcmp(line, "live lights-demo")) {
    live_esp32_status_t state{};
    live_esp32_status(&state);
    if (!ready || state.busy) {
      ESP_LOGW(TAG, "Demo requires detected LEDs and an idle voice session");
      return true;
    }
    enabled = true;
    demo_start = demo_next = esp_timer_get_time();
    demo_step = 0;
    flow.clear_activity();
    ESP_LOGI(TAG, "Silent LED demo: user cyan, assistant gold, 18 seconds");
  } else if (!strcmp(line, "live lights off")) {
    enabled = false;
    demo_start = -1;
  } else if (!strcmp(line, "live lights on")) {
    enabled = true;
  } else if (strcmp(line, "live lights")) {
    return false;
  }
  ESP_LOGI(TAG,
           "ready=%d enabled=%d demo=%d user_chunks=%lu assistant_chunks=%lu "
           "writes=%lu errors=%lu write_max_us=%lu RAM_readback=%d mode=%s",
           ready, enabled, demo_start >= 0, (unsigned long)users,
           (unsigned long)assistants, (unsigned long)writes,
           (unsigned long)errors, (unsigned long)write_max_us, readback(),
           lights::mode_name(current_mode));
  return true;
}
} // namespace stackchan
