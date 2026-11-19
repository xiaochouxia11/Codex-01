#include "photo_tool.hpp"
#include <cassert>
#include <string>
#include <vector>

using namespace live_photo;

struct Transport {
  live_session_t *session = nullptr;
  std::string sent;
  int sends = 0, result = 0;
  bool reenter = false;
  static int send(void *context, const char *json, size_t length) {
    auto &t = *static_cast<Transport *>(context);
    ++t.sends;
    t.sent.assign(json, length);
    if (t.reenter) {
      assert(live_session_response_create(t.session) == LIVE_BUSY);
      assert(live_session_response_item(t.session, "{}", 2) == LIVE_BUSY);
      assert(live_session_destroy(t.session) == LIVE_BUSY);
    }
    return t.result;
  }
  ~Transport() { live_session_destroy(session); }
};

static void protocol() {
  Transport t;
  live_config_t cfg{};
  cfg.model = "fixture-voice";
  cfg.responses_model = "fixture-backend";
  cfg.responses_web_search = true;
  cfg.responses_tools_json = TOOL_JSON;
  cfg.send = Transport::send;
  cfg.context = &t;
  assert(live_session_create(&cfg, &t.session) == LIVE_OK);
  assert(live_session_response_create(t.session) == LIVE_INVALID_STATE);
  char offer[LIVE_MAX_JSON_BYTES];
  assert(live_session_offer(t.session, "v=0\r\n", offer, sizeof(offer)) ==
         LIVE_OK);
  cJSON *json = cJSON_Parse(offer);
  auto get = [](const cJSON *o, const char *k) {
    return cJSON_GetObjectItemCaseSensitive(o, k);
  };
  const cJSON *responses =
      get(get(get(json, "session"), "delegation"), "responses");
  const cJSON *tools = get(responses, "tools");
  assert(cJSON_GetArraySize(tools) == 2);
  assert(!strcmp(get(cJSON_GetArrayItem(tools, 0), "name")->valuestring,
                 "capture_photo"));
  assert(!strcmp(get(cJSON_GetArrayItem(tools, 1), "type")->valuestring,
                 "web_search"));
  assert(cJSON_IsFalse(get(responses, "parallel_tool_calls")));
  cJSON_Delete(json);
  constexpr char answer[] =
      "{\"session\":{\"id\":\"fixture-session\"},\"transport\":{\"type\":"
      "\"webrtc\",\"sdp\":\"v=0\\r\\n\"}}";
  constexpr char started[] =
      "{\"type\":\"session.started\",\"session\":{\"id\":\"fixture-session\"}}";
  assert(live_session_answer(t.session, 201, answer, strlen(answer), offer,
                             sizeof(offer)) == LIVE_OK);
  assert(live_session_receive(t.session, started, strlen(started)) == LIVE_OK);
  std::vector<uint8_t> jpeg(MAX_JPEG_BYTES, 0);
  jpeg[0] = 0xff;
  jpeg[1] = 0xd8;
  jpeg[jpeg.size() - 2] = 0xff;
  jpeg.back() = 0xd9;
  auto bytes = output("tool-call", jpeg.data(), jpeg.size(), 1234, nullptr,
                      offer, sizeof(offer));
  assert(bytes);
  t.reenter = true;
  assert(live_session_response_item(t.session, offer, bytes) == LIVE_OK);
  assert(t.sent.size() < LIVE_MAX_JSON_BYTES);
  json = cJSON_Parse(t.sent.c_str());
  assert(json &&
         !strcmp(get(json, "type")->valuestring, "response.item.create"));
  assert(!strcmp(get(get(json, "item"), "call_id")->valuestring, "tool-call"));
  cJSON_Delete(json);
  assert(live_session_response_create(t.session) == LIVE_OK);
  assert(t.sent.find("response.create") != std::string::npos);
  for (auto *bad :
       {"[]", "{}", "{\"type\":\"message\"} trailing",
        "{\"type\":\"x\",\"type\":\"y\"}", "{\"type\":\"x\\u0000y\"}"}) {
    int sends = t.sends;
    assert(live_session_response_item(t.session, bad, strlen(bad)) ==
           LIVE_INVALID_JSON);
    assert(t.sends == sends);
  }
  std::string huge =
      "{\"type\":\"message\",\"content\":\"" + std::string(16340, 'a') + "\"}";
  assert(huge.size() < LIVE_MAX_JSON_BYTES);
  assert(live_session_response_item(t.session, huge.data(), huge.size()) ==
         LIVE_LIMIT_EXCEEDED);
  t.result = -1;
  assert(live_session_response_item(t.session, offer, bytes) ==
         LIVE_SEND_ERROR);
  assert(live_session_response_create(t.session) == LIVE_SEND_ERROR);
  t.result = 0;
  assert(live_session_close(t.session) == LIVE_OK);
  assert(live_session_response_item(t.session, offer, bytes) ==
         LIVE_INVALID_STATE);
  assert(live_session_response_create(t.session) == LIVE_INVALID_STATE);
  assert(live_session_destroy(t.session) == LIVE_OK);
  t.session = nullptr;
  for (auto *bad :
       {"[]", "{}", "null", "[{}]", "[{\"type\":\"web_search\"}]",
        "[{\"type\":\"function\",\"name\":\"x\"}]",
        "[{\"type\":\"function\",\"name\":\"x\",\"parameters\":{}},{\"type\":"
        "\"function\",\"name\":\"x\",\"parameters\":{}}]"}) {
    cfg.responses_tools_json = bad;
    assert(live_session_create(&cfg, &t.session) == LIVE_INVALID_ARGUMENT &&
           !t.session);
  }
  cfg.responses_model = nullptr;
  cfg.responses_web_search = false;
  cfg.responses_tools_json = TOOL_JSON;
  assert(live_session_create(&cfg, &t.session) == LIVE_INVALID_ARGUMENT);
  cfg.responses_tools_json = nullptr;
  assert(live_session_create(&cfg, &t.session) == LIVE_OK);
  assert(live_session_response_create(t.session) == LIVE_INVALID_STATE);
}

int main() {
  protocol();
  assert(empty_arguments("{}"));
  assert(empty_arguments(" \n{ \t }\r"));
  for (auto *s : {"", "{", "null", "[]", "{}x", "{}{}", "{\"x\":1}"})
    assert(!empty_arguments(s));
  assert(!empty_arguments(nullptr));
  assert(!empty_arguments(std::string(129, ' ').c_str()));

  Batch batch;
  assert(batch.set_delegation("delegation-1"));
  assert(batch.matches("delegation-1") && !batch.matches("delegation-2"));
  assert(!batch.begin(""));
  assert(batch.begin("response-1"));
  auto generation = batch.generation;
  assert(batch.add("a", nullptr) == Added::accepted);
  assert(batch.add("a", nullptr) == Added::duplicate);
  assert(batch.begin("response-1") && batch.generation == generation &&
         batch.count == 1);
  batch.next()->started = true;
  assert(!batch.next() && !batch.ready());
  assert(batch.submitted("a") && !batch.ready());
  // A second call can arrive after the first result, before completion.
  assert(batch.add("b", "error") == Added::accepted);
  assert(!batch.complete("wrong"));
  assert(batch.complete("response-1") && !batch.ready());
  assert(batch.next() && !strcmp(batch.next()->id, "b"));
  assert(batch.submitted("b") && batch.ready());
  batch.continued = true;
  assert(!batch.ready());
  assert(batch.add("b", nullptr) == Added::duplicate);
  assert(batch.add("late", nullptr) == Added::invalid);
  assert(batch.begin("response-2") && batch.generation != generation);
  assert(batch.matches("delegation-1"));
  generation = batch.generation;
  batch.cancel();
  assert(batch.cancelled && batch.generation != generation && !batch.ready());
  assert(batch.begin("response-2") && batch.cancelled);
  assert(batch.begin("response-2-next") && !batch.cancelled);
  // Cancellation/new session invalidates in-flight results and continuation.
  generation = batch.generation;
  batch.clear();
  assert(batch.generation != generation && !batch.ready() && !batch.next());
  assert(!batch.matches("delegation-1"));
  assert(batch.set_delegation("delegation-2"));
  assert(batch.add("orphan", nullptr) == Added::invalid);
  assert(batch.begin("response-3"));
  assert(batch.add(std::string(65, 'a').c_str(), nullptr) == Added::invalid);
  for (size_t i = 0; i < MAX_CALLS; ++i)
    assert(batch.add(std::to_string(i).c_str(), nullptr) == Added::accepted);
  assert(batch.add("overflow", nullptr) == Added::full);

  char out[LIVE_MAX_JSON_BYTES];
  for (size_t bytes : {size_t(4), size_t(5), size_t(6), MAX_JPEG_BYTES}) {
    std::vector<uint8_t> jpeg(bytes, 0);
    jpeg[0] = 0xff;
    jpeg[1] = 0xd8;
    jpeg[bytes - 2] = 0xff;
    jpeg[bytes - 1] = 0xd9;
    size_t length = output("call_\"\\test", jpeg.data(), bytes, 123, nullptr,
                           out, sizeof(out));
    assert(length && length + 128 < LIVE_MAX_JSON_BYTES);
    cJSON *root = cJSON_Parse(out);
    assert(root);
    assert(!strcmp(cJSON_GetObjectItem(root, "call_id")->valuestring,
                   "call_\"\\test"));
    cJSON *parts = cJSON_GetObjectItem(root, "output");
    assert(cJSON_IsArray(parts) && cJSON_GetArraySize(parts) == 2);
    cJSON *image = cJSON_GetArrayItem(parts, 1);
    const char *url = cJSON_GetObjectItem(image, "image_url")->valuestring;
    constexpr char prefix[] = "data:image/jpeg;base64,";
    assert(!strncmp(url, prefix, strlen(prefix)));
    assert(strlen(url) == strlen(prefix) + ((bytes + 2) / 3) * 4);
    if (bytes == 4)
      assert(!strcmp(url + strlen(prefix), "/9j/2Q=="));
    cJSON_Delete(root);
    assert(!output("c", jpeg.data(), bytes, 123, nullptr, out, 24));
    jpeg[bytes - 1] = 0;
    assert(!output("c", jpeg.data(), bytes, 123, nullptr, out, sizeof(out)));
  }
  std::vector<uint8_t> oversized(MAX_JPEG_BYTES + 1, 0);
  assert(!output("c", oversized.data(), oversized.size(), 0, nullptr, out,
                 sizeof(out)));
  assert(!output("", nullptr, 0, 0, nullptr, out, sizeof(out)));
  assert(output("c", nullptr, 0, 0, "Error: \"camera\"\nfailed", out,
                sizeof(out)));
  cJSON *error = cJSON_Parse(out);
  assert(error && !strcmp(cJSON_GetObjectItem(error, "output")->valuestring,
                          "Error: \"camera\"\nfailed"));
  cJSON_Delete(error);
  assert(!output(std::string(65, 'c').c_str(), nullptr, 0, 0, "failed", out,
                 sizeof(out)));
}
