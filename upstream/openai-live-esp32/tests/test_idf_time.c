#define _POSIX_C_SOURCE 200809L
#include "freertos/FreeRTOS.h"
#include <assert.h>
#include <errno.h>
#include <stdint.h>
#include <time.h>

int live_peer_idf_nanosleep(const struct timespec *, struct timespec *);
static int64_t now;
static unsigned delays;
int64_t esp_timer_get_time(void) { return now; }
void vTaskDelay(TickType_t ticks) {
  assert(ticks > 0 && ticks <= configTICK_RATE_HZ);
  // Emulate the first wake occurring just after a tick boundary, early by
  // almost one tick. The implementation must check the clock and wait again.
  now += (int64_t)ticks * 1000000 / configTICK_RATE_HZ;
  if (!delays++)
    now -= 9999;
}
int main(void) {
  struct timespec request = {0}, remaining = {12, 34};
  assert(live_peer_idf_nanosleep(&request, &remaining) == 0);
  assert(delays == 0 && remaining.tv_sec == 0 && remaining.tv_nsec == 0);
  request.tv_nsec = 1;
  assert(live_peer_idf_nanosleep(&request, NULL) == 0);
  assert(now >= 1);
  now = 0;
  delays = 0;
  request = (struct timespec){2, 123456789};
  assert(live_peer_idf_nanosleep(&request, &remaining) == 0);
  assert(now >= 2123457 && now < 2133457);
  assert(remaining.tv_sec == 0 && remaining.tv_nsec == 0);
  const unsigned before = delays;
  assert(live_peer_idf_nanosleep(NULL, NULL) == -1 && errno == EINVAL);
  request = (struct timespec){-1, 0};
  assert(live_peer_idf_nanosleep(&request, NULL) == -1);
  request = (struct timespec){0, -1};
  assert(live_peer_idf_nanosleep(&request, NULL) == -1);
  request = (struct timespec){0, 1000000000};
  assert(live_peer_idf_nanosleep(&request, NULL) == -1);
  request = (struct timespec){INT64_MAX, 0};
  assert(live_peer_idf_nanosleep(&request, NULL) == -1);
  assert(delays == before);
}
