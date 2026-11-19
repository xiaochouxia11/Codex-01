#include "test_live.h"
#include <stdio.h>

extern bool live_header_cpp_check(void);

int main(void) {
  int failed = live_run_tests(true) + !live_header_cpp_check();
  puts(failed ? "LIVE_TESTS_FAIL" : "LIVE_TESTS_PASS");
  return failed ? 1 : 0;
}
