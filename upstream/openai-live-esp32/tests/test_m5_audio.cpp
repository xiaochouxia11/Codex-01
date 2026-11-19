#include "AudioFormat.hpp"
#include <array>
#include <cassert>
#include <cstdint>

int main() {
  // Distinct channels catch both swapped microphone slots and an accidental
  // average. Include the signed extrema used by 16-bit I2S.
  const int16_t stereo[] = {-32768, 1234, -1, 99, 0, -99, 32767, -1234};
  std::array<int16_t, 6> mono{42, 0, 0, 0, 0, 42};
  board::microphone_mono(stereo, mono.data() + 1, 4);
  assert((mono == std::array<int16_t, 6>{42, -32768, -1, 0, 32767, 42}));
  std::array<int16_t, 10> output{42, 0, 0, 0, 0, 0, 0, 0, 0, 42};
  board::speaker_stereo(mono.data() + 1, output.data() + 1, 4);
  assert((output == std::array<int16_t, 10>{42, -32768, -32768, -1, -1, 0, 0,
                                            32767, 32767, 42}));
  board::microphone_mono(nullptr, nullptr, 0);
  board::speaker_stereo(nullptr, nullptr, 0);
}
