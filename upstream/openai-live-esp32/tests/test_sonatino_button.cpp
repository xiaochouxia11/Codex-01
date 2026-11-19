#include "BootButton.hpp"
#include <cassert>
#include <cstdint>

using board::BootButton;

int main() {
  BootButton button;
  // Boot and an idle released button must never start the microphone.
  assert(!button.update(true, false, 0));
  assert(!button.update(true, false, 40));
  assert(!button.update(true, false, 1000));
  // Reject a short contact bounce.
  assert(!button.update(true, true, 1010));
  assert(!button.update(true, false, 1020));
  assert(!button.update(true, false, 1060));
  // A held press never starts; both press and release must settle.
  assert(!button.update(true, true, 1100));
  assert(!button.update(true, true, 1139));
  assert(!button.update(true, true, 1140));
  assert(!button.update(true, true, 5000));
  assert(!button.update(true, false, 5010));
  assert(!button.update(true, false, 5049));
  assert(button.update(true, false, 5050));
  assert(!button.update(true, false, 5090));
  // Release bounce cannot fire early or produce two starts.
  assert(!button.update(true, true, 5100));
  assert(!button.update(true, true, 5140));
  assert(!button.update(true, false, 5150));
  assert(!button.update(true, true, 5160));
  assert(!button.update(true, false, 5170));
  assert(!button.update(true, false, 5209));
  assert(button.update(true, false, 5210));
  assert(!button.update(true, false, 5300));
  // Busy, Wi-Fi unavailable, or pin handoff cancels an armed press. A press
  // spanning that boundary cannot start a new session when availability
  // returns.
  assert(!button.update(true, true, 5400));
  assert(!button.update(true, true, 5440));
  assert(!button.update(false, true, 5450));
  assert(!button.update(true, true, 6000));
  assert(!button.update(true, true, 6040));
  assert(!button.update(true, false, 6100));
  assert(!button.update(true, false, 6140));
  assert(!button.update(true, true, 6200));
  assert(!button.update(true, true, 6240));
  assert(!button.update(true, false, 6300));
  assert(button.update(true, false, 6340));
  // A button held at firmware initialization also needs a fresh press.
  BootButton held;
  assert(!held.update(true, true, 0));
  assert(!held.update(true, true, 100));
  assert(!held.update(true, false, 200));
  assert(!held.update(true, false, 240));
  // Millisecond wraparound must preserve the debounce duration.
  BootButton wrap;
  const uint32_t near_wrap = UINT32_MAX - 60;
  assert(!wrap.update(true, false, near_wrap - 100));
  assert(!wrap.update(true, false, near_wrap - 60));
  assert(!wrap.update(true, true, near_wrap));
  assert(!wrap.update(true, true, near_wrap + 40));
  assert(!wrap.update(true, false, UINT32_MAX - 10));
  assert(!wrap.update(true, false, 28));
  assert(wrap.update(true, false, 29));
}
