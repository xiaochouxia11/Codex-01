#pragma once
#include <cstddef>
#include <cstdint>

namespace board {
// ES7210 supplies two microphone slots. Use one microphone, not an average of
// two phase-shifted signals. AW88298 receives identical left/right samples.
inline void microphone_mono(const int16_t *stereo, int16_t *mono,
                            size_t count) {
  for (size_t i = 0; i < count; ++i)
    mono[i] = stereo[2 * i];
}
inline void speaker_stereo(const int16_t *mono, int16_t *stereo, size_t count) {
  for (size_t i = 0; i < count; ++i)
    stereo[2 * i] = stereo[2 * i + 1] = mono[i];
}
} // namespace board
