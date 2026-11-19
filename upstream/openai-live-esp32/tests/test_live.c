#include "test_live.h"
#include "cJSON.h"
#include "live.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* Synthetic fixtures follow the public Live API event contract. They never call
 * a live service. IDs intentionally have no live_ prefix; the protocol treats
 * them as opaque.
 */
static const char answer[] =
    "{\"session\":{\"id\":\"opaque-42\"},"
    "\"transport\":{\"type\":\"webrtc\",\"sdp\":\"v=0\\r\\nanswer\\r\\n\"}}";
static const char started[] = "{\"type\":\"session.started\",\"session\":{"
                              "\"id\":\"opaque-42\",\"status\":\"active\"}}";
static const char closed[] =
    "{\"type\":\"session.closed\",\"reason\":\"close_requested\","
    "\"session\":{\"id\":\"opaque-42\",\"status\":\"active\"},\"usage\":{"
    "\"seconds\":12.4}}";
static const char offer_sdp[] = "v=0\r\ns=quoted \"offer\"\\test\r\n";

typedef struct {
  live_session_t *session;
  int sends;
  int events;
  int send_status;
  bool check_reentry;
  live_result_t reentry;
  live_result_t destroy_reentry;
  char sent[2048];
  char event[512];
  char type[128];
} fixture_t;

/* Keep large work buffers off the microcontroller task stack. Tests serialize.
 */
static char buffer[LIVE_MAX_JSON_BYTES + 1];
static char sdp_buffer[LIVE_MAX_SDP_BYTES + 1];

#define CHECK(condition)                                                       \
  do {                                                                         \
    if (!(condition)) {                                                        \
      printf("FAIL %s:%d: %s\n", __func__, __LINE__, #condition);              \
      failed = 1;                                                              \
      goto cleanup;                                                            \
    }                                                                          \
  } while (0)

static int send_message(void *context, const char *json, size_t length) {
  fixture_t *f = context;
  ++f->sends;
  if (length >= sizeof(f->sent))
    return -1;
  memcpy(f->sent, json, length);
  f->sent[length] = 0;
  if (f->check_reentry) {
    f->reentry = live_session_close(f->session);
    f->destroy_reentry = live_session_destroy(f->session);
  }
  return f->send_status;
}

static void on_event(void *context, const char *type, const char *json,
                     size_t length) {
  fixture_t *f = context;
  ++f->events;
  snprintf(f->type, sizeof(f->type), "%s", type);
  size_t count = length < sizeof(f->event) - 1 ? length : sizeof(f->event) - 1;
  memcpy(f->event, json, count);
  f->event[count] = 0;
  if (f->check_reentry) {
    f->reentry = live_session_transport_closed(f->session);
    f->destroy_reentry = live_session_destroy(f->session);
  }
}

static live_result_t create(fixture_t *f) {
  live_config_t config = {.model = "fixture-model",
                          .send = send_message,
                          .on_event = on_event,
                          .context = f};
  return live_session_create(&config, &f->session);
}

static live_result_t receive(fixture_t *f, const char *json) {
  return live_session_receive(f->session, json, strlen(json));
}

static int make_waiting(fixture_t *f) {
  return create(f) != LIVE_OK ||
         live_session_offer(f->session, offer_sdp, buffer, sizeof(buffer)) !=
             LIVE_OK ||
         live_session_answer(f->session, 201, answer, strlen(answer),
                             sdp_buffer, sizeof(sdp_buffer)) != LIVE_OK;
}

static const cJSON *get(const cJSON *object, const char *key) {
  return cJSON_GetObjectItemCaseSensitive(object, key);
}

static bool equals(const cJSON *object, const char *key, const char *expected) {
  const cJSON *value = get(object, key);
  return cJSON_IsString(value) && !strcmp(value->valuestring, expected);
}

static int test_configuration_and_offer(void) {
  int failed = 0;
  fixture_t f = {0};
  cJSON *root = NULL;
  char model[] = "fixture-model";
  live_config_t config = {.model = model,
                          .instructions = "A \"quote\"\nline",
                          .voice = "marin",
                          .responses_model = "gpt-6-luna",
                          .send = send_message,
                          .context = &f,
                          .responses_service_tier = "priority",
                          .responses_instructions =
                              "Use web search for current facts.",
                          .responses_web_search = true};
  CHECK(live_session_create(&config, &f.session) == LIVE_OK);
  model[0] = 'X'; // Configuration is copied, not borrowed.
  CHECK(live_session_offer(f.session, offer_sdp, buffer, 2) ==
        LIVE_BUFFER_TOO_SMALL);
  CHECK(live_session_state(f.session) == LIVE_NEW);
  CHECK(live_session_offer(f.session, offer_sdp, buffer, sizeof(buffer)) ==
        LIVE_OK);
  root = cJSON_Parse(buffer);
  CHECK(root && cJSON_GetArraySize(root) == 2);
  const cJSON *session = get(root, "session");
  CHECK(equals(session, "model", "fixture-model"));
  CHECK(equals(session, "instructions", config.instructions));
  CHECK(equals(get(get(session, "audio"), "output"), "voice", "marin"));
  CHECK(equals(get(session, "delegation"), "type", "responses"));
  const cJSON *responses = get(get(session, "delegation"), "responses");
  CHECK(equals(responses, "model", "gpt-6-luna"));
  CHECK(equals(responses, "service_tier", "priority"));
  CHECK(equals(responses, "instructions", config.responses_instructions));
  CHECK(equals(responses, "tool_choice", "auto"));
  CHECK(cJSON_IsArray(get(responses, "tools")));
  CHECK(cJSON_GetArraySize(get(responses, "tools")) == 1);
  CHECK(equals(cJSON_GetArrayItem(get(responses, "tools"), 0), "type",
               "web_search"));
  CHECK(get(session, "service_tier") == NULL && get(session, "tools") == NULL);
  CHECK(equals(get(root, "transport"), "type", "webrtc"));
  CHECK(equals(get(root, "transport"), "sdp", offer_sdp));
  CHECK(live_session_offer(f.session, offer_sdp, buffer, sizeof(buffer)) ==
        LIVE_INVALID_STATE);
cleanup:
  cJSON_Delete(root);
  live_session_destroy(f.session);
  return failed;
}

static int test_invalid_configuration(void) {
  int failed = 0;
  fixture_t f = {0};
  live_config_t config = {.model = "", .send = send_message};
  CHECK(live_session_create(NULL, &f.session) == LIVE_INVALID_ARGUMENT);
  CHECK(live_session_create(&config, &f.session) == LIVE_INVALID_ARGUMENT);
  CHECK(f.session == NULL);
  config.model = "fixture-model";
  config.send = NULL;
  CHECK(live_session_create(&config, &f.session) == LIVE_INVALID_ARGUMENT);
  config.send = send_message;
  memset(buffer, 'a', 128);
  buffer[128] = 0;
  config.model = buffer;
  CHECK(live_session_create(&config, &f.session) == LIVE_INVALID_ARGUMENT);
  config.model = "fixture-model";
  config.responses_web_search = true;
  CHECK(live_session_create(&config, &f.session) == LIVE_INVALID_ARGUMENT);
  config.responses_web_search = false;
  config.responses_service_tier = "priority";
  CHECK(live_session_create(&config, &f.session) == LIVE_INVALID_ARGUMENT);
  config.responses_model = "gpt-6-luna";
  config.responses_service_tier = "";
  CHECK(live_session_create(&config, &f.session) == LIVE_INVALID_ARGUMENT);
  config.responses_service_tier = buffer;
  CHECK(live_session_create(&config, &f.session) == LIVE_INVALID_ARGUMENT);
  config.responses_service_tier = NULL;
  memset(buffer, 'a', 4097);
  buffer[4097] = 0;
  config.responses_instructions = buffer;
  CHECK(live_session_create(&config, &f.session) == LIVE_INVALID_ARGUMENT);
  CHECK(live_session_destroy(NULL) == LIVE_OK);
cleanup:
  live_session_destroy(f.session);
  return failed;
}

static int test_responses_defaults(void) {
  int failed = 0;
  fixture_t f = {0};
  cJSON *root = NULL;
  live_config_t config = {.model = "fixture-model",
                          .responses_model = "fixture-responses",
                          .send = send_message};
  CHECK(live_session_create(&config, &f.session) == LIVE_OK);
  CHECK(live_session_offer(f.session, offer_sdp, buffer, sizeof(buffer)) ==
        LIVE_OK);
  root = cJSON_Parse(buffer);
  CHECK(root);
  const cJSON *responses =
      get(get(get(root, "session"), "delegation"), "responses");
  CHECK(equals(responses, "model", "fixture-responses"));
  CHECK(get(responses, "service_tier") == NULL);
  CHECK(get(responses, "instructions") == NULL);
  CHECK(get(responses, "tools") == NULL);
  CHECK(get(responses, "tool_choice") == NULL);
cleanup:
  cJSON_Delete(root);
  live_session_destroy(f.session);
  return failed;
}

static int test_signaling_errors_and_retry(void) {
  int failed = 0;
  fixture_t f = {0};
  CHECK(create(&f) == LIVE_OK);
  CHECK(live_session_mute(f.session, true) == LIVE_INVALID_STATE);
  CHECK(live_session_offer(f.session, offer_sdp, buffer, sizeof(buffer)) ==
        LIVE_OK);
  CHECK(strstr(buffer, "\"delegation\":{\"type\":\"client\"}") != NULL);
  CHECK(live_session_answer(f.session, 401, "not JSON", 8, sdp_buffer,
                            sizeof(sdp_buffer)) == LIVE_HTTP_ERROR);
  CHECK(live_session_answer(f.session, 200, answer, strlen(answer), sdp_buffer,
                            sizeof(sdp_buffer)) == LIVE_HTTP_ERROR);
  CHECK(live_session_answer(f.session, 201, "{}", 2, sdp_buffer,
                            sizeof(sdp_buffer)) == LIVE_INVALID_JSON);
  CHECK(live_session_answer(f.session, 201, answer, strlen(answer), sdp_buffer,
                            2) == LIVE_BUFFER_TOO_SMALL);
  CHECK(live_session_state(f.session) == LIVE_SIGNALING);
  CHECK(!strcmp(live_session_id(f.session), ""));
  CHECK(live_session_answer(f.session, 201, answer, strlen(answer), sdp_buffer,
                            sizeof(sdp_buffer)) == LIVE_OK);
  CHECK(!strcmp(sdp_buffer, "v=0\r\nanswer\r\n"));
  CHECK(!strcmp(live_session_id(f.session), "opaque-42"));
  CHECK(live_session_state(f.session) == LIVE_WAITING);
  CHECK(live_session_mute(f.session, true) == LIVE_INVALID_STATE);
  CHECK(f.sends == 0); // No session.start is emitted on the WebRTC channel.
cleanup:
  live_session_destroy(f.session);
  return failed;
}

static int test_lifecycle(void) {
  int failed = 0;
  fixture_t f = {0};
  CHECK(!make_waiting(&f));
  CHECK(receive(&f, started) == LIVE_OK);
  CHECK(live_session_state(f.session) == LIVE_ACTIVE);
  CHECK(live_session_mute(f.session, true) == LIVE_OK);
  CHECK(!strcmp(
      f.sent,
      "{\"type\":\"session.input_audio.mute\",\"event_id\":\"sdk_1\"}"));
  CHECK(live_session_mute(f.session, false) == LIVE_OK);
  CHECK(!strcmp(
      f.sent,
      "{\"type\":\"session.input_audio.unmute\",\"event_id\":\"sdk_2\"}"));
  CHECK(live_session_close(f.session) == LIVE_OK);
  CHECK(!strcmp(f.sent, "{\"type\":\"session.close\",\"event_id\":\"sdk_3\"}"));
  CHECK(live_session_state(f.session) == LIVE_CLOSING);
  CHECK(!live_session_finalized(f.session));
  CHECK(live_session_mute(f.session, false) == LIVE_INVALID_STATE);
  CHECK(receive(&f, closed) == LIVE_OK);
  CHECK(live_session_state(f.session) == LIVE_CLOSED);
  CHECK(live_session_finalized(f.session));
  CHECK(!strcmp(f.event, closed)); // Final usage and reason remain available.
  CHECK(live_session_transport_closed(f.session) == LIVE_OK);
  CHECK(live_session_finalized(f.session));
  CHECK(receive(&f, started) == LIVE_INVALID_STATE);
cleanup:
  live_session_destroy(f.session);
  return failed;
}

static int test_forward_compatible_events(void) {
  int failed = 0;
  fixture_t f = {0};
  static const char unknown[] =
      "{\"type\":\"future.event\",\"nested\":{\"delta\":\"a\\nb\"}}";
  static const char error[] = "{\"type\":\"error\",\"error\":{\"code\":\"event_"
                              "not_allowed\",\"client_event_id\":\"sdk_1\"}}";
  CHECK(!make_waiting(&f));
  CHECK(receive(&f, started) == LIVE_OK);
  CHECK(receive(&f, unknown) == LIVE_OK);
  CHECK(!strcmp(f.event, unknown));
  CHECK(!strcmp(f.type, "future.event"));
  CHECK(receive(&f, error) == LIVE_OK);
  CHECK(!strcmp(f.event, error));
  CHECK(live_session_state(f.session) == LIVE_ACTIVE);
  CHECK(!live_session_finalized(f.session));
  CHECK(f.events == 3);
cleanup:
  live_session_destroy(f.session);
  return failed;
}

static int test_invalid_messages(void) {
  int failed = 0;
  fixture_t f = {0};
  const char *invalid[] = {
      "[]",
      "{}",
      "{\"type\":1}",
      "{\"type\":\"x\"}garbage",
      "{\"type\":\"x\"}{\"type\":\"y\"}",
      "{\"type\":\"x\",\"type\":\"y\"}",
      "{\"type\":\"session.started\",\"session\":{\"id\":\"other\"}}",
      "{\"type\":\"session.started\",\"session\":{\"id\":\"opaque-42\",\"id\":"
      "\"other\"}}",
      "{\"type\":\"session.closed\",\"session\":{\"id\":\"opaque-42\"}}",
      "{\"type\":\"session.started\\u0000spoof\",\"session\":{\"id\":\"opaque-"
      "42\"}}",
      "{\"type\":\"bad\nstring\"}",
      "{\"type\":\"unterminated}",
  };
  CHECK(!make_waiting(&f));
  for (size_t i = 0; i < sizeof(invalid) / sizeof(invalid[0]); ++i) {
    CHECK(receive(&f, invalid[i]) == LIVE_INVALID_JSON);
    CHECK(live_session_state(f.session) == LIVE_WAITING);
  }
  char raw_nul[] = {'{', '}', 0, ' '};
  CHECK(live_session_receive(f.session, raw_nul, sizeof(raw_nul)) ==
        LIVE_INVALID_JSON);
  CHECK(live_session_receive(f.session, NULL, 1) == LIVE_INVALID_ARGUMENT);
  CHECK(live_session_receive(f.session, buffer, 0) == LIVE_INVALID_ARGUMENT);
  CHECK(f.events == 0);
  CHECK(receive(&f, "{\"type\":\"valid\",\"escaped\":\"\\\\u0000\"} \n") ==
        LIVE_OK);
cleanup:
  live_session_destroy(f.session);
  return failed;
}

static int test_resource_bounds(void) {
  int failed = 0;
  fixture_t f = {0};
  CHECK(!make_waiting(&f));
  memset(buffer, ' ', sizeof(buffer));
  CHECK(live_session_receive(f.session, buffer, sizeof(buffer)) ==
        LIVE_LIMIT_EXCEEDED);
  const char prefix[] = "{\"type\":\"future\",\"data\":";
  size_t offset = strlen(prefix);
  memcpy(buffer, prefix, offset);
  memset(buffer + offset, '[', 33);
  memset(buffer + offset + 33, ']', 33);
  buffer[offset + 66] = '}';
  CHECK(live_session_receive(f.session, buffer, offset + 67) ==
        LIVE_LIMIT_EXCEEDED);
  CHECK(live_session_state(f.session) == LIVE_WAITING);
  CHECK(f.events == 0);
  // The root object plus 31 arrays reaches, but does not exceed, the limit.
  memset(buffer + offset, '[', 31);
  memset(buffer + offset + 31, ']', 31);
  buffer[offset + 62] = '}';
  CHECK(live_session_receive(f.session, buffer, offset + 63) == LIVE_OK);
  memset(buffer + offset + 63, ' ', LIVE_MAX_JSON_BYTES - offset - 63);
  CHECK(live_session_receive(f.session, buffer, LIVE_MAX_JSON_BYTES) ==
        LIVE_OK);
cleanup:
  live_session_destroy(f.session);
  return failed;
}

static int test_send_failure_and_disconnect(void) {
  int failed = 0;
  fixture_t f = {0};
  CHECK(!make_waiting(&f));
  CHECK(receive(&f, started) == LIVE_OK);
  f.send_status = -1;
  CHECK(live_session_close(f.session) == LIVE_SEND_ERROR);
  CHECK(live_session_state(f.session) == LIVE_ACTIVE);
  f.send_status = 0;
  CHECK(live_session_close(f.session) == LIVE_OK);
  CHECK(live_session_state(f.session) == LIVE_CLOSING);
  CHECK(receive(&f, started) == LIVE_INVALID_STATE);
  CHECK(live_session_transport_closed(f.session) == LIVE_OK);
  CHECK(live_session_state(f.session) == LIVE_CLOSED);
  CHECK(!live_session_finalized(f.session));
cleanup:
  live_session_destroy(f.session);
  return failed;
}

static int test_server_initiated_close(void) {
  int failed = 0;
  fixture_t f = {0};
  CHECK(!make_waiting(&f));
  CHECK(receive(&f, closed) == LIVE_OK);
  CHECK(live_session_finalized(f.session));
  CHECK(live_session_state(f.session) == LIVE_CLOSED);
  CHECK(f.sends == 0);
cleanup:
  live_session_destroy(f.session);
  return failed;
}

static int test_callback_reentry(void) {
  int failed = 0;
  fixture_t f = {0};
  CHECK(!make_waiting(&f));
  f.check_reentry = true;
  CHECK(receive(&f, started) == LIVE_OK);
  CHECK(f.reentry == LIVE_BUSY && f.destroy_reentry == LIVE_BUSY);
  CHECK(live_session_state(f.session) == LIVE_ACTIVE);
  CHECK(live_session_mute(f.session, true) == LIVE_OK);
  CHECK(f.reentry == LIVE_BUSY && f.destroy_reentry == LIVE_BUSY);
  CHECK(live_session_state(f.session) == LIVE_ACTIVE);
cleanup:
  live_session_destroy(f.session);
  return failed;
}

static int test_commentary(void) {
  int failed = 0;
  fixture_t f = {0};
  cJSON *root = NULL;
  char maximum[LIVE_MAX_COMMENTARY_BYTES + 1];
  char oversized[LIVE_MAX_COMMENTARY_BYTES + 2];
  const char text[] = "Hey. A \"quiet\" moment.\nWhere shall we wander?";
  CHECK(live_session_commentary(NULL, text) == LIVE_INVALID_ARGUMENT);
  CHECK(!make_waiting(&f));
  CHECK(live_session_commentary(f.session, text) == LIVE_INVALID_STATE);
  CHECK(f.sends == 0);
  CHECK(receive(&f, started) == LIVE_OK);
  CHECK(live_session_commentary(f.session, NULL) == LIVE_INVALID_ARGUMENT);
  CHECK(live_session_commentary(f.session, "") == LIVE_INVALID_ARGUMENT);
  memset(oversized, 'x', sizeof(oversized) - 1);
  oversized[sizeof(oversized) - 1] = 0;
  CHECK(live_session_commentary(f.session, oversized) == LIVE_LIMIT_EXCEEDED);
  CHECK(f.sends == 0);
  f.check_reentry = true;
  CHECK(live_session_commentary(f.session, text) == LIVE_OK);
  CHECK(f.reentry == LIVE_BUSY && f.destroy_reentry == LIVE_BUSY);
  root = cJSON_Parse(f.sent);
  CHECK(root && cJSON_GetArraySize(root) == 4);
  CHECK(equals(root, "type", "session.commentary.append"));
  CHECK(equals(root, "content", text));
  CHECK(equals(root, "event_id", "sdk_1"));
  CHECK(cJSON_IsNull(get(root, "delegation_id")));
  cJSON_Delete(root);
  root = NULL;
  memset(maximum, '\x01', sizeof(maximum) - 1); // Six-byte JSON escapes.
  maximum[sizeof(maximum) - 1] = 0;
  CHECK(live_session_commentary(f.session, maximum) == LIVE_OK);
  root = cJSON_Parse(f.sent);
  CHECK(root && equals(root, "content", maximum));
  CHECK(equals(root, "event_id", "sdk_2"));
  CHECK(live_session_state(f.session) == LIVE_ACTIVE);
  f.send_status = -1;
  CHECK(live_session_commentary(f.session, text) == LIVE_SEND_ERROR);
  CHECK(live_session_state(f.session) == LIVE_ACTIVE);
  f.send_status = 0;
  CHECK(live_session_close(f.session) == LIVE_OK);
  CHECK(live_session_commentary(f.session, text) == LIVE_INVALID_STATE);
  CHECK(live_session_transport_closed(f.session) == LIVE_OK);
  CHECK(live_session_commentary(f.session, text) == LIVE_INVALID_STATE);
cleanup:
  cJSON_Delete(root);
  live_session_destroy(f.session);
  return failed;
}

int live_run_tests(bool verbose) {
  const struct {
    const char *name;
    int (*run)(void);
  } tests[] = {
      {"configuration and offer", test_configuration_and_offer},
      {"invalid configuration", test_invalid_configuration},
      {"optional Responses settings", test_responses_defaults},
      {"signaling errors and retry", test_signaling_errors_and_retry},
      {"lifecycle and graceful close", test_lifecycle},
      {"forward compatible events", test_forward_compatible_events},
      {"invalid messages", test_invalid_messages},
      {"resource bounds", test_resource_bounds},
      {"send failure and disconnect", test_send_failure_and_disconnect},
      {"server initiated close", test_server_initiated_close},
      {"callback reentry", test_callback_reentry},
      {"frontend commentary", test_commentary},
  };
  int failed = 0;
  for (size_t i = 0; i < sizeof(tests) / sizeof(tests[0]); ++i) {
    int result = tests[i].run();
    failed += result;
    if (verbose)
      printf("%s: %s\n", result ? "FAIL" : "PASS", tests[i].name);
  }
  return failed;
}
