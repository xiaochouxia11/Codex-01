#include "Cinema.hpp"
#include "Board.hpp"
#include "CinemaCue.hpp"
#include "CinemaLibrary.hpp"
#include "CinemaPolicy.hpp"
#include "CinemaStorage.hpp"
#include "CinemaTranscript.hpp"
#include "cJSON.h"
#include "esp_log.h"
#include <cstdio>
#include <cstring>

#include "CinemaAssets.hpp"
#include "CinemaMetadata.hpp"
#include "esp_heap_caps.h"
#include "esp_jpeg_dec.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/idf_additions.h"
#include "freertos/task.h"
#include <atomic>
#include <cstdlib>
#include <new>
#include <string_view>

extern "C" const uint8_t fallback_start[] asm("_binary_fallback_bin_start");
extern "C" const uint8_t fallback_end[] asm("_binary_fallback_bin_end");
namespace cinema {
namespace {
constexpr char TAG[] = "Cinema";
#ifdef CINEMA_ENCODER_POTION
static_assert(assets::DIMENSIONS == 128,
              "POTION requires a matching 128D pack");
#else
static_assert(assets::DIMENSIONS == 50, "GloVe requires a matching 50D pack");
#endif
static_assert(assets::COUNT > 0 && assets::COUNT <= 30000,
              "Prepare a 1..30000-clip local cinema pack");
std::atomic<bool> enabled{false}, initialized{false};
std::atomic<bool> player_failed{false}, player_idle{true};
std::atomic<bool> photo_paused{false};
std::atomic<bool> holding_frame{false};
std::atomic<bool> associative_playback{false};
std::atomic<bool> visible_wander{false};
std::atomic<unsigned> requests{0}, failures{0}, selected_count{0};
std::atomic<uint32_t> search_count{0}, search_last_us{0}, search_max_us{0};
std::atomic<unsigned> frames_shown{0}, frames_late{0}, decode_failures{0};
std::atomic<int> current{-1};
std::atomic<uint32_t> scene_epoch{0};
portMUX_TYPE lock = portMUX_INITIALIZER_UNLOCKED;
Mailbox mailbox;
VisualTopic topic;
VideoRequest video_request;
static_assert(assets::METADATA_COUNT == assets::COUNT &&
                  std::string_view(assets::METADATA_DIGEST) == assets::DIGEST,
              "Regenerate matching cinema metadata with --existing");
std::atomic<bool> *playable = nullptr;
History history;
TaskHandle_t query_task = nullptr;
struct Trace {
  int64_t time_us = 0;
  uint32_t sequence = 0, epoch = 0;
  int clip = -1;
  char source = '?';
  bool retained = false;
  char text[257]{};
  Ranking candidates;
  void clear() {
    // Avoid large aggregate temporaries (Xtensa GCC gimplify bug), and erase
    // all retained transcript bytes when the user clears diagnostic tracing.
    time_us = 0;
    sequence = epoch = 0;
    clip = -1;
    source = '?';
    retained = false;
    memset(text, 0, sizeof(text));
    candidates.count = 0;
    candidates.minimum = MIN_RELEVANCE;
  }
};
constexpr unsigned TRACE_COUNT = 64;
Trace *traces = nullptr;
unsigned trace_count = 0, trace_sequence = 0;
bool tracing = false;
// Caller holds lock. Traces are opt-in, bounded PSRAM, never written to SD.
void trace_locked(uint32_t epoch, int clip, char source, const char *text,
                  const Ranking &candidates, bool retained = false) {
  if (!tracing || !traces)
    return;
  auto &entry = traces[trace_sequence % TRACE_COUNT];
  entry.clear();
  entry.time_us = esp_timer_get_time();
  entry.sequence = ++trace_sequence;
  entry.epoch = epoch;
  entry.clip = clip;
  entry.source = source;
  entry.retained = retained;
  if (text)
    snprintf(entry.text, sizeof(entry.text), "%s", text);
  entry.candidates = candidates;
  trace_count = std::min(trace_count + 1, TRACE_COUNT);
}

void dump_trace() {
  unsigned count, end;
  portENTER_CRITICAL(&lock);
  count = trace_count;
  end = trace_sequence;
  portEXIT_CRITICAL(&lock);
  for (unsigned n = 0; n < count; ++n) {
    const unsigned seq = end - count + n + 1;
    Trace entry;
    portENTER_CRITICAL(&lock);
    entry = traces[(seq - 1) % TRACE_COUNT];
    portEXIT_CRITICAL(&lock);
    if (entry.sequence != seq)
      continue;
    cJSON *root = cJSON_CreateObject();
    if (!root)
      return;
    cJSON_AddNumberToObject(root, "sequence", seq);
    cJSON_AddNumberToObject(root, "ms", entry.time_us / 1000);
    cJSON_AddNumberToObject(root, "epoch", entry.epoch);
    cJSON_AddStringToObject(root, "kind", entry.clip < 0 ? "query" : "played");
    if (entry.clip >= 0)
      cJSON_AddNumberToObject(root, "clip", entry.clip);
    else {
      cJSON_AddStringToObject(root, "source",
                              entry.source == 'u'   ? "user"
                              : entry.source == 'a' ? "assistant"
                                                    : "manual/tool");
      cJSON_AddStringToObject(root, "cue", entry.text);
      cJSON_AddBoolToObject(root, "retained_previous_topic", entry.retained);
      cJSON *candidates = cJSON_AddArrayToObject(root, "candidates");
      for (unsigned i = 0; candidates && i < entry.candidates.count; ++i) {
        auto *candidate = cJSON_CreateObject();
        if (!candidate)
          break;
        cJSON_AddNumberToObject(candidate, "clip", entry.candidates.best[i].id);
        cJSON_AddNumberToObject(candidate, "score",
                                entry.candidates.best[i].score);
        cJSON_AddItemToArray(candidates, candidate);
      }
    }
    char *json = cJSON_PrintUnformatted(root);
    if (json) {
      printf("CINEMA TRACE %s\n", json);
      cJSON_free(json);
    }
    cJSON_Delete(root);
    vTaskDelay(1);
  }
}
struct Runtime {
  uint32_t total = 0, idle0 = 0, idle1 = 0, player = 0, gui = 0, query = 0,
           loader = 0, query_stack_min = 0;
};
Runtime runtime() {
  TaskStatus_t tasks[32]{};
  Runtime value;
  const auto count = uxTaskGetSystemState(tasks, 32, &value.total);
  for (unsigned i = 0; i < count; ++i) {
    const auto &task = tasks[i];
    if (!strcmp(task.pcTaskName, "IDLE0"))
      value.idle0 = task.ulRunTimeCounter;
    if (!strcmp(task.pcTaskName, "IDLE1"))
      value.idle1 = task.ulRunTimeCounter;
    if (!strcmp(task.pcTaskName, "cinema_player"))
      value.player = task.ulRunTimeCounter;
    if (!strcmp(task.pcTaskName, "cinema_queries")) {
      value.query = task.ulRunTimeCounter;
      value.query_stack_min = task.usStackHighWaterMark;
    }
    if (!strcmp(task.pcTaskName, "cinema_loader"))
      value.loader = task.ulRunTimeCounter;
    if (strstr(task.pcTaskName, "LVGL") || strstr(task.pcTaskName, "lvgl"))
      value.gui += task.ulRunTimeCounter;
  }
  if (!count)
    value.total = 0;
  return value;
}

bool enqueue(const char *text, bool priority, char source = 't') {
  if (!initialized.load() || !enabled.load() || player_failed.load())
    return false;
  const int64_t now = esp_timer_get_time();
  bool queued = false;
  portENTER_CRITICAL(&lock);
  if (priority && video_request.blocks()) {
    video_request.cancel();
    mailbox.invalidate();
    topic.clear();
    ++scene_epoch;
  }
  if (!video_request.blocks())
    queued = mailbox.submit(text, now, priority, source);
  portEXIT_CRITICAL(&lock);
  if (queued)
    xTaskNotifyGive(query_task);
  return queued;
}

template <class Proceed>
SearchResult search(const char *text, Ranking &out, Proceed proceed) {
  const auto began = esp_timer_get_time();
#ifdef CINEMA_ENCODER_POTION
  const auto result = search_potion(
#else
  const auto result = search_library(
#endif
      text, assets::CLIPS, assets::VECTORS, assets::COUNT, assets::WORDS,
      assets::WORD_COUNT, assets::WORD_STRINGS,
      [](unsigned id) { return playable && playable[id].load(); }, proceed,
      out);
  const auto elapsed =
      uint32_t(std::min<int64_t>(UINT32_MAX, esp_timer_get_time() - began));
  search_last_us = elapsed;
  ++search_count;
  auto previous = search_max_us.load();
  while (previous < elapsed &&
         !search_max_us.compare_exchange_weak(previous, elapsed)) {
  }
  return result;
}

void queries(void *) {
  int64_t next_request = 0;
  for (;;) {
    ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(1000));
    if (!enabled.load() || esp_timer_get_time() < next_request)
      continue;
    char cue[257]{};
    uint32_t generation = 0;
    char source = '?';
    portENTER_CRITICAL(&lock);
    mailbox.take(cue, generation, &source);
    portEXIT_CRITICAL(&lock);
    if (!cue[0])
      continue;
    ++requests;
    const int64_t began = esp_timer_get_time();
    Ranking next;
    const auto outcome = search(cue, next, [] {
      vTaskDelay(1);
      return enabled.load();
    });
    next_request = esp_timer_get_time() + 2000000;
    if (outcome == SearchResult::cancelled)
      continue;
    if (outcome == SearchResult::unknown_words)
      ++failures;
    bool accepted = false, retained = false;
    portENTER_CRITICAL(&lock);
    // A newer cue, session end or cinema-off invalidates an in-flight result.
    if (mailbox.accepts(generation) && enabled.load() &&
        !video_request.blocks()) {
      const auto now = esp_timer_get_time();
      const bool changed = topic.update(next, now, source);
      if (changed)
        ++scene_epoch;
      retained = !changed && topic.active(now);
      accepted = true;
      trace_locked(scene_epoch, -1, source, cue, next, retained);
    }
    portEXIT_CRITICAL(&lock);
    const bool close = next.count && next.best[0].score >= next.minimum;
    ESP_LOGI(TAG,
             "Cue %s candidates=%u best=%d score=%.3f latency_ms=%lld close=%d "
             "retained=%d",
             !accepted  ? "superseded"
             : retained ? "held"
             : close    ? "matched"
                        : "unmatched",
             next.count, next.count ? next.best[0].id : -1,
             next.count ? next.best[0].score : 0.f,
             (esp_timer_get_time() - began) / 1000, close, retained);
  }
}

int choose_next(uint32_t &epoch, int active_id, uint32_t active_epoch,
                bool &associative, bool &wander) {
  Ranking next;
  bool fresh = false, held_topic = false;
  int anchor = -1;
  associative = false;
  wander = false;
  const auto now = esp_timer_get_time();
  portENTER_CRITICAL(&lock);
  if (video_request.expire(now))
    ++scene_epoch;
  epoch = scene_epoch.load();
  if (video_request.state == VideoRequest::State::queued) {
    const int requested = video_request.pending_clip(active_id, active_epoch);
    portEXIT_CRITICAL(&lock);
    // Wait for its first published frame before prefetching the following clip.
    return requested;
  }
  // Once the requested clip is visible, prefetch from the held subject too.
  // Its first complete playback is still protected by VideoRequest.
  if (topic.active(now)) {
    next = topic.remaining(active_id);
    held_topic = true;
    fresh = topic.fresh;
    anchor = topic.ranking.best[0].id;
  }
  portEXIT_CRITICAL(&lock);
  wander = !held_topic;
  Ranking available;
  available.minimum = next.minimum;
  for (unsigned i = 0; i < next.count; ++i) {
    const auto &c = next.best[i];
    if (playable[c.id].load() && c.score >= next.minimum)
      available.add(c.id, c.score, c.source);
  }
  next = available;
  // Keep the subject as an anchor without freezing for its three-minute TTL.
  // These are visual associations, not additional confident search results.
  // Always return to the original anchor instead of drifting through the graph.
  if (held_topic && !next.count) {
    associative = true;
    return association_candidates(
               anchor, active_id, assets::CLIPS, assets::COUNT, history,
               [](unsigned id) { return playable[id].load(); })
        .choose(history, esp_random());
  }
  if (fresh && next.count)
    return next.choose(history, 0, true);
  const int previous = active_id >= 0 ? active_id : current.load();
  // Idle dreaming follows semantic neighbors, with occasional global
  // exploration.
  const bool explore = esp_random() % 5 == 0;
  if (!next.count && previous >= 0 && !explore) {
    for (auto i : assets::CLIPS[previous].neighbors)
      if (playable[i] && i != previous)
        next.add(i, .5f, assets::CLIPS[i].source);
  }
  if (!next.count) {
    const unsigned start = esp_random() % assets::COUNT;
    for (unsigned n = 0; n < assets::COUNT; ++n) {
      const auto i = (start + n) % assets::COUNT;
      if (playable[i] && int(i) != previous)
        next.add(i, .5f, assets::CLIPS[i].source);
    }
  }
  return next.choose(history, esp_random());
}

enum class LoadState { idle, requested, loading, ready };
struct LoadJob {
  std::atomic<LoadState> state{LoadState::idle};
  std::atomic<bool> cancel{false};
  uint8_t *buffer = nullptr;
  bool *card_failed = nullptr;
  unsigned slot = 0;
  int id = -1;
  uint32_t epoch = 0;
  bool ok = false, retry = false, associative = false, wander = false;
  Film film;
};
LoadJob *load_job = nullptr;
TaskHandle_t loader_task = nullptr;
std::atomic<unsigned> boundary_max_ms{0}, looped_frames{0};

void load_movie(void *) {
  auto &job = *load_job;
  for (;;) {
    ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
    auto expected = LoadState::requested;
    if (!job.state.compare_exchange_strong(expected, LoadState::loading))
      continue;
    const int id = job.id;
    const auto &clip = assets::CLIPS[id];
    const auto began = esp_timer_get_time();
    job.ok = false;
    job.retry = false;
    if (!job.cancel.load() && storage_available() && !job.card_failed[id]) {
      const auto result = storage_read(id, job.buffer, clip.bytes, [] {
        return photo_paused.load() || !enabled.load() ||
               load_job->cancel.load();
      });
      // A pause/new cue can race the final SD operation. Do not remember a
      // cancelled read as a permanently bad card file.
      if (result == ReadResult::cancelled || job.cancel.load() ||
          photo_paused.load() || !enabled.load())
        job.cancel = true;
      else if (result == ReadResult::retry)
        job.retry = true;
      else {
        job.ok =
            result == ReadResult::ok && job.film.parse(job.buffer, clip.bytes);
        job.card_failed[id] = !job.ok;
      }
    }
    const size_t blob_bytes = fallback_end - fallback_start;
    if (!job.cancel.load() && !job.ok && clip.length == clip.bytes &&
        clip.offset <= blob_bytes && clip.length <= blob_bytes - clip.offset) {
      memcpy(job.buffer, fallback_start + clip.offset, clip.length);
      job.ok = job.film.parse(job.buffer, clip.bytes);
      if (job.ok)
        job.retry = false;
    }
    if (!job.cancel.load())
      ESP_LOGI(TAG, "Prefetched clip=%d bytes=%u load_ms=%u valid=%d retry=%d",
               id, unsigned(clip.bytes),
               unsigned((esp_timer_get_time() - began) / 1000), job.ok,
               job.retry);
    // All fields and compressed bytes become readable before ready is observed.
    // Only the player returns this slot to idle; it never overwrites a live
    // job.
    job.state.store(LoadState::ready, std::memory_order_release);
  }
}

void play(void *) {
  size_t capacity = 0;
  for (auto &clip : assets::CLIPS)
    capacity = std::max(capacity, size_t(clip.bytes));
  uint8_t *compressed[2]{};
  uint8_t *pixels[2]{};
  for (unsigned i = 0; i < 2; ++i) {
    if (capacity <= MAX_FILM)
      compressed[i] = static_cast<uint8_t *>(
          heap_caps_malloc(capacity, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    pixels[i] = static_cast<uint8_t *>(heap_caps_aligned_alloc(
        16, PIXEL_BYTES, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  }
  void *job_memory =
      heap_caps_malloc(sizeof(LoadJob), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  if (job_memory)
    load_job = new (job_memory) LoadJob;
  if (load_job)
    load_job->card_failed = static_cast<bool *>(heap_caps_calloc(
        assets::COUNT, sizeof(bool), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  jpeg_dec_config_t config = DEFAULT_JPEG_DEC_CONFIG();
  config.output_type = JPEG_PIXEL_FORMAT_RGB565_LE;
  jpeg_dec_handle_t decoder = nullptr;
  bool ok = compressed[0] && compressed[1] && pixels[0] && pixels[1] &&
            load_job && load_job->card_failed &&
            jpeg_dec_open(&config, &decoder) == JPEG_ERR_OK;
  if (ok)
    // Use the other core's spare time; microphone/speaker tasks remain higher
    // priority. CPU1 already carries Live control, GUI, decode and search work.
    ok = xTaskCreatePinnedToCoreWithCaps(
             load_movie, "cinema_loader", 6144, nullptr, 2, &loader_task, 0,
             MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT) == pdPASS;
  if (!ok) {
    ESP_LOGE(TAG, "Player allocation failed; captions remain available");
    for (unsigned i = 0; i < 2; ++i) {
      free(compressed[i]);
      free(pixels[i]);
    }
    if (decoder)
      jpeg_dec_close(decoder);
    if (load_job) {
      free(load_job->card_failed);
      load_job->~LoadJob();
      free(load_job);
      load_job = nullptr;
    }
    player_failed = true;
    enabled = false;
    vTaskDeleteWithCaps(nullptr);
    return;
  }
  ESP_LOGI(TAG,
           "Player ready clips=%u compressed_capacity=%u buffers=2 pixels=%u "
           "fps=12 audio=none",
           assets::COUNT, unsigned(capacity), PIXEL_BYTES * 2);
  auto &job = *load_job;
  Film film;
  int active_id = -1;
  int published_frame = -1;
  unsigned active_slot = 0, back = 0;
  uint32_t active_epoch = 0;
  uint64_t tick = 0;
  int64_t begin = 0, last_presented = 0, paused_at = 0;
  int64_t final_presented = -1;
  uint32_t final_receipt = 0;
  bool active_wander = false;
  bool published = false, boundary = false, seen_visible = false;
  for (;;) {
    auto state = job.state.load(std::memory_order_acquire);
    const bool hidden = visibility_paused(
        enabled.load(), board::view_movie_visible(), seen_visible);
    if (!enabled.load() || photo_paused.load() || hidden) {
      holding_frame = false;
      associative_playback = false;
      published_frame = -1;
      final_presented = -1;
      job.cancel = true;
      if (state == LoadState::ready) {
        job.state = LoadState::idle;
        state = LoadState::idle;
      }
      // The camera/upload barrier includes pending SD reads, not only decoding.
      player_idle = state == LoadState::idle;
      if (!paused_at)
        paused_at = esp_timer_get_time();
      // Retain the active film across a photo/usage overlay. Restarting it
      // would require another SD read and freeze on the first resumed frame.
      if (!enabled.load())
        active_id = -1;
      last_presented = 0;
      if (!enabled.load() && published && board::view_movie_frame(nullptr))
        published = false;
      vTaskDelay(pdMS_TO_TICKS(20));
      continue;
    }
    if (paused_at) {
      begin += esp_timer_get_time() - paused_at;
      paused_at = 0;
    }
    player_idle = false;
    if (active_id >= 0 && published_frame == int(film.count) - 1 &&
        final_presented < 0) {
      int64_t rendered_at = 0;
      if (board::view_movie_presented(final_receipt, rendered_at))
        final_presented = rendered_at - begin;
    }
    const auto epoch = scene_epoch.load();
    if (state != LoadState::idle && job.epoch != epoch)
      job.cancel = true;
    if (state == LoadState::ready) {
      if (job.cancel.load() || job.retry || !job.ok ||
          !playable[job.id].load()) {
        if (!job.cancel.load() && !job.retry) {
          playable[job.id] = false;
          portENTER_CRITICAL(&lock);
          video_request.finish(job.id, job.epoch, false);
          portEXIT_CRITICAL(&lock);
          ESP_LOGW(TAG,
                   "Clip %d unavailable or invalid; disabled for this boot",
                   job.id);
        }
        job.state = LoadState::idle;
        state = LoadState::idle;
      } else if (active_id < 0 ||
                 transition_due(esp_timer_get_time() - begin, film.fps,
                                film.count, published_frame, final_presented)) {
        portENTER_CRITICAL(&lock);
        // Linearize the selection at the boundary against a concurrent cue.
        // It may replace prefetch, never the already-playing film.
        if (job.epoch != scene_epoch.load()) {
          portEXIT_CRITICAL(&lock);
          job.cancel = true;
          continue;
        }
        video_request.finish(active_id, active_epoch, true);
        portEXIT_CRITICAL(&lock);
        boundary = active_id >= 0;
        if (boundary)
          ESP_LOGI(TAG, "Finished clip=%d elapsed_ms=%lld duration_ms=%lld",
                   active_id, (esp_timer_get_time() - begin) / 1000,
                   clip_duration_us(film.fps, film.count) / 1000);
        active_id = job.id;
        active_wander = job.wander;
        associative_playback = job.associative;
        published_frame = -1;
        final_presented = -1;
        holding_frame = false;
        active_slot = job.slot;
        active_epoch = job.epoch;
        film = job.film;
        job.state = LoadState::idle;
        state = LoadState::idle;
        history.add(active_id, assets::CLIPS[active_id].source);
        ++selected_count;
        portENTER_CRITICAL(&lock);
        if (active_epoch == scene_epoch.load())
          topic.fresh = false;
        trace_locked(active_epoch, active_id, '?', nullptr, Ranking{});
        portEXIT_CRITICAL(&lock);
        begin = esp_timer_get_time();
        tick = 0;
        ESP_LOGI(TAG,
                 "Playing clip=%d epoch=%lu associative=%d wander=%d "
                 "duration_ms=%lld",
                 active_id, (unsigned long)active_epoch, job.associative,
                 active_wander, clip_duration_us(film.fps, film.count) / 1000);
      }
    }
    if (state == LoadState::idle) {
      uint32_t next_epoch = 0;
      bool associative = false, wander = false;
      const int next =
          choose_next(next_epoch, active_id, active_epoch, associative, wander);
      if (next >= 0) {
        job.id = next;
        job.epoch = next_epoch;
        job.associative = associative;
        job.wander = wander;
        job.cancel = false;
        job.ok = false;
        job.retry = false;
        if (next == active_id) {
          job.slot = active_slot;
          job.film = film;
          job.ok = true;
          job.state.store(LoadState::ready, std::memory_order_release);
        } else {
          job.slot = active_id < 0 ? 0 : active_slot ^ 1;
          job.buffer = compressed[job.slot];
          job.state.store(LoadState::requested, std::memory_order_release);
          xTaskNotifyGive(loader_task);
        }
      }
    }
    if (active_id < 0) {
      vTaskDelay(pdMS_TO_TICKS(10));
      continue;
    }
    const int64_t due = begin + int64_t(tick) * 1000000 / film.fps;
    const auto wait = due - esp_timer_get_time();
    if (wait > 1000)
      vTaskDelay(pdMS_TO_TICKS(wait / 1000));
    if (!enabled.load() || photo_paused.load())
      continue;
    const auto target =
        frame_at(esp_timer_get_time() - begin, film.fps, film.count);
    if (target > tick) {
      frames_late.fetch_add(unsigned(target - tick));
      tick = target;
    }
    if (hold_final_frame(tick, film.count, published_frame)) {
      if (transition_due(esp_timer_get_time() - begin, film.fps, film.count,
                         published_frame, final_presented)) {
        portENTER_CRITICAL(&lock);
        video_request.finish(active_id, active_epoch, true);
        portEXIT_CRITICAL(&lock);
      }
      holding_frame = true;
      // Intentional still time is neither a missed frame nor a boundary stall.
      last_presented = 0;
      boundary = false;
      vTaskDelay(pdMS_TO_TICKS(20));
      continue;
    }
    holding_frame = false;
    const auto frame_index = playback_frame(tick, film.count);
    const auto &frame = film.frames[frame_index];
    jpeg_dec_io_t io{};
    io.inbuf = compressed[active_slot] + frame.offset;
    io.inbuf_len = frame.size;
    io.outbuf = pixels[back];
    jpeg_dec_header_info_t header{};
    int required = 0;
    ok = jpeg_dec_parse_header(decoder, &io, &header) == JPEG_ERR_OK &&
         header.width == 320 && header.height == 240 &&
         jpeg_dec_get_outbuf_len(decoder, &required) == JPEG_ERR_OK &&
         required == int(PIXEL_BYTES) &&
         jpeg_dec_process(decoder, &io) == JPEG_ERR_OK;
    if (!ok) {
      ++decode_failures;
      playable[active_id] = false;
      portENTER_CRITICAL(&lock);
      video_request.finish(active_id, active_epoch, false);
      portEXIT_CRITICAL(&lock);
      active_id = -1;
      continue;
    }
    if (!enabled.load() || photo_paused.load())
      continue;
    uint32_t receipt = 0;
    if (board::view_movie_frame(pixels[back], back, &receipt)) {
      visible_wander = active_wander;
      portENTER_CRITICAL(&lock);
      current = active_id;
      video_request.published(active_id, active_epoch);
      topic.presented(active_id);
      portEXIT_CRITICAL(&lock);
      published_frame = int(frame_index);
      const auto presented = esp_timer_get_time();
      if (frame_index == film.count - 1)
        final_receipt = receipt;
      if (boundary && last_presented)
        boundary_max_ms =
            std::max(boundary_max_ms.load(),
                     unsigned((presented - last_presented) / 1000));
      boundary = false;
      last_presented = presented;
      back ^= 1;
      published = true;
      ++frames_shown;
    } else
      ++frames_late;
    tick = std::min<uint64_t>(tick + 1, film.count);
  }
}
struct LibraryBackend {
  bool (*cancelled)(void *);
  void *context;
  int64_t deadline = esp_timer_get_time() + 5000000;
  bool proceed() {
    vTaskDelay(1);
    return esp_timer_get_time() < deadline &&
           !(cancelled && cancelled(context));
  }
  LibrarySnapshot snapshot() {
    LibrarySnapshot s;
    s.pack = assets::DIGEST;
    s.count = assets::COUNT;
    s.enabled = enabled.load() && !player_failed.load();
    s.card = storage_available();
    portENTER_CRITICAL(&lock);
    s.request = video_request;
    s.current = current.load();
    portEXIT_CRITICAL(&lock);
    s.visible = s.enabled && s.current >= 0 && !photo_paused.load() &&
                board::view_movie_visible();
    return s;
  }
  VideoInfo video(unsigned id) {
    const auto &m = assets::METADATA[id];
    return {assets::CATALOG_TEXT + m.title,
            assets::CATALOG_TEXT + m.description,
            assets::CATALOG_TEXT + m.mood,
            m.basis == 1   ? "sampled_frames"
            : m.basis == 2 ? "archive_metadata"
                           : "unspecified",
            m.seconds,
            playable && playable[id].load(),
            assets::CATALOG_TEXT + m.film_context};
  }
  SearchResult search(const char *text, Ranking &out) {
    return cinema::search(text, out, [this] { return proceed(); });
  }
  bool play(int id, uint32_t &ticket, const Ranking *matches = nullptr) {
    if (!available() || !enabled.load() || !playable[id].load() ||
        (cancelled && cancelled(context)))
      return false;
    portENTER_CRITICAL(&lock);
    if (!enabled.load() || player_failed.load() || !playable[id].load() ||
        esp_timer_get_time() >= deadline || (cancelled && cancelled(context))) {
      portEXIT_CRITICAL(&lock);
      return false;
    }
    mailbox.invalidate();
    topic.request(id, assets::CLIPS[id].source, esp_timer_get_time(), matches);
    ticket = ++scene_epoch;
    video_request.queue(id, ticket, esp_timer_get_time());
    portEXIT_CRITICAL(&lock);
    return true;
  }
};

} // namespace

void before_display() { storage_init(); }
void init() {
  playable = static_cast<std::atomic<bool> *>(heap_caps_malloc(
      sizeof(*playable) * assets::COUNT, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  if (!playable)
    return;
  for (unsigned i = 0; i < assets::COUNT; ++i)
    new (playable + i)
        std::atomic<bool>(storage_available() || assets::CLIPS[i].length != 0);
  // Share time with playback so complex clips cannot starve a pending search.
  // Both remain below the audio tasks; search also yields between batches.
  constexpr UBaseType_t background_priority = 2;
  if (xTaskCreatePinnedToCoreWithCaps(
          queries, "cinema_queries", 16384, nullptr, background_priority,
          &query_task, 1, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT) != pdPASS)
    return;
  enabled = true;
  if (xTaskCreatePinnedToCoreWithCaps(
          play, "cinema_player", 12288, nullptr, background_priority, nullptr,
          1, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT) != pdPASS) {
    enabled = false;
    vTaskDeleteWithCaps(query_task);
    query_task = nullptr;
    return;
  }
  initialized = true;
}
bool available() { return initialized.load() && !player_failed.load(); }
bool wandering() {
  return available() && enabled.load() && !photo_paused.load() &&
         board::view_movie_visible() && visible_wander.load();
}
bool pause_for_photo() {
  photo_paused = true;
  const auto deadline = esp_timer_get_time() + 2000000;
  while (available() && !player_idle.load() && esp_timer_get_time() < deadline)
    vTaskDelay(pdMS_TO_TICKS(10));
  if (available() && !player_idle.load()) {
    photo_paused = false;
    return false;
  }
  return true;
}
void resume_after_photo() { photo_paused = false; }
void tick() {
  if (!initialized.load())
    return;
  portENTER_CRITICAL(&lock);
  if (video_request.expire(esp_timer_get_time()))
    ++scene_epoch;
  portEXIT_CRITICAL(&lock);
  static bool active = false;
  static uint32_t observed = 0, submitted = 0;
  static int64_t changed = 0, last = 0;
  static TranscriptCursor transcript_cursor;
  live_esp32_status_t state{};
  live_esp32_status(&state);
  const auto now = esp_timer_get_time();
  if (active && !state.active) {
    portENTER_CRITICAL(&lock);
    mailbox.invalidate();
    topic.clear();
    video_request.cancel();
    ++scene_epoch;
    portEXIT_CRITICAL(&lock);
  }
  if (!active && state.active) {
    transcript_cursor = {};
    submitted = UINT32_MAX;
    last = now - 10000000;
  }
  active = state.active;
  if (!active || !enabled.load())
    return;
  if (state.transcript_revision != observed) {
    observed = state.transcript_revision;
    changed = now;
  }
  if (observed == submitted || now - last < 5000000 ||
      (now - changed < 500000 && now - last < 8000000))
    return;
  live_transcript_t transcript{};
  live_esp32_transcripts(&transcript);
  if (!transcript.count)
    return;
  char cue_text[257]{};
  const int index = transcript_cursor.next(transcript);
  if (index < 0)
    return;
  const auto &block = transcript.blocks[index];
  transcript_cue(block.text, cue_text);
  if (strlen(cue_text) < 3)
    return;
  if (enqueue(cue_text, false,
              block.speaker == LIVE_SPEAKER_USER ? 'u' : 'a')) {
    transcript_cursor.accept(transcript, unsigned(index));
    submitted = observed;
    last = now;
  }
}
esp_err_t cue(const char *arguments, char *result, size_t capacity) {
  char text[257];
  if (!result || capacity < 150 || !parse_cue(arguments, text))
    return ESP_ERR_INVALID_ARG;
  const bool queued = enqueue(text, true);
  if (!queued)
    return ESP_ERR_INVALID_STATE;
  snprintf(result, capacity,
           "{\"queued\":true,\"meaning\":\"An archival visual association, not "
           "a current camera view or factual evidence.\"}");
  return ESP_OK;
}
esp_err_t library(const char *name, const char *arguments, char *result,
                  size_t capacity, bool (*cancelled)(void *), void *context) {
  LibraryBackend backend{cancelled, context};
  return execute_library_tool(name, arguments, result, capacity, backend)
             ? ESP_OK
             : ESP_FAIL;
}
bool command(const char *line) {
  if (strncmp(line, "cinema ", 7))
    return false;
  if (!strncmp(line + 7, "trace ", 6)) {
    const char *operation = line + 13;
    if (!strcmp(operation, "dump"))
      dump_trace();
    else if (!strcmp(operation, "on") || !strcmp(operation, "off") ||
             !strcmp(operation, "clear")) {
      if (!strcmp(operation, "on") && !traces) {
        void *memory = heap_caps_malloc(sizeof(Trace) * TRACE_COUNT,
                                        MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (memory) {
          traces = static_cast<Trace *>(memory);
          for (unsigned i = 0; i < TRACE_COUNT; ++i)
            new (traces + i) Trace;
        }
      }
      portENTER_CRITICAL(&lock);
      if (!strcmp(operation, "clear")) {
        trace_count = trace_sequence = 0;
        if (traces)
          for (unsigned i = 0; i < TRACE_COUNT; ++i)
            traces[i].clear();
      } else
        tracing = !strcmp(operation, "on") && traces;
      portEXIT_CRITICAL(&lock);
      ESP_LOGI(TAG, "Trace %s; RAM only, capacity=%u; dump/clear available",
               tracing ? "on" : "off", TRACE_COUNT);
    } else
      ESP_LOGW(TAG, "cinema trace on/off/dump/clear");
    return true;
  }
  if (!strncmp(line + 7, "sd ", 3)) {
    live_esp32_status_t state{};
    live_esp32_status(&state);
    if (enabled.load() || state.busy || !player_idle.load()) {
      printf("CINEMA ERROR stop-live-and-cinema-first\n");
      return true;
    }
    return storage_command(line + 10);
  }
  if (!strcmp(line + 7, "off")) {
    enabled = false;
    board::view_movie_frame(nullptr);
    portENTER_CRITICAL(&lock);
    mailbox.invalidate();
    topic.clear();
    video_request.cancel();
    ++scene_epoch;
    portEXIT_CRITICAL(&lock);
  } else if (!strcmp(line + 7, "on"))
    enabled = available();
  else if (!strncmp(line + 7, "cue ", 4))
    enqueue(line + 11, true);
  else if (strcmp(line + 7, "status"))
    ESP_LOGW(TAG, "Commands: cinema on/off/status/cue <description>");
  unsigned usable = 0;
  int64_t topic_remaining = 0;
  portENTER_CRITICAL(&lock);
  const auto checked_at = esp_timer_get_time();
  if (topic.active(checked_at))
    topic_remaining = (topic.expires_at - checked_at) / 1000;
  portEXIT_CRITICAL(&lock);
  uint32_t rendered;
  int64_t gap;
  board::view_movie_stats(rendered, gap);
  board::view_movie_diagnostics();
  storage_diagnostics();
  if (playable)
    for (unsigned i = 0; i < assets::COUNT; ++i)
      usable += playable[i].load();
  ESP_LOGI(TAG,
           "enabled=%d sd=%d catalog=%u playable=%u current=%d clips=%u "
           "frames=%u rendered=%lu max_gap_ms=%lld late=%u decode_errors=%u "
           "requests=%u failures=%u boundary_max_ms=%u looped_frames=%u "
           "sd_waits=%u topic_remaining_ms=%lld holding_final=%d "
           "associative=%d wander=%d",
           enabled.load(), storage_available(), assets::COUNT, usable,
           current.load(), selected_count.load(), frames_shown.load(),
           (unsigned long)rendered, gap / 1000, frames_late.load(),
           decode_failures.load(), requests.load(), failures.load(),
           boundary_max_ms.load(), looped_frames.load(), storage_contention(),
           topic_remaining, holding_frame.load(), associative_playback.load(),
           wandering());
  static Runtime previous;
  static int64_t previous_time = 0;
  const auto wall_time = esp_timer_get_time();
  const auto now = runtime();
  ESP_LOGI(
      TAG,
      "encoder=%s dimensions=%u word_bytes=%u vector_bytes=%u "
      "searches=%lu search_last_us=%lu search_max_us=%lu query_stack_min=%lu",
      assets::MODEL, assets::DIMENSIONS, unsigned(sizeof(assets::WORDS)),
      unsigned(sizeof(assets::VECTORS)), (unsigned long)search_count.load(),
      (unsigned long)search_last_us.load(), (unsigned long)search_max_us.load(),
      (unsigned long)now.query_stack_min);
  const double elapsed = uint32_t(now.total - previous.total);
  if (previous.total && now.total && elapsed > 0 &&
      wall_time - previous_time < 1800000000)
    ESP_LOGI(TAG,
             "cpu_window core0_busy=%.1f%% core1_busy=%.1f%% player=%.1f%% "
             "gui=%.1f%% query=%.1f%% loader=%.1f%%",
             100. * (1. - uint32_t(now.idle0 - previous.idle0) / elapsed),
             100. * (1. - uint32_t(now.idle1 - previous.idle1) / elapsed),
             100. * uint32_t(now.player - previous.player) / elapsed,
             100. * uint32_t(now.gui - previous.gui) / elapsed,
             100. * uint32_t(now.query - previous.query) / elapsed,
             100. * uint32_t(now.loader - previous.loader) / elapsed);
  previous = now;
  previous_time = wall_time;
  return true;
}
} // namespace cinema
