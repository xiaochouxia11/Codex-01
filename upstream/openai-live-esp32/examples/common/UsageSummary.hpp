#pragma once
#include "live_usage.h"
#include <cmath>
#include <cstdio>

namespace live_usage_view {
enum Row { FRONTEND, VOICE, BACKEND, TOKENS, INPUT, OUTPUT, ROW_COUNT };
constexpr const char *KEYS[] = {"Frontend", "Voice", "Backend",
                                "Tokens",   "Input", "Output"};
inline void format(const live_usage_t &usage, Row row, char *text,
                   size_t size) {
  if (row == FRONTEND || row == BACKEND) {
    const char *model =
        row == FRONTEND ? usage.frontend_model : usage.backend_model;
    snprintf(text, size, "%s", *model ? model : "Not reported");
  } else if (row == VOICE) {
    if (usage.seconds_available)
      snprintf(text, size,
               std::floor(usage.seconds) == usage.seconds ? "%.0f s" : "%.1f s",
               usage.seconds);
    else
      snprintf(text, size, "0");
  } else if (usage.tokens_available) {
    uint64_t count = row == INPUT    ? usage.input_tokens
                     : row == OUTPUT ? usage.output_tokens
                                     : usage.total_tokens;
    snprintf(text, size, "%llu", (unsigned long long)count);
  } else {
    snprintf(text, size, "0");
  }
}
} // namespace live_usage_view
