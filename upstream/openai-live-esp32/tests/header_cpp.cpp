// Compile and link the public C ABI from C++ without a separate wrapper.
#include "live.h"
extern "C" bool live_header_cpp_check(void) {
  return live_session_state(nullptr) == LIVE_CLOSED;
}
