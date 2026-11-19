#include "ScreenMirrorWire.hpp"
#include <cassert>
#include <vector>
using namespace live_mirror;

int main() {
  uint8_t pixels[16]{};
  uint8_t packed[16]{};
  assert(rle(pixels, sizeof(pixels), packed, sizeof(packed)) == 4);
  assert(packed[0] == 8 && packed[1] == 0 && packed[2] == 0 && packed[3] == 0);
  for (unsigned i = 0; i < 16; ++i)
    pixels[i] = i;
  assert(rle(pixels, sizeof(pixels), packed, sizeof(packed)) == 0);
  assert(rle(pixels, sizeof(pixels), packed, 0) == 0);
  const uint8_t golden[] = {0x11, 0, 0x22, 0x33, 0};
  const uint8_t expected[] = {2, 0x11, 3, 0x22, 0x33, 1};
  uint8_t encoded[1100]{};
  assert(cobs(golden, sizeof(golden), encoded) == sizeof(expected));
  assert(!memcmp(encoded, expected, sizeof(expected)));
  for (unsigned size : {0, 1, 253, 254, 255, 508, 800}) {
    for (unsigned pattern : {0, 1, 255}) {
      std::vector<uint8_t> input(size);
      for (unsigned i = 0; i < size; ++i)
        input[i] = pattern == 255 ? i % 256 : pattern;
      size_t n = cobs(input.data(), size, encoded);
      assert(n <= size + size / 254 + 2);
      std::vector<uint8_t> decoded;
      for (size_t i = 0; i < n;) {
        unsigned code = encoded[i++];
        assert(code && i + code - 1 <= n);
        for (unsigned j = 1; j < code; ++j)
          decoded.push_back(encoded[i++]);
        if (code != 255 && i < n)
          decoded.push_back(0);
      }
      assert(input == decoded);
    }
  }
}
