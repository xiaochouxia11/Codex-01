/* SPDX-FileCopyrightText: 2026 OpenAI
 * SPDX-License-Identifier: Apache-2.0 */
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <errno.h>
#include <stdint.h>
#include <time.h>

/* usrsctp's unused threaded timer path still references nanosleep at link
 * time. ESP-IDF does not supply it. Keep this symbol private to the SCTP
 * target: a launcher may supply a different global POSIX implementation.
 * Our transport continues to use usrsctp_init_nothreads and explicit ticks. */
int live_peer_idf_nanosleep(const struct timespec *request,
                            struct timespec *remaining) {
  const int64_t start = esp_timer_get_time();
  if (!request || request->tv_sec < 0 || request->tv_nsec < 0 ||
      request->tv_nsec >= 1000000000 ||
      request->tv_sec > (INT64_MAX - start - 1000000) / 1000000) {
    errno = EINVAL;
    return -1;
  }
  const int64_t deadline = start + (int64_t)request->tv_sec * 1000000 +
                           (request->tv_nsec + 999) / 1000;
  for (;;) {
    int64_t left = deadline - esp_timer_get_time();
    if (left <= 0)
      break;
    // Bound each delay and round upward. An early tick boundary must not make
    // this function return before the requested monotonic duration.
    if (left > 1000000)
      left = 1000000;
    TickType_t ticks = (left * configTICK_RATE_HZ + 999999) / 1000000;
    vTaskDelay(ticks ? ticks : 1);
  }
  if (remaining)
    *remaining = (struct timespec){0};
  return 0;
}
