#pragma once
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>

namespace live_example {
struct LightRgb {
  uint8_t r = 0, g = 0, b = 0;
  bool operator==(const LightRgb &other) const {
    return r == other.r && g == other.g && b == other.b;
  }
};
template <unsigned Count> using LightFrame = std::array<LightRgb, Count>;
enum class LightMode { off, connecting, active, muted, wander };

// Allocation-free, time-driven animation. Staggered hue and breathing waves
// keep the LEDs distinct even through quiet passages. Recent chunks smoothly
// accelerate the waves, never restart a fade or write hardware from audio
// tasks.
template <unsigned Count> class TranscriptLights {
  static_assert(Count > 0 && Count <= 32);
  float current_[Count][3]{};
  float phase_ = 0, breath_phase_ = 0, activity_ = 0;
  int64_t last_step_ = -1, last_chunk_ = -1;
  bool assistant_ = false;

public:
  static constexpr int64_t FRAME_US = 50000; // At most 20 full-strip writes/s.
  static constexpr float MAX_STEP = 10; // Before the device's brightness limit.

  void clear_activity() {
    last_chunk_ = -1;
    assistant_ = false;
    activity_ = 0;
  }
  void chunk(bool assistant, int64_t now) {
    assistant_ = assistant;
    last_chunk_ = now;
  }
  // Adopt explicit tool colors so their expiry blends back from what is
  // actually visible, including individual-LED overrides.
  void adopt(int index, LightRgb color) {
    for (unsigned i = 0; i < Count; ++i) {
      if (index >= 0 && i != unsigned(index))
        continue;
      current_[i][0] = color.r;
      current_[i][1] = color.g;
      current_[i][2] = color.b;
    }
  }
  void hold(int64_t now) { last_step_ = now; }
  bool step(int64_t now, LightMode mode, LightFrame<Count> &frame) {
    if (last_step_ >= 0 && now - last_step_ < FRAME_US)
      return false;
    const float dt = last_step_ < 0
                         ? 0.05f
                         : std::min(0.1f, float(now - last_step_) / 1000000);
    last_step_ = now;
    const float recent =
        last_chunk_ < 0
            ? 0
            : std::clamp(1.f - float(now - last_chunk_) / 1500000.f, 0.f, 1.f);
    // Fast attack, slow release: coalesced chunks keep motion lively without
    // making speed jump at chunk boundaries or stop abruptly between words.
    const float response = recent > activity_ ? 0.18f : 0.8f;
    activity_ += (recent - activity_) * dt / (response + dt);
    if (mode == LightMode::active || mode == LightMode::wander) {
      // Active speech brings the waves around in roughly 2.5-3 seconds.
      // Quiet passages return to the original slow drift/breathing periods.
      phase_ += dt * (0.32f + 2.2f * activity_);
      breath_phase_ += dt * (0.85f + 1.7f * activity_);
      if (phase_ >= 6.2831853f)
        phase_ -= 6.2831853f;
      if (breath_phase_ >= 6.2831853f)
        breath_phase_ -= 6.2831853f;
    }
    const float alpha = dt / (0.55f - 0.25f * activity_ + dt);
    for (unsigned i = 0; i < frame.size(); ++i) {
      float target[3]{};
      if (mode == LightMode::connecting) {
        target[0] = 120;
        target[1] = 65;
        target[2] = 12;
      } else if (mode == LightMode::muted) {
        target[0] = 150;
        target[1] = 20;
        target[2] = 35;
      } else if (mode == LightMode::active || mode == LightMode::wander) {
        const float wave = std::sin(phase_ + float(i) * (6.2831853f / Count));
        const float breath = std::sin(breath_phase_ - float(i) * 1.7f);
        const float gain =
            0.61f + 0.08f * activity_ + (0.13f + 0.04f * activity_) * breath;
        // Violet idle dreams; otherwise teal/cyan/blue or amber/gold. Keep
        // separation after hardware dimming and stay lit at pulse troughs.
        if (mode == LightMode::wander) {
          target[0] = (155.f + 25 * wave) * gain;
          target[1] = (55.f + 16 * wave) * gain;
          target[2] = (240.f + 10 * wave) * gain;
        } else {
          target[0] =
              (assistant_ ? 240.f + 10 * wave : 26.f + 12 * wave) * gain;
          target[1] =
              (assistant_ ? 148.f + 48 * wave : 184.f + 55 * wave) * gain;
          target[2] =
              (assistant_ ? 42.f + 22 * wave : 230.f - 25 * wave) * gain;
        }
      }
      uint8_t channels[3];
      for (unsigned c = 0; c < 3; ++c) {
        auto &value = current_[i][c];
        value += std::clamp((target[c] - value) * alpha, -MAX_STEP, MAX_STEP);
        channels[c] = uint8_t(std::clamp(std::lround(value), 0L, 255L));
      }
      frame[i] = {channels[0], channels[1], channels[2]};
    }
    return true;
  }
};
} // namespace live_example
