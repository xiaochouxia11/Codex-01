// SPDX-License-Identifier: Apache-2.0
#pragma once
#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <cstring>

namespace stackchan {
// Keep capture timing and errors intact while silencing microphone test input.
template <class Quiet, class Read>
int read_pcm(Quiet quiet, int16_t *pcm, size_t samples, Read read) {
  const int result = read(pcm, samples);
  // A USB command can enable quiet mode while the hardware read is blocked.
  if (quiet() && samples)
    memset(pcm, 0, samples * sizeof(*pcm));
  return result;
}
// Preserve arbitrary decoder batch sizes and I2S timing while silencing a test.
// A decoded packet can contain substantially more than one 20 ms frame.
template <class Write>
int write_pcm(bool quiet, const int16_t *pcm, size_t samples, Write write) {
  if (!quiet)
    return write(pcm, samples);
  static constexpr int16_t silence[480]{};
  while (samples) {
    const auto count = std::min(samples, size_t(480));
    const int result = write(silence, count);
    if (result)
      return result;
    samples -= count;
  }
  return 0;
}
// The board callback tears down the sensor before returning. Retry only a
// transient timeout, once; allocation/configuration failures remain failures.
template <class Capture, class BeforeRetry>
int retry_capture(int timeout, Capture capture, BeforeRetry before_retry) {
  const int result = capture();
  if (result != timeout)
    return result;
  before_retry();
  return capture();
}
} // namespace stackchan
