#include "UsageSummary.hpp"
#include "usage.hpp"
#include <cassert>
#include <string>

static void receive(live_usage::Tracker &tracker, const char *type,
                    const char *json) {
  cJSON *root = cJSON_Parse(json);
  assert(root);
  tracker.receive(type, root);
  cJSON_Delete(root);
}
static void
response(live_usage::Tracker &tracker, const std::string &id,
         const char *type = "response.completed",
         const char *usage = "{\"input_tokens\":100,\"output_tokens\":25,"
                             "\"total_tokens\":125,\"input_tokens_details\":"
                             "{\"cached_tokens\":40}}") {
  const std::string json = "{\"event\":{\"type\":\"" + std::string(type) +
                           "\",\"response\":{\"id\":\"" + id +
                           "\",\"usage\":" + usage + "}}}";
  receive(tracker, "response.event", json.c_str());
}

int main() {
  live_usage::Tracker tracker;
  tracker.reset("configured-live", "configured-backend");
  assert(std::string(tracker.snapshot.frontend_model) == "configured-live");
  assert(std::string(tracker.snapshot.backend_model) == "configured-backend");
  receive(tracker, "session.started",
          "{\"session\":{\"model\":\"served-live\"}}");
  receive(tracker, "response.event",
          "{\"event\":{\"type\":\"response.created\",\"response\":{\"model\":"
          "\"served-backend\"}}}");
  assert(std::string(tracker.snapshot.frontend_model) == "served-live");
  assert(std::string(tracker.snapshot.backend_model) == "served-backend");
  tracker.receive("session.started", nullptr);
  assert(tracker.snapshot.started);
  receive(tracker, "session.usage.updated", "{\"usage\":{\"seconds\":12.4}}");
  receive(tracker, "session.usage.updated", "{\"usage\":{\"seconds\":14.6}}");
  assert(tracker.snapshot.seconds == 14.6); // Replace, never sum snapshots.
  response(tracker, "resp_one");
  response(tracker, "resp_two", "response.incomplete");
  response(tracker, "resp_one"); // Replay after another response.
  assert(tracker.snapshot.responses == 2);
  assert(tracker.snapshot.input_tokens == 200);
  assert(tracker.snapshot.output_tokens == 50);
  assert(tracker.snapshot.total_tokens == 250);
  assert(tracker.snapshot.cached_tokens == 80);
  assert(!tracker.snapshot.tokens_partial);

  // Transport loss does not clear the last valid report; the UI can show it
  // even when no terminal event arrives or Wi-Fi is unavailable.
  char text[384];
  live_usage_view::format(tracker.snapshot, live_usage_view::VOICE, text,
                          sizeof(text));
  assert(!tracker.snapshot.seconds_final);
  assert(std::string(text) == "14.6 s");
  live_usage_view::format(tracker.snapshot, live_usage_view::TOKENS, text,
                          sizeof(text));
  assert(std::string(text) == "250");
  live_usage_view::format(tracker.snapshot, live_usage_view::INPUT, text,
                          sizeof(text));
  assert(std::string(text) == "200");
  live_usage_view::format(tracker.snapshot, live_usage_view::OUTPUT, text,
                          sizeof(text));
  assert(std::string(text) == "50");
  live_usage_view::format(tracker.snapshot, live_usage_view::FRONTEND, text,
                          sizeof(text));
  assert(std::string(text) == "served-live");
  live_usage_view::format(tracker.snapshot, live_usage_view::BACKEND, text,
                          sizeof(text));
  assert(std::string(text) == "served-backend");
  receive(tracker, "session.closed", "{\"usage\":{\"seconds\":15.1}}");
  assert(tracker.snapshot.seconds_final && tracker.snapshot.seconds == 15.1);
  assert(tracker.snapshot.total_tokens == 250);
  receive(tracker, "session.usage.updated", "{\"usage\":{\"seconds\":16}}");
  receive(tracker, "session.closed", "{\"usage\":{\"seconds\":19}}");
  assert(tracker.snapshot.seconds == 15.1); // Terminal report wins.

  tracker.reset();
  assert(!tracker.snapshot.started && !tracker.snapshot.tokens_available);
  assert(!tracker.snapshot.seconds_available &&
         !tracker.snapshot.seconds_final);
  for (unsigned i = 0; i < live_usage_view::ROW_COUNT; ++i) {
    live_usage_view::format(tracker.snapshot,
                            static_cast<live_usage_view::Row>(i), text,
                            sizeof(text));
    const bool model =
        i == live_usage_view::FRONTEND || i == live_usage_view::BACKEND;
    assert(std::string(text) == (model ? "Not reported" : "0"));
  }
  // Missing/malformed final data must not overwrite a usable periodic report.
  receive(tracker, "session.usage.updated", "{\"usage\":{\"seconds\":0}}");
  for (const auto *bad :
       {"{}", "{\"usage\":null}", "{\"usage\":{\"seconds\":-1}}",
        "{\"usage\":{\"seconds\":\"12\"}}", "{\"usage\":{\"seconds\":1e999}}"})
    receive(tracker, "session.closed", bad);
  assert(tracker.snapshot.seconds_available && tracker.snapshot.seconds == 0);
  assert(!tracker.snapshot.seconds_final);
  response(tracker, "resp_one"); // IDs are cleared between sessions too.
  assert(tracker.snapshot.total_tokens == 125);

  // Only terminal Responses events with trustworthy counts are aggregated.
  response(tracker, "resp_active", "response.in_progress");
  response(tracker, "resp_missing", "response.completed", "null");
  response(tracker, "", "response.completed");
  response(tracker, std::string(live_usage::MAX_RESPONSE_ID + 1, 'x'));
  for (const char *bad :
       {"{\"input_tokens\":-1,\"output_tokens\":2,\"total_tokens\":1}",
        "{\"input_tokens\":1.5,\"output_tokens\":2,\"total_tokens\":3.5}",
        "{\"input_tokens\":1e999,\"output_tokens\":2,\"total_tokens\":1e999}",
        "{\"input_tokens\":9007199254740992,\"output_tokens\":0,\"total_"
        "tokens\":9007199254740992}",
        "{\"input_tokens\":\"1\",\"output_tokens\":2,\"total_tokens\":3}",
        "{\"input_tokens\":1,\"output_tokens\":2,\"total_tokens\":9}"})
    response(tracker, "resp_bad", "response.completed", bad);
  assert(tracker.snapshot.responses == 1 &&
         tracker.snapshot.total_tokens == 125);
  assert(tracker.snapshot.tokens_partial);
  response(tracker, "resp_missing"); // A later usable report can be counted.
  assert(tracker.snapshot.responses == 2);
  assert(tracker.snapshot.tokens_partial);

  tracker.reset();
  for (unsigned i = 0; i < live_usage::MAX_RESPONSES + 3; ++i)
    response(tracker, "resp_" + std::to_string(i));
  response(tracker, "resp_0"); // Never evict old IDs and accidentally recount.
  assert(tracker.snapshot.responses == live_usage::MAX_RESPONSES);
  assert(tracker.snapshot.total_tokens == 125 * live_usage::MAX_RESPONSES);
  assert(tracker.snapshot.tokens_partial);

  tracker.reset();
  response(tracker, "resp_large", "response.completed",
           "{\"input_tokens\":4294967296,\"output_tokens\":10,\"total_tokens\":"
           "4294967306}");
  assert(tracker.snapshot.total_tokens == UINT64_C(4294967306));
  live_usage_view::format(tracker.snapshot, live_usage_view::TOKENS, text,
                          sizeof(text));
  assert(std::string(text) == "4294967306");
}
