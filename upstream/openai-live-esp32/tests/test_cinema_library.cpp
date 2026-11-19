#include "CinemaCue.hpp"
#include "CinemaLibrary.hpp"
#include "CinemaPersonality.hpp"
#include "MotionPolicy.hpp"
#include "client_tools.hpp"
#include "live.h"
#include <cassert>
#include <cstdlib>
#include <string>
#include <vector>
using namespace cinema;
size_t allocations = 0, fail_at = 0;
void *failing_malloc(size_t bytes) {
  return ++allocations == fail_at ? nullptr : malloc(bytes);
}
const cJSON *field(const cJSON *object, const char *name) {
  return cJSON_GetObjectItemCaseSensitive(object, name);
}
struct Fake {
  LibrarySnapshot state{
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      10,
      2,
      true,
      true,
      true,
      {}};
  std::string description =
      "A boat sails across the water. Gentle waves pass the shore.";
  std::string title = "Harbor film";
  std::string mood = "calm";
  std::string film = "Source film: a 1949 documentary about harbor life.";
  double seconds = 8.0;
  bool cancelled = false, reject_play = false;
  unsigned mutations = 0, queries = 0;
  unsigned checks = 0, proceed_until = UINT32_MAX;
  SearchResult search_result = SearchResult::ok;
  float best_score = 1.f;
  Ranking held;
  int selected = -1;
  bool proceed() { return ++checks <= proceed_until && !cancelled; }
  LibrarySnapshot snapshot() { return state; }
  VideoInfo video(unsigned id) {
    assert(id < state.count);
    return {title.c_str(), description.c_str(),
            mood.c_str(),  "archive_metadata",
            seconds,       id != 4,
            film.c_str()};
  }
  SearchResult search(const char *, Ranking &out) {
    ++queries;
    for (int i = 0; i < 8; ++i)
      out.add(i, best_score - i * .02f, i);
    return search_result;
  }
  bool play(int id, uint32_t &ticket, const Ranking *matches = nullptr) {
    if (reject_play || cancelled)
      return false;
    ++mutations;
    selected = id;
    if (matches)
      held = *matches;
    ticket = 17;
    return true;
  }
};
int main() {
  // The actual declaration bundle must fit existing SDK and core limits,
  // including capture_photo, without increasing every device's memory budget.
  std::string declared = stackchan::TOOLS_JSON;
  declared.pop_back();
  declared += std::string(",") + SCENE_TOOL + "," + LIBRARY_TOOLS + "]";
  std::string wire;
  assert(live_tools::configure(declared.c_str(), true, wire));
  assert(wire.size() <= 4096);
  auto *all = cJSON_Parse(wire.c_str());
  assert(cJSON_GetArraySize(all) == 8);
  cJSON_Delete(all);
  live_config_t config{};
  config.model = "gpt-live-1";
  config.responses_model = "test-backend";
  config.instructions = personality::FRONTEND;
  config.responses_instructions = personality::BACKEND;
  config.responses_tools_json = wire.c_str();
  config.responses_web_search = true;
  config.send = [](void *, const char *, size_t) { return 0; };
  live_session_t *session = nullptr;
  assert(live_session_create(&config, &session) == LIVE_OK);
  char session_json[LIVE_MAX_JSON_BYTES];
  assert(live_session_offer(session, "v=0\r\n", session_json,
                            sizeof(session_json)) == LIVE_OK);
  live_session_destroy(session);

  LibraryArguments args;
  assert(parse_library_arguments("inspect_video",
                                 "{\"clip_id\":null,\"offset\":0}", args));
  assert(args.clip == -1);
  assert(parse_library_arguments(
             "inspect_video",
             "{\"clip_id\":null,\"offset\":0,\"section\":\"film\"}", args) &&
         args.film);
  for (auto invalid : {"{\"clip_id\":null,\"offset\":1,\"section\":\"clip\"}",
                       "{\"clip_id\":1,\"offset\":0,\"section\":\"other\"}",
                       "{\"clip_id\":1,\"offset\":0,\"section\":null}",
                       "{\"clip_id\":1,\"offset\":0,\"section\":\"film\","
                       "\"section\":\"clip\"}"})
    assert(!parse_library_arguments("inspect_video", invalid, args));
  for (auto invalid :
       {"{}", "[]", "{\"clip_id\":-1}", "{\"clip_id\":0.5}",
        "{\"clip_id\":30000}", "{\"clip_id\":1e999}", "{\"clip_id\":true}",
        "{\"clip_id\":null}", "{\"clip_id\":\"../0001.SCF\"}",
        "{\"clip_id\":1,\"clip_id\":2}", "{\"clip_id\":1,\"extra\":0}",
        "{\"clip_id\":1} trailing", "{\"clip_id\\u0000\":1}"})
    assert(!parse_library_arguments("play_video", invalid, args));
  assert(!parse_library_arguments("search_videos",
                                  "{\"query\":\"a\",\"offset\":-1}", args));
  assert(!parse_library_arguments(
      "search_videos", "{\"query\":\"a\\u0000b\",\"offset\":0}", args));
  auto huge =
      std::string("{\"query\":\"") + std::string(257, 'a') + "\",\"offset\":0}";
  assert(!parse_library_arguments("search_videos", huge.c_str(), args));
  for (auto invalid :
       {"{\"query\":\"\",\"offset\":0,\"play\":true}",
        "{\"query\":\"cat\",\"offset\":3,\"play\":true}",
        "{\"query\":\"cat\",\"offset\":0,\"play\":1}",
        "{\"query\":\"cat\",\"offset\":0,\"play\":null}",
        "{\"query\":\"cat\",\"offset\":0,\"play\":true,\"play\":false}"})
    assert(!parse_library_arguments("search_videos", invalid, args));
  assert(parse_library_arguments(
      "search_videos", "{\"query\":\"\",\"offset\":3,\"play\":false}", args));
  assert(!args.autoplay);

  Fake backend;
  char result[live_tools::MAX_RESULT];
  auto call = [&](const char *name, const char *arguments) {
    assert(
        execute_library_tool(name, arguments, result, sizeof(result), backend));
    assert(strlen(result) < sizeof(result));
    auto *root = cJSON_Parse(result);
    assert(root);
    return root;
  };
  auto *root = call("search_videos", "{\"query\":\"boat\",\"offset\":0}");
  assert(cJSON_GetArraySize(field(root, "results")) == 3);
  assert(field(root, "next_offset")->valueint == 3);
  cJSON_Delete(root);
  root = call("search_videos", "{\"query\":\"boat\",\"offset\":3}");
  assert(field(cJSON_GetArrayItem(field(root, "results"), 1), "clip_id")
             ->valueint == 5);
  cJSON_Delete(root);
  root = call("search_videos", "{\"query\":\"\",\"offset\":8}");
  assert(cJSON_GetArraySize(field(root, "results")) == 2);
  assert(cJSON_IsNull(field(root, "next_offset")) && backend.queries == 2);
  cJSON_Delete(root);
  root = call("inspect_video", "{\"clip_id\":null,\"offset\":0}");
  assert(field(root, "clip_id")->valueint == 2);
  assert(!strcmp(field(root, "description")->valuestring,
                 backend.description.c_str()));
  assert(!strcmp(field(root, "basis")->valuestring, "archive_metadata"));
  cJSON_Delete(root);
  assert(backend.mutations == 0);
  assert(field(root = call("inspect_video", "{\"clip_id\":2,\"offset\":0}"),
               "source_film_title"));
  assert(
      !field(root, "title")); // Film titles must not masquerade as clip facts.
  cJSON_Delete(root);
  root = call("inspect_video",
              "{\"clip_id\":null,\"offset\":0,\"section\":\"film\"}");
  assert(
      !strcmp(field(root, "description")->valuestring, backend.film.c_str()));
  assert(!strcmp(field(root, "basis")->valuestring, "archive_catalog"));
  assert(!strcmp(field(root, "scope")->valuestring, "source_film"));
  cJSON_Delete(root);
  assert(backend.mutations == 0);
  backend.state.visible = false;
  root = call("inspect_video", "{\"clip_id\":null,\"offset\":0}");
  assert(cJSON_IsFalse(field(root, "screen_visible")));
  cJSON_Delete(root);
  backend.state.current = -1;
  root = call("inspect_video", "{\"clip_id\":null,\"offset\":0}");
  assert(field(root, "error"));
  cJSON_Delete(root);

  // Playback intent is explicit, atomic, and carries the whole relevant set
  // into subsequent automatic selection. Legacy/read-only searches stay pure.
  for (bool play : {false, true}) {
    Fake fake;
    assert(execute_library_tool(
        "search_videos",
        play ? "{\"query\":\"cat\",\"offset\":0,\"play\":true}"
             : "{\"query\":\"cat\",\"offset\":0,\"play\":false}",
        result, sizeof(result), fake));
    root = cJSON_Parse(result);
    assert(root && !field(root, "error") && fake.mutations == unsigned(play));
    assert(cJSON_GetArraySize(field(root, "results")) == (play ? 1 : 3));
    if (play) {
      assert(fake.selected == 0 && fake.held.count == 8);
      assert(field(root, "requested_clip")->valueint == 0);
      assert(!strcmp(field(root, "request_status")->valuestring, "queued"));
      assert(field(root, "screen_clip")->valueint == 2);
    }
    cJSON_Delete(root);
  }
  for (auto outcome : {SearchResult::ok, SearchResult::unknown_words,
                       SearchResult::cancelled}) {
    Fake fake;
    fake.best_score = MIN_RELEVANCE - .001f;
    fake.search_result = outcome;
    assert(execute_library_tool(
        "search_videos", "{\"query\":\"cat\",\"offset\":0,\"play\":true}",
        result, sizeof(result), fake));
    assert(fake.mutations == 0);
  }
  for (unsigned stop = 0; stop < 5; ++stop) {
    Fake fake;
    fake.proceed_until = stop;
    execute_library_tool("search_videos",
                         "{\"query\":\"cat\",\"offset\":0,\"play\":true}",
                         result, sizeof(result), fake);
    assert(fake.mutations == (stop == 4 ? 1u : 0u));
  }

  root = call("play_video", "{\"clip_id\":4}");
  assert(field(root, "error") && backend.mutations == 0);
  cJSON_Delete(root);
  root = call("play_video", "{\"clip_id\":2}");
  assert(backend.selected == 2 && backend.mutations == 1);
  assert(!strcmp(field(root, "request_status")->valuestring, "queued"));
  assert(field(root, "request_id")->valueint == 17);
  assert(cJSON_IsNull(
      field(root, "screen_clip"))); // Never pretend the queued clip is visible.
  cJSON_Delete(root);
  backend.reject_play = true;
  root = call("play_video", "{\"clip_id\":1}");
  assert(field(root, "error") && backend.mutations == 1);
  cJSON_Delete(root);
  backend.cancelled = true;
  root = call("play_video", "{\"clip_id\":1}");
  assert(field(root, "error") && backend.mutations == 1);
  cJSON_Delete(root);
  backend.cancelled = backend.reject_play = false;
  assert(!execute_library_tool("play_video", "{\"clip_id\":2}", nullptr, 0,
                               backend));
  char tiny[64];
  execute_library_tool("play_video", "{\"clip_id\":2}", tiny, sizeof(tiny),
                       backend);
  assert(backend.mutations == 1);

  Fake late_cancel;
  late_cancel.proceed_until = 2; // Cancel after preparing the acknowledgement.
  assert(execute_library_tool("play_video", "{\"clip_id\":2}", result,
                              sizeof(result), late_cancel));
  root = cJSON_Parse(result);
  assert(root && field(root, "error") && !late_cancel.mutations);
  assert(!strcmp(field(root, "request_status")->valuestring, "not_queued"));
  cJSON_Delete(root);

  // Round-trip long multilingual/control-heavy descriptions through repeated
  // pages. Neither JSON expansion nor UTF-8 boundaries lose facts or loop.
  backend.title = std::string(100, '"');
  backend.description.clear();
  for (unsigned i = 0; i < 160; ++i)
    backend.description += "\n\"café 船🙂\\";
  std::string joined;
  unsigned offset = 0, pages = 0;
  backend.state.request.queue(2, UINT32_MAX, 0);
  for (;;) {
    char arguments[80];
    snprintf(arguments, sizeof(arguments), "{\"clip_id\":2,\"offset\":%u}",
             offset);
    root = call("inspect_video", arguments);
    assert(!field(root, "error"));
    joined += field(root, "description")->valuestring;
    const auto *next = field(root, "next_offset");
    if (cJSON_IsNull(next)) {
      cJSON_Delete(root);
      break;
    }
    assert(next->valueint > int(offset));
    offset = next->valueint;
    cJSON_Delete(root);
    assert(++pages < 100);
  }
  assert(joined == backend.description);
  // Film pages keep a fixed ID even as automatic playback advances.
  backend.film = backend.description;
  joined.clear();
  offset = pages = 0;
  for (;;) {
    char arguments[96];
    snprintf(arguments, sizeof(arguments),
             "{\"clip_id\":2,\"offset\":%u,\"section\":\"film\"}", offset);
    backend.state.current = pages % 10;
    root = call("inspect_video", arguments);
    assert(!field(root, "error") && field(root, "clip_id")->valueint == 2);
    assert(!strcmp(field(root, "scope")->valuestring, "source_film"));
    joined += field(root, "description")->valuestring;
    const auto *next = field(root, "next_offset");
    if (cJSON_IsNull(next)) {
      cJSON_Delete(root);
      break;
    }
    assert(next->valueint > int(offset));
    offset = next->valueint;
    cJSON_Delete(root);
    assert(++pages < 100);
  }
  assert(joined == backend.film);
  root = call("search_videos", "{\"query\":\"boat\",\"offset\":0}");
  assert(!field(root, "error"));
  cJSON_Delete(root);
  backend.state.count = 30000;
  backend.state.current = 29999;
  backend.state.request.queue(29999, UINT32_MAX, 0);
  backend.description = std::string(4096, '"');
  backend.mood = std::string(256, 'a');
  backend.seconds = 143.99998474121094;
  root = call("inspect_video", "{\"clip_id\":29999,\"offset\":0}");
  assert(!field(root, "error"));
  cJSON_Delete(root);
  root = call("search_videos", "{\"query\":\"boat\",\"offset\":0}");
  assert(!field(root, "error"));
  cJSON_Delete(root);
  backend.description = "船";
  root = call("inspect_video", "{\"clip_id\":2,\"offset\":1}");
  assert(field(root, "error"));
  cJSON_Delete(root);
  root = call("inspect_video", "{\"clip_id\":30000,\"offset\":0}");
  assert(field(root, "error"));
  cJSON_Delete(root);

  // Any allocation failure before the acknowledgement is preflighted must
  // prevent the side effect. Successful playback needs no later allocation.
  for (const bool autoplay : {false, true})
    for (size_t failure = 1; failure < 220; ++failure) {
      Fake fake;
      fail_at = failure;
      allocations = 0;
      cJSON_Hooks hooks{failing_malloc, free};
      cJSON_InitHooks(&hooks);
      const bool ok = execute_library_tool(
          autoplay ? "search_videos" : "play_video",
          autoplay ? "{\"query\":\"cat\",\"offset\":0,\"play\":true}"
                   : "{\"clip_id\":2}",
          result, sizeof(result), fake);
      cJSON_InitHooks(nullptr);
      if (fake.mutations) {
        assert(ok);
        auto *response = cJSON_Parse(result);
        assert(response && !field(response, "error"));
        assert(
            !strcmp(field(response, "request_status")->valuestring, "queued"));
        cJSON_Delete(response);
      }
    }

  VideoRequest request;
  request.queue(2, 5, 100);
  assert(request.blocks() && request.pending_clip(1, 4) == 2);
  assert(request.pending_clip(2, 5) ==
         -1); // Don't prefetch a duplicate before frame zero.
  request.published(2, 4);
  assert(request.state == VideoRequest::State::queued);
  request.published(1, 5);
  assert(request.state == VideoRequest::State::queued);
  assert(!request.expire(15000099));
  request.published(2, 5);
  assert(request.state == VideoRequest::State::playing &&
         !request.expire(16000000));
  request.finish(2, 4, true);
  assert(request.blocks());
  request.finish(2, 5, true);
  assert(!request.blocks());
  request.queue(3, 6, 100);
  assert(request.expire(15000100));
  request.published(3, 6);
  assert(request.state == VideoRequest::State::failed);
  request.queue(3, 7, 0);
  request.queue(1, 8, 0);
  request.published(3, 7);
  assert(request.state == VideoRequest::State::queued);
  request.cancel();
  assert(!request.blocks());
  request.queue(1, 9, 0);
  request.finish(1, 9, false);
  assert(request.state == VideoRequest::State::failed);

  // Recall an exact subject outside the 64-vector shortlist; exclude
  // unavailable clips and ensure cancellation is checked during the actual
  // device search.
  struct Word {
    uint32_t offset;
    float scale, norm;
    int8_t vector[50];
  };
  Word words[] = {
      {0, 1, 127, {127}}, {7, 1, 127, {0, 127}}, {14, 1, 127, {0, 0, 127}}};
  const char strings[] = "office\0sports\0tennis\0";
  struct Clip {
    uint32_t source;
    float norm;
    uint16_t keywords[2];
  };
  Clip clips[71];
  int8_t vectors[71][50]{};
  for (unsigned i = 0; i < 71; ++i) {
    clips[i] = {i, 127, {0, 65535}};
    vectors[i][1] = 127;
  }
  clips[70].keywords[0] = 1;
  vectors[70][0] = 126;
  vectors[70][1] = 13;
  Ranking matches;
  auto search = [&](const char *text, bool include, bool proceed) {
    return search_library(
        text, clips, vectors, 71, words, 3, strings,
        [include](unsigned i) { return include || i != 70; },
        [proceed] { return proceed; }, matches);
  };
  assert(search("sports", true, true) == SearchResult::ok);
  assert(matches.best[0].id == 70 && matches.best[0].score > MIN_RELEVANCE);
  assert(search("sports", false, true) == SearchResult::ok);
  assert(matches.best[0].score < MIN_RELEVANCE);
  assert(search("tennis", true, true) == SearchResult::ok &&
         matches.best[0].score < MIN_RELEVANCE);
  assert(search("sports", true, false) == SearchResult::cancelled);
  assert(search("zzzzzzz", true, true) == SearchResult::unknown_words);
}
