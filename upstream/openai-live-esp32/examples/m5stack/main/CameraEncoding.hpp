#pragma once
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <initializer_list>

namespace m5_camera {
constexpr unsigned WIDTH = 320, HEIGHT = 240, FRAME_BYTES = WIDTH * HEIGHT * 2;
// For baseline 4:2:0 JPEG, even 16-bit Huffman codes + 10-bit AC magnitudes,
// worst-case byte stuffing, DC differences, and headers fit below this bound.
// The encoder workspace must not be sized from the much smaller wire budget:
// esp_new_jpeg has been observed writing beyond its declared output capacity.
constexpr size_t JPEG_WORKSPACE_BYTES = WIDTH * HEIGHT * 12 + 4096;

template <class Encode>
bool encode_to_budget(uint8_t *out, size_t capacity, size_t &length,
                      uint8_t *workspace, size_t workspace_capacity,
                      uint8_t &quality, Encode encode) {
  length = 0;
  quality = 0;
  if (!out || !workspace || !capacity ||
      workspace_capacity < JPEG_WORKSPACE_BYTES)
    return false;
  for (uint8_t q : {uint8_t(70), uint8_t(50), uint8_t(35), uint8_t(20)}) {
    const int bytes = encode(q, workspace, workspace_capacity);
    if (bytes < 4 || size_t(bytes) > workspace_capacity)
      return false;
    if (size_t(bytes) > capacity)
      continue;
    if (workspace[0] != 0xff || workspace[1] != 0xd8 ||
        workspace[bytes - 2] != 0xff || workspace[bytes - 1] != 0xd9)
      return false;
    memcpy(out, workspace, size_t(bytes));
    length = size_t(bytes);
    quality = q;
    return true;
  }
  return false;
}

inline bool rgb565_to_native(uint8_t *pixels, size_t bytes) {
  if (!pixels || bytes % 2)
    return false;
  for (size_t i = 0; i < bytes; i += 2) {
    const auto first = pixels[i];
    pixels[i] = pixels[i + 1];
    pixels[i + 1] = first;
  }
  return true;
}
} // namespace m5_camera
