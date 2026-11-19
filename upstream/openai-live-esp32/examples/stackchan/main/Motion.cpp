// SPDX-License-Identifier: Apache-2.0
// Hardware protocol adapted from M5Stack StackChan-BSP and FTServo (MIT).
// See third_party/stackchan/ for notices and the pinned source reference.
#include "Motion.hpp"
#include "Lights.hpp"
#include "MotionPolicy.hpp"
#include "bsp/m5stack_core_s3.h"
#include "driver/uart.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include "live_esp32.h"
#include "nvs.h"
#include <atomic>
#include <cstdio>
#include <new>

namespace stackchan {
namespace {
constexpr char TAG[] = "StackMotion";
constexpr uart_port_t UART = UART_NUM_1;
i2c_master_dev_handle_t expander = nullptr;
SemaphoreHandle_t bus_lock = nullptr;
bool ready = false;
int yaw_zero = YAW_ZERO, pitch_zero = PITCH_ZERO;
int servo_min[2]{}, servo_max[2]{1000, 1000};
std::atomic<uint32_t> cancel_epoch{0};
std::atomic<bool> diagnostic_busy{false};
struct Feedback {
  int position, load, temperature;
};

esp_err_t reg_read(uint8_t reg, uint8_t &value) {
  return i2c_master_transmit_receive(expander, &reg, 1, &value, 1, 20);
}
esp_err_t bit(uint8_t reg, bool high) {
  uint8_t value;
  auto err = reg_read(reg, value);
  if (err != ESP_OK)
    return err;
  uint8_t bytes[]{reg, uint8_t(high ? value | 1 : value & ~1)};
  return i2c_master_transmit(expander, bytes, sizeof(bytes), 20);
}
bool power(bool on) { return expander && bit(0x05, on) == ESP_OK; }

bool transact(uint8_t id, uint8_t instruction, const uint8_t *params,
              size_t params_size, uint8_t *data, size_t data_size) {
  uint8_t request[16], reply[14];
  size_t n =
      packet(id, instruction, params, params_size, request, sizeof(request));
  if (!n || data_size > 8)
    return false;
  uart_flush_input(UART);
  // The validated servo ACK confirms transmission. Waiting separately for
  // TX_DONE is unnecessary and introduces another scheduler-sensitive wait.
  if (uart_write_bytes(UART, request, n) != int(n)) {
    ESP_LOGW(TAG, "Servo write failed id=%u instruction=%u", id, instruction);
    return false;
  }
  const size_t used = receive(
      reply, sizeof(reply), data_size,
      [](uint8_t &byte) { return uart_read_bytes(UART, &byte, 1, 0) == 1; },
      [] { return esp_timer_get_time(); },
      [] { vTaskDelay(pdMS_TO_TICKS(1)); });
  if (!response(reply, used, id, data_size)) {
    ESP_LOGW(TAG,
             "Servo reply rejected id=%u instruction=%u bytes=%u expected=%u "
             "length=%u status=%u",
             id, instruction, unsigned(used), unsigned(data_size + 6),
             used > 3 ? reply[3] : 0, used > 4 ? reply[4] : 0);
    return false;
  }
  if (data_size)
    memcpy(data, reply + 5, data_size);
  return true;
}
bool read(uint8_t id, uint8_t address, uint8_t *data, size_t size) {
  uint8_t params[]{address, uint8_t(size)};
  return transact(id, 2, params, sizeof(params), data, size);
}
bool torque(uint8_t id, bool enabled) {
  uint8_t params[]{40, uint8_t(enabled)};
  return transact(id, 3, params, sizeof(params), nullptr, 0);
}
bool position(uint8_t id, int raw_position) {
  if (raw_position < 0 || raw_position > 1000)
    return false;
  // Big-endian words: position, time (20 ms), speed (0 = use time).
  uint8_t params[]{
      42, uint8_t(raw_position >> 8), uint8_t(raw_position), 0, 20, 0, 0};
  return transact(id, 3, params, sizeof(params), nullptr, 0);
}
bool feedback(uint8_t id, Feedback &f) {
  uint8_t bytes[8];
  if (!read(id, 56, bytes, sizeof(bytes)))
    return false;
  f.position = (bytes[0] << 8) | bytes[1];
  int load = (bytes[4] << 8) | bytes[5];
  f.load = load & 0x3ff;
  f.temperature = bytes[7];
  bool safe = f.position >= 0 && f.position <= 1000 && f.temperature < 65 &&
              f.load < 800;
  if (!safe)
    ESP_LOGE(TAG, "Unsafe servo feedback id=%u raw=%d load=%d temperature=%d",
             id, f.position, f.load, f.temperature);
  return safe;
}
bool release(bool fault) {
  bool first = torque(1, false), second = torque(2, false);
  if (fault || !first || !second) {
    bool off = power(false);
    if (!off) {
      // Independent head-side switch if the base expander does not respond.
      auto *io = bsp_io_expander_init();
      off = io &&
            esp_io_expander_set_level(io, IO_EXPANDER_PIN_NUM_1, 0) == ESP_OK;
    }
    ready = false;
    if (off)
      ESP_LOGW(TAG,
               "Motor power disabled; reboot required before more movement");
    else
      ESP_LOGE(
          TAG,
          "Motor shutdown not confirmed; disconnect power before inspection");
    return false;
  }
  return true;
}
bool measured(Feedback &yaw, Feedback &pitch) {
  return feedback(1, yaw) && feedback(2, pitch);
}
void report(char *out, size_t cap, const Feedback &yaw, const Feedback &pitch) {
  snprintf(
      out, cap,
      "{\"yaw_degrees\":%.2f,\"pitch_degrees\":%.2f,\"yaw_temperature_c\":%d,"
      "\"pitch_temperature_c\":%d,\"yaw_load\":%d,\"pitch_load\":%d}",
      degrees(yaw.position, yaw_zero), degrees(pitch.position, pitch_zero),
      yaw.temperature, pitch.temperature, yaw.load, pitch.load);
}
} // namespace
void cancel_motion() { ++cancel_epoch; }

void init() {
  bus_lock = xSemaphoreCreateMutex();
  if (!bus_lock)
    return;
  i2c_device_config_t device{};
  device.dev_addr_length = I2C_ADDR_BIT_LEN_7;
  device.device_address = 0x6f;
  device.scl_speed_hz = 100000;
  if (i2c_master_bus_add_device(bsp_i2c_get_handle(), &device, &expander) !=
      ESP_OK)
    return;
  uint8_t version = 0;
  for (unsigned retry = 0; retry < 6; ++retry) {
    if (reg_read(2, version) == ESP_OK && version && version != 0xff)
      break;
    vTaskDelay(pdMS_TO_TICKS(200));
  }
  if (!version || version == 0xff || !power(false) || bit(3, true) != ESP_OK ||
      bit(0x0b, false) != ESP_OK || bit(9, true) != ESP_OK) {
    ESP_LOGW(TAG, "StackChan base not detected; voice/camera remain available");
    return;
  }
  // The CoreS3 BSP resets AW9523 outputs, including the 5 V boost and
  // M-Bus supply that power the base. Enable boost before BUS_OUT_EN, while
  // the base's separate VM switch is still off. Use the BSP's cached handle
  // so later display/camera operations preserve these bits.
  auto *head_io = bsp_io_expander_init();
  if (!head_io ||
      esp_io_expander_set_dir(head_io,
                              IO_EXPANDER_PIN_NUM_15 | IO_EXPANDER_PIN_NUM_1,
                              IO_EXPANDER_OUTPUT) != ESP_OK ||
      esp_io_expander_set_level(head_io, IO_EXPANDER_PIN_NUM_15, 1) != ESP_OK ||
      esp_io_expander_set_level(head_io, IO_EXPANDER_PIN_NUM_1, 1) != ESP_OK) {
    ESP_LOGE(TAG, "Cannot enable base 5 V supply");
    return;
  }
  lights_init(expander);
  // Read factory calibration without rewriting its namespace or servo EEPROM.
  nvs_handle_t nvs;
  const auto opened = nvs_open("servo", NVS_READONLY, &nvs);
  if (opened != ESP_OK && opened != ESP_ERR_NVS_NOT_FOUND) {
    ESP_LOGE(TAG, "Cannot read factory calibration; movement disabled");
    return;
  }
  if (opened == ESP_OK) {
    int32_t y = YAW_ZERO, p = PITCH_ZERO;
    const auto yr = nvs_get_i32(nvs, "zero_pos_1", &y);
    const auto pr = nvs_get_i32(nvs, "zero_pos_2", &p);
    nvs_close(nvs);
    if ((yr != ESP_OK && yr != ESP_ERR_NVS_NOT_FOUND) ||
        (pr != ESP_OK && pr != ESP_ERR_NVS_NOT_FOUND) ||
        !calibration_valid(y, p)) {
      ESP_LOGE(TAG, "Invalid saved servo calibration; movement disabled");
      return;
    }
    yaw_zero = y;
    pitch_zero = p;
  }
  uart_config_t uart{};
  uart.baud_rate = 1000000;
  uart.data_bits = UART_DATA_8_BITS;
  uart.parity = UART_PARITY_DISABLE;
  uart.stop_bits = UART_STOP_BITS_1;
  uart.flow_ctrl = UART_HW_FLOWCTRL_DISABLE;
  uart.source_clk = UART_SCLK_DEFAULT;
  if (uart_driver_install(UART, 256, 0, 0, nullptr, 0) != ESP_OK)
    return;
  if (uart_param_config(UART, &uart) != ESP_OK ||
      uart_set_pin(UART, 6, 7, UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE) !=
          ESP_OK ||
      !power(true)) {
    power(false);
    return;
  }
  vTaskDelay(pdMS_TO_TICKS(200));
  uint8_t vm = 0, mode = 0;
  reg_read(5, vm);
  reg_read(3, mode);
  ESP_LOGI(TAG, "VM output=%02x mode=%02x", vm, mode);
  for (uint8_t id = 1; id <= 2; ++id) {
    uint8_t diagnostic[6]{};
    bool found = false;
    for (int retry = 0; retry < 5 && !found; ++retry) {
      found = read(id, 3, diagnostic, 6);
      if (!found)
        vTaskDelay(pdMS_TO_TICKS(200));
    }
    ESP_LOGI(
        TAG,
        "Servo probe id=%u found=%d registers=%02x,%02x,%02x,%02x,%02x,%02x",
        id, found, diagnostic[0], diagnostic[1], diagnostic[2], diagnostic[3],
        diagnostic[4], diagnostic[5]);
  }
  for (uint8_t id = 1; id <= 2; ++id) {
    uint8_t deadband[2]{};
    if (read(id, 26, deadband, 2))
      ESP_LOGI(TAG, "Servo id=%u deadband=%u,%u", id, deadband[0], deadband[1]);
  }
  bool ok = torque(1, false);
  ok = torque(2, false) && ok;
  ESP_LOGI(TAG, "Base version=%u calibration=%d,%d torque_off=%d", version,
           yaw_zero, pitch_zero, ok);
  // Refuse continuous-rotation mode; never unlock/write servo EEPROM.
  for (uint8_t id = 1; id <= 2 && ok; ++id) {
    uint8_t limits[4];
    ok = read(id, 9, limits, 4);
    if (ok)
      ESP_LOGI(TAG, "Servo id=%u limits=%u,%u", id,
               (limits[0] << 8) | limits[1], (limits[2] << 8) | limits[3]);
    if (ok) {
      servo_min[id - 1] = (limits[0] << 8) | limits[1];
      servo_max[id - 1] = (limits[2] << 8) | limits[3];
      ok = valid_servo_limits(servo_min[id - 1], servo_max[id - 1]);
    }
  }
  Feedback yaw{}, pitch{};
  ok = ok && measured(yaw, pitch);
  if (!ok) {
    release(true);
    return;
  }
  ready = true;
  ESP_LOGI(TAG, "Base detected version=%u zeros=%d,%d raw=%d,%d torque=off",
           version, yaw_zero, pitch_zero, yaw.position, pitch.position);
}

esp_err_t execute_tool(void *, const char *name, const char *arguments,
                       char *out, size_t cap, bool (*cancelled)(void *),
                       void *context) {
  if (!out || cap < 128 || !name || !arguments || !cancelled)
    return ESP_ERR_INVALID_ARG;
  out[0] = 0;
  Pose target;
  const bool query = !strcmp(name, "get_head_pose");
  const bool center = !strcmp(name, "center_head");
  bool args_ok = false;
  if (query || center) {
    cJSON *args = cJSON_ParseWithOpts(arguments, nullptr, true);
    args_ok = cJSON_IsObject(args) && !args->child;
    cJSON_Delete(args);
  } else if (!strcmp(name, "look_at"))
    args_ok = parse_pose(arguments, target);
  if (!args_ok) {
    snprintf(out, cap,
             "Invalid arguments: yaw must be an integer -40..40 and pitch "
             "10..60; center/pose take {}.");
    return ESP_ERR_INVALID_ARG;
  }
  if (!bus_lock || xSemaphoreTake(bus_lock, 0) != pdTRUE) {
    snprintf(out, cap, "Motor controller busy or unavailable.");
    return ESP_ERR_INVALID_STATE;
  }
  struct Unlock {
    ~Unlock() { xSemaphoreGive(bus_lock); }
  } unlock;
  const uint32_t epoch = cancel_epoch.load();
  auto stopped = [&] {
    return cancelled(context) || cancel_epoch.load() != epoch;
  };
  if (!ready || stopped()) {
    snprintf(out, cap, "Motor controller unavailable or request cancelled.");
    return ESP_ERR_INVALID_STATE;
  }
  Feedback yaw{}, pitch{};
  if (!measured(yaw, pitch)) {
    release(true);
    snprintf(out, cap,
             "Servo feedback failed or load/temperature exceeded limits.");
    return ESP_FAIL;
  }
  if (query) {
    report(out, cap, yaw, pitch);
    return ESP_OK;
  }
  const double current_yaw = degrees(yaw.position, yaw_zero);
  const double current_pitch = degrees(pitch.position, pitch_zero);
  // Allow a small edge margin for a factory resting pose; never move from an
  // unknown/wrapped yaw or an extreme pitch. No implicit recalibration.
  if (current_yaw < -60 || current_yaw > 60 || current_pitch < -2 ||
      current_pitch > 70) {
    snprintf(out, cap,
             "Current pose is outside the startup envelope; inspect "
             "alignment/calibration before moving.");
    return ESP_ERR_INVALID_STATE;
  }
  int start_y = yaw.position, start_p = pitch.position;
  int end_y = raw(target.yaw, yaw_zero), end_p = raw(target.pitch, pitch_zero);
  if (end_y < servo_min[0] || end_y > servo_max[0] || end_p < servo_min[1] ||
      end_p > servo_max[1]) {
    snprintf(out, cap,
             "Requested pose exceeds the servo's stored position limits.");
    return ESP_ERR_INVALID_ARG;
  }
  unsigned duration = duration_ms(end_y - start_y, end_p - start_p);
  if (duration > 3500) {
    snprintf(out, cap, "Requested move exceeds the bounded motion duration.");
    return ESP_ERR_INVALID_ARG;
  }
  bool ok = !stopped() && position(1, start_y) && !stopped() &&
            position(2, start_p) && !stopped() && torque(1, true) &&
            !stopped() && torque(2, true);
  const int64_t began = esp_timer_get_time();
  unsigned cycle = 0;
  while (ok && !stopped()) {
    unsigned elapsed = unsigned((esp_timer_get_time() - began) / 1000);
    ok = position(1, interpolate(start_y, end_y, elapsed, duration)) &&
         !stopped() &&
         position(2, interpolate(start_p, end_p, elapsed, duration));
    if (++cycle % 5 == 0)
      ok = ok && !stopped() && measured(yaw, pitch);
    if (elapsed >= duration)
      break;
    vTaskDelay(pdMS_TO_TICKS(20));
  }
  unsigned settled = 0;
  const int64_t deadline = esp_timer_get_time() + 800000;
  while (ok && !stopped() && esp_timer_get_time() < deadline && settled < 3) {
    uint8_t moving_y = 1, moving_p = 1;
    ok = read(1, 66, &moving_y, 1) && !stopped() && read(2, 66, &moving_p, 1) &&
         !stopped() && measured(yaw, pitch);
    settled = ok && arrived(yaw.position, end_y, moving_y) &&
                      arrived(pitch.position, end_p, moving_p)
                  ? settled + 1
                  : 0;
    vTaskDelay(pdMS_TO_TICKS(20));
  }
  bool was_cancelled = stopped();
  ok = ok && settled >= 3 && !was_cancelled;
  const bool released = release(!ok && !was_cancelled);
  ok = ok && released;
  ESP_LOGI(
      TAG,
      "Move target=%d,%d actual=%.2f,%.2f elapsed_ms=%lld ok=%d cancelled=%d",
      target.yaw, target.pitch, degrees(yaw.position, yaw_zero),
      degrees(pitch.position, pitch_zero),
      (esp_timer_get_time() - began) / 1000, ok, was_cancelled);
  if (!ok) {
    snprintf(out, cap,
             was_cancelled && released
                 ? "Movement cancelled; torque released."
                 : "Movement incomplete; controller disabled and motor "
                   "shutdown requested. Check USB diagnostics before reboot.");
    return was_cancelled ? ESP_ERR_INVALID_STATE : ESP_FAIL;
  }
  report(out, cap, yaw, pitch);
  return ESP_OK;
}

namespace {
struct Diagnostic {
  const char *name;
  char args[96];
  uint32_t epoch;
};
void diagnostic_task(void *arg) {
  auto *job = static_cast<Diagnostic *>(arg);
  char result[512];
  auto cancel = [](void *p) {
    return static_cast<Diagnostic *>(p)->epoch != cancel_epoch.load();
  };
  const auto err = execute_tool(nullptr, job->name, job->args, result,
                                sizeof(result), cancel, job);
  ESP_LOGI(TAG, "Diagnostic %s result=%s %s", job->name, esp_err_to_name(err),
           result);
  delete job;
  diagnostic_busy = false;
  vTaskDelete(nullptr);
}
} // namespace
void diagnostic(const char *command) {
  if (!strcmp(command, "stop")) {
    cancel_motion();
    return;
  }
  const char *name = nullptr;
  Pose pose;
  int consumed = 0;
  if (!strcmp(command, "pose"))
    name = "get_head_pose";
  else if (!strcmp(command, "center"))
    name = "center_head";
  else if (sscanf(command, "look %6d %6d%n", &pose.yaw, &pose.pitch,
                  &consumed) == 2 &&
           !command[consumed] && valid(pose))
    name = "look_at";
  if (!name || diagnostic_busy.exchange(true)) {
    ESP_LOGW(TAG, "Invalid/busy head diagnostic");
    return;
  }
  auto *job = new (std::nothrow) Diagnostic{name, {}, cancel_epoch.load()};
  if (!job) {
    diagnostic_busy = false;
    return;
  }
  if (!strcmp(name, "look_at"))
    snprintf(job->args, sizeof(job->args),
             "{\"yaw_degrees\":%d,\"pitch_degrees\":%d}", pose.yaw, pose.pitch);
  else
    snprintf(job->args, sizeof(job->args), "{}");
  if (xTaskCreate(diagnostic_task, "head_test", 4096, job, 2, nullptr) !=
      pdPASS) {
    delete job;
    diagnostic_busy = false;
  }
}
} // namespace stackchan
