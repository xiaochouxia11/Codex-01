#pragma once
#include <algorithm>
#include <cstddef>
#include <cstdint>

namespace mosaico {
constexpr unsigned PHOTO_WIDTH = 320, PHOTO_HEIGHT = 240;
// Validate before indexing camera memory, including row padding and overflow.
inline bool frame_valid(unsigned w, unsigned h, size_t stride, size_t bytes) {
  return w >= 2 && !(w & 1) && h && w <= 4096 && h <= 4096 &&
         stride >= size_t(w) * 2 && stride <= 16384 &&
         bytes >= (size_t(h) - 1) * stride + size_t(w) * 2;
}
inline size_t frame_stride(unsigned w, unsigned h, size_t stride,
                           size_t bytes) {
  if (w < 2 || (w & 1) || !h || w > 4096 || h > 4096)
    return 0;
  // ESP Video's DVP G_FMT omits bytesperline. Infer tight UYVY packing only
  // when the complete buffer has exactly the expected size; never guess
  // padding.
  if (!stride && bytes == size_t(w) * h * 2)
    stride = size_t(w) * 2;
  return frame_valid(w, h, stride, bytes) ? stride : 0;
}
inline uint16_t rgb565(int y, int u, int v) {
  const int c = std::max(y - 16, 0), d = u - 128, e = v - 128;
  const auto clip = [](int x) { return std::clamp(x, 0, 255); };
  const int r = clip((298 * c + 409 * e + 128) >> 8);
  const int g = clip((298 * c - 100 * d - 208 * e + 128) >> 8);
  const int b = clip((298 * c + 516 * d + 128) >> 8);
  return uint16_t(((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3));
}
// Produce a centered 4:3 crop; each UYVY pair stays
// aligned. Process a row at a time so the caller can yield to audio tasks.
inline void sample_row(const uint8_t *source, unsigned w, unsigned h,
                       size_t stride, unsigned row, uint8_t *uyvy,
                       uint16_t *preview) {
  unsigned cw = std::min(w, h * 4 / 3) & ~1U;
  unsigned ch = std::min(h, w * 3 / 4);
  unsigned y = (h - ch) / 2 + row * ch / PHOTO_HEIGHT;
  unsigned x0 = ((w - cw) / 2) & ~1U;
  for (unsigned x = 0; x < PHOTO_WIDTH; x += 2) {
    unsigned sx = x0 + ((x * cw / PHOTO_WIDTH) & ~1U);
    const uint8_t *p = source + y * stride + sx * 2;
    for (unsigned i = 0; i < 4; ++i)
      uyvy[x * 2 + i] = p[i];
    if (preview) {
      preview[x] = rgb565(p[1], p[0], p[2]);
      preview[x + 1] = rgb565(p[3], p[0], p[2]);
    }
  }
}
} // namespace mosaico
