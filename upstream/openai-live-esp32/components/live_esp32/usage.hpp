#pragma once
#include "cJSON.h"
#include "live_usage.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

namespace live_usage {
// Never evict response IDs: a replay must not count twice. Bound memory and
// explicitly mark partial totals if a very long session exceeds this limit.
constexpr size_t MAX_RESPONSES = 128, MAX_RESPONSE_ID = 128;
class Tracker {
public:
  live_usage_t snapshot{};
  void reset(const char *frontend = nullptr, const char *backend = nullptr) {
    snapshot = {};
    response_ids_.clear();
    snprintf(snapshot.frontend_model, sizeof(snapshot.frontend_model), "%s",
             frontend ? frontend : "");
    snprintf(snapshot.backend_model, sizeof(snapshot.backend_model), "%s",
             backend ? backend : "");
  }
  void receive(const char *type, const cJSON *root) {
    if (!strcmp(type, "session.started") || !strcmp(type, "session.closed"))
      model(snapshot.frontend_model, item(root, "session"));
    if (!strcmp(type, "session.started")) {
      snapshot.started = true;
    } else if (!strcmp(type, "session.usage.updated") ||
               !strcmp(type, "session.closed")) {
      if (snapshot.seconds_final)
        return;
      const auto *seconds = item(item(root, "usage"), "seconds");
      if (cJSON_IsNumber(seconds) && std::isfinite(seconds->valuedouble) &&
          seconds->valuedouble >= 0) {
        snapshot.seconds = seconds->valuedouble;
        snapshot.seconds_available = true;
        snapshot.seconds_final = !strcmp(type, "session.closed");
      }
    } else if (!strcmp(type, "response.event")) {
      const auto *event = item(root, "event");
      const auto *response = item(event, "response");
      model(snapshot.backend_model, response);
      const auto *event_type = item(event, "type");
      if (!cJSON_IsString(event_type) ||
          (strcmp(event_type->valuestring, "response.completed") &&
           strcmp(event_type->valuestring, "response.incomplete") &&
           strcmp(event_type->valuestring, "response.failed")))
        return;
      const auto *id = item(response, "id");
      if (!cJSON_IsString(id) || !*id->valuestring ||
          strlen(id->valuestring) > MAX_RESPONSE_ID) {
        snapshot.tokens_partial = true;
        return;
      }
      if (std::find(response_ids_.begin(), response_ids_.end(),
                    id->valuestring) != response_ids_.end())
        return;
      const auto *usage = item(response, "usage");
      uint64_t input, output, total, cached = 0;
      if (response_ids_.size() == MAX_RESPONSES ||
          !count(item(usage, "input_tokens"), input) ||
          !count(item(usage, "output_tokens"), output) ||
          !count(item(usage, "total_tokens"), total) ||
          total != input + output) {
        snapshot.tokens_partial = true;
        return;
      }
      const auto *cached_value =
          item(item(usage, "input_tokens_details"), "cached_tokens");
      if (cached_value && (!count(cached_value, cached) || cached > input)) {
        cached = 0;
        snapshot.tokens_partial = true;
      }
      response_ids_.emplace_back(id->valuestring);
      snapshot.input_tokens += input;
      snapshot.output_tokens += output;
      snapshot.total_tokens += total;
      snapshot.cached_tokens += cached;
      snapshot.responses++;
      snapshot.tokens_available = true;
    }
  }

private:
  std::vector<std::string> response_ids_;
  static const cJSON *item(const cJSON *object, const char *name) {
    return cJSON_GetObjectItemCaseSensitive(object, name);
  }
  template <size_t N> static void model(char (&out)[N], const cJSON *object) {
    const auto *value = item(object, "model");
    if (cJSON_IsString(value) && *value->valuestring)
      snprintf(out, N, "%s", value->valuestring);
  }
  static bool count(const cJSON *value, uint64_t &out) {
    if (!cJSON_IsNumber(value) || !std::isfinite(value->valuedouble) ||
        value->valuedouble < 0 || value->valuedouble > 9007199254740991.0 ||
        std::floor(value->valuedouble) != value->valuedouble)
      return false;
    out = static_cast<uint64_t>(value->valuedouble);
    return true;
  }
};
} // namespace live_usage
