#pragma once
#include "TranscriptPage.hpp"
#include "UsageSummary.hpp"
#include "live_transcript.h"
#include "lvgl.h"
#include "systems/phone/esp_brookesia_phone_app.hpp"

namespace esp_brookesia::apps {
class LiveVoice final : public systems::phone::App {
public:
  static LiveVoice *requestInstance();
  static void provisionWifi();
  void inspectScreen(bool capture, bool reset = false);
  void testCaptions(bool glyphs = false);

protected:
  LiveVoice();
  bool init() override;
  bool deinit() override;
  bool run() override;
  bool back() override;
  bool close() override;
  bool pause() override;
  bool resume() override;

private:
  void refresh();
  void drawRail(lv_event_t *event) const;
  lv_obj_t *welcome_ = nullptr, *welcome_title_ = nullptr;
  lv_obj_t *title_ = nullptr, *status_ = nullptr, *usage_status_ = nullptr;
  lv_obj_t *usage_ = nullptr;
  lv_obj_t *usage_values_[live_usage_view::ROW_COUNT]{};
  lv_obj_t *usage_note_ = nullptr;
  // More than the physical display can fit at the 36-pixel caption font size.
  lv_obj_t *transcripts_[24]{};
  lv_obj_t *transcript_area_ = nullptr;
  lv_obj_t *rail_ = nullptr;
  int rail_y_[LIVE_TRANSCRIPT_BLOCKS]{}, rail_height_ = 0;
  live_speaker_t rail_speakers_[LIVE_TRANSCRIPT_BLOCKS]{};
  unsigned rail_count_ = 0;
  uint32_t transcript_revision_ = UINT32_MAX;
  live_transcript_t transcript_snapshot_{};
  live_caption_view::Page transcript_page_{};
  int transcript_width_ = 0, transcript_height_ = 0;
  uint32_t caption_test_until_ = 0, caption_test_step_ = 0;
  bool caption_glyph_test_ = false;
  uint32_t caption_test_overflows_ = 0, caption_test_render_max_us_ = 0;
  lv_obj_t *footer_ = nullptr;
  bool control_large_ = false;
  lv_obj_t *control_ = nullptr, *control_text_ = nullptr,
           *control_dot_ = nullptr;
  int control_mode_ = -1;
  lv_timer_t *timer_ = nullptr;
};
} // namespace esp_brookesia::apps
