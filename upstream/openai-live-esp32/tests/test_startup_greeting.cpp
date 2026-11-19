#include "startup_greeting.hpp"
#include <cassert>
#include <cstring>
#include <initializer_list>

int main() {
  using live_voice::StartupGreeting;
  StartupGreeting greeting;
  unsigned sends = 0;
  const auto send = [&](const char *text) {
    assert(!strcmp(text, "Hello."));
    ++sends;
    return LIVE_OK;
  };
  for (auto state :
       {LIVE_NEW, LIVE_SIGNALING, LIVE_WAITING, LIVE_CLOSING, LIVE_CLOSED})
    assert(greeting.poll(state, false, "Hello.", send) == LIVE_OK);
  assert(greeting.poll(LIVE_ACTIVE, true, "Hello.", send) == LIVE_OK);
  assert(greeting.poll(LIVE_ACTIVE, false, nullptr, send) == LIVE_OK);
  assert(greeting.poll(LIVE_ACTIVE, false, "", send) == LIVE_OK);
  assert(sends == 0 && !greeting.attempted);
  assert(greeting.poll(LIVE_ACTIVE, false, "Hello.", send) == LIVE_OK);
  for (unsigned i = 0; i < 100; ++i)
    assert(greeting.poll(LIVE_ACTIVE, false, "Hello.", send) == LIVE_OK);
  assert(sends == 1); // Repeated active polls/events cannot repeat the welcome.
  StartupGreeting reconnected;
  assert(reconnected.poll(LIVE_ACTIVE, false, "Hello.", send) == LIVE_OK);
  assert(sends == 2); // A new connection gets its own welcome.
  StartupGreeting ambiguous;
  const auto failed_send = [&](const char *) {
    ++sends;
    return LIVE_SEND_ERROR;
  };
  assert(ambiguous.poll(LIVE_ACTIVE, false, "Hello.", failed_send) ==
         LIVE_SEND_ERROR);
  assert(ambiguous.poll(LIVE_ACTIVE, false, "Hello.", failed_send) == LIVE_OK);
  assert(sends == 3); // Do not replay a possibly delivered greeting.
}
