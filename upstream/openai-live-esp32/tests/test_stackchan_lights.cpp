#include "LightsPolicy.hpp"
#include <cassert>
#include <set>
using namespace stackchan::lights;

static unsigned color(const Packet &packet, unsigned i) {
  return packet[1 + 2 * i] | unsigned(packet[2 + 2 * i]) << 8;
}
static std::array<int, 3> rgb(const Packet &p, unsigned i) {
  const auto c = color(p, i);
  return {int((c >> 11) & 31) * 8, int((c >> 5) & 63) * 4, int(c & 31) * 8};
}
int main() {
  Frame frame{};
  auto off = encode(frame);
  assert(off.size() == 25 && off[0] == 0x30);
  assert(CONFIG == 0x24 && REFRESH == 0x4c);
  for (unsigned i = 0; i < COUNT; ++i)
    assert(!color(off, i));
  frame[0] = {255, 255, 255};
  frame[11] = {0, 0, 255};
  const auto bytes = encode(frame);
  assert(bytes[1] == 0x08 &&
         bytes[2] == 0x42); // Dimmed RGB565, low byte first.
  assert(bytes[23] == 0x08 && bytes[24] == 0);
  for (unsigned i = 1; i < 11; ++i)
    assert(!color(bytes, i));
  assert(select_mode(true, false, false, false, false, true) == Mode::wander);
  assert(select_mode(true, false, true, false, true, true) == Mode::wander);
  assert(select_mode(true, false, true, false, true, false) == Mode::active);
  assert(select_mode(true, false, false, false, false, false) == Mode::off);
  assert(select_mode(false, false, true, false, true, true) == Mode::off);
  assert(select_mode(true, false, true, true, true, true) == Mode::muted);
  assert(select_mode(true, false, false, false, true, true) ==
         Mode::connecting);
  assert(select_mode(true, true, false, false, false, true) == Mode::active);
  for (unsigned palette = 0; palette < 3; ++palette) {
    const bool assistant = palette == 1;
    const auto mode = palette == 2 ? Mode::wander : Mode::active;
    Animation flow;
    Frame frame{};
    Packet previous = off;
    int low[COUNT], high[COUNT]{};
    std::fill(std::begin(low), std::end(low), 255);
    unsigned distinct = 0;
    for (unsigned tick = 0; tick < 600; ++tick) {
      const int64_t now = tick * Animation::FRAME_US;
      if (tick % 5 == 0)
        flow.chunk(assistant, now);
      assert(flow.step(now, mode, frame));
      assert(!flow.step(now + 1000, mode, frame));
      auto packet = encode(frame);
      std::set<unsigned> colors;
      for (unsigned i = 0; i < COUNT; ++i) {
        const auto value = rgb(packet, i), old = rgb(previous, i);
        for (unsigned c = 0; c < 3; ++c) {
          assert(value[c] <= 64);
          assert(std::abs(value[c] - old[c]) <= 8); // Quantized, gentle steps.
        }
        if (tick > 100) {
          const auto peak = std::max({value[0], value[1], value[2]});
          assert(peak >= 16); // Pulses do not switch off between chunks.
          low[i] = std::min(low[i], peak);
          high[i] = std::max(high[i], peak);
          if (mode == Mode::wander)
            assert(value[2] > value[0] && value[0] >= value[1] + 8);
          else if (assistant)
            assert(value[0] >= value[1] && value[1] > value[2]);
          else
            assert(value[1] > value[0] + 8 && value[2] > value[0] + 8);
          colors.insert(color(packet, i));
        }
      }
      distinct += colors.size() >= 4;
      previous = packet;
    }
    assert(distinct > 450);
    for (unsigned i = 0; i < COUNT; ++i)
      assert(high[i] - low[i] >= 8); // Both six-LED banks actually breathe.
    flow.clear_activity();
    for (unsigned tick = 600; tick < 900; ++tick)
      flow.step(tick * Animation::FRAME_US, Mode::off, frame);
    assert(encode(frame) == off);
  }
  // Mode changes crossfade from the currently shown colors without a reset.
  Animation flow;
  Packet previous = off;
  for (unsigned tick = 0; tick < 800; ++tick) {
    const auto now = tick * Animation::FRAME_US;
    flow.chunk((tick / 200) % 2, now);
    const auto mode = (tick / 100) % 2 ? Mode::wander : Mode::active;
    assert(flow.step(now, mode, frame));
    const auto packet = encode(frame);
    for (unsigned i = 0; i < COUNT; ++i)
      for (unsigned c = 0; c < 3; ++c)
        assert(std::abs(rgb(packet, i)[c] - rgb(previous, i)[c]) <= 8);
    previous = packet;
  }
}
