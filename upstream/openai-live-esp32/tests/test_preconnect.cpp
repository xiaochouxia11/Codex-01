#include "preconnect.hpp"
#include <cassert>

struct FakeTls {
  bool allocated = false, alive = true, allocate_ok = true;
  int progress = 0, begins = 0, closes = 0;
  bool begin() {
    assert(!allocated);
    ++begins;
    return allocated = allocate_ok;
  }
  int poll() {
    assert(allocated);
    return progress;
  }
  bool healthy() { return alive; }
  void close() {
    if (allocated)
      ++closes;
    allocated = false;
  }
  int release() {
    assert(allocated);
    allocated = false;
    return 1;
  }
};
using Cache = live_https::Preconnect<FakeTls>;
using State = Cache::State;

int main() {
  // Hardware regression: a 14-second-old idle TLS connection passed the
  // health probe, then closed during POST. A healthy probe alone must not
  // allow reuse that close to the observed upstream idle timeout.
  Cache aged;
  aged.transport.progress = 1;
  aged.idle(0, 1, true);
  aged.validate(14000, 1, true);
  assert(aged.take() == 0 && aged.transport.closes == 1);

  Cache c;
  c.idle(0, 1, false);
  c.idle(0, 2, true); // No IP: never open a socket.
  assert(c.transport.begins == 0);
  c.idle(10, 3, true);
  assert(c.state == State::Connecting);
  assert(c.take() == 0); // Start must not consume unfinished TLS.
  c.advance(20);
  assert(c.transport.begins == 1); // Early Start joins the same attempt.
  c.transport.progress = 1;
  c.advance(30);
  assert(c.state == State::Ready);
  c.validate(40, 3, true);
  assert(c.take() == 1);
  assert(c.take() == 0); // Ownership transfers exactly once.
  assert(!c.transport.allocated && c.transport.closes == 0);

  c.idle(50, 3, true);
  c.validate(60, 7, true); // Missed loss/reacquisition, same availability bit.
  assert(c.state == State::Empty && c.transport.closes == 1);
  c.transport.progress = 0;
  c.idle(70, 7, true);
  c.validate(80, 8, true); // Loss during handshake.
  assert(c.state == State::Empty && c.transport.closes == 2);
  c.idle(90, 9, true);
  c.validate(100, 9, false); // App closes mid-handshake.
  assert(c.state == State::Empty && c.transport.closes == 3);

  c.transport.progress = 1;
  c.idle(110, 9, true);
  c.validate(110 + Cache::MAX_AGE_MS - 1, 9, true);
  assert(c.state == State::Ready);
  c.validate(110 + Cache::MAX_AGE_MS, 9, true);
  assert(c.state == State::Empty && c.transport.closes == 4);
  c.idle(50000, 9, true);
  c.transport.alive = false; // Peer closes an idle connection early.
  c.validate(50001, 9, true);
  assert(c.take() == 0 && c.transport.closes == 5);

  c.transport.alive = true;
  c.transport.progress = -1;
  c.idle(60000, 9, true);
  const int failed_begins = c.transport.begins;
  c.idle(60001, 9, true);
  assert(c.state == State::Empty && c.transport.begins == failed_begins);
  c.transport.progress = 0;
  c.idle(60000 + Cache::RETRY_MS, 9, true);
  assert(c.state == State::Connecting);
  c.advance(60000 + Cache::RETRY_MS + Cache::TIMEOUT_MS);
  assert(c.state == State::Empty && !c.transport.allocated);
  c.idle(95001, 9, true);
  assert(c.transport.begins == failed_begins + 1); // Timeout also backs off.
  c.idle(95002, 11, true); // New network bypasses previous network's backoff.
  assert(c.transport.begins == failed_begins + 2);
  c.clear();
  c.transport.allocate_ok = false;
  c.idle(100000, 11, true);
  assert(c.state == State::Empty && !c.transport.allocated);
  const int allocation_begins = c.transport.begins;
  c.idle(100001, 11, true);
  assert(c.transport.begins == allocation_begins);
}
