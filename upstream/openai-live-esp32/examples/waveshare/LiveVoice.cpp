#include "LiveVoice.hpp"
#include "CaptionSamples.hpp"
#include "CaptionText.hpp"
#include "LiveFonts.h"
#include "ScreenMirror.hpp"
#include "UsageSummary.hpp"
#include "WifiProfiles.hpp"
#include "bsp/display.h"
#include "bsp/esp-bsp.h"
#include "bsp_board_extra.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "freertos/idf_additions.h"
#include "live_esp32.h"
#include "live_voice_secrets.h"
#include "src/misc/lv_text_private.h"
#include "system_status.hpp"
#include "transcript.hpp"
#include <algorithm>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>

namespace {
constexpr uint32_t background = 0x000000, foreground = 0xF0F0ED;
constexpr uint32_t muted = 0xA0A4A9, user_color = 0x8EDCE9,
                   assistant_color = 0xEDCA93;
constexpr int rail_gutter = 18, caption_line_space = 0, caption_turn_gap = 4;
const lv_font_t &caption_font = live_font_36;

bool caption_glyph(uint32_t codepoint) {
  lv_font_glyph_dsc_t dsc{};
  // Probe this static subset directly so an unsupported character does not
  // produce a missing-glyph warning on every streaming snapshot.
  return caption_font.get_glyph_dsc(&caption_font, &dsc, codepoint, 0) &&
         !dsc.is_placeholder;
}

uint32_t speaker_color(live_speaker_t speaker) {
  return speaker == LIVE_SPEAKER_USER ? user_color : assistant_color;
}
void draw_dot(lv_layer_t *layer, int x, int y, int size, uint32_t color) {
  lv_draw_rect_dsc_t dsc;
  lv_draw_rect_dsc_init(&dsc);
  dsc.bg_color = lv_color_hex(color);
  dsc.bg_opa = LV_OPA_COVER;
  dsc.radius = LV_RADIUS_CIRCLE;
  const lv_area_t area = {x, y, x + size - 1, y + size - 1};
  lv_draw_rect(layer, &dsc, &area);
}
void show(lv_obj_t *obj, bool visible) {
  if (visible)
    lv_obj_remove_flag(obj, LV_OBJ_FLAG_HIDDEN);
  else
    lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN);
}
bool owns_audio = false;
esp_err_t audio_open(void *) {
  esp_err_t e = bsp_extra_audio_session_acquire(BSP_EXTRA_AUDIO_OWNER_LIVE);
  if (e != ESP_OK)
    return e;
  owns_audio = true;
  e = bsp_extra_codec_set_voice_fs(24000, 16);
  if (e == ESP_OK)
    e = bsp_extra_codec_volume_set(100, nullptr);
  return e;
}
void audio_close(void *) {
  if (!owns_audio)
    return;
  bsp_extra_codec_dev_stop();
  bsp_extra_audio_session_release(BSP_EXTRA_AUDIO_OWNER_LIVE);
  owns_audio = false;
}
esp_err_t read_pcm(void *, int16_t *pcm, size_t samples) {
  size_t n = 0;
  esp_err_t e = bsp_extra_i2s_read(pcm, samples * sizeof(*pcm), &n, 1000);
  return e == ESP_OK && n != samples * sizeof(*pcm) ? ESP_FAIL : e;
}
esp_err_t write_pcm(void *, const int16_t *pcm, size_t samples) {
  size_t n = 0;
  esp_err_t e = bsp_extra_i2s_write(const_cast<int16_t *>(pcm),
                                    samples * sizeof(*pcm), &n, 1000);
  return e == ESP_OK && n != samples * sizeof(*pcm) ? ESP_FAIL : e;
}
void start() {
  if (!live_wifi::ready()) {
    ESP_LOGW("LiveVoice", "Wait for Wi-Fi and DHCP before starting");
    return;
  }
  // Wi-Fi power saving otherwise adds avoidable latency to voice packets.
  esp_wifi_set_ps(WIFI_PS_NONE);
  ESP_LOGI("LiveVoice", "Start requested: %s",
           esp_err_to_name(live_esp32_start()));
}
void wifi_status() {
  live_wifi::print_status();
  brookesia::system_status::Snapshot s{};
  brookesia::system_status::get_snapshot(s);
  esp_netif_ip_info_t ip{};
  auto *netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
  if (netif)
    esp_netif_get_ip_info(netif, &ip);
  ESP_LOGI("LiveVoice", "wifi enabled=%d connected=%d rssi=%d ip=" IPSTR,
           s.wifi_enabled, s.wifi_connected, s.wifi_rssi, IP2STR(&ip.ip));
  ESP_LOGI("LiveVoice",
           "power pmu=%d battery_valid=%d battery_present=%d "
           "percent=%d charging=%d charger_status=%u",
           s.pmu_present, s.battery_valid, s.battery_present, s.battery_percent,
           s.charging, s.charger_status);
}
void wifi_scan() {
  live_esp32_status_t s{};
  live_esp32_status(&s);
  if (s.busy) {
    ESP_LOGW("LiveVoice", "End the Live session before scanning Wi-Fi");
    return;
  }
  uint16_t count = 64;
  auto *records =
      static_cast<wifi_ap_record_t *>(calloc(count, sizeof(wifi_ap_record_t)));
  if (!records) {
    ESP_LOGW("LiveVoice", "Wi-Fi scan: insufficient memory");
    return;
  }
  // The resident manager pauses reconnects until the scan results are copied.
  esp_err_t e = brookesia::system_status::scan_wifi(records, &count);
  if (e != ESP_OK)
    count = 0;
  ESP_LOGI("LiveVoice", "Wi-Fi scan: %s, %u access points (limit 64)",
           esp_err_to_name(e), count);
  for (unsigned i = 0; e == ESP_OK && i < count; ++i) {
    const auto &ap = records[i];
    ESP_LOGI("LiveVoice", "AP ssid=\"%.32s\" channel=%u rssi=%d auth=%d",
             reinterpret_cast<const char *>(ap.ssid), ap.primary, ap.rssi,
             static_cast<int>(ap.authmode));
  }
  free(records);
}
void console(void *) {
  // Small, credential-free USB control surface for repeatable hardware smoke
  // tests.
  char line[40];
  size_t n = 0;
  for (;;) {
    int c = getchar();
    if (c == EOF) {
      clearerr(stdin);
      vTaskDelay(pdMS_TO_TICKS(20));
      continue;
    }
    if (c == '\r' || c == '\n') {
      line[n] = 0;
      n = 0;
      if (!strcmp(line, "live start"))
        start();
      else if (!strcmp(line, "live audio-test"))
        live_esp32_audio_test();
      else if (!strcmp(line, "live jitter-test"))
        live_esp32_jitter_test();
      else if (!strcmp(line, "live playout-on"))
        live_esp32_playout_buffer(true);
      else if (!strcmp(line, "live playout-off"))
        live_esp32_playout_buffer(false);
      else if (!strcmp(line, "live peer-test"))
        ESP_LOGI("LiveVoice", "Peer test requested: %s",
                 esp_err_to_name(live_esp32_peer_test()));
      else if (!strcmp(line, "live stop"))
        live_esp32_stop();
      else if (!strcmp(line, "live mute"))
        live_esp32_mute(true);
      else if (!strcmp(line, "live unmute"))
        live_esp32_mute(false);
      else if (!strcmp(line, "live wifi-next"))
        live_wifi::next();
      else if (!strcmp(line, "live timing"))
        live_esp32_log_startup();
      else if (!strcmp(line, "live diagnostics"))
        live_esp32_log_diagnostics();
      else if (!strcmp(line, "live mirror-on"))
        live_mirror::enable(true);
      else if (!strcmp(line, "live mirror-off"))
        live_mirror::enable(false);
      else if (!strcmp(line, "live mirror-key"))
        live_mirror::keyframe();
      else if (!strcmp(line, "live mirror-status"))
        live_mirror::status();
      else if (!strcmp(line, "live captions-test"))
        esp_brookesia::apps::LiveVoice::requestInstance()->testCaptions();
      else if (!strcmp(line, "live glyphs-test"))
        esp_brookesia::apps::LiveVoice::requestInstance()->testCaptions(true);
      else if (!strcmp(line, "live preconnect-on"))
        live_esp32_preconnect(true);
      else if (!strcmp(line, "live preconnect-off"))
        live_esp32_preconnect(false);
      else if (!strcmp(line, "live screen"))
        esp_brookesia::apps::LiveVoice::requestInstance()->inspectScreen(false);
      else if (!strcmp(line, "live screenshot"))
        esp_brookesia::apps::LiveVoice::requestInstance()->inspectScreen(true);
      else if (!strcmp(line, "live panel-reset"))
        esp_brookesia::apps::LiveVoice::requestInstance()->inspectScreen(false,
                                                                         true);
      else if (!strcmp(line, "live wifi-scan"))
        wifi_scan();
      else if (!strcmp(line, "live wifi-reconnect")) {
        ESP_LOGI(
            "LiveVoice", "Wi-Fi reconnect: %s",
            esp_err_to_name(brookesia::system_status::request_wifi_connect()));
      } else if (!strcmp(line, "live status")) {
        live_esp32_status_t s{};
        live_esp32_status(&s);
        ESP_LOGI("LiveVoice",
                 "status=%s active=%d busy=%d finalized=%d tx=%lu rx=%lu "
                 "played=%lu id=%s",
                 s.status, s.active, s.busy, s.finalized,
                 (unsigned long)s.sent_packets,
                 (unsigned long)s.received_packets,
                 (unsigned long)s.played_samples, s.session_id);
        wifi_status();
      }
    } else if (n + 1 < sizeof(line))
      line[n++] = c;
    else
      n = 0;
  }
}
lv_obj_t *button(lv_obj_t *parent, lv_event_cb_t cb, void *ctx) {
  lv_obj_t *b = lv_button_create(parent);
  lv_obj_remove_style_all(b);
  lv_obj_set_size(b, 180, 56);
  lv_obj_set_ext_click_area(b, 20);
  lv_obj_set_style_bg_opa(b, LV_OPA_COVER, 0);
  lv_obj_set_style_border_width(b, 1, 0);
  lv_obj_set_style_border_opa(b, LV_OPA_COVER, 0);
  lv_obj_set_style_radius(b, LV_RADIUS_CIRCLE, 0);
  lv_obj_set_flex_flow(b, LV_FLEX_FLOW_ROW);
  lv_obj_set_flex_align(b, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER,
                        LV_FLEX_ALIGN_CENTER);
  lv_obj_set_style_pad_column(b, 10, 0);
  lv_obj_remove_flag(b, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_add_event_cb(b, cb, LV_EVENT_CLICKED, ctx);
  return b;
}
} // namespace
namespace esp_brookesia::apps {
LiveVoice *LiveVoice::requestInstance() {
  static auto *instance = new LiveVoice();
  return instance;
}
// Hide the persistent system chrome while retaining launcher navigation gestures.
LiveVoice::LiveVoice()
    : App(systems::base::App::Config::SIMPLE_CONSTRUCTOR("Live Voice", nullptr,
                                                       true),
          [] {
            auto config = App::Config::SIMPLE_CONSTRUCTOR(nullptr, false, true);
            config.flags.hide_bottom_gesture_indicator = 1;
            return config;
          }()) {}
bool LiveVoice::init() {
  live_esp32_config_t cfg{};
  cfg.api_key = LIVE_API_KEY;
  cfg.model = LIVE_MODEL;
  cfg.wake_on_speech = true;
  cfg.idle_timeout_s = 30;
  cfg.responses_model = LIVE_RESPONSES_MODEL;
  cfg.responses_service_tier = "priority";
  cfg.responses_web_search = true;
  cfg.responses_instructions =
      "Use web search for current facts and internet lookup requests. Return "
      "concise, factual findings with source URLs for the voice assistant. "
      "Say when information could not be verified.";
  cfg.audio_open = audio_open;
  cfg.audio_close = audio_close;
  cfg.read = read_pcm;
  cfg.write = write_pcm;
  cfg.output_starvations = [](void *) {
    return bsp_extra_audio_tx_empty_events();
  };
  if (live_esp32_init(&cfg) != ESP_OK)
    return false;
  if (!live_mirror::init())
    ESP_LOGW("LiveVoice", "USB screen mirror unavailable");
  return xTaskCreatePinnedToCoreWithCaps(
             console, "live_usb", 8192, nullptr, 2, nullptr, 1,
             MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT) == pdPASS;
}
void LiveVoice::provisionWifi() { live_wifi::start(); }
bool LiveVoice::run() {
  live_esp32_preconnect(true);
  lv_obj_t *screen = lv_screen_active();
  lv_obj_remove_flag(screen, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_style_bg_color(screen, lv_color_hex(background), 0);
  lv_obj_set_style_text_color(screen, lv_color_hex(foreground), 0);
  lv_obj_set_style_pad_all(screen, 0, 0);
  auto area = getVisualArea();
  const int w = lv_area_get_width(&area), h = lv_area_get_height(&area);
  // Brookesia already positions the app screen within its visual area. Inset
  // its contents again for the physical AMOLED corners and navigation gesture.
  constexpr int inset = 28;
  lv_obj_t *content = lv_obj_create(screen);
  lv_obj_remove_style_all(content);
  lv_obj_remove_flag(content, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_pos(content, inset, inset);
  lv_obj_set_size(content, w - 2 * inset, h - 2 * inset);
  lv_obj_set_flex_flow(content, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_pad_row(content, 8, 0);
  title_ = lv_label_create(content);
  lv_label_set_text(title_, "Session usage");
  lv_obj_set_style_text_font(title_, &live_font_22, 0);
  lv_obj_set_style_text_color(title_, lv_color_hex(muted), 0);
  lv_obj_set_width(title_, LV_PCT(100));
  usage_status_ = lv_label_create(content);
  lv_label_set_text(usage_status_, "Last reported");
  lv_obj_set_style_text_font(usage_status_, &live_font_18, 0);
  lv_obj_set_style_text_color(usage_status_, lv_color_hex(muted), 0);
  welcome_ = lv_obj_create(content);
  lv_obj_remove_style_all(welcome_);
  lv_obj_remove_flag(welcome_, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_size(welcome_, LV_PCT(100), 0);
  lv_obj_set_flex_grow(welcome_, 1);
  lv_obj_set_flex_flow(welcome_, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_flex_align(welcome_, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_START,
                        LV_FLEX_ALIGN_START);
  lv_obj_set_style_pad_row(welcome_, 16, 0);
  auto *motif = lv_obj_create(welcome_);
  lv_obj_remove_style_all(motif);
  lv_obj_remove_flag(motif, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_size(motif, 48, 48);
  lv_obj_add_event_cb(
      motif,
      [](lv_event_t *event) {
        lv_area_t a;
        lv_obj_get_coords(lv_event_get_target_obj(event), &a);
        auto *layer = lv_event_get_layer(event);
        for (int y = 0; y < 5; ++y)
          for (int x = 0; x < 5; ++x)
            draw_dot(layer, a.x1 + x * 10, a.y1 + y * 10, 3,
                     (x + y * 5) % 4 == 1 ? user_color : 0x594C39);
      },
      LV_EVENT_DRAW_MAIN, nullptr);
  welcome_title_ = lv_label_create(welcome_);
  lv_label_set_text(welcome_title_, "Ready to talk.");
  lv_obj_set_style_text_font(welcome_title_, &live_font_28, 0);
  status_ = lv_label_create(welcome_);
  lv_obj_set_size(status_, LV_PCT(100), 44);
  lv_label_set_long_mode(status_, LV_LABEL_LONG_DOT);
  lv_obj_set_style_text_font(status_, &live_font_18, 0);
  lv_obj_set_style_text_color(status_, lv_color_hex(muted), 0);
  usage_ = lv_obj_create(content);
  lv_obj_remove_style_all(usage_);
  lv_obj_set_size(usage_, LV_PCT(100), 0);
  lv_obj_set_flex_grow(usage_, 1);
  lv_obj_set_scroll_dir(usage_, LV_DIR_VER);
  lv_obj_set_scrollbar_mode(usage_, LV_SCROLLBAR_MODE_AUTO);
  lv_obj_set_flex_flow(usage_, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_pad_row(usage_, 6, 0);
  for (unsigned i = 0; i < live_usage_view::ROW_COUNT; ++i) {
    auto *row = lv_obj_create(usage_);
    lv_obj_remove_style_all(row);
    lv_obj_remove_flag(row, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_size(row, LV_PCT(100), LV_SIZE_CONTENT);
    lv_obj_set_flex_flow(row, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(row, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_column(row, 8, 0);
    auto *key = lv_label_create(row);
    lv_obj_set_width(key, 96);
    lv_label_set_text(key, live_usage_view::KEYS[i]);
    lv_obj_set_style_text_font(key, &live_font_18, 0);
    lv_obj_set_style_text_color(key, lv_color_hex(muted), 0);
    auto *value = usage_values_[i] = lv_label_create(row);
    lv_obj_set_width(value, 0);
    lv_obj_set_flex_grow(value, 1);
    lv_label_set_long_mode(value, LV_LABEL_LONG_WRAP);
    lv_obj_set_style_text_font(value, &live_font_22, 0);
    lv_obj_set_style_text_color(value, lv_color_hex(foreground), 0);
  }
  usage_note_ = lv_label_create(usage_);
  lv_obj_set_width(usage_note_, LV_PCT(100));
  lv_label_set_text(usage_note_, "Partial token totals");
  lv_obj_set_style_text_font(usage_note_, &live_font_18, 0);
  lv_obj_set_style_text_color(usage_note_, lv_color_hex(assistant_color), 0);
  lv_obj_add_flag(usage_note_, LV_OBJ_FLAG_HIDDEN);
  lv_obj_add_flag(usage_, LV_OBJ_FLAG_HIDDEN);
  transcript_area_ = lv_obj_create(content);
  lv_obj_remove_style_all(transcript_area_);
  lv_obj_set_size(transcript_area_, LV_PCT(100), 0);
  lv_obj_set_flex_grow(transcript_area_, 1);
  lv_obj_remove_flag(transcript_area_, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_scrollbar_mode(transcript_area_, LV_SCROLLBAR_MODE_OFF);
  rail_ = lv_obj_create(transcript_area_);
  lv_obj_remove_style_all(rail_);
  lv_obj_remove_flag(rail_, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_size(rail_, rail_gutter, LV_PCT(100));
  rail_count_ = 0;
  rail_height_ = 0;
  lv_obj_add_event_cb(
      rail_,
      [](lv_event_t *event) {
        static_cast<LiveVoice *>(lv_event_get_user_data(event))
            ->drawRail(event);
      },
      LV_EVENT_DRAW_MAIN, this);
  for (auto &label : transcripts_) {
    label = lv_label_create(transcript_area_);
    lv_obj_set_size(label, LV_PCT(100), caption_font.line_height);
    lv_obj_set_x(label, rail_gutter);
    lv_label_set_text(label, "");
    lv_label_set_long_mode(label, LV_LABEL_LONG_CLIP);
    lv_obj_set_style_text_font(label, &caption_font, 0);
    lv_obj_set_style_text_line_space(label, caption_line_space, 0);
    lv_obj_add_flag(label, LV_OBJ_FLAG_HIDDEN);
  }
  transcript_revision_ = UINT32_MAX;
  transcript_page_ = {};
  transcript_width_ = transcript_height_ = 0;
  footer_ = lv_obj_create(content);
  lv_obj_remove_style_all(footer_);
  lv_obj_remove_flag(footer_, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_size(footer_, LV_PCT(100), 56);
  // Keep the footer's layout space, but parent the button to the screen so
  // its invisible touch padding is not clipped by the footer or content.
  control_ = button(
      screen,
      [](lv_event_t *event) {
        live_esp32_status_t s{};
        live_esp32_status(&s);
        ESP_LOGI("LiveVoice", "Touch control: %s", s.busy ? "Stop" : "Start");
        if (s.busy)
          live_esp32_stop();
        else
          start();
        static_cast<LiveVoice *>(lv_event_get_user_data(event))->refresh();
      },
      this);
  lv_obj_align(control_, LV_ALIGN_BOTTOM_MID, 0, -inset);
  control_dot_ = lv_obj_create(control_);
  lv_obj_remove_style_all(control_dot_);
  lv_obj_remove_flag(control_dot_,
                     LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_size(control_dot_, 5, 5);
  lv_obj_set_style_radius(control_dot_, LV_RADIUS_CIRCLE, 0);
  lv_obj_set_style_bg_opa(control_dot_, LV_OPA_COVER, 0);
  control_text_ = lv_label_create(control_);
  lv_label_set_text(control_text_, "Start");
  lv_obj_set_style_text_font(control_text_, &live_font_22, 0);
  control_mode_ = -1;
  control_large_ = false;
  timer_ = lv_timer_create(
      [](lv_timer_t *timer) {
        static_cast<LiveVoice *>(lv_timer_get_user_data(timer))->refresh();
      },
      100, this);
  refresh();
  return timer_ != nullptr;
}
void LiveVoice::drawRail(lv_event_t *event) const {
  if (!rail_count_)
    return;
  lv_area_t a;
  lv_obj_get_coords(rail_, &a);
  auto *layer = lv_event_get_layer(event);
  const int center = caption_font.line_height / 2;
  for (int y = center; y < rail_height_; y += 10) {
    bool marker = false;
    for (unsigned i = 0; i < rail_count_; ++i)
      marker |= abs(y - (rail_y_[i] + center)) <= 6;
    if (!marker)
      draw_dot(layer, a.x1 + 3, a.y1 + y - 1, 2, 0x34383C);
  }
  for (unsigned i = 0; i < rail_count_; ++i) {
    const int y = a.y1 + rail_y_[i] + center - 2;
    const bool assistant = rail_speakers_[i] == LIVE_SPEAKER_ASSISTANT;
    draw_dot(layer, a.x1 + 2, y - (assistant ? 3 : 0), 4,
             speaker_color(rail_speakers_[i]));
    if (assistant)
      draw_dot(layer, a.x1 + 2, y + 3, 4, assistant_color);
  }
}
void LiveVoice::refresh() {
  live_esp32_status_t s{};
  live_esp32_status(&s);
  const bool network_ready = live_wifi::ready();
  const uint32_t tick = lv_tick_get();
  const bool testing =
      caption_test_until_ && int32_t(caption_test_until_ - tick) > 0;
  if (caption_test_until_ && !testing) {
    ESP_LOGI("LiveVoice",
             "Caption test complete clears=%u overflows=%lu render_max_us=%lu",
             transcript_page_.clears, (unsigned long)caption_test_overflows_,
             (unsigned long)caption_test_render_max_us_);
    caption_test_until_ = 0;
    transcript_page_ = {};
    transcript_revision_ = UINT32_MAX;
  }
  const bool connected = s.active && network_ready;
  const bool show_usage = !testing && !s.busy && s.usage.started;
  const bool show_captions = connected || testing;
  const bool show_welcome = !show_captions && !show_usage;
  const bool large_start = show_welcome && !s.busy;
  if (large_start != control_large_) {
    // Reserve only the compact footer during calls and on the usage page.
    lv_obj_set_size(control_, large_start ? 260 : 180, large_start ? 112 : 56);
    lv_obj_set_height(footer_, large_start ? 112 : 56);
    lv_obj_set_style_text_font(control_text_,
                              large_start ? &live_font_28 : &live_font_22, 0);
    control_large_ = large_start;
  }
  show(title_, show_usage);
  show(usage_status_, show_usage && !s.usage.seconds_final);
  show(welcome_, show_welcome);
  if (show_welcome) {
    const char *title =
        network_ready && !s.busy ? "Ready to talk." : "Live Voice";
    if (strcmp(lv_label_get_text(welcome_title_), title))
      lv_label_set_text(welcome_title_, title);
    const char *text = network_ready ? s.status : "Connecting Wi-Fi...";
    show(status_, strcmp(text, "Ready - tap Start") != 0);
    if (strcmp(lv_label_get_text(status_), text))
      lv_label_set_text(status_, text);
  }
  if (show_usage) {
    for (unsigned i = 0; i < live_usage_view::ROW_COUNT; ++i) {
      char text[128];
      live_usage_view::format(s.usage, static_cast<live_usage_view::Row>(i),
                              text, sizeof(text));
      if (strcmp(lv_label_get_text(usage_values_[i]), text))
        lv_label_set_text(usage_values_[i], text);
    }
    if (s.usage.tokens_partial)
      lv_obj_remove_flag(usage_note_, LV_OBJ_FLAG_HIDDEN);
    else
      lv_obj_add_flag(usage_note_, LV_OBJ_FLAG_HIDDEN);
  }
  show(usage_, show_usage);
  show(transcript_area_, show_captions);
  bool captions_changed =
      show_captions && transcript_revision_ != s.transcript_revision;
  if (testing) {
    // A bounded, local-only workload to compare rendering/mirroring with an
    // active voice session. Synthetic text never enters the API conversation.
    static const char *words[] = {"A ",    "smooth ",  "display ",  "keeps ",
                                  "each ", "caption ", "readable. "};
    const unsigned step = (30000 - (caption_test_until_ - tick)) /
                          (caption_glyph_test_ ? 10000 : 100);
    if (step != caption_test_step_) {
      caption_test_step_ = step;
      if (caption_glyph_test_) {
        live_captions::clear(transcript_snapshot_);
        if (step == 0)
          live_captions::append(transcript_snapshot_, LIVE_SPEAKER_USER,
                                "Tell me a quick joke.", 0, 0);
        live_captions::append(
            transcript_snapshot_,
            step % 2 ? LIVE_SPEAKER_USER : LIVE_SPEAKER_ASSISTANT,
            live_caption_view::glyph_samples
                [step % std::size(live_caption_view::glyph_samples)],
            0, 0);
      } else
        live_captions::append(transcript_snapshot_,
                              (step / 35) % 2 ? LIVE_SPEAKER_USER
                                              : LIVE_SPEAKER_ASSISTANT,
                              words[step % 7], step * 100, step * 100);
    }
    captions_changed = transcript_revision_ != transcript_snapshot_.revision;
  } else if (captions_changed)
    live_esp32_transcripts(&transcript_snapshot_);
  if (captions_changed)
    live_caption_view::simplify(transcript_snapshot_, caption_glyph);
  lv_obj_update_layout(transcript_area_);
  const int width = lv_obj_get_content_width(transcript_area_) - rail_gutter;
  const int height = lv_obj_get_content_height(transcript_area_);
  if (show_captions && width > 0 &&
      height >= caption_font.line_height &&
      (captions_changed || width != transcript_width_ ||
       height != transcript_height_)) {
    const int64_t render_started = esp_timer_get_time();
    lv_text_attributes_t attrs;
    lv_text_attributes_init(&attrs);
    attrs.max_width = width;
    attrs.line_space = caption_line_space;
    transcript_page_.update(
        transcript_snapshot_, height, caption_font.line_height,
        caption_line_space, caption_turn_gap, [&](const char *text) {
          return lv_text_get_next_line(text, LV_TEXT_LEN_MAX,
                                       &caption_font, nullptr, &attrs);
        });
    unsigned line_index = 0;
    int y = 0;
    bool rail_changed = rail_count_ != transcript_page_.count;
    for (unsigned i = 0; i < transcript_page_.count; ++i) {
      const auto &block = transcript_page_.blocks[i];
      const auto color = lv_color_hex(speaker_color(block.speaker));
      rail_changed |= rail_y_[i] != y || rail_speakers_[i] != block.speaker;
      rail_y_[i] = y;
      rail_speakers_[i] = block.speaker;
      const size_t length = strlen(block.text);
      size_t offset = 0;
      for (;;) {
        if (line_index == std::size(transcripts_))
          break;
        const size_t n =
            offset < length
                ? lv_text_get_next_line(block.text + offset, LV_TEXT_LEN_MAX,
                                        &caption_font, nullptr, &attrs)
                : 0;
        char text[LIVE_TRANSCRIPT_BYTES];
        const size_t bytes = std::min(n, length - offset);
        memcpy(text, block.text + offset, bytes);
        size_t end = bytes;
        while (end && (text[end - 1] == '\n' || text[end - 1] == '\r' ||
                       text[end - 1] == ' '))
          --end;
        text[end] = 0;
        auto *label = transcripts_[line_index++];
        // Stable line objects let LVGL invalidate just the growing last line,
        // instead of redrawing every earlier line of the same utterance.
        if (strcmp(lv_label_get_text(label), text))
          lv_label_set_text(label, text);
        if (lv_obj_get_y(label) != y)
          lv_obj_set_y(label, y);
        if (lv_obj_get_width(label) != width)
          lv_obj_set_width(label, width);
        if (!lv_color_eq(lv_obj_get_style_text_color(label, LV_PART_MAIN),
                         color))
          lv_obj_set_style_text_color(label, color, 0);
        lv_obj_remove_flag(label, LV_OBJ_FLAG_HIDDEN);
        y += caption_font.line_height;
        if (!bytes)
          break;
        offset += bytes;
        if (offset == length && block.text[offset - 1] != '\n' &&
            block.text[offset - 1] != '\r')
          break;
        y += caption_line_space;
      }
      y += caption_turn_gap;
    }
    rail_count_ = transcript_page_.count;
    const int rail_height =
        std::max(0, y - caption_turn_gap -
                        int(caption_font.line_height) / 2 + 1);
    rail_changed |= rail_height_ != rail_height;
    rail_height_ = rail_height;
    if (rail_changed)
      lv_obj_invalidate(rail_);
    for (unsigned i = line_index; i < std::size(transcripts_); ++i)
      lv_obj_add_flag(transcripts_[i], LV_OBJ_FLAG_HIDDEN);
    transcript_revision_ = transcript_snapshot_.revision;
    transcript_width_ = width;
    transcript_height_ = height;
    if (testing) {
      lv_obj_update_layout(transcript_area_);
      bool overflow = lv_obj_get_scroll_y(transcript_area_) != 0;
      for (unsigned i = 0; i < line_index; ++i)
        overflow |=
            lv_obj_get_y(transcripts_[i]) + lv_obj_get_height(transcripts_[i]) >
                height ||
            lv_obj_get_x(transcripts_[i]) + lv_obj_get_width(transcripts_[i]) >
                width + rail_gutter;
      caption_test_overflows_ += overflow;
      caption_test_render_max_us_ =
          std::max(caption_test_render_max_us_,
                   uint32_t(esp_timer_get_time() - render_started));
    }
  }
  const int mode = s.busy ? (connected ? 2 : 1) : (network_ready ? 0 : 3);
  if (mode != control_mode_) {
    const uint32_t colors[] = {0x14221B, 0x211E16, 0x221518, 0x17191C};
    const uint32_t inks[] = {0x9BDDBB, 0xE6C989, 0xEF999E, 0xA0A4A9};
    const uint32_t borders[] = {0x344E40, 0x4D4530, 0x523338, 0x34383C};
    lv_label_set_text(control_text_, s.busy ? "Stop" : "Start");
    lv_obj_set_style_bg_color(control_, lv_color_hex(colors[mode]), 0);
    lv_obj_set_style_bg_color(control_, lv_color_hex(borders[mode]),
                              LV_STATE_PRESSED);
    lv_obj_set_style_border_color(control_, lv_color_hex(borders[mode]), 0);
    lv_obj_set_style_text_color(control_text_, lv_color_hex(inks[mode]), 0);
    lv_obj_set_style_bg_color(control_dot_, lv_color_hex(inks[mode]), 0);
    if (mode == 3)
      lv_obj_add_state(control_, LV_STATE_DISABLED);
    else
      lv_obj_remove_state(control_, LV_STATE_DISABLED);
    ESP_LOGI("LiveVoice", "UI control=%s connected=%d enabled=%d",
             s.busy ? "Stop" : "Start", connected, mode != 3);
    control_mode_ = mode;
  }
}
void LiveVoice::testCaptions(bool glyphs) {
  if (!bsp_display_lock(1000))
    return;
  if (transcript_area_) {
    live_captions::clear(transcript_snapshot_);
    transcript_page_ = {};
    transcript_revision_ = UINT32_MAX;
    caption_test_step_ = UINT32_MAX;
    caption_glyph_test_ = glyphs;
    caption_test_overflows_ = caption_test_render_max_us_ = 0;
    caption_test_until_ = lv_tick_get() + 30000;
    if (glyphs) {
      unsigned missing = 0, clipped = 0;
      for (const auto *sample : live_caption_view::glyph_samples) {
        char display[LIVE_TRANSCRIPT_BYTES];
        snprintf(display, sizeof(display), "%s", sample);
        live_caption_view::simplify(display, sizeof(display), caption_glyph);
        uint32_t index = 0;
        while (display[index]) {
          const uint32_t codepoint = lv_text_encoded_next(display, &index);
          if (codepoint == '\n')
            continue;
          lv_font_glyph_dsc_t dsc{};
          if (!lv_font_get_glyph_dsc(&caption_font, &dsc, codepoint, 0) ||
              dsc.is_placeholder)
            ++missing;
          else if (dsc.ofs_y < -caption_font.base_line ||
                   dsc.ofs_y + dsc.box_h >
                       caption_font.line_height - caption_font.base_line)
            ++clipped;
        }
      }
      ESP_LOGI("LiveVoice", "Glyph coverage missing=%u clipped=%u", missing,
               clipped);
    }
    ESP_LOGI("LiveVoice", "Caption test started (30 seconds)");
  }
  bsp_display_unlock();
}
void LiveVoice::inspectScreen(bool capture, bool reset) {
  if (!bsp_display_lock(1000)) {
    ESP_LOGW("LiveVoice", "Display lock timed out");
    return;
  }
  const esp_err_t result =
      reset ? bsp_display_recover() : bsp_display_brightness_set(70);
  ESP_LOGI("LiveVoice", "Panel %s: %s", reset ? "reset" : "brightness",
           esp_err_to_name(result));
  lv_obj_t *screen = lv_screen_active();
  lv_obj_update_layout(screen);
  lv_obj_invalidate(screen);
  lv_area_t bounds{};
  lv_obj_get_coords(screen, &bounds);
  ESP_LOGI("LiveVoice", "Screen bounds=%ld,%ld..%ld,%ld", (long)bounds.x1,
           (long)bounds.y1, (long)bounds.x2, (long)bounds.y2);
  if (control_) {
    lv_obj_get_coords(control_, &bounds);
    ESP_LOGI("LiveVoice", "Control visible=%d bounds=%ld,%ld..%ld,%ld mode=%d",
             lv_obj_is_visible(control_), (long)bounds.x1, (long)bounds.y1,
             (long)bounds.x2, (long)bounds.y2, control_mode_);
    lv_obj_get_click_area(control_, &bounds);
    ESP_LOGI("LiveVoice", "Control touch bounds=%ld,%ld..%ld,%ld",
             (long)bounds.x1, (long)bounds.y1, (long)bounds.x2,
             (long)bounds.y2);
  }
  std::vector<uint8_t> pixels;
  uint32_t width = 0, height = 0, stride = 0;
  if (capture) {
    lv_draw_buf_t *snapshot = lv_snapshot_take(screen, LV_COLOR_FORMAT_RGB565);
    if (snapshot) {
      width = snapshot->header.w;
      height = snapshot->header.h;
      stride = snapshot->header.stride;
      pixels.assign(snapshot->data, snapshot->data + stride * height);
      lv_draw_buf_destroy(snapshot);
    } else {
      ESP_LOGE("LiveVoice", "Screen snapshot allocation failed");
    }
  }
  bsp_display_unlock();
  if (!pixels.empty()) {
    printf("LVGL_RGB565 %lu %lu %lu\n", (unsigned long)width,
           (unsigned long)height, (unsigned long)stride);
    constexpr char hex[] = "0123456789abcdef";
    for (size_t offset = 0; offset < pixels.size(); offset += 128) {
      char line[257];
      size_t count = std::min(size_t(128), pixels.size() - offset);
      for (size_t i = 0; i < count; ++i) {
        line[2 * i] = hex[pixels[offset + i] >> 4];
        line[2 * i + 1] = hex[pixels[offset + i] & 15];
      }
      line[count * 2] = 0;
      printf("LVGL_DATA %s\n", line);
    }
    printf("LVGL_END\n");
  }
}
bool LiveVoice::close() {
  live_esp32_preconnect(false);
  live_esp32_stop();
  if (timer_) {
    lv_timer_delete(timer_);
    timer_ = nullptr;
  }
  title_ = status_ = usage_status_ = usage_ = transcript_area_ = control_ =
      control_text_ = control_dot_ = welcome_ = welcome_title_ = rail_ = footer_ =
          nullptr;
  rail_count_ = 0;
  rail_height_ = 0;
  usage_note_ = nullptr;
  for (auto &label : usage_values_)
    label = nullptr;
  for (auto &label : transcripts_)
    label = nullptr;
  transcript_revision_ = UINT32_MAX;
  control_mode_ = -1;
  control_large_ = false;
  caption_test_until_ = 0;
  return true;
}
bool LiveVoice::back() {
  live_esp32_preconnect(false);
  live_esp32_stop();
  return notifyCoreClosed();
}
bool LiveVoice::pause() {
  live_esp32_preconnect(false);
  live_esp32_stop();
  if (timer_)
    lv_timer_pause(timer_);
  return true;
}
bool LiveVoice::resume() {
  live_esp32_preconnect(true);
  if (timer_)
    lv_timer_resume(timer_);
  return true;
}
bool LiveVoice::deinit() { return close(); }
} // namespace esp_brookesia::apps
