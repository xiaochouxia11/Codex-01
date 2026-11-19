#include "CameraPixels.hpp"
#include "ToolPolicy.hpp"
#include <cassert>
#include <climits>
#include <limits>
#include <string>
#include <vector>

int main() {
  using namespace mosaico;
  LightOverride lights;
  assert(!lights.active(0, false));
  lights.start(2000000, false); // Idle USB effects survive housekeeping.
  assert(lights.active(50000, false));
  assert(lights.active(1999999, false));
  assert(!lights.active(2000000, false));
  lights.start(5000000, true);
  assert(lights.active(3000000, true));
  assert(!lights.active(3000001, false)); // Stop cancels a session effect.
  assert(!lights.active(3000002, true));  // Reconnect cannot revive it.
  lights.start(6000000, false);           // A new idle command is independent.
  assert(lights.active(4000000, false));
  lights.start(4100000, false); // A replacement uses its own expiry.
  assert(lights.active(4099999, false));
  assert(!lights.active(4100000, false));
  ButtonEdge button;
  assert(!button.update(true, 0)); // A held button at boot cannot start audio.
  assert(!button.update(true, 100000));
  assert(!button.update(false, 110000));
  assert(!button.update(false, 180000));
  assert(!button.update(true, 200000));
  assert(!button.update(false, 210000)); // Bounce never becomes a press.
  assert(!button.update(true, 220000));
  assert(!button.update(true, 270000));
  assert(button.update(true, 280000));
  assert(!button.update(true, 400000)); // No repeat while held.
  assert(!button.update(false, 410000));
  assert(!button.update(false, 480000));
  assert(!button.update(true, 500000));
  assert(button.update(true, 560000));
  assert(!parse_arguments(nullptr));
  for (const char *json : {"{\"x\":{}}", "{\"x\":[]}", "[[[[]]]]", "{} junk",
                           "}\"x\"", "{", "{\"x\":\"unterminated"})
    assert(!parse_arguments(json));
  assert(!parse_arguments(std::string(513, ' ').c_str()));
  assert(!parse_arguments(
      (std::string(256, '[') + std::string(256, ']')).c_str()));
  auto *flat = parse_arguments(R"({"x":"{[\"quoted\"]}"})");
  assert(flat && cJSON_IsString(cJSON_GetObjectItem(flat, "x")));
  cJSON_Delete(flat);
  assert(frame_stride(1280, 720, 0, 1280 * 720 * 2) == 2560);
  assert(!frame_stride(1280, 720, 0, 1280 * 720 * 2 - 1));
  assert(!frame_stride(1280, 720, 0, 1280 * 720 * 2 + 64));
  assert(!frame_stride(UINT_MAX, UINT_MAX, 0, SIZE_MAX));
  assert(frame_stride(320, 240, 672, 672 * 240) == 672);
  assert(frame_valid(1280, 720, 2560, 1280 * 720 * 2));
  assert(!frame_valid(1280, 720, 2560, 1280 * 720 * 2 - 1));
  assert(!frame_valid(1280, 720, 100, 2000000));
  assert(!frame_valid(1279, 720, 2560, 2000000));
  assert(!frame_valid(1280, 0, 2560, 2000000));
  assert(
      !frame_valid(4096, 4096, std::numeric_limits<size_t>::max(), SIZE_MAX));
  assert(rgb565(16, 128, 128) == 0);
  assert(rgb565(235, 128, 128) == 0xffff);
  assert((rgb565(81, 90, 240) & 0xf800) == 0xf800);
  // Every odd pixel is white, every even pixel black, with sentinel row
  // padding. Downscaling must preserve chroma pairs, never sample the padding,
  // and stay inside both the source allocation and destination canaries
  // (ASan/UBSan).
  for (const auto &dimensions : {std::pair{1280U, 720U}, std::pair{1024U, 768U},
                                 std::pair{2U, 1U}, std::pair{320U, 240U}}) {
    const auto [w, h] = dimensions;
    const size_t stride = w * 2 + 16;
    std::vector<uint8_t> source(stride * h, 0xa5),
        row(PHOTO_WIDTH * 2 + 2, 0xa5);
    std::vector<uint16_t> preview(PHOTO_WIDTH + 2, 0xa5a5);
    for (unsigned y = 0; y < h; ++y)
      for (unsigned x = 0; x < w; x += 2) {
        auto *p = source.data() + stride * y + x * 2;
        p[0] = p[2] = 128;
        p[1] = 16;
        p[3] = 235;
      }
    for (unsigned y = 0; y < PHOTO_HEIGHT; ++y) {
      sample_row(source.data(), w, h, stride, y, row.data() + 1,
                 preview.data() + 1);
      assert(row.front() == 0xa5 && row.back() == 0xa5);
      assert(preview.front() == 0xa5a5 && preview.back() == 0xa5a5);
      for (unsigned x = 0; x < PHOTO_WIDTH; ++x)
        assert(preview[x + 1] == (x % 2 ? 0xffff : 0));
    }
  }
  const char *names[]{"address", "command"};
  for (const char *json :
       {"[]", "null", "{}", "{\"address\":1}", "{\"address\":1,\"address\":2}",
        "{\"address\":1,\"command\":2,\"extra\":0}"}) {
    auto *obj = cJSON_Parse(json);
    assert(!keys(obj, names, 2));
    cJSON_Delete(obj);
  }
  for (const char *json :
       {"{\"address\":-1}", "{\"address\":256}", "{\"address\":1.5}",
        "{\"address\":1e999}", "{\"address\":\"1\"}", "{\"address\":true}"}) {
    auto *obj = cJSON_Parse(json);
    int value = 7;
    assert(!integer(obj, "address", 0, 255, value));
    assert(value == 7);
    cJSON_Delete(obj);
  }
  auto *obj = cJSON_Parse("{\"address\":0,\"command\":255}");
  int value = -1;
  assert(keys(obj, names, 2));
  assert(integer(obj, "address", 0, 255, value) && value == 0);
  assert(integer(obj, "command", 0, 255, value) && value == 255);
  cJSON_Delete(obj);
}
