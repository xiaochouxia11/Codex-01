#include "live_esp32.h"
#include "client_tools.hpp"
#include "https_transport.hpp"
#include "playout.hpp"
#include "preconnect.hpp"
#include "startup_greeting.hpp"
#include "transcript.hpp"
#include "usage.hpp"

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <new>
#include <string>
#include <sys/time.h>
#include <vector>

#include "cJSON.h"
#include "decoder/impl/esp_opus_dec.h"
#include "encoder/impl/esp_opus_enc.h"
#include "esp_crt_bundle.h"
#include "esp_heap_caps.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/idf_additions.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include "live.h"
#include "peer.h"
#include "peer_connection.h"

namespace {
constexpr char TAG[] = "LiveVoice";
constexpr int RATE = 24000, SAMPLES = RATE / 50, PACKET_BYTES = 1500;
// Preserve the decoder's original stack headroom in addition to the PCM
// reserve.
constexpr uint32_t PLAYBACK_STACK = 32 * 1024 + sizeof(live_audio::Prebuffer);
struct Packet {
  int64_t received_at_us;
  uint32_t capture_timestamp;
  int size;
  uint8_t data[PACKET_BYTES];
};
live_esp32_config_t config{};
live_esp32_status_t status{};
live_transcript_t transcripts{};
live_usage::Tracker usage;
portMUX_TYPE status_lock = portMUX_INITIALIZER_UNLOCKED;
std::atomic<bool> test_audio{false};
std::atomic<bool> test_jitter{false}, playout_buffer_enabled{true};
std::atomic<bool> test_burst{false};
std::atomic<bool> test_peer{false};
std::atomic<bool> request_pending{false}, preconnect_enabled{false};
// Availability and generation share one atomic so a rapid disconnect/reconnect
// cannot make a socket from the previous network look current.
std::atomic<uint32_t> network_generation{0};
live_https::Preconnect<live_https::TlsTransport> preconnection;
using PreconnectState = decltype(preconnection)::State;
std::atomic<bool> preconnect_ready{false}, preconnect_pending{false};
std::atomic<bool> initialized{false}, starting{false}, stop{false},
    muted{false};
std::atomic<bool> audio_running{false}, capture_done{true}, playback_done{true};
std::atomic<bool> connected{false}, failed{false};
TaskHandle_t controller = nullptr;
// ESP-IDF pthread_join uses notification slot zero on the calling task. App or
// Wi-Fi wakeups must not satisfy that wait and delete an SCTP worker too early.
SemaphoreHandle_t control_wake = nullptr;
QueueHandle_t tx = nullptr, rx = nullptr;
PeerConnection *peer = nullptr;
// Retain ownership after a failed global shutdown. A later attempt must finish
// that shutdown before acquiring another reference, or every retry would leak
// a peer_init() reference and prevent the runtime from ever being released.
bool peer_runtime_held = false;
bool release_peer_runtime() {
  if (!peer_runtime_held)
    return true;
  if (peer_deinit())
    return false;
  peer_runtime_held = false;
  return true;
}
bool acquire_peer_runtime() {
  if (!release_peer_runtime() || peer_init())
    return false;
  peer_runtime_held = true;
  return true;
}
live_session_t *session = nullptr;
uint16_t stream_id = 0;
bool channel_open = false;
bool first_audio_received = false;
int64_t requested_at_us = 0, startup_origin_us = 0;
constexpr const char *STARTUP_NAMES[] = {
    "controller",      "peer_created",   "offer_ready",
    "https_connected", "request_sent",   "response_headers",
    "response_body",   "audio_ready",    "ice_paired",
    "dtls_connected",  "sctp_connected", "data_channel_open",
    "session_started", "first_audio_rx", "first_playback"};
static_assert(sizeof(STARTUP_NAMES) / sizeof(STARTUP_NAMES[0]) ==
              LIVE_STARTUP_STAGE_COUNT);
std::string offer;
void *encoder = nullptr, *decoder = nullptr;
void error(const char *text);

enum class PhotoPhase { idle, reserved, queued, ready };
std::atomic<PhotoPhase> photo_phase{PhotoPhase::idle};
TaskHandle_t photo_task = nullptr;
struct BatchDeleter {
  void operator()(live_photo::Batch *p) const {
    if (p)
      p->~Batch();
    heap_caps_free(p);
  }
};
// Function arguments enlarge the bounded queue. Keep it out of scarce internal
// RAM, and allocate nothing for devices without camera/custom function tools.
std::unique_ptr<live_photo::Batch, BatchDeleter> photo_batch;
unsigned photo_attempts = 0, tool_attempts = 0;
std::string tools_json;
std::atomic<uint32_t> tool_epoch{0};
struct PhotoJob {
  uint64_t generation = 0;
  char call_id[65]{}, name[65]{}, arguments[513]{};
  uint32_t epoch = 0;
  bool is_photo = true;
  const char *error = nullptr;
  bool diagnostic = false, owns_start = false;
  char *output = nullptr;
  size_t length = 0, jpeg_bytes = 0;
  uint32_t elapsed_us = 0;
  esp_err_t result = ESP_FAIL;
} photo_job;

bool tool_cancelled(void *context) {
  const auto &job = *static_cast<const PhotoJob *>(context);
  return stop || failed || job.epoch != tool_epoch.load();
}

void photo_worker(void *) {
  for (;;) {
    ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
    if (photo_phase.load() != PhotoPhase::queued)
      continue;
    const int64_t began = esp_timer_get_time();
    auto &job = photo_job;
    job.output = static_cast<char *>(heap_caps_malloc(
        LIVE_MAX_JSON_BYTES, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    if (!job.diagnostic && tool_cancelled(&job))
      job.error = "Tool cancelled before execution.";
    if (job.is_photo) {
      auto *jpeg = static_cast<uint8_t *>(heap_caps_malloc(
          live_photo::MAX_JPEG_BYTES, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
      job.result = job.error ? ESP_ERR_INVALID_ARG
                   : jpeg && job.output
                       ? config.capture_photo(config.context, jpeg,
                                              live_photo::MAX_JPEG_BYTES,
                                              &job.jpeg_bytes)
                       : ESP_ERR_NO_MEM;
      timeval now{};
      gettimeofday(&now, nullptr);
      if (job.result != ESP_OK && !job.error)
        job.error =
            "Camera capture failed. No image was obtained; tell the user "
            "and retry only if asked.";
      job.length =
          live_photo::output(job.call_id, jpeg, job.jpeg_bytes,
                             uint64_t(now.tv_sec) * 1000 + now.tv_usec / 1000,
                             job.error, job.output, LIVE_MAX_JSON_BYTES);
      free(jpeg);
    } else {
      char result[live_tools::MAX_RESULT]{};
      job.result = job.error     ? ESP_ERR_INVALID_ARG
                   : !job.output ? ESP_ERR_NO_MEM
                                 : config.execute_tool(config.context, job.name,
                                                       job.arguments, result,
                                                       sizeof(result),
                                                       tool_cancelled, &job);
      // A callback must terminate its result; never serialize unbounded data.
      const bool terminated = memchr(result, 0, sizeof(result));
      if (!terminated || !result[0]) {
        job.result = ESP_FAIL;
        snprintf(result, sizeof(result), "Tool returned no valid result.");
      }
      char message[live_tools::MAX_RESULT + 64];
      snprintf(message, sizeof(message), "%s%s",
               job.result == ESP_OK ? "" : "Tool failed: ",
               job.error ? job.error : result);
      job.length = live_photo::output(job.call_id, nullptr, 0, 0, message,
                                      job.output, LIVE_MAX_JSON_BYTES);
    }
    if (!job.length) {
      job.result = ESP_FAIL;
      job.length = live_photo::output(job.call_id, nullptr, 0, 0,
                                      "Tool returned invalid output.",
                                      job.output, LIVE_MAX_JSON_BYTES);
    }
    job.elapsed_us = esp_timer_get_time() - began;
    ESP_LOGI(TAG, "tool=%s ok=%d jpeg_bytes=%u elapsed_us=%lu diagnostic=%d",
             job.is_photo ? "capture_photo" : job.name, job.result == ESP_OK,
             unsigned(job.jpeg_bytes), (unsigned long)job.elapsed_us,
             job.diagnostic);
    // An idle diagnostic owns the start gate until its USB dump is finished.
    // Neither image data nor its base64 expansion is logged during a session.
    if (job.diagnostic && job.owns_start && job.result == ESP_OK)
      printf("PHOTO_BEGIN\n%s\nPHOTO_END\n", job.output);
    photo_phase = PhotoPhase::ready;
    xSemaphoreGive(control_wake);
  }
}

void publish_photo_job() {
  portENTER_CRITICAL(&status_lock);
  status.photo_busy = photo_job.is_photo;
  status.tool_busy = true;
  portEXIT_CRITICAL(&status_lock);
  photo_phase = PhotoPhase::queued;
  xTaskNotifyGive(photo_task);
}

void service_photos() {
  if (!photo_task)
    return;
  if (photo_phase.load() == PhotoPhase::ready) {
    auto &job = photo_job;
    const bool current = session && !stop && !failed &&
                         job.generation == photo_batch->generation &&
                         live_session_state(session) == LIVE_ACTIVE;
    uint32_t send_us = 0;
    if (!job.diagnostic && current) {
      const int64_t began = esp_timer_get_time();
      const auto result =
          job.length
              ? live_session_response_item(session, job.output, job.length)
              : LIVE_OUT_OF_MEMORY;
      send_us = esp_timer_get_time() - began;
      if (result != LIVE_OK)
        error("Client tool result could not be sent");
      else
        photo_batch->submitted(job.call_id);
      ESP_LOGI(TAG, "photo result sent=%d send_us=%lu", result == LIVE_OK,
               (unsigned long)send_us);
    }
    portENTER_CRITICAL(&status_lock);
    status.photo_busy = status.tool_busy = false;
    if ((current || job.diagnostic) && !job.is_photo) {
      ++status.tool_calls;
      if (job.result != ESP_OK)
        ++status.tool_errors;
      status.tool_max_us = std::max(status.tool_max_us, job.elapsed_us);
    }
    if ((current || job.diagnostic) && job.is_photo) {
      if (job.result == ESP_OK)
        ++status.photos_captured;
      else
        ++status.photo_errors;
      status.photo_capture_max_us =
          std::max(status.photo_capture_max_us, job.elapsed_us);
      status.photo_send_max_us = std::max(status.photo_send_max_us, send_us);
    }
    portEXIT_CRITICAL(&status_lock);
    free(job.output);
    job.output = nullptr;
    if (job.owns_start)
      starting = false;
    photo_phase = PhotoPhase::idle;
  }
  if (!session || stop || failed || live_session_state(session) != LIVE_ACTIVE)
    return;
  if (photo_batch->ready()) {
    if (live_session_response_create(session) != LIVE_OK)
      error("Client tool continuation could not be sent");
    else
      photo_batch->continued = true;
  }
  if (failed)
    return;
  auto *call = photo_batch->next();
  auto expected = PhotoPhase::idle;
  if (call &&
      photo_phase.compare_exchange_strong(expected, PhotoPhase::reserved)) {
    photo_job = {};
    photo_job.generation = photo_batch->generation;
    photo_job.epoch = tool_epoch.load();
    photo_job.is_photo =
        !strcmp(call->name, "capture_photo") && config.capture_photo;
    snprintf(photo_job.name, sizeof(photo_job.name), "%s", call->name);
    snprintf(photo_job.arguments, sizeof(photo_job.arguments), "%s",
             call->arguments);
    snprintf(photo_job.call_id, sizeof(photo_job.call_id), "%s", call->id);
    photo_job.error = call->error;
    if (!photo_job.error && photo_job.is_photo) {
      if (photo_attempts >= live_photo::MAX_CAPTURES_PER_SESSION)
        photo_job.error = "Camera capture limit reached. Start a new session "
                          "for more photos.";
      else
        ++photo_attempts;
    }
    if (!photo_job.is_photo && !photo_job.error) {
      if (tool_attempts >= live_tools::MAX_CALLS_PER_SESSION)
        photo_job.error = "Board tool limit reached for this session.";
      else
        ++tool_attempts;
    }
    call->started = true;
    publish_photo_job();
  }
}

void mark_startup(live_startup_stage_t stage) {
  const uint32_t elapsed = (esp_timer_get_time() - startup_origin_us) / 1000;
  portENTER_CRITICAL(&status_lock);
  const bool first =
      status.startup_available && status.startup_ms[stage] == UINT32_MAX;
  if (first)
    status.startup_ms[stage] = elapsed;
  portEXIT_CRITICAL(&status_lock);
  if (first)
    ESP_LOGI(TAG, "startup stage=%s elapsed_ms=%lu", STARTUP_NAMES[stage],
             static_cast<unsigned long>(elapsed));
}

void message(const char *text) {
  portENTER_CRITICAL(&status_lock);
  snprintf(status.status, sizeof(status.status), "%s", text);
  portEXIT_CRITICAL(&status_lock);
  ESP_LOGI(TAG, "%s", text);
}
void error(const char *text) {
  failed = true;
  message(text);
}

int send_event(void *, const char *json, size_t length) {
  if (!peer || !channel_open)
    return -1;
  return peer_connection_datachannel_send_sid(peer, const_cast<char *>(json),
                                              length, stream_id);
}

void publish_usage(const char *type, const cJSON *root) {
  usage.receive(type, root);
  portENTER_CRITICAL(&status_lock);
  status.usage = usage.snapshot;
  portEXIT_CRITICAL(&status_lock);
}

void inference_status() {
  const bool standby = live_session_in_standby(session);
  portENTER_CRITICAL(&status_lock);
  status.active = true;
  status.standby = standby;
  const bool mic_muted = status.muted;
  portEXIT_CRITICAL(&status_lock);
  message(mic_muted ? "Microphone muted"
          : standby ? "Standby - speak to wake"
                    : "Listening - speak naturally");
}

void event(void *, const char *type, const char *json, size_t length) {
  if (!strcmp(type, "session.started")) {
    cJSON *root = cJSON_ParseWithLength(json, length);
    publish_usage(type, root);
    cJSON_Delete(root);
    mark_startup(LIVE_STARTUP_SESSION_STARTED);
    inference_status();
  } else if (!strcmp(type, "session.paused") ||
             !strcmp(type, "session.resumed")) {
    ESP_LOGI(TAG, "event: %s", type);
    if (live_session_state(session) == LIVE_ACTIVE && !stop)
      inference_status();
  } else if (!strcmp(type, "session.closed") ||
             !strcmp(type, "session.usage.updated")) {
    cJSON *root = cJSON_ParseWithLength(json, length);
    publish_usage(type, root);
    cJSON_Delete(root);
    if (!strcmp(type, "session.closed"))
      message("Session ended");
  } else if (!strcmp(type, "session.delegation.created") &&
             !tools_json.empty()) {
    const auto previous_generation = photo_batch ? photo_batch->generation : 0;
    cJSON *root = cJSON_ParseWithLength(json, length);
    const auto *delegation =
        cJSON_GetObjectItemCaseSensitive(root, "delegation");
    const auto *id = cJSON_GetObjectItemCaseSensitive(delegation, "id");
    if (!cJSON_IsString(id) || !photo_batch->set_delegation(id->valuestring))
      error("Invalid camera delegation identifier");
    if (photo_batch && photo_batch->generation != previous_generation)
      ++tool_epoch;
    cJSON_Delete(root);
  } else if (!strcmp(type, "error")) {
    // Server error envelopes contain no API key; keep diagnostics bounded.
    ESP_LOGE(TAG, "Live error: %.*s",
             static_cast<int>(std::min(length, size_t(1500))), json);
    error("Live API error - see USB log");
  } else if (!strcmp(type, "response.event")) {
    const auto previous_generation = photo_batch ? photo_batch->generation : 0;
    cJSON *root = cJSON_ParseWithLength(json, length);
    publish_usage(type, root);
    const cJSON *nested = cJSON_GetObjectItemCaseSensitive(root, "event");
    auto text = [](const cJSON *object, const char *name) {
      const cJSON *value = cJSON_GetObjectItemCaseSensitive(object, name);
      return cJSON_IsString(value) ? value->valuestring : "";
    };
    const char *nested_type = text(nested, "type");
    const char *delegation_id = text(root, "delegation_id");
    if (!tools_json.empty() && !photo_batch->delegation[0])
      photo_batch->set_delegation(delegation_id);
    if (!tools_json.empty() && photo_batch->matches(delegation_id)) {
      const cJSON *response =
          cJSON_GetObjectItemCaseSensitive(nested, "response");
      if (!strcmp(nested_type, "response.created")) {
        if (!photo_batch->begin(text(response, "id")))
          error("Invalid camera response identifier");
      } else if (!strcmp(nested_type, "response.output_item.done") &&
                 !photo_batch->cancelled) {
        const cJSON *item = cJSON_GetObjectItemCaseSensitive(nested, "item");
        if (!strcmp(text(item, "type"), "function_call")) {
          const char *name = text(item, "name"),
                     *args = text(item, "arguments");
          const char *reason = !live_tools::declared(tools_json, name)
                                   ? "Unknown client tool."
                               : !strcmp(name, "capture_photo") &&
                                       !live_photo::empty_arguments(args)
                                   ? "capture_photo takes an empty JSON object."
                               : strlen(args) > live_tools::MAX_ARGUMENTS
                                   ? "Tool arguments exceed the 512-byte limit."
                                   : nullptr;
          const auto added = photo_batch->add(
              text(item, "call_id"), reason,
              *name && strlen(name) <= 64 ? name : "invalid",
              strlen(args) <= live_tools::MAX_ARGUMENTS ? args : "{}");
          if (added == live_photo::Added::invalid ||
              added == live_photo::Added::full)
            error("Invalid or excessive camera tool calls");
        }
      } else if (!strcmp(nested_type, "response.completed")) {
        photo_batch->complete(text(response, "id"));
      } else if (!strcmp(nested_type, "response.failed") ||
                 !strcmp(nested_type, "response.cancelled") ||
                 !strcmp(nested_type, "response.incomplete") ||
                 !strcmp(nested_type, "error")) {
        photo_batch->cancel();
      }
    }
    if (photo_batch && photo_batch->generation != previous_generation)
      ++tool_epoch;
    if (!strstr(nested_type, ".delta")) {
      const cJSON *response =
          cJSON_GetObjectItemCaseSensitive(nested, "response");
      const cJSON *item = cJSON_GetObjectItemCaseSensitive(nested, "item");
      ESP_LOGI(TAG, "Responses event=%s model=%s tier=%s item=%s", nested_type,
               text(response, "model"), text(response, "service_tier"),
               text(item, "type"));
      if (!strcmp(nested_type, "response.failed") ||
          !strcmp(nested_type, "error"))
        ESP_LOGE(TAG, "Responses error: %.*s",
                 static_cast<int>(std::min(length, size_t(1500))), json);
    }
    cJSON_Delete(root);
  } else if (!strcmp(type, "session.input_transcript.delta") ||
             !strcmp(type, "session.output_transcript.delta")) {
    cJSON *root = cJSON_ParseWithLength(json, length);
    cJSON *delta = cJSON_GetObjectItemCaseSensitive(root, "delta");
    if (cJSON_IsString(delta)) {
      auto time_ms = [root](const char *name) -> uint32_t {
        const auto *value = cJSON_GetObjectItemCaseSensitive(root, name);
        return cJSON_IsNumber(value) && value->valuedouble >= 0 &&
                       value->valuedouble <= UINT32_MAX
                   ? static_cast<uint32_t>(value->valuedouble)
                   : 0;
      };
      const auto speaker = !strcmp(type, "session.input_transcript.delta")
                               ? LIVE_SPEAKER_USER
                               : LIVE_SPEAKER_ASSISTANT;
      live_transcript_t captions;
      portENTER_CRITICAL(&status_lock);
      captions = transcripts;
      portEXIT_CRITICAL(&status_lock);
      live_captions::append(captions, speaker, delta->valuestring,
                            time_ms("start_ms"), time_ms("end_ms"));
      portENTER_CRITICAL(&status_lock);
      transcripts = captions;
      status.transcript_revision = captions.revision;
      const bool woke = status.standby && !live_session_in_standby(session);
      portEXIT_CRITICAL(&status_lock);
      if (woke && live_session_state(session) == LIVE_ACTIVE && !stop)
        inference_status();
      ESP_LOGI(TAG, "%s: %s", type, delta->valuestring);
    }
    cJSON_Delete(root);
  } else {
    ESP_LOGI(TAG, "event: %s", type);
  }
}

void on_state(PeerConnectionState state, void *) {
  ESP_LOGI(TAG, "portable peer state=%s",
           peer_connection_state_to_string(state));
  if (state == PEER_CONNECTION_CONNECTED) {
    mark_startup(LIVE_STARTUP_DTLS_CONNECTED);
    connected = true;
  }
  if (state == PEER_CONNECTION_FAILED ||
      state == PEER_CONNECTION_DISCONNECTED) {
    connected = false;
    error("WebRTC disconnected");
  }
}
void on_sctp_open(void *) {
  mark_startup(LIVE_STARTUP_SCTP_CONNECTED);
  if (peer_connection_create_datachannel(peer, DATA_CHANNEL_RELIABLE, 0, 0,
                                         const_cast<char *>("oai-events"),
                                         const_cast<char *>("")) < 0)
    error("Could not open Live data channel");
}
void on_sctp_close(void *) { error("Live data channel closed"); }
void on_data(char *data, size_t size, void *, uint16_t sid) {
  if (!size)
    return;
  // Incoming data proves DCEP completion; lookup also confirms the expected
  // label.
  const char *label = peer_connection_lookup_sid_label(peer, sid);
  if (!label || strcmp(label, "oai-events"))
    return;
  if (!channel_open) {
    channel_open = true;
    stream_id = sid;
    mark_startup(LIVE_STARTUP_DATA_CHANNEL_OPEN);
  }
  if (live_session_receive(session, data, size) != LIVE_OK)
    error("Invalid Live event");
}
void on_audio(uint8_t *data, size_t size, void *) {
  if (!audio_running || !size)
    return;
  if (size > PACKET_BYTES) {
    error("Incoming Opus packet too large");
    return;
  }
  if (!first_audio_received) {
    first_audio_received = true;
    mark_startup(LIVE_STARTUP_FIRST_AUDIO_RX);
  }
  Packet p{};
  p.received_at_us = esp_timer_get_time();
  p.size = size;
  memcpy(p.data, data, size);
  bool dropped = xQueueSend(rx, &p, 0) != pdTRUE;
  portENTER_CRITICAL(&status_lock);
  ++status.received_packets;
  if (dropped) {
    ++status.dropped_packets;
    ++status.rx_queue_drops;
  }
  portEXIT_CRITICAL(&status_lock);
}

void capture(void *) {
  int16_t pcm[SAMPLES];
  Packet packet{};
  uint32_t capture_timestamp = 0;
  while (audio_running) {
    if (!connected) {
      vTaskDelay(pdMS_TO_TICKS(10));
      continue;
    }
    if (config.read(config.context, pcm, SAMPLES) != ESP_OK) {
      error("Microphone read failed");
      break;
    }
    int peak = 0;
    for (int16_t s : pcm)
      peak = std::max(peak, abs(static_cast<int>(s)));
    portENTER_CRITICAL(&status_lock);
    status.mic_peak = peak;
    portEXIT_CRITICAL(&status_lock);
    if (muted)
      memset(pcm, 0, sizeof(pcm));
    esp_audio_enc_in_frame_t in{};
    in.buffer = reinterpret_cast<uint8_t *>(pcm);
    in.len = sizeof(pcm);
    esp_audio_enc_out_frame_t out{};
    out.buffer = packet.data;
    out.len = sizeof(packet.data);
    int64_t encode_start = esp_timer_get_time();
    if (esp_opus_enc_process(encoder, &in, &out) != ESP_AUDIO_ERR_OK ||
        out.encoded_bytes <= 0) {
      error("Opus encode failed");
      break;
    }
    portENTER_CRITICAL(&status_lock);
    status.encode_max_us = std::max(
        status.encode_max_us, uint32_t(esp_timer_get_time() - encode_start));
    portEXIT_CRITICAL(&status_lock);
    packet.size = out.encoded_bytes;
    packet.capture_timestamp = capture_timestamp;
    // Advance for every captured frame, including ones dropped by the queue.
    // Opus RTP uses 48 kHz even though this board captures at 24 kHz.
    capture_timestamp += SAMPLES * 48000 / RATE;
    if (xQueueSend(tx, &packet, 0) != pdTRUE) {
      portENTER_CRITICAL(&status_lock);
      ++status.dropped_packets;
      ++status.tx_queue_drops;
      portEXIT_CRITICAL(&status_lock);
    } else
      xSemaphoreGive(control_wake);
  }
  ESP_LOGI(TAG, "capture stack minimum free=%u",
           uxTaskGetStackHighWaterMark(nullptr));
  capture_done = true;
  vTaskDeleteWithCaps(nullptr);
}
void playback(void *) {
  // Opus permits up to 120 ms per packet. Decode directly at the board's 24
  // kHz.
  int16_t pcm[RATE * 120 / 1000];
  Packet packet{};
  bool first = true;
  const bool buffering = playout_buffer_enabled.load();
  live_audio::Prebuffer reserve(config.playout_buffer_ms
                                    ? config.playout_buffer_ms
                                    : live_audio::Prebuffer::DELAY_MS);
  bool priming = true;
  uint32_t last_dma_empty = 0;
  int64_t last_write_at = 0;
  auto dma_empty = [] {
    return config.output_starvations ? config.output_starvations(config.context)
                                     : 0;
  };
  portENTER_CRITICAL(&status_lock);
  status.playout_target_ms = buffering ? reserve.delay_ms() : 0;
  portEXIT_CRITICAL(&status_lock);
  auto write_pcm = [&](const int16_t *data, size_t samples) {
    const uint32_t before = dma_empty();
    const int64_t start = esp_timer_get_time();
    if (config.write(config.context, data, samples) != ESP_OK) {
      error("Speaker write failed");
      return false;
    }
    last_write_at = esp_timer_get_time();
    const uint32_t after = dma_empty();
    portENTER_CRITICAL(&status_lock);
    status.speaker_write_max_us =
        std::max(status.speaker_write_max_us, uint32_t(last_write_at - start));
    // Ignore empty DMA before the first real write, including intentional
    // startup priming. Afterwards this counts actual driver empty events.
    status.speaker_dma_empty_events +=
        after - (first ? before : last_dma_empty);
    status.played_samples += samples;
    portEXIT_CRITICAL(&status_lock);
    last_dma_empty = after;
    if (first) {
      mark_startup(LIVE_STARTUP_FIRST_PLAYBACK);
      first = false;
    }
    return true;
  };
  while (audio_running) {
    if (priming && reserve.ready(esp_timer_get_time() / 1000, buffering)) {
      if (!write_pcm(reserve.pcm, reserve.size))
        break;
      reserve.clear();
      priming = false;
      continue;
    }
    if (xQueueReceive(rx, &packet,
                      pdMS_TO_TICKS(priming && reserve.size ? 5 : 50)) !=
        pdTRUE) {
      if (!first && !priming) {
        portENTER_CRITICAL(&status_lock);
        ++status.playback_wait_timeouts;
        portEXIT_CRITICAL(&status_lock);
      }
      continue;
    }
    esp_audio_dec_in_raw_t in{};
    in.buffer = packet.data;
    in.len = packet.size;
    in.frame_recover = ESP_AUDIO_DEC_RECOVERY_NONE;
    esp_audio_dec_out_frame_t out{};
    out.buffer = reinterpret_cast<uint8_t *>(pcm);
    out.len = sizeof(pcm);
    esp_audio_dec_info_t info{};
    int64_t decode_start = esp_timer_get_time();
    if (esp_opus_dec_decode(decoder, &in, &out, &info) != ESP_AUDIO_ERR_OK ||
        out.decoded_size <= 0 || out.decoded_size > sizeof(pcm)) {
      error("Opus decode failed");
      break;
    }
    const uint32_t decode_us = esp_timer_get_time() - decode_start;
    size_t samples = out.decoded_size / sizeof(int16_t);
    uint32_t peak = 0, clipped = 0;
    for (size_t i = 0; i < samples; ++i) {
      const uint32_t magnitude = abs(int(pcm[i]));
      peak = std::max(peak, magnitude);
      clipped += magnitude >= 32760;
    }
    portENTER_CRITICAL(&status_lock);
    status.decode_max_us = std::max(status.decode_max_us, decode_us);
    status.rx_queue_age_max_us =
        std::max(status.rx_queue_age_max_us,
                 uint32_t(decode_start - packet.received_at_us));
    status.decoded_peak = std::max(status.decoded_peak, peak);
    status.decoded_near_full_scale_samples += clipped;
    portEXIT_CRITICAL(&status_lock);
    if (buffering && !first && !priming &&
        ((config.output_starvations && dma_empty() != last_dma_empty) ||
         (!config.output_starvations &&
          decode_start - last_write_at > reserve.delay_ms() * 1000))) {
      priming = true;
      portENTER_CRITICAL(&status_lock);
      ++status.playout_rebuffers;
      portEXIT_CRITICAL(&status_lock);
    }
    if (priming) {
      if (!reserve.append(pcm, samples, esp_timer_get_time() / 1000)) {
        error("PCM priming buffer overflow");
        break;
      }
    } else if (!write_pcm(pcm, samples))
      break;
  }
  ESP_LOGI(TAG, "playback stack minimum free=%u",
           uxTaskGetStackHighWaterMark(nullptr));
  playback_done = true;
  vTaskDeleteWithCaps(nullptr);
}

void log_playout() {
  live_esp32_status_t s{};
  live_esp32_status(&s);
  ESP_LOGI(TAG,
           "playout target_ms=%lu dma_empty=%lu rebuffers=%lu "
           "queue_age_max_us=%lu write_max_us=%lu pcm_peak=%lu "
           "pcm_near_full_scale=%lu",
           (unsigned long)s.playout_target_ms,
           (unsigned long)s.speaker_dma_empty_events,
           (unsigned long)s.playout_rebuffers,
           (unsigned long)s.rx_queue_age_max_us,
           (unsigned long)s.speaker_write_max_us, (unsigned long)s.decoded_peak,
           (unsigned long)s.decoded_near_full_scale_samples);
}

// The portable peer and SCTP timers have exactly one owning task. Capture and
// playback only exchange bounded queues with it; they never enter the stack.
void send_queued_audio() {
  // A successful queue receive copies the entire Packet; a failed receive
  // exits before inspecting it. Do not clear 1.5 KiB on every empty poll.
  Packet packet;
  for (unsigned i = 0; i < 4 && connected && audio_running; ++i) {
    if (xQueueReceive(tx, &packet, 0) != pdTRUE)
      break;
    int64_t send_start = esp_timer_get_time();
    const int result = peer_connection_send_audio_at(
        peer, packet.data, packet.size, packet.capture_timestamp);
    uint32_t send_us = esp_timer_get_time() - send_start;
    portENTER_CRITICAL(&status_lock);
    status.peer_send_max_us = std::max(status.peer_send_max_us, send_us);
    if (send_us > 20000)
      ++status.peer_send_over_20ms;
    if (!result)
      ++status.sent_packets;
    else {
      ++status.dropped_packets;
      ++status.send_errors;
    }
    portEXIT_CRITICAL(&status_lock);
  }
}

void publish_preconnect() {
  preconnect_ready = preconnection.state == PreconnectState::Ready;
  preconnect_pending = preconnection.state == PreconnectState::Connecting;
}

esp_transport_handle_t take_preconnection() {
  const uint32_t network = network_generation.load();
  // If Start arrives mid-handshake, finish that handshake on this same task.
  // Stop and network changes cancel it; no second socket races it.
  do {
    preconnection.validate(esp_timer_get_time() / 1000,
                           network_generation.load(),
                           preconnect_enabled && !stop);
    if (stop || network != network_generation.load()) {
      preconnection.clear();
      break;
    }
    preconnection.advance(esp_timer_get_time() / 1000);
    if (preconnection.state != PreconnectState::Connecting)
      break;
    vTaskDelay(pdMS_TO_TICKS(20));
  } while (true);
  // Recheck after the last handshake step, which can yield to Wi-Fi events.
  preconnection.validate(esp_timer_get_time() / 1000, network_generation.load(),
                         preconnect_enabled && !stop);
  auto tls = preconnection.take();
  if (tls)
    ESP_LOGI(TAG, "preconnect used age_ms=%lld handshake_ms=%lld",
             esp_timer_get_time() / 1000 - preconnection.ready_at,
             preconnection.ready_at - preconnection.started_at);
  publish_preconnect();
  return live_https::wrap(tls);
}

bool signal() {
  message("Creating Live session");
  std::vector<char> body(LIVE_MAX_JSON_BYTES + 1),
      answer(LIVE_MAX_JSON_BYTES + 1), sdp(LIVE_MAX_SDP_BYTES + 1);
  if (live_session_offer(session, offer.c_str(), body.data(), body.size()) !=
      LIVE_OK) {
    error("Could not serialize SDP");
    return false;
  }
  esp_http_client_config_t http{};
  http.url = "https://api.openai.com/v1/live/sessions";
  http.crt_bundle_attach = esp_crt_bundle_attach;
  http.timeout_ms = 30000;
  http.buffer_size = 4096;
  http.buffer_size_tx = 4096;
  http.event_handler = [](esp_http_client_event_t *event) -> esp_err_t {
    if (event->event_id == HTTP_EVENT_ON_CONNECTED)
      mark_startup(LIVE_STARTUP_HTTPS_CONNECTED);
    return ESP_OK;
  };
  // Never forward a project key to a redirect target.
  http.disable_auto_redirect = true;
  auto warm_transport = take_preconnection();
  http.transport = warm_transport;
  if (stop) {
    if (warm_transport)
      esp_transport_destroy(warm_transport);
    return false;
  }
  esp_http_client_handle_t client = esp_http_client_init(&http);
  if (!client) {
    if (warm_transport)
      esp_transport_destroy(warm_transport);
    error("HTTP allocation failed");
    return false;
  }
  std::string bearer = "Bearer ";
  bearer += config.api_key;
  esp_http_client_set_method(client, HTTP_METHOD_POST);
  esp_http_client_set_header(client, "Authorization", bearer.c_str());
  esp_http_client_set_header(client, "Content-Type", "application/json");
  int body_length = strlen(body.data());
  esp_err_t result = esp_http_client_open(client, body_length);
  if (result != ESP_OK && warm_transport && !stop) {
    // open() sends headers only. The nonempty session JSON has not been sent,
    // so replacing a stale cached socket here cannot duplicate a session.
    // Never retry once write() starts, even if the response is lost.
    ESP_LOGW(TAG, "preconnect stale before body; using a fresh connection");
    esp_http_client_cleanup(client);
    esp_transport_destroy(warm_transport);
    warm_transport = nullptr;
    http.transport = nullptr;
    portENTER_CRITICAL(&status_lock);
    status.startup_ms[LIVE_STARTUP_HTTPS_CONNECTED] = UINT32_MAX;
    portEXIT_CRITICAL(&status_lock);
    client = esp_http_client_init(&http);
    if (client) {
      esp_http_client_set_method(client, HTTP_METHOD_POST);
      esp_http_client_set_header(client, "Authorization", bearer.c_str());
      esp_http_client_set_header(client, "Content-Type", "application/json");
      result = esp_http_client_open(client, body_length);
    } else
      result = ESP_ERR_NO_MEM;
  }
  portENTER_CRITICAL(&status_lock);
  status.https_preconnected = warm_transport && result == ESP_OK;
  portEXIT_CRITICAL(&status_lock);
  int sent = 0;
  while (result == ESP_OK && sent < body_length) {
    int n =
        esp_http_client_write(client, body.data() + sent, body_length - sent);
    if (n <= 0)
      result = ESP_FAIL;
    else
      sent += n;
  }
  if (result == ESP_OK)
    mark_startup(LIVE_STARTUP_REQUEST_SENT);
  int total = 0, code = 0;
  if (result == ESP_OK && esp_http_client_fetch_headers(client) >= 0) {
    mark_startup(LIVE_STARTUP_RESPONSE_HEADERS);
    code = esp_http_client_get_status_code(client);
    while (total < LIVE_MAX_JSON_BYTES) {
      int n = esp_http_client_read(client, answer.data() + total,
                                   LIVE_MAX_JSON_BYTES - total);
      if (n < 0) {
        result = ESP_FAIL;
        break;
      }
      if (!n)
        break;
      total += n;
    }
    if (!esp_http_client_is_complete_data_received(client))
      result = ESP_FAIL;
    if (result == ESP_OK)
      mark_startup(LIVE_STARTUP_RESPONSE_BODY);
  } else
    result = ESP_FAIL;
  esp_http_client_cleanup(client);
  if (warm_transport)
    esp_transport_destroy(warm_transport);
  std::fill(bearer.begin(), bearer.end(), '\0');
  ESP_LOGI(TAG, "Live HTTP %d, response bytes=%d", code, total);
  if (result != ESP_OK || code != 201) {
    ESP_LOGE(TAG, "Creation failed: %.*s", std::min(total, 1800),
             answer.data());
    char message_text[96];
    snprintf(message_text, sizeof(message_text),
             "Live request failed (HTTP %d)", code);
    error(message_text);
    return false;
  }
  if (live_session_answer(session, code, answer.data(), total, sdp.data(),
                          sdp.size()) != LIVE_OK) {
    error("Invalid Live session answer");
    return false;
  }
  portENTER_CRITICAL(&status_lock);
  snprintf(status.session_id, sizeof(status.session_id), "%s",
           live_session_id(session));
  portEXIT_CRITICAL(&status_lock);
  ESP_LOGI(TAG, "session_id=%s model=%s", live_session_id(session),
           config.model);
  if (peer_connection_set_remote_description_n(
          peer, sdp.data(), strlen(sdp.data()), SDP_TYPE_ANSWER)) {
    error("SDP answer rejected");
    return false;
  }
  message("Connecting WebRTC");
  return true;
}

bool open_codecs() {
  esp_opus_enc_config_t enc = ESP_OPUS_ENC_CONFIG_DEFAULT();
  enc.sample_rate = RATE;
  enc.channel = ESP_AUDIO_MONO;
  enc.bits_per_sample = ESP_AUDIO_BIT16;
  enc.bitrate = 24000;
  enc.frame_duration = ESP_OPUS_ENC_FRAME_DURATION_20_MS;
  enc.application_mode = ESP_OPUS_ENC_APPLICATION_VOIP;
  enc.complexity = 1;
  enc.enable_fec = false;
  enc.enable_dtx = false;
  enc.enable_vbr = true;
  esp_opus_dec_cfg_t dec = ESP_OPUS_DEC_CONFIG_DEFAULT();
  dec.sample_rate = RATE;
  dec.channel = ESP_AUDIO_MONO;
  dec.frame_duration = ESP_OPUS_DEC_FRAME_DURATION_INVALID;
  dec.self_delimited = false;
  int input_size = 0, output_size = 0;
  if (esp_opus_enc_open(&enc, sizeof(enc), &encoder) != ESP_AUDIO_ERR_OK ||
      esp_opus_enc_get_frame_size(encoder, &input_size, &output_size) !=
          ESP_AUDIO_ERR_OK ||
      input_size != SAMPLES * int(sizeof(int16_t)) ||
      output_size > PACKET_BYTES ||
      esp_opus_dec_open(&dec, sizeof(dec), &decoder) != ESP_AUDIO_ERR_OK) {
    error("Opus initialization failed");
    return false;
  }
  return true;
}
void close_codecs() {
  if (encoder) {
    esp_opus_enc_close(encoder);
    encoder = nullptr;
  }
  if (decoder) {
    esp_opus_dec_close(decoder);
    decoder = nullptr;
  }
}
bool open_audio() {
  if (config.audio_open(config.context) != ESP_OK) {
    error("Audio is busy or unavailable");
    return false;
  }
  if (!open_codecs())
    return false;
  audio_running = true;
  capture_done = false;
  if (xTaskCreatePinnedToCoreWithCaps(
          capture, "live_mic", 48 * 1024, nullptr, 7, nullptr, 0,
          MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT) != pdPASS) {
    capture_done = true;
    error("Microphone task allocation failed");
    return false;
  }
  playback_done = false;
  if (xTaskCreatePinnedToCoreWithCaps(
          playback, "live_speaker", PLAYBACK_STACK, nullptr, 7, nullptr, 0,
          MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT) != pdPASS) {
    playback_done = true;
    error("Speaker task allocation failed");
    return false;
  }
  return true;
}

void run_session() {
  ESP_LOGI(TAG,
           "resources phase=before heap=%lu internal=%lu largest=%lu tasks=%u",
           (unsigned long)esp_get_free_heap_size(),
           (unsigned long)heap_caps_get_free_size(MALLOC_CAP_INTERNAL),
           (unsigned long)heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL),
           uxTaskGetNumberOfTasks());
  failed = false;
  muted = false;
  connected = false;
  channel_open = false;
  first_audio_received = false;
  if (photo_batch)
    photo_batch->clear();
  ++tool_epoch;
  photo_attempts = tool_attempts = 0;
  startup_origin_us = requested_at_us;
  stream_id = 0;
  offer.clear();
  usage.reset(config.model, config.responses_model);
  portENTER_CRITICAL(&status_lock);
  status = {};
  status.tool_busy = photo_phase.load() != PhotoPhase::idle;
  status.photo_busy = false; // An active diagnostic owns the Start gate.
  status.usage = usage.snapshot;
  live_captions::clear(transcripts);
  status.transcript_revision = transcripts.revision;
  status.busy = true;
  status.network_required = true;
  status.startup_available = true;
  std::fill_n(status.startup_ms, LIVE_STARTUP_STAGE_COUNT, UINT32_MAX);
  portEXIT_CRITICAL(&status_lock);
  mark_startup(LIVE_STARTUP_CONTROL);
  xQueueReset(tx);
  xQueueReset(rx);
  message("Preparing voice");
  bool audio_claimed = false;
  live_config_t cfg{};
  cfg.model = config.model;
  cfg.responses_model = config.responses_model;
  cfg.responses_service_tier = config.responses_service_tier;
  cfg.responses_instructions = config.responses_instructions;
  cfg.responses_web_search = config.responses_web_search;
  cfg.wake_on_speech = config.wake_on_speech;
  cfg.idle_timeout_s = config.idle_timeout_s;
  cfg.responses_tools_json = tools_json.empty() ? nullptr : tools_json.c_str();
  cfg.voice = "marin";
  cfg.instructions =
      config.responses_web_search
          ? "You are a friendly voice assistant on a small handheld device. "
            "Speak "
            "in English. Keep answers brief and conversational. Delegate "
            "requests "
            "for current information and internet lookups to your backend, "
            "which "
            "can search the web. Wait for its findings before stating results."
          : "You are a friendly voice assistant on a small handheld device. "
            "Speak "
            "in English. Keep answers brief and conversational. Delegate "
            "questions "
            "when needed.";
  if (config.instructions)
    cfg.instructions = config.instructions;
  cfg.send = send_event;
  cfg.on_event = event;
  if (live_session_create(&cfg, &session) != LIVE_OK) {
    error("Session allocation failed");
    goto cleanup;
  }
  {
    if (!acquire_peer_runtime()) {
      error("Peer runtime initialization failed");
      goto cleanup;
    }
    PeerConfiguration pc{};
    pc.audio_codec = CODEC_OPUS;
    pc.datachannel = DATA_CHANNEL_STRING;
    pc.onaudiotrack = on_audio;
    peer = peer_connection_create(&pc);
    if (!peer) {
      error("Peer allocation failed");
      goto cleanup;
    }
    peer_connection_oniceconnectionstatechange(peer, on_state);
    peer_connection_ondatachannel(peer, on_data, on_sctp_open, on_sctp_close);
    mark_startup(LIVE_STARTUP_PEER_CREATED);
    const char *sdp_offer = peer_connection_create_offer(peer);
    if (!sdp_offer || !*sdp_offer) {
      error("Could not create WebRTC offer");
      goto cleanup;
    }
    offer = sdp_offer;
    int64_t deadline;
    mark_startup(LIVE_STARTUP_OFFER_READY);
    if (stop || !signal())
      goto cleanup;
    // audio_close tolerates a failed acquisition; the board adapter tracks
    // ownership.
    audio_claimed = true;
    if (!open_audio())
      goto cleanup;
    mark_startup(LIVE_STARTUP_AUDIO_READY);
    bool applied_mute = false;
    live_voice::StartupGreeting greeting;
    bool closing = false;
    int64_t close_deadline = 0;
    deadline = esp_timer_get_time() + 30000000;
    int64_t report_at = 0;
    int64_t last_active_poll = 0;
    bool ice_recorded = false;
    while (!failed) {
      const int64_t poll_start = esp_timer_get_time();
      if (last_active_poll) {
        const uint32_t cycle_us = poll_start - last_active_poll;
        portENTER_CRITICAL(&status_lock);
        status.control_cycle_max_us =
            std::max(status.control_cycle_max_us, cycle_us);
        if (cycle_us > 20000)
          ++status.control_cycle_over_20ms;
        portEXIT_CRITICAL(&status_lock);
      }
      if (peer_connection_loop(peer) < 0)
        failed = true;
      send_queued_audio();
      service_photos();
      if (!ice_recorded) {
        PeerConnectionStats stats{};
        peer_connection_get_stats(peer, &stats);
        if (stats.ice_connected) {
          ice_recorded = true;
          mark_startup(LIVE_STARTUP_ICE_PAIRED);
        }
      }
      const uint32_t poll_us = esp_timer_get_time() - poll_start;
      portENTER_CRITICAL(&status_lock);
      status.peer_poll_max_us = std::max(status.peer_poll_max_us, poll_us);
      if (poll_us > 20000)
        ++status.peer_poll_over_20ms;
      portEXIT_CRITICAL(&status_lock);
      auto state = live_session_state(session);
      // Include scheduling, logging, and display contention, not just time
      // inside peer_connection_loop. Exclude setup and teardown from this
      // metric.
      last_active_poll = state == LIVE_ACTIVE ? poll_start : 0;
      if (state == LIVE_CLOSED)
        break;
      if (state != LIVE_ACTIVE && !closing && esp_timer_get_time() > deadline) {
        error("Session startup timed out");
        break;
      }
      if (stop && !closing) {
        if (state == LIVE_ACTIVE && live_session_close(session) == LIVE_OK) {
          closing = true;
          // Live may drain work for 10 seconds, then reconcile usage for 5.
          // Keep receiving the final event with a little transport headroom.
          close_deadline = esp_timer_get_time() + 20000000;
          message("Ending session");
        } else
          break;
      }
      if (closing && esp_timer_get_time() > close_deadline) {
        message("Closed locally - final event timed out");
        break;
      }
      const auto greeting_result =
          greeting.poll(state, stop.load() || closing || failed.load() ||
                                   live_session_in_standby(session),
                        config.greeting, [](const char *text) {
                          return live_session_commentary(session, text);
                        });
      if (greeting_result != LIVE_OK)
        ESP_LOGW(TAG, "Startup greeting send failed: %d; no automatic retry",
                 int(greeting_result));
      const bool requested_mute = muted.load();
      if (!closing && state == LIVE_ACTIVE && requested_mute != applied_mute) {
        if (live_session_mute(session, requested_mute) == LIVE_OK) {
          applied_mute = requested_mute;
          portENTER_CRITICAL(&status_lock);
          status.muted = applied_mute;
          portEXIT_CRITICAL(&status_lock);
          inference_status();
        }
      }
      if (esp_timer_get_time() > report_at) {
        live_esp32_status_t s{};
        live_esp32_status(&s);
        ESP_LOGI(
            TAG,
            "audio tx=%lu rx=%lu played=%lu dropped=%lu mic_peak=%lu heap=%lu "
            "internal=%lu",
            (unsigned long)s.sent_packets, (unsigned long)s.received_packets,
            (unsigned long)s.played_samples, (unsigned long)s.dropped_packets,
            (unsigned long)s.mic_peak, (unsigned long)esp_get_free_heap_size(),
            (unsigned long)heap_caps_get_free_size(MALLOC_CAP_INTERNAL));
        report_at = esp_timer_get_time() + 5000000;
        PeerConnectionStats stats{};
        peer_connection_get_stats(peer, &stats);
        ESP_LOGI(
            TAG,
            "portable rx_rejected=%llu seq_gaps=%lu reordered=%lu "
            "rx_gap_ms=%lu late_drop=%lu reorder_full=%lu playout_lost=%lu "
            "encode_max_us=%lu decode_max_us=%lu "
            "playback_wait=%lu",
            (unsigned long long)stats.rejected_rtp,
            (unsigned long)stats.rtp_sequence_gaps,
            (unsigned long)stats.rtp_reordered,
            (unsigned long)stats.rtp_max_gap_ms,
            (unsigned long)stats.rtp_late_dropped,
            (unsigned long)stats.rtp_buffer_dropped,
            (unsigned long)stats.rtp_playout_gaps,
            (unsigned long)s.encode_max_us, (unsigned long)s.decode_max_us,
            (unsigned long)s.playback_wait_timeouts);
        ESP_LOGI(
            TAG,
            "audio detail tx_drop=%lu rx_drop=%lu send_err=%lu "
            "poll_max_us=%lu poll_slow=%lu tx_depth=%u rx_depth=%u "
            "send_max_us=%lu send_slow=%lu",
            (unsigned long)s.tx_queue_drops, (unsigned long)s.rx_queue_drops,
            (unsigned long)s.send_errors, (unsigned long)s.peer_poll_max_us,
            (unsigned long)s.peer_poll_over_20ms, uxQueueMessagesWaiting(tx),
            uxQueueMessagesWaiting(rx), (unsigned long)s.peer_send_max_us,
            (unsigned long)s.peer_send_over_20ms);
        log_playout();
        ESP_LOGI(TAG, "control active_cycle_max_us=%lu active_cycle_slow=%lu",
                 (unsigned long)s.control_cycle_max_us,
                 (unsigned long)s.control_cycle_over_20ms);
      }
      // UDP polling is nonblocking. Audio/control events wake the owner
      // immediately; the 2 ms bound keeps receive, reordering, retransmission
      // and consent timers serviced even without local events. This replaces
      // the previous 1 ms select plus one-tick sleep at the 1 kHz board tick.
      xSemaphoreTake(control_wake, std::max(TickType_t(1), pdMS_TO_TICKS(2)));
    }
  }
cleanup:
  if (photo_batch)
    photo_batch->clear();
  ++tool_epoch;
  audio_running = false;
  // Never destroy codec or buffers while an audio task can still reference
  // them.
  while (!capture_done || !playback_done)
    vTaskDelay(pdMS_TO_TICKS(10));
  close_codecs();
  if (audio_claimed)
    config.audio_close(config.context);
  if (peer) {
    peer_connection_destroy(peer);
    peer = nullptr;
  }
  if (!release_peer_runtime())
    error("Peer shutdown incomplete");
  if (session) {
    bool finalized = live_session_finalized(session);
    ESP_LOGI(TAG, "session finished id=%s finalized=%d",
             live_session_id(session), finalized);
    portENTER_CRITICAL(&status_lock);
    status.finalized = finalized;
    portEXIT_CRITICAL(&status_lock);
    live_session_transport_closed(session);
    live_session_destroy(session);
    session = nullptr;
  }
  portENTER_CRITICAL(&status_lock);
  status.active = false;
  status.standby = false;
  status.busy = false;
  status.network_required = false;
  portEXIT_CRITICAL(&status_lock);
  starting = false;
  ESP_LOGI(TAG,
           "resources phase=after heap=%lu internal=%lu largest=%lu tasks=%u",
           (unsigned long)esp_get_free_heap_size(),
           (unsigned long)heap_caps_get_free_size(MALLOC_CAP_INTERNAL),
           (unsigned long)heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL),
           uxTaskGetNumberOfTasks());
  const auto &u = usage.snapshot;
  ESP_LOGI(TAG,
           "usage source=%s seconds_available=%d seconds=%.1f "
           "tokens_available=%d partial=%d input=%llu output=%llu total=%llu "
           "cached=%llu responses=%lu",
           u.seconds_final ? "final" : "last_reported", u.seconds_available,
           u.seconds, u.tokens_available, u.tokens_partial,
           (unsigned long long)u.input_tokens,
           (unsigned long long)u.output_tokens,
           (unsigned long long)u.total_tokens,
           (unsigned long long)u.cached_tokens, (unsigned long)u.responses);
}
void audio_diagnostic() {
  portENTER_CRITICAL(&status_lock);
  status = {};
  live_captions::clear(transcripts);
  status.transcript_revision = transcripts.revision;
  status.busy = true;
  portEXIT_CRITICAL(&status_lock);
  message("Audio check - playing test tone");
  if (config.audio_open(config.context) == ESP_OK && open_codecs()) {
    int16_t input[SAMPLES], output[SAMPLES], decoded[RATE * 120 / 1000];
    uint8_t encoded[PACKET_BYTES];
    double quiet_energy = 0, tone_energy = 0;
    int quiet_frames = 0, tone_frames = 0;
    bool ok = true;
    int frame = 0;
    for (; frame < 150 && !stop; ++frame) {
      bool tone = frame >= 25 && frame < 75;
      for (int i = 0; i < SAMPLES; ++i)
        output[i] = tone ? int16_t(3000 * sinf(2 * 3.14159265f * i / 48)) : 0;
      esp_audio_enc_in_frame_t raw{};
      raw.buffer = reinterpret_cast<uint8_t *>(output);
      raw.len = sizeof(output);
      esp_audio_enc_out_frame_t packet{};
      packet.buffer = encoded;
      packet.len = sizeof(encoded);
      esp_audio_dec_in_raw_t packet_in{};
      packet_in.buffer = encoded;
      esp_audio_dec_out_frame_t pcm{};
      pcm.buffer = reinterpret_cast<uint8_t *>(decoded);
      pcm.len = sizeof(decoded);
      esp_audio_dec_info_t info{};
      if (esp_opus_enc_process(encoder, &raw, &packet) != ESP_AUDIO_ERR_OK) {
        ok = false;
        message("Local Opus encode failed");
        break;
      }
      packet_in.len = packet.encoded_bytes;
      if (esp_opus_dec_decode(decoder, &packet_in, &pcm, &info) !=
              ESP_AUDIO_ERR_OK ||
          pcm.decoded_size != sizeof(output)) {
        ok = false;
        message("Local Opus decode failed");
        break;
      }
      if (config.write(config.context, decoded, SAMPLES) != ESP_OK ||
          config.read(config.context, input, SAMPLES) != ESP_OK) {
        ok = false;
        message("Local audio I/O failed");
        break;
      }
      double real = 0, imaginary = 0;
      int peak = 0;
      for (int i = 0; i < SAMPLES; ++i) {
        real += input[i] * cosf(2 * 3.14159265f * i / 48);
        imaginary += input[i] * sinf(2 * 3.14159265f * i / 48);
        peak = std::max(peak, abs(int(input[i])));
      }
      double energy =
          2 * (real * real + imaginary * imaginary) / (SAMPLES * SAMPLES);
      if (frame < 20) {
        quiet_energy += energy;
        ++quiet_frames;
      }
      if (frame >= 35 && frame < 70) {
        tone_energy += energy;
        ++tone_frames;
      }
      portENTER_CRITICAL(&status_lock);
      status.mic_peak = peak;
      status.played_samples += SAMPLES;
      portEXIT_CRITICAL(&status_lock);
    }
    if (ok && frame == 150) {
      char result[128];
      snprintf(result, sizeof(result),
               "Opus/I2S complete: 500Hz mic RMS quiet=%.1f tone=%.1f",
               sqrt(quiet_energy / std::max(1, quiet_frames)),
               sqrt(tone_energy / std::max(1, tone_frames)));
      message(result);
    } else if (ok)
      message("Audio test cancelled");
  } else
    message("Audio is busy or unavailable");
  ESP_LOGI(TAG, "diagnostic stack minimum free=%u",
           uxTaskGetStackHighWaterMark(nullptr));
  close_codecs();
  config.audio_close(config.context);
  portENTER_CRITICAL(&status_lock);
  status.busy = false;
  portEXIT_CRITICAL(&status_lock);
  starting = false;
}
void jitter_diagnostic() {
  const bool burst = test_burst.load();
  portENTER_CRITICAL(&status_lock);
  status = {};
  live_captions::clear(transcripts);
  status.transcript_revision = transcripts.revision;
  status.busy = true;
  portEXIT_CRITICAL(&status_lock);
  failed = false;
  connected = false;
  first_audio_received = false;
  xQueueReset(rx);
  message(burst ? "Local receive-burst test" : "Local receive-jitter test");
  bool opened = config.audio_open(config.context) == ESP_OK;
  bool ok = opened && open_codecs();
  if (ok) {
    audio_running = true;
    playback_done = false;
    if (xTaskCreatePinnedToCoreWithCaps(
            playback, "live_speaker", PLAYBACK_STACK, nullptr, 7, nullptr, 0,
            MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT) != pdPASS) {
      playback_done = true;
      ok = false;
    }
  }
  int16_t pcm[SAMPLES];
  constexpr unsigned TEST_FRAMES = 300;
  auto *packets = static_cast<Packet *>(heap_caps_malloc(
      TEST_FRAMES * sizeof(Packet), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  if (!packets) {
    ok = false;
    message("Jitter test allocation failed");
  }
  // Encode before scheduling arrivals. Encoding between callbacks would
  // spread the burst out and hide receive-queue overflow on the real path.
  for (unsigned f = 0; ok && !stop && f < TEST_FRAMES; ++f) {
    for (int i = 0; i < SAMPLES; ++i)
      pcm[i] = int16_t(1200 * sinf(2 * 3.14159265f * i / 48));
    esp_audio_enc_in_frame_t in{};
    in.buffer = reinterpret_cast<uint8_t *>(pcm);
    in.len = sizeof(pcm);
    esp_audio_enc_out_frame_t out{};
    out.buffer = packets[f].data;
    out.len = sizeof(packets[f].data);
    ok = esp_opus_enc_process(encoder, &in, &out) == ESP_AUDIO_ERR_OK &&
         out.encoded_bytes > 0 && out.encoded_bytes <= sizeof(packets[f].data);
    packets[f].size = out.encoded_bytes;
  }
  const int64_t origin = esp_timer_get_time();
  unsigned frames = 0;
  // The normal test adds 80 ms jitter. The burst test adds 480 ms, then
  // delivers 25 packets together, exceeding the old 16-packet queue.
  const unsigned hold = burst ? 24 : 4;
  while (ok && !stop && !failed && frames < TEST_FRAMES) {
    const unsigned phase = frames % 50;
    const unsigned held = frames >= 50 && phase < hold ? hold - phase : 0;
    const int64_t due = origin + (int64_t(frames) + held) * 20000;
    if (esp_timer_get_time() < due) {
      vTaskDelay(pdMS_TO_TICKS(1));
      continue;
    }
    on_audio(packets[frames].data, packets[frames].size, nullptr);
    ++frames;
  }
  heap_caps_free(packets);
  // Wait for all test audio, including the reserve, to be submitted to I2S.
  // Submission does not measure when the final DMA tail reaches the speaker.
  const int64_t deadline = esp_timer_get_time() + 1000000;
  while (ok && !stop && !failed && esp_timer_get_time() < deadline) {
    live_esp32_status_t s{};
    live_esp32_status(&s);
    if (s.played_samples == frames * SAMPLES)
      break;
    vTaskDelay(pdMS_TO_TICKS(5));
  }
  audio_running = false;
  while (!playback_done)
    vTaskDelay(pdMS_TO_TICKS(5));
  log_playout();
  live_esp32_status_t s{};
  live_esp32_status(&s);
  ok = ok && !failed && !stop && s.played_samples == frames * SAMPLES &&
       !s.rx_queue_drops;
  ESP_LOGI(TAG,
           "jitter-test complete mode=%s ok=%d frames=%u samples=%lu drops=%lu",
           burst ? "burst" : "normal", ok, frames,
           (unsigned long)s.played_samples, (unsigned long)s.rx_queue_drops);
  close_codecs();
  config.audio_close(config.context);
  message(ok ? "Receive-jitter test complete"
             : "Receive-jitter test stopped or failed");
  portENTER_CRITICAL(&status_lock);
  status.busy = false;
  portEXIT_CRITICAL(&status_lock);
  starting = false;
}
void control(void *) {
  for (;;) {
    service_photos();
    if (request_pending.exchange(false)) {
      // Keep active media/control work above the display. Idle TLS can spend a
      // long time inside a single crypto step, so it uses a lower priority
      // below.
      vTaskPrioritySet(nullptr, 6);
      if (test_peer) {
        preconnection.clear();
        publish_preconnect();
        bool ok = true;
        for (unsigned i = 0; i < 5 && ok; ++i) {
          ESP_LOGI(TAG, "peer self-test round=%u stage=init", i + 1);
          if (!acquire_peer_runtime()) {
            ok = false;
            break;
          }
          ESP_LOGI(TAG, "peer self-test round=%u stage=create", i + 1);
          PeerConfiguration cfg{};
          cfg.local_address = "127.0.0.1";
          cfg.audio_codec = CODEC_OPUS;
          cfg.datachannel = DATA_CHANNEL_STRING;
          auto *p = peer_connection_create(&cfg);
          ok = p && peer_connection_create_offer(p);
          if (p)
            peer_connection_destroy(p);
          if (!release_peer_runtime())
            ok = false;
          // Let the idle task reclaim deleted FreeRTOS task stacks/TCBs.
          vTaskDelay(pdMS_TO_TICKS(100));
          ESP_LOGI(
              TAG,
              "peer self-test round=%u ok=%d heap=%lu internal=%lu tasks=%u",
              i + 1, ok, (unsigned long)esp_get_free_heap_size(),
              (unsigned long)heap_caps_get_free_size(MALLOC_CAP_INTERNAL),
              uxTaskGetNumberOfTasks());
        }
        message(ok ? "Peer lifecycle test passed"
                   : "Peer lifecycle test failed");
        starting = false;
      } else if (test_jitter) {
        preconnection.clear();
        publish_preconnect();
        jitter_diagnostic();
      } else if (test_audio) {
        preconnection.clear();
        publish_preconnect();
        audio_diagnostic();
      } else
        run_session();
    } else {
      vTaskPrioritySet(nullptr, 2);
      const auto previous = preconnection.state;
      preconnection.idle(esp_timer_get_time() / 1000, network_generation.load(),
                         preconnect_enabled.load());
      if (preconnection.state == PreconnectState::Ready &&
          previous != PreconnectState::Ready)
        ESP_LOGI(TAG, "preconnect ready handshake_ms=%lld",
                 preconnection.ready_at - preconnection.started_at);
      else if (previous == PreconnectState::Connecting &&
               preconnection.state == PreconnectState::Empty)
        ESP_LOGI(TAG, "preconnect cancelled or failed; retry deferred");
      publish_preconnect();
    }
    xSemaphoreTake(control_wake,
                   pdMS_TO_TICKS(preconnect_pending.load() ? 20 : 250));
  }
}
} // namespace

esp_err_t live_esp32_init(const live_esp32_config_t *cfg) {
  if (!cfg || !cfg->api_key || !*cfg->api_key || !cfg->model ||
      !cfg->audio_open || !cfg->audio_close || !cfg->read || !cfg->write)
    return ESP_ERR_INVALID_ARG;
  if ((cfg->capture_photo || cfg->execute_tool) &&
      (!cfg->responses_model || !*cfg->responses_model))
    return ESP_ERR_INVALID_ARG;
  if (cfg->greeting &&
      (!*cfg->greeting || strlen(cfg->greeting) > LIVE_MAX_COMMENTARY_BYTES))
    return ESP_ERR_INVALID_ARG;
  if (cfg->playout_buffer_ms &&
      !live_audio::Prebuffer::valid_delay(cfg->playout_buffer_ms))
    return ESP_ERR_INVALID_ARG;
  if (cfg->idle_timeout_s &&
      (!cfg->wake_on_speech || cfg->idle_timeout_s < LIVE_MIN_IDLE_TIMEOUT_S ||
       cfg->idle_timeout_s > LIVE_MAX_IDLE_TIMEOUT_S))
    return ESP_ERR_INVALID_ARG;
  if (initialized)
    return ESP_ERR_INVALID_STATE;
  if (bool(cfg->execute_tool) != bool(cfg->tools_json) ||
      !live_tools::configure(cfg->tools_json, cfg->capture_photo, tools_json))
    return ESP_ERR_INVALID_ARG;
  config = *cfg;
  if (!tools_json.empty()) {
    void *storage = heap_caps_malloc(sizeof(live_photo::Batch),
                                     MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!storage)
      return ESP_ERR_NO_MEM;
    photo_batch.reset(new (storage) live_photo::Batch{});
  }
  control_wake = xSemaphoreCreateBinary();
  tx = xQueueCreateWithCaps(8, sizeof(Packet),
                            MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  // Headroom for recovered Wi-Fi bursts, not a larger priming target. This
  // bounded PSRAM queue is drained immediately; default priming stays 120 ms.
  rx = xQueueCreateWithCaps(64, sizeof(Packet),
                            MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  if (!control_wake || !tx || !rx) {
    if (tx)
      vQueueDeleteWithCaps(tx);
    if (rx)
      vQueueDeleteWithCaps(rx);
    if (control_wake)
      vSemaphoreDelete(control_wake);
    control_wake = nullptr;
    tx = rx = nullptr;
    photo_batch.reset();
    return ESP_ERR_NO_MEM;
  }
  if (!tools_json.empty() &&
      xTaskCreatePinnedToCoreWithCaps(
          photo_worker, "live_tools", 12 * 1024, nullptr, 2, &photo_task, 1,
          MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT) != pdPASS) {
    vQueueDeleteWithCaps(tx);
    vQueueDeleteWithCaps(rx);
    vSemaphoreDelete(control_wake);
    control_wake = nullptr;
    tx = rx = nullptr;
    photo_batch.reset();
    return ESP_ERR_NO_MEM;
  }
  if (xTaskCreatePinnedToCoreWithCaps(
          control, "live_control", 64 * 1024, nullptr, 6, &controller, 1,
          MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT) != pdPASS) {
    if (photo_task)
      vTaskDeleteWithCaps(photo_task);
    photo_task = nullptr;
    vQueueDeleteWithCaps(tx);
    vQueueDeleteWithCaps(rx);
    vSemaphoreDelete(control_wake);
    control_wake = nullptr;
    tx = rx = nullptr;
    photo_batch.reset();
    return ESP_ERR_NO_MEM;
  }
  initialized = true;
  message("Ready - tap Start");
  return ESP_OK;
}
esp_err_t live_esp32_start(void) {
  bool expected = false;
  if (!initialized || !starting.compare_exchange_strong(expected, true))
    return ESP_ERR_INVALID_STATE;
  stop = false;
  test_audio = false;
  test_jitter = false;
  test_peer = false;
  requested_at_us = esp_timer_get_time();
  request_pending = true;
  xSemaphoreGive(control_wake);
  return ESP_OK;
}
esp_err_t live_esp32_audio_test(void) {
  bool expected = false;
  if (!initialized || !starting.compare_exchange_strong(expected, true))
    return ESP_ERR_INVALID_STATE;
  stop = false;
  test_audio = true;
  test_jitter = false;
  test_peer = false;
  request_pending = true;
  xSemaphoreGive(control_wake);
  return ESP_OK;
}
esp_err_t live_esp32_peer_test(void) {
  bool expected = false;
  if (!initialized || !starting.compare_exchange_strong(expected, true))
    return ESP_ERR_INVALID_STATE;
  test_audio = false;
  test_jitter = false;
  test_peer = true;
  request_pending = true;
  xSemaphoreGive(control_wake);
  return ESP_OK;
}
static esp_err_t start_jitter_test(bool burst) {
  bool expected = false;
  if (!initialized || !starting.compare_exchange_strong(expected, true))
    return ESP_ERR_INVALID_STATE;
  stop = false;
  test_audio = false;
  test_peer = false;
  test_burst = burst;
  test_jitter = true;
  request_pending = true;
  xSemaphoreGive(control_wake);
  return ESP_OK;
}
esp_err_t live_esp32_jitter_test(void) { return start_jitter_test(false); }
esp_err_t live_esp32_burst_test(void) { return start_jitter_test(true); }
void live_esp32_playout_buffer(bool enabled) {
  playout_buffer_enabled = enabled;
  ESP_LOGI(TAG, "Next playback priming target=%u ms",
           enabled
               ? (config.playout_buffer_ms ? config.playout_buffer_ms
                                           : live_audio::Prebuffer::DELAY_MS)
               : 0);
}
void live_esp32_stop(void) {
  stop = true;
  if (initialized)
    xSemaphoreGive(control_wake);
}
void live_esp32_mute(bool value) {
  muted = value;
  if (initialized)
    xSemaphoreGive(control_wake);
}
void live_esp32_preconnect(bool enabled) {
  preconnect_enabled = enabled;
  if (initialized)
    xSemaphoreGive(control_wake);
}
void live_esp32_network_changed(bool available) {
  uint32_t previous = network_generation.load();
  while (!network_generation.compare_exchange_weak(
      previous, ((previous + 2u) & ~1u) | (available ? 1u : 0u))) {
  }
  if (initialized)
    xSemaphoreGive(control_wake);
}
void live_esp32_status(live_esp32_status_t *out) {
  if (!out)
    return;
  portENTER_CRITICAL(&status_lock);
  *out = status;
  out->transcript_has_text = transcripts.count != 0;
  out->transcript_speaker = transcripts.last_speaker;
  portEXIT_CRITICAL(&status_lock);
  // Expose a queued start immediately, before the controller task runs.
  out->busy = out->busy || starting.load();
  out->preconnect_ready = preconnect_ready.load();
  out->preconnect_pending = preconnect_pending.load();
}
void live_esp32_log_startup(void) {
  live_esp32_status_t snapshot{};
  live_esp32_status(&snapshot);
  ESP_LOGI(TAG, "preconnect ready=%d pending=%d last_session_reused=%d",
           snapshot.preconnect_ready, snapshot.preconnect_pending,
           snapshot.https_preconnected);
  if (!snapshot.startup_available) {
    ESP_LOGI(TAG, "No session startup timing recorded since boot");
    return;
  }
  for (unsigned i = 0; i < LIVE_STARTUP_STAGE_COUNT; ++i)
    if (snapshot.startup_ms[i] != UINT32_MAX)
      ESP_LOGI(TAG, "startup stage=%s elapsed_ms=%lu", STARTUP_NAMES[i],
               static_cast<unsigned long>(snapshot.startup_ms[i]));
}
void live_esp32_log_diagnostics(void) {
  log_playout();
  live_esp32_status_t camera{};
  live_esp32_status(&camera);
  ESP_LOGI(TAG,
           "photos busy=%d captured=%lu errors=%lu capture_max_us=%lu "
           "send_max_us=%lu",
           camera.photo_busy, (unsigned long)camera.photos_captured,
           (unsigned long)camera.photo_errors,
           (unsigned long)camera.photo_capture_max_us,
           (unsigned long)camera.photo_send_max_us);
  ESP_LOGI(TAG, "board tools busy=%d calls=%lu errors=%lu max_us=%lu",
           camera.tool_busy, (unsigned long)camera.tool_calls,
           (unsigned long)camera.tool_errors,
           (unsigned long)camera.tool_max_us);
  ESP_LOGI(
      TAG,
      "resources phase=snapshot heap=%lu internal=%lu largest=%lu tasks=%u",
      (unsigned long)esp_get_free_heap_size(),
      (unsigned long)heap_caps_get_free_size(MALLOC_CAP_INTERNAL),
      (unsigned long)heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL),
      uxTaskGetNumberOfTasks());
#if configUSE_TRACE_FACILITY && configGENERATE_RUN_TIME_STATS
  std::vector<TaskStatus_t> tasks(uxTaskGetNumberOfTasks() + 8);
  configRUN_TIME_COUNTER_TYPE total = 0;
  const unsigned count =
      uxTaskGetSystemState(tasks.data(), tasks.size(), &total);
  std::vector<std::string> names;
  names.reserve(count);
  for (unsigned i = 0; i < count; ++i)
    names.emplace_back(tasks[i].pcTaskName);
  // Pace optional USB diagnostics so a small console TX buffer does not drop
  // the first records of the snapshot. Runtime counters are already captured.
  vTaskDelay(pdMS_TO_TICKS(10));
  ESP_LOGI(TAG, "tasks sample total_ticks=%llu count=%u",
           (unsigned long long)total, count);
  for (unsigned i = 0; i < count; ++i) {
    vTaskDelay(pdMS_TO_TICKS(10));
    const auto &t = tasks[i];
    ESP_LOGI(
        TAG,
        "task name=%s number=%u runtime_ticks=%llu priority=%u stack_free=%u",
        names[i].c_str(), t.xTaskNumber, (unsigned long long)t.ulRunTimeCounter,
        t.uxCurrentPriority, t.usStackHighWaterMark);
  }
#endif
}

esp_err_t live_esp32_photo_test(void) {
  if (!initialized || !photo_task || !config.capture_photo)
    return ESP_ERR_NOT_SUPPORTED;
  auto expected = PhotoPhase::idle;
  if (!photo_phase.compare_exchange_strong(expected, PhotoPhase::reserved))
    return ESP_ERR_INVALID_STATE;
  photo_job = {};
  photo_job.diagnostic = true;
  snprintf(photo_job.call_id, sizeof(photo_job.call_id), "diagnostic");
  bool idle = false;
  photo_job.owns_start = starting.compare_exchange_strong(idle, true);
  publish_photo_job();
  return ESP_OK;
}
void live_esp32_transcripts(live_transcript_t *out) {
  if (!out)
    return;
  portENTER_CRITICAL(&status_lock);
  *out = transcripts;
  portEXIT_CRITICAL(&status_lock);
}
