#pragma once
#include <cstddef>
#include <cstdint>
#include <cstring>

namespace live_mirror {
constexpr unsigned WIDTH = 368, HEIGHT = 448, ROWS = 16;
constexpr unsigned STRIPES = HEIGHT / ROWS;
constexpr size_t STRIPE_BYTES = WIDTH * ROWS * 2;
constexpr size_t CHUNK_BYTES = 768, HEADER_BYTES = 24;

inline void put16(uint8_t *p, uint16_t v) {
  p[0] = v;
  p[1] = v >> 8;
}
inline void put32(uint8_t *p, uint32_t v) {
  put16(p, v);
  put16(p + 2, v >> 16);
}

// RGB565 runs are (uint16 count, uint16 pixel), both little endian.
// Return zero when raw pixels would be smaller; output never exceeds capacity.
inline size_t rle(const uint8_t *pixels, size_t size, uint8_t *out,
                  size_t capacity) {
  size_t used = 0;
  for (size_t i = 0; i < size;) {
    size_t count = 1;
    while (i + 2 * count < size && count < 65535 &&
           pixels[i] == pixels[i + 2 * count] &&
           pixels[i + 1] == pixels[i + 2 * count + 1])
      ++count;
    if (used + 4 >= size || used + 4 > capacity)
      return 0;
    put16(out + used, count);
    memcpy(out + used + 2, pixels + i, 2);
    used += 4;
    i += count * 2;
  }
  return used;
}

// Caller reserves size + size/254 + 2 bytes. Delimiters are added separately.
inline size_t cobs(const uint8_t *data, size_t size, uint8_t *out) {
  size_t cursor = 1, code_at = 0;
  uint8_t code = 1;
  for (size_t i = 0; i < size; ++i) {
    if (!data[i]) {
      out[code_at] = code;
      code_at = cursor++;
      code = 1;
    } else {
      out[cursor++] = data[i];
      if (++code == 255) {
        out[code_at] = code;
        code_at = cursor++;
        code = 1;
      }
    }
  }
  out[code_at] = code;
  return cursor;
}
} // namespace live_mirror
