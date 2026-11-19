// PY32 LED register/byte format adapted from M5Stack StackChan-BSP (MIT).
// See third_party/stackchan/ for the retained notice and pinned source.
#pragma once
#include "../../common/TranscriptLights.hpp"

namespace stackchan::lights {
constexpr unsigned COUNT = 12;
using Frame = live_example::LightFrame<COUNT>;
using Animation = live_example::TranscriptLights<COUNT>;
using Mode = live_example::LightMode;
using Packet = std::array<uint8_t, 1 + COUNT * 2>;
constexpr uint8_t CONFIG = 0x24, RAM = 0x30, REFRESH = 0x40 | COUNT;
// Modest output, with enough RGB565 resolution for differing hues and breaths.
constexpr unsigned BRIGHTNESS = 64;
inline Mode select_mode(bool enabled, bool demo, bool active, bool muted,
                        bool busy, bool wandering) {
  if (!enabled)
    return Mode::off;
  if (demo)
    return Mode::active;
  if (active && muted)
    return Mode::muted;
  if (!active && busy)
    return Mode::connecting;
  if (wandering)
    return Mode::wander;
  return active ? Mode::active : Mode::off;
}
inline const char *mode_name(Mode mode) {
  switch (mode) {
  case Mode::wander:
    return "wander";
  case Mode::active:
    return "transcript";
  case Mode::connecting:
    return "connecting";
  case Mode::muted:
    return "muted";
  default:
    return "off";
  }
}
inline Packet encode(const Frame &frame) {
  Packet out{};
  out[0] = RAM;
  for (unsigned i = 0; i < COUNT; ++i) {
    const unsigned r = unsigned(frame[i].r) * BRIGHTNESS / 255;
    const unsigned g = unsigned(frame[i].g) * BRIGHTNESS / 255;
    const unsigned b = unsigned(frame[i].b) * BRIGHTNESS / 255;
    const uint16_t color = ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
    out[1 + 2 * i] = uint8_t(color);
    out[2 + 2 * i] = uint8_t(color >> 8);
  }
  return out;
}
} // namespace stackchan::lights
