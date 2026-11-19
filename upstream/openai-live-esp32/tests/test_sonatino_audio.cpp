#include "AudioFormat.hpp"
#include <array>
#include <cassert>
#include <climits>

int main() {
  const int16_t input[] = {-32768, 190, -1, 191, 0, 192, 32767, 193};
  std::array<int16_t, 6> mono{42, 0, 0, 0, 0, 42};
  board::microphone_mono(input, mono.data() + 1, 4);
  assert((mono == std::array<int16_t, 6>{42, -32768, -1, 0, 32767, 42}));
  for (unsigned volume : {0u, 20u, 100u, UINT_MAX}) {
    std::array<int16_t, 10> output{42, 0, 0, 0, 0, 0, 0, 0, 0, 42};
    board::headphone_stereo(mono.data() + 1, output.data() + 1, 4, volume);
    const int gain = volume > 100 ? 100 : volume;
    for (unsigned i = 0; i < 4; ++i) {
      const int expected = int(mono[i + 1]) * gain / 100;
      assert(output[2 * i + 1] == expected);
      assert(output[2 * i + 2] == expected);
    }
    assert(output.front() == 42 && output.back() == 42);
  }
  board::microphone_mono(nullptr, nullptr, 0);
  board::headphone_stereo(nullptr, nullptr, 0, 20);
  unsigned value = 42;
  for (const char *invalid : {"", "-1", "101", "1000", "99999999999999999",
                              "20x", "20 30", "+20", " 20"}) {
    assert(!board::parse_volume(invalid, value));
    assert(value == 42);
  }
  assert(!board::parse_volume(nullptr, value));
  assert(board::parse_volume("0", value) && value == 0);
  assert(board::parse_volume("20", value) && value == 20);
  assert(board::parse_volume("100", value) && value == 100);
}
