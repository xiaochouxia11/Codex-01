#pragma once
#include <cstddef>
#include <cstdint>
namespace cinema {
void storage_init(); // Never formats the card or erases existing directories.
bool storage_available();
enum class ReadResult { ok, unavailable, cancelled, retry };
// Retry bus acquisition, not file validation. Callers retain their current
// offset; exhausting the wait budget must never classify a file as corrupt.
template <class Attempt, class Cancelled, class Clock, class Wait>
ReadResult retry_card_access(Attempt attempt, Cancelled cancelled, Clock now,
                             Wait wait) {
  const auto deadline = now() + 2000000;
  for (;;) {
    if (cancelled())
      return ReadResult::cancelled;
    if (attempt())
      return ReadResult::ok;
    if (now() >= deadline)
      return ReadResult::retry;
    wait();
  }
}
unsigned storage_contention();
void storage_diagnostics();
ReadResult storage_read(unsigned id, uint8_t *output, size_t bytes,
                        bool (*cancelled)());
bool storage_command(
    const char *line); // USB-only, while Live and cinema are idle.
} // namespace cinema
