#include "CameraEncoding.hpp"
#include <array>
#include <cassert>
#include <vector>

int main() {
  using namespace m5_camera;
  std::vector<uint8_t> workspace(JPEG_WORKSPACE_BYTES);
  std::array<uint8_t, 10242> target;
  target.fill(0xa5);
  size_t length = 99;
  uint8_t quality = 99;
  unsigned calls = 0;
  auto encoder = [&](uint8_t q, uint8_t *out, size_t capacity) {
    assert(capacity == JPEG_WORKSPACE_BYTES && out == workspace.data());
    ++calls;
    // Simulate a codec that emits more than the wire limit at high quality.
    const int size = q == 70 ? 22000 : 9000;
    memset(out, 0x33, size);
    out[0] = 0xff;
    out[1] = 0xd8;
    out[size - 2] = 0xff;
    out[size - 1] = 0xd9;
    return size;
  };
  assert(encode_to_budget(target.data() + 1, 10240, length, workspace.data(),
                          workspace.size(), quality, encoder));
  assert(length == 9000 && quality == 50 && calls == 2);
  assert(target.front() == 0xa5 && target.back() == 0xa5 &&
         target[9001] == 0xa5);
  target.fill(0xa5);
  assert(!encode_to_budget(target.data() + 1, 100, length, workspace.data(),
                           workspace.size(), quality, encoder));
  assert(length == 0 && quality == 0);
  for (auto byte : target)
    assert(byte == 0xa5);
  assert(!encode_to_budget(target.data(), 100, length, workspace.data(), 10240,
                           quality, encoder));
  for (int result : {-1, 0, int(JPEG_WORKSPACE_BYTES + 1)}) {
    assert(!encode_to_budget(
        target.data(), 10240, length, workspace.data(), workspace.size(),
        quality, [=](uint8_t, uint8_t *, size_t) { return result; }));
    assert(!length);
  }
  uint8_t pixels[] = {0xf8, 0x00, 0x07, 0xe0, 0x00, 0x1f};
  const uint8_t expected[] = {0x00, 0xf8, 0xe0, 0x07, 0x1f, 0x00};
  assert(rgb565_to_native(pixels, sizeof(pixels)));
  assert(!memcmp(pixels, expected, sizeof(pixels)));
  assert(!rgb565_to_native(pixels, 3));
  assert(!memcmp(pixels, expected, sizeof(pixels)));
}
