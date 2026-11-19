#pragma once
#include <cstddef>
#include <cstdint>

namespace board {
inline bool parse_volume(const char *text, unsigned &percent) {
  if (!text || !*text)
    return false;
  unsigned value = 0;
  for (; *text; ++text) {
    if (*text < '0' || *text > '9')
      return false;
    value = value * 10 + unsigned(*text - '0');
    if (value > 100)
      return false;
  }
  percent = value;
  return true;
}
inline void microphone_mono(const int16_t *stereo, int16_t *mono,
                            size_t count) {
  // Sonatino routes the jack's mono microphone to the WM8782 left input.
  for (size_t i = 0; i < count; ++i)
    mono[i] = stereo[2 * i];
}
inline void headphone_stereo(const int16_t *mono, int16_t *stereo, size_t count,
                             unsigned percent) {
  if (percent > 100)
    percent = 100;
  for (size_t i = 0; i < count; ++i) {
    // Signed arithmetic preserves negative samples and cannot overflow.
    const int16_t sample = int32_t(mono[i]) * int32_t(percent) / 100;
    stereo[2 * i] = stereo[2 * i + 1] = sample;
  }
}
} // namespace board
