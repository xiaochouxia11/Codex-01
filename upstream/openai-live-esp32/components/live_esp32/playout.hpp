#pragma once
#include <cstddef>
#include <cstdint>
#include <cstring>

namespace live_audio {
// A bounded PCM reserve before starting/restarting hardware playback. Measure
// actual decoded samples: Opus packets need not all contain 20 ms of audio.
class Prebuffer {
public:
  static constexpr size_t RATE = 24000;
  static constexpr unsigned DELAY_MS = 120;
  static constexpr unsigned MAX_DELAY_MS = 300;
  static constexpr size_t TARGET = RATE * DELAY_MS / 1000;
  static constexpr size_t MAX_PACKET = RATE * 120 / 1000;
  static constexpr size_t CAPACITY = TARGET + MAX_PACKET;
  int16_t pcm[RATE * MAX_DELAY_MS / 1000 + MAX_PACKET];
  size_t size = 0;

  explicit Prebuffer(unsigned delay_ms = DELAY_MS)
      : delay_ms_(valid_delay(delay_ms) ? delay_ms : DELAY_MS) {}
  static constexpr bool valid_delay(unsigned ms) {
    return ms >= 20 && ms <= MAX_DELAY_MS;
  }
  unsigned delay_ms() const { return delay_ms_; }
  size_t target() const { return RATE * delay_ms_ / 1000; }
  size_t capacity() const { return target() + MAX_PACKET; }

  bool append(const int16_t *input, size_t samples, uint32_t now_ms) {
    if (!input || !samples || samples > MAX_PACKET || size > capacity() ||
        samples > capacity() - size)
      return false;
    if (!size)
      started_ = now_ms;
    std::memcpy(pcm + size, input, samples * sizeof(int16_t));
    size += samples;
    return true;
  }
  bool ready(uint32_t now_ms, bool enabled) const {
    return size && (!enabled || size >= target() ||
                    uint32_t(now_ms - started_) >= delay_ms_);
  }
  void clear() { size = 0; }

private:
  uint32_t started_ = 0;
  unsigned delay_ms_;
};
} // namespace live_audio
