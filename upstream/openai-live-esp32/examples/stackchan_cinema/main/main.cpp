#include "AppSupport.hpp"
#include "Board.hpp"
#include "Cinema.hpp"
#include "CinemaCue.hpp"
#include "CinemaLibrary.hpp"
#include "CinemaPersonality.hpp"
#include "Lights.hpp"
#include "Motion.hpp"
#include "MotionPolicy.hpp"
#include "driver/usb_serial_jtag.h"
#include "esp_app_desc.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "live_voice_secrets.h"
#include "nvs_flash.h"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <sys/time.h>

namespace {
constexpr const char *TAG = "StackChanCinema";
esp_err_t capture_photo(void *ctx, uint8_t *jpeg, size_t capacity,
                        size_t *length) {
  if (!cinema::pause_for_photo())
    return ESP_ERR_TIMEOUT;
  // The shared bounded retry stays inside cinema's decode/SD pause barrier.
  const auto result = stackchan::capture_photo(ctx, jpeg, capacity, length);
  cinema::resume_after_photo();
  return result;
}
void command(const char *line) {
  if (stackchan::diagnostic_command(line) || stackchan::lights_command(line))
    return;
  if (cinema::command(line))
    return;
  esp_err_t result = ESP_OK;
  if (!strcmp(line, "live start"))
    result = board::wifi_ready() ? live_esp32_start() : ESP_ERR_INVALID_STATE;
  else if (!strcmp(line, "live stop")) {
    stackchan::cancel_motion();
    live_esp32_stop();
  } else if (!strncmp(line, "live head ", 10)) {
    stackchan::diagnostic(line + 10);
  } else if (!strcmp(line, "live mute"))
    live_esp32_mute(true);
  else if (!strcmp(line, "live unmute"))
    live_esp32_mute(false);
  else if (!strcmp(line, "live audio-test"))
    result = live_esp32_audio_test();
  else if (!strcmp(line, "live jitter-test"))
    result = live_esp32_jitter_test();
  else if (!strcmp(line, "live peer-test"))
    result = live_esp32_peer_test();
  else if (!strcmp(line, "live photo-test"))
    result = live_esp32_photo_test();
  else if (!strcmp(line, "live display vivid"))
    result = board::view_display_profile(true);
  else if (!strcmp(line, "live display original"))
    result = board::view_display_profile(false);
  else if (!strcmp(line, "live display-test"))
    result = board::view_display_test();
  else if (!strncmp(line, "live brightness ", 16)) {
    char *end = nullptr;
    const long percent = strtol(line + 16, &end, 10);
    result = end != line + 16 && !*end && percent >= 0 && percent <= 100
                 ? board::view_brightness(int(percent))
                 : ESP_ERR_INVALID_ARG;
  } else if (!strcmp(line, "live timing"))
    live_esp32_log_startup();
  else if (!strcmp(line, "live diagnostics"))
    live_esp32_log_diagnostics();
  else if (!strcmp(line, "live wifi-next"))
    board::wifi_next();
  else if (!strcmp(line, "live status")) {
    live_esp32_status_t state{};
    live_esp32_status(&state);
    ESP_LOGI(TAG,
             "busy=%d active=%d status=%s session=%s tx=%lu rx=%lu mic=%lu "
             "played=%lu txdrop=%lu rxdrop=%lu starvation=%lu rebuffer=%lu",
             state.busy, state.active, state.status, state.session_id,
             (unsigned long)state.sent_packets,
             (unsigned long)state.received_packets,
             (unsigned long)state.mic_peak, (unsigned long)state.played_samples,
             (unsigned long)state.tx_queue_drops,
             (unsigned long)state.rx_queue_drops,
             (unsigned long)state.speaker_dma_empty_events,
             (unsigned long)state.playout_rebuffers);
    board::wifi_status();
  } else {
    ESP_LOGW(TAG, "Unknown command");
    return;
  }
  if (result != ESP_OK)
    ESP_LOGW(TAG, "Command failed: %s", esp_err_to_name(result));
}
} // namespace
namespace {
esp_err_t execute_tool(void *context, const char *name, const char *arguments,
                       char *result, size_t capacity, bool (*cancelled)(void *),
                       void *cancel_context) {
  if (cancelled && cancelled(cancel_context))
    return ESP_ERR_INVALID_STATE;
  if (cinema::library_tool(name))
    return cinema::library(name, arguments, result, capacity, cancelled,
                           cancel_context);
  if (!strcmp(name, "set_visual_scene"))
    return cinema::cue(arguments, result, capacity);
  return stackchan::execute_tool(context, name, arguments, result, capacity,
                                 cancelled, cancel_context);
}
} // namespace
extern "C" void app_main() {
  auto result = nvs_flash_init();
  // Preserve factory servo calibration; never erase NVS to recover an error.
  ESP_ERROR_CHECK(result);
  // Seed TLS time conservatively from this build, then refine it with SNTP.
  // Certificate chain, hostname, and validity checks remain enabled.
  setenv("TZ", "UTC0", 1);
  tzset();
  struct tm built{};
  char timestamp[64];
  const auto *description = esp_app_get_description();
  snprintf(timestamp, sizeof(timestamp), "%s %s", description->date,
           description->time);
  if (strptime(timestamp, "%b %d %Y %H:%M:%S", &built)) {
    const time_t lower_bound = mktime(&built);
    if (time(nullptr) < lower_bound) {
      timeval now{lower_bound, 0};
      settimeofday(&now, nullptr);
    }
  }
  board::audio_init();
  stackchan::init();
  static live_esp32_config_t config{};
  config.api_key = LIVE_API_KEY;
  config.model = LIVE_MODEL;
  config.responses_model = LIVE_RESPONSES_MODEL;
  config.responses_service_tier = "priority";
  config.responses_web_search = true;
  config.instructions = cinema::personality::FRONTEND;
  config.responses_instructions = cinema::personality::BACKEND;
  config.greeting = cinema::personality::GREETING;
  static char tools[4096];
  const auto tools_size =
      snprintf(tools, sizeof(tools), "%.*s,%s,%s]",
               int(strlen(stackchan::TOOLS_JSON) - 1), stackchan::TOOLS_JSON,
               cinema::SCENE_TOOL, cinema::LIBRARY_TOOLS);
  ESP_ERROR_CHECK(tools_size > 0 && tools_size < int(sizeof(tools)) ? ESP_OK
                                                                    : ESP_FAIL);
  config.tools_json = tools;
  config.execute_tool = execute_tool;
  config.capture_photo = capture_photo;
  config.audio_open = board::audio_open;
  config.audio_close = board::audio_close;
  config.read = stackchan::read_audio;
  config.write = stackchan::write_audio;
  config.output_starvations = board::audio_starvations;
  config.playout_buffer_ms = 240;
  ESP_ERROR_CHECK(live_esp32_init(&config));
  cinema::before_display();
  board::view_init("StackChan");
  board::wifi_init();
  live_esp32_preconnect(true);
  cinema::init();
  // RX headroom beyond one SD upload block; shared buffered TX for replies.
  ESP_ERROR_CHECK(stackchan::init_console(8192));
  ESP_LOGI(TAG,
           "StackChan Live Voice ready; USB live "
           "status/start/stop/audio-test/jitter-test/photo-test/diagnostics");
  char line[288];
  size_t used = 0;
  bool discard = false;
  for (;;) {
    char input[64];
    int n = usb_serial_jtag_read_bytes(input, sizeof(input), pdMS_TO_TICKS(50));
    for (int i = 0; i < n; ++i) {
      if (input[i] == '\r')
        continue;
      if (input[i] == '\n') {
        line[used] = 0;
        if (!discard && used) {
          command(line);
          fflush(stdout);
        }
        used = 0;
        discard = false;
      } else if (used + 1 < sizeof(line) && !discard) {
        line[used++] = input[i];
      } else {
        discard = true;
      }
    }
    board::view_update();
    stackchan::lights_poll(cinema::wandering());
    cinema::tick();
  }
}
