#ifndef LIVE_USAGE_H
#define LIVE_USAGE_H
#include <stdbool.h>
#include <stdint.h>

/* Retained until the next session or audio diagnostic (not across reboot).
 * Live reports seconds, not frontend tokens. Backend counters sum distinct
 * delegated Responses terminal events received on this connection. */
typedef struct {
  bool started;
  bool seconds_available, seconds_final;
  bool tokens_available, tokens_partial;
  double seconds;
  uint64_t input_tokens, output_tokens, total_tokens, cached_tokens;
  uint32_t responses;
  /* Configured names until a server event supplies the served model. */
  char frontend_model[128], backend_model[128];
} live_usage_t;
#endif
