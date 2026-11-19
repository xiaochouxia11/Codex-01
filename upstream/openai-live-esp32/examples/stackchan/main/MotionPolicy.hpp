// Register map and angle conversion adapted from M5Stack StackChan-BSP and
// FTServo (MIT). See third_party/stackchan/ for retained notices and
// provenance.
#pragma once
#include "cJSON.h"
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstring>

namespace stackchan {
constexpr int YAW_ZERO = 460, PITCH_ZERO = 620;
constexpr int YAW_MIN = -40, YAW_MAX = 40, PITCH_MIN = 10, PITCH_MAX = 60;
constexpr int CENTER_PITCH = 15;
// This is an application arrival tolerance, not a claimed encoder accuracy.
// Real loaded head tests stop about 4 degrees short with moving=0. Preserve
// factory gains and always report measured pose instead of claiming exact aim.
constexpr int ARRIVAL_TOLERANCE_RAW = 16; // 5 degrees
inline bool arrived(int actual, int target, uint8_t moving) {
  return moving == 0 && std::abs(actual - target) <= ARRIVAL_TOLERANCE_RAW;
}
constexpr char TOOLS_JSON[] = R"([
{"type":"function","name":"look_at","description":"Move the head to an absolute pose, then report measured position. Yaw is degrees from forward (-40 to 40): positive turns left from the robot's perspective, negative right; pitch is the vendor upward tilt coordinate (10 to 60). Motion is slow and limited; the base does not drive. Capture a new photo after moving to inspect that view.","parameters":{"type":"object","properties":{"yaw_degrees":{"type":"integer","minimum":-40,"maximum":40},"pitch_degrees":{"type":"integer","minimum":10,"maximum":60}},"required":["yaw_degrees","pitch_degrees"],"additionalProperties":false},"strict":true},
{"type":"function","name":"center_head","description":"Return the head to forward yaw 0 and a gentle 15-degree upward tilt. Wait for completion before taking a photo.","parameters":{"type":"object","properties":{},"required":[],"additionalProperties":false},"strict":true},
{"type":"function","name":"get_head_pose","description":"Read both servo positions, temperatures, and load. Does not move the head.","parameters":{"type":"object","properties":{},"required":[],"additionalProperties":false},"strict":true}
])";
inline bool valid_servo_limits(int low, int high) {
  return low >= 0 && high <= 1023 && low < high;
}
struct Pose {
  int yaw = 0, pitch = CENTER_PITCH;
};
inline bool valid(Pose p) {
  return p.yaw >= YAW_MIN && p.yaw <= YAW_MAX && p.pitch >= PITCH_MIN &&
         p.pitch <= PITCH_MAX;
}
inline bool parse_pose(const char *json, Pose &out) {
  if (!json || strlen(json) > 512 || strstr(json, "\\u0000"))
    return false;
  cJSON *root = cJSON_ParseWithOpts(json, nullptr, true);
  bool ok = cJSON_IsObject(root);
  unsigned fields = 0, seen = 0;
  Pose p;
  for (auto *v = root ? root->child : nullptr; ok && v; v = v->next) {
    ++fields;
    if (!v->string || !cJSON_IsNumber(v) || !std::isfinite(v->valuedouble) ||
        v->valuedouble != std::floor(v->valuedouble) || v->valuedouble < -40 ||
        v->valuedouble > 60) {
      ok = false;
      break;
    }
    unsigned bit = !strcmp(v->string, "yaw_degrees")     ? 1
                   : !strcmp(v->string, "pitch_degrees") ? 2
                                                         : 0;
    if (!bit || (seen & bit)) {
      ok = false;
      break;
    }
    seen |= bit;
    if (bit == 1)
      p.yaw = int(v->valuedouble);
    else
      p.pitch = int(v->valuedouble);
  }
  ok = ok && fields == 2 && seen == 3 && valid(p);
  cJSON_Delete(root);
  if (ok)
    out = p;
  return ok;
}
inline int raw(int degrees, int zero) { return zero + degrees * 16 / 5; }
inline double degrees(int position, int zero) {
  return (position - zero) * 5.0 / 16;
}
inline bool calibration_valid(int yaw, int pitch) {
  return yaw >= 200 && yaw <= 800 && pitch >= 200 && pitch <= 800 &&
         raw(YAW_MIN, yaw) >= 0 && raw(YAW_MAX, yaw) <= 1000 &&
         raw(PITCH_MIN, pitch) >= 0 && raw(PITCH_MAX, pitch) <= 1000;
}
// Smoothstep peak velocity is 1.5 times average; cap it at 45 degrees/s.
inline unsigned duration_ms(int dx_raw, int dy_raw) {
  return std::max(
      400u, unsigned(std::ceil(std::max(std::abs(dx_raw), std::abs(dy_raw)) *
                               (5.0 / 16) * 1500 / 45)));
}
inline int interpolate(int start, int end, unsigned elapsed,
                       unsigned duration) {
  double t = std::min(1.0, double(elapsed) / std::max(1u, duration));
  return int(std::lround(start + (end - start) * t * t * (3 - 2 * t)));
}
// Small, fixed-size SCS packets; no dynamic length can escape these bounds.
inline size_t packet(uint8_t id, uint8_t instruction, const uint8_t *params,
                     size_t n, uint8_t *out, size_t cap) {
  if (!out || !id || id > 2 || n > 7 || cap < n + 6 || (n && !params))
    return 0;
  out[0] = out[1] = 0xff;
  out[2] = id;
  out[3] = uint8_t(n + 2);
  out[4] = instruction;
  uint8_t sum = id + out[3] + instruction;
  for (size_t i = 0; i < n; ++i) {
    out[5 + i] = params[i];
    sum += params[i];
  }
  out[5 + n] = uint8_t(~sum);
  return n + 6;
}
// A low-priority task can be preempted after reading the header while the
// rest of the reply is already queued. Drain available bytes before applying
// the wall-clock timeout; bound even an endless noise stream to 64 bytes.
template <class Read, class Clock, class Wait>
inline size_t receive(uint8_t *out, size_t capacity, size_t data,
                      Read read_byte, Clock now, Wait wait) {
  if (!out || data > 8 || capacity < data + 6)
    return 0;
  const int64_t deadline = now() + 10000;
  size_t used = 0, scanned = 0;
  while (used < data + 6 && scanned < 64) {
    uint8_t byte = 0;
    if (!read_byte(byte)) {
      if (now() >= deadline)
        break;
      wait();
      continue;
    }
    ++scanned;
    if (used < 2 && byte != 0xff) {
      used = 0;
      continue;
    }
    if (used == 2 && byte == 0xff)
      continue;
    out[used++] = byte;
  }
  return used;
}
inline bool response(const uint8_t *bytes, size_t n, uint8_t id, size_t data) {
  if (!bytes || data > 8 || n != data + 6 || bytes[0] != 0xff ||
      bytes[1] != 0xff || bytes[2] != id || bytes[3] != data + 2 ||
      bytes[4] != 0)
    return false;
  uint8_t sum = 0;
  for (size_t i = 2; i < n; ++i)
    sum += bytes[i];
  return sum == 0xff;
}
} // namespace stackchan
