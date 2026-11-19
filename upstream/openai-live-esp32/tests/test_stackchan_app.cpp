#include "AppPolicy.hpp"
#include <array>
#include <cassert>
#include <vector>

using namespace stackchan;
int main() {
  for (const bool quiet : {false, true}) {
    std::array<int16_t, 3> data{0, 0, 0};
    unsigned reads = 0;
    const auto read = [&](int16_t *pcm, size_t samples) {
      assert(pcm == data.data() && samples == data.size());
      ++reads;
      pcm[0] = -32768;
      pcm[1] = 0;
      pcm[2] = 32767;
      return -7; // Do not hide input errors, even in quiet mode.
    };
    assert(read_pcm([&] { return quiet; }, data.data(), data.size(), read) ==
           -7);
    assert(reads == 1);
    assert(data[0] == (quiet ? 0 : -32768));
    assert(data[1] == 0);
    assert(data[2] == (quiet ? 0 : 32767));
  }
  assert(read_pcm([] { return true; }, nullptr, 0,
                  [](int16_t *, size_t) { return 0; }) == 0);
  {
    bool quiet = false;
    int16_t sample = 99;
    assert(read_pcm([&] { return quiet; }, &sample, 1,
                    [&](int16_t *, size_t) {
                      quiet = true; // Enable while a hardware read is blocked.
                      return 0;
                    }) == 0);
    assert(sample == 0);
  }
  for (const size_t batch : {0u, 1u, 479u, 480u, 481u, 5761u}) {
    size_t written = 0, calls = 0;
    const auto silent = [&](const int16_t *pcm, size_t n) {
      assert(n > 0 && n <= 480);
      for (size_t i = 0; i < n; ++i)
        assert(pcm[i] == 0);
      written += n;
      ++calls;
      return 0;
    };
    assert(write_pcm(true, nullptr, batch, silent) == 0);
    assert(written == batch && calls == (batch + 479) / 480);
  }
  unsigned writes = 0;
  assert(write_pcm(true, nullptr, 1440, [&](const int16_t *, size_t) {
           return ++writes == 2 ? -7 : 0;
         }) == -7);
  assert(writes == 2); // Stop on the first failed I2S write.
  int16_t source[]{1, -2, 3};
  assert(write_pcm(false, source, 3, [&](const int16_t *pcm, size_t n) {
           assert(pcm == source && n == 3 && pcm[1] == -2);
           return -8;
         }) == -8);

  constexpr int timeout = 17;
  for (const auto outcomes :
       {std::array{0, 0}, std::array{-7, 0}, std::array{timeout, 0},
        std::array{timeout, timeout}, std::array{timeout, -8}}) {
    unsigned attempts = 0;
    std::vector<char> order;
    const int result = retry_capture(
        timeout,
        [&] {
          assert(attempts < 2);
          order.push_back('c');
          return outcomes[attempts++];
        },
        [&] { order.push_back('d'); });
    if (outcomes[0] == timeout) {
      assert(attempts == 2 && result == outcomes[1]);
      assert((order == std::vector<char>{'c', 'd', 'c'}));
    } else {
      assert(attempts == 1 && result == outcomes[0]);
      assert((order == std::vector<char>{'c'}));
    }
  }
}
