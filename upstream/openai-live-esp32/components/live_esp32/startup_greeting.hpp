#pragma once
#include "live.h"

namespace live_voice {
// One instance per connection, polled by the controller after event callbacks.
struct StartupGreeting {
  bool attempted = false;
  template <typename Send>
  live_result_t poll(live_state_t state, bool stopping, const char *text,
                     Send send) {
    if (attempted || !text || !*text || stopping || state != LIVE_ACTIVE)
      return LIVE_OK;
    // A send failure may be ambiguous; never retry and risk speaking twice.
    attempted = true;
    return send(text);
  }
};
} // namespace live_voice
