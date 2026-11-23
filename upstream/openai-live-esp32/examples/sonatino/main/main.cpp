#include "AudioFormat.hpp"
#include "Board.hpp"
#include "BootButton.hpp"
#include "driver/usb_serial_jtag.h"
#include "esp_app_desc.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "live_voice_secrets.h"
#include "nvs_flash.h"
#include <cstdio>
#include <cstring>
#include <ctime>
#include <sys/time.h>

namespace {
constexpr const char *TAG = "SonatinoLive";
void command(const char *line) {
  esp_err_t result = ESP_OK;
  if (!strcmp(line, "live start"))
    result = board::wifi_ready() ? live_esp32_start() : ESP_ERR_INVALID_STATE;
  else if (!strcmp(line, "live stop"))
    live_esp32_stop();
  else if (!strcmp(line, "live mute"))
    live_esp32_mute(true);
  else if (!strcmp(line, "live unmute"))
    live_esp32_mute(false);
  else if (!strcmp(line, "live audio-test"))
    result = live_esp32_audio_test();
  else if (!strcmp(line, "live jitter-test"))
    result = live_esp32_jitter_test();
  else if (!strcmp(line, "live peer-test"))
    result = live_esp32_peer_test();
  else if (!strcmp(line, "live timing"))
    live_esp32_log_startup();
  else if (!strcmp(line, "live diagnostics")) {
    live_esp32_log_diagnostics();
    board::audio_log_pin();
  } else if (!strcmp(line, "live wifi-next"))
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
  } else if (!strcmp(line, "live transcripts")) {
    live_transcript_t transcript{};
    live_esp32_transcripts(&transcript);
    for (unsigned i = 0; i < transcript.count; ++i) {
      const auto &block = transcript.blocks[i];
      ESP_LOGI(TAG, "%s: %s",
               block.speaker == LIVE_SPEAKER_USER ? "User" : "Assistant",
               block.text);
    }
  } else if (!strncmp(line, "live volume ", 12)) {
    unsigned percent;
    if (!board::parse_volume(line + 12, percent))
      result = ESP_ERR_INVALID_ARG;
    else {
      board::audio_volume(percent);
      ESP_LOGI(TAG, "Headphone volume=%u%%", percent);
    }
  } else {
    ESP_LOGW(TAG, "Unknown command");
    return;
  }
  if (result != ESP_OK)
    ESP_LOGW(TAG, "Command failed: %s", esp_err_to_name(result));
}
void poll_button() {
  static board::BootButton button;
  live_esp32_status_t state{};
  live_esp32_status(&state);
  bool down = false;
  const bool available = !state.busy && !state.active && board::wifi_ready() &&
                         board::boot_button_read(down);
  if (button.update(available, down, uint32_t(esp_timer_get_time() / 1000))) {
    ESP_LOGI(TAG, "BOOT released: starting session");
    command("live start");
  }
}
} // namespace
extern "C" void app_main() {
  auto result = nvs_flash_init();
  if (result == ESP_ERR_NVS_NO_FREE_PAGES ||
      result == ESP_ERR_NVS_NEW_VERSION_FOUND) {
    ESP_ERROR_CHECK(nvs_flash_erase());
    result = nvs_flash_init();
  }
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
  static live_esp32_config_t config{};
  config.api_key = LIVE_API_KEY;
  config.model = LIVE_MODEL;
  config.wake_on_speech = true;
  config.idle_timeout_s = 30;
  config.responses_model = LIVE_RESPONSES_MODEL;
  config.responses_service_tier = "priority";
  config.responses_web_search = true;
  config.responses_instructions =
      "Use web search for questions needing current information. Keep spoken "
      "replies concise.";
  config.audio_open = board::audio_open;
  config.audio_close = board::audio_close;
  config.read = board::audio_read;
  config.write = board::audio_write;
  config.output_starvations = board::audio_starvations;
  ESP_ERROR_CHECK(live_esp32_init(&config));
  board::wifi_init();
  live_esp32_preconnect(true);
  usb_serial_jtag_driver_config_t usb = USB_SERIAL_JTAG_DRIVER_CONFIG_DEFAULT();
  ESP_ERROR_CHECK(usb_serial_jtag_driver_install(&usb));
  ESP_LOGI(TAG, "Sonatino Live Voice ready; USB live "
                "status/start/stop/audio-test/jitter-test/diagnostics");
  ESP_LOGI(TAG, "When Wi-Fi is ready, press/release BOOT to start; "
                "use RESET to end. Do not press BOOT during audio.");
  board::audio_log_pin();
  char line[96];
  size_t used = 0;
  bool discard = false;
  for (;;) {
    char input[64];
    int n = usb_serial_jtag_read_bytes(input, sizeof(input), pdMS_TO_TICKS(20));
    for (int i = 0; i < n; ++i) {
      if (input[i] == '\r')
        continue;
      if (input[i] == '\n') {
        line[used] = 0;
        if (!discard && used)
          command(line);
        used = 0;
        discard = false;
      } else if (used + 1 < sizeof(line) && !discard) {
        line[used++] = input[i];
      } else {
        discard = true;
      }
    }
    poll_button();
  }
}
