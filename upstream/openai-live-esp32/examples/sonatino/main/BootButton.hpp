#pragma once
#include <cstdint>

namespace board {
// Start only after a debounced press AND release while continuously available.
// Require a released baseline after boot, Wi-Fi loss, or audio ownership.
class BootButton {
public:
  static constexpr uint32_t DEBOUNCE_MS = 40;
  bool update(bool available, bool down, uint32_t now) {
    if (!available) {
      initialized_ = armed_ = pressed_ = false;
      return false;
    }
    if (!initialized_ || down != raw_down_) {
      initialized_ = true;
      raw_down_ = down;
      changed_at_ = now;
      return false;
    }
    if (uint32_t(now - changed_at_) < DEBOUNCE_MS)
      return false;
    if (down) {
      pressed_ = armed_;
      return false;
    }
    const bool start = pressed_;
    armed_ = true;
    pressed_ = false;
    return start;
  }

private:
  bool initialized_ = false, raw_down_ = false, armed_ = false,
       pressed_ = false;
  uint32_t changed_at_ = 0;
};
} // namespace board
