#include "Board.hpp"
#include "CaptionText.hpp"
#include "LiveFonts.h"
#include "TranscriptPage.hpp"
#include "UsageSummary.hpp"
#include "bsp/esp_mosaico.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "src/misc/cache/instance/lv_image_cache.h"
#include "src/misc/lv_text_private.h"
#include <algorithm>
#include <atomic>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iterator>

static_assert(LVGL_VERSION_MAJOR == 9 && LVGL_VERSION_MINOR == 5 &&
                  LVGL_VERSION_PATCH == 0,
              "Build with the LVGL version pinned in idf_component.yml");

namespace board {
namespace {
constexpr int CONTENT_HEIGHT = 300, LINE_WIDTH = 404;
const lv_font_t *caption_font = &live_font_36;
bool control_large = false;
uint32_t control_color = UINT32_MAX;
struct DisplayProfile {
  uint32_t user, assistant, start, stop;
  uint8_t brightness, border;
};
constexpr DisplayProfile ORIGINAL{0x83D9E5, 0xE5C78F, 0x8CDBAD,
                                  0xE89CA0, 85,       64};
constexpr DisplayProfile VIVID{0x3CD9F0, 0xFFBF50, 0x37D995, 0xFF607B, 65, 144};
const DisplayProfile *profile = &VIVID;
int brightness = VIVID.brightness;
lv_obj_t *welcome, *status_label, *captions, *usage, *button, *button_text;
lv_obj_t *photo_label;
lv_obj_t *photo_image;
std::atomic<uint8_t *> pending_photo{nullptr};
uint8_t *shown_photo = nullptr;
lv_image_dsc_t photo_descriptor{};
int64_t photo_expires_us = 0;
lv_obj_t *lines[10], *dots[10], *values[live_usage_view::ROW_COUNT];
live_caption_view::Page page;
live_transcript_t snapshot{};
uint32_t revision = UINT32_MAX;
void show(lv_obj_t *object, bool visible) {
  if (visible)
    lv_obj_remove_flag(object, LV_OBJ_FLAG_HIDDEN);
  else
    lv_obj_add_flag(object, LV_OBJ_FLAG_HIDDEN);
}
void text(lv_obj_t *label, const char *value) {
  if (strcmp(lv_label_get_text(label), value))
    lv_label_set_text(label, value);
}
lv_obj_t *area(lv_obj_t *parent, int x, int y, int w, int h) {
  auto *obj = lv_obj_create(parent);
  lv_obj_remove_style_all(obj);
  lv_obj_set_pos(obj, x, y);
  lv_obj_set_size(obj, w, h);
  lv_obj_remove_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
  return obj;
}
lv_obj_t *label(lv_obj_t *parent, int x, int y, int w, uint32_t color) {
  auto *obj = lv_label_create(parent);
  lv_obj_set_pos(obj, x, y);
  lv_obj_set_width(obj, w);
  lv_obj_set_style_text_font(obj, &live_font_18, 0);
  lv_obj_set_style_text_color(obj, lv_color_hex(color), 0);
  lv_obj_set_style_text_line_space(obj, 0, 0);
  lv_label_set_long_mode(obj, LV_LABEL_LONG_CLIP);
  lv_label_set_text(obj, "");
  return obj;
}
bool glyph(uint32_t codepoint) {
  lv_font_glyph_dsc_t dsc{};
  return caption_font->get_glyph_dsc(caption_font, &dsc, codepoint, 0) &&
         !dsc.is_placeholder;
}
void press(lv_event_t *) {
  ESP_LOGI("MosaicoView", "Touch Start/Stop pressed");
  live_esp32_status_t state{};
  live_esp32_status(&state);
  if (state.busy)
    live_esp32_stop();
  else if (wifi_ready())
    live_esp32_start();
}
void render_captions() {
  live_esp32_transcripts(&snapshot);
  live_caption_view::simplify(snapshot, glyph);
  auto next_line = [&](const char *value) {
    lv_text_attributes_t attributes{};
    attributes.max_width = LINE_WIDTH;
    return lv_text_get_next_line(value, LV_TEXT_LEN_MAX, caption_font, nullptr,
                                 &attributes);
  };
  page.update(snapshot, CONTENT_HEIGHT, caption_font->line_height, 0, 2,
              next_line);
  unsigned index = 0;
  int y = 0;
  for (unsigned i = 0; i < page.count; ++i) {
    const auto &block = page.blocks[i];
    const auto color =
        lv_color_hex(block.speaker == LIVE_SPEAKER_USER ? profile->user
                                                        : profile->assistant);
    size_t offset = 0, length = strlen(block.text);
    bool first = true;
    for (;;) {
      if (index >= std::size(lines))
        break;
      const size_t n = offset < length
                           ? std::min(size_t(next_line(block.text + offset)),
                                      length - offset)
                           : 0;
      char value[LIVE_TRANSCRIPT_BYTES];
      memcpy(value, block.text + offset, n);
      size_t end = n;
      while (end && (value[end - 1] == '\n' || value[end - 1] == '\r' ||
                     value[end - 1] == ' '))
        --end;
      value[end] = 0;
      text(lines[index], value);
      lv_obj_set_y(lines[index], y);
      lv_obj_set_style_text_color(lines[index], color, 0);
      show(lines[index], true);
      lv_obj_set_y(dots[index], y + caption_font->line_height / 2 - 2);
      lv_obj_set_style_bg_color(dots[index],
                                first ? color : lv_color_hex(0x243236), 0);
      show(dots[index], true);
      first = false;
      ++index;
      y += caption_font->line_height;
      if (!n)
        break;
      offset += n;
      if (offset == length && block.text[offset - 1] != '\n' &&
          block.text[offset - 1] != '\r')
        break;
    }
    y += 2;
  }
  for (; index < std::size(lines); ++index) {
    show(lines[index], false);
    show(dots[index], false);
  }
  revision = snapshot.revision;
}
} // namespace
void view_init() {
  bsp_display_config_t config = BSP_DISPLAY_DEFAULT_CONFIG();
  config.buffer_height = 40;
  ESP_ERROR_CHECK(bsp_display_start_with_config(&config) ? ESP_OK : ESP_FAIL);
  ESP_ERROR_CHECK(bsp_display_brightness_set(brightness));
  // This BSP treats zero as a nonblocking attempt, not an infinite wait.
  ESP_ERROR_CHECK(bsp_display_lock(2000) ? ESP_OK : ESP_FAIL);
  auto *screen = lv_screen_active();
  lv_obj_set_style_bg_color(screen, lv_color_black(), 0);
  lv_obj_remove_flag(screen, LV_OBJ_FLAG_SCROLLABLE);
  welcome = label(screen, 90, 82, 300, 0xE5E9EB);
  text(welcome, "Mosaico");
  lv_obj_set_style_text_align(welcome, LV_TEXT_ALIGN_CENTER, 0);
  status_label = label(screen, 85, 120, 310, 0x82949B);
  lv_label_set_long_mode(status_label, LV_LABEL_LONG_WRAP);
  lv_obj_set_style_text_align(status_label, LV_TEXT_ALIGN_CENTER, 0);
  captions = area(screen, 32, 48, 416, CONTENT_HEIGHT);
  usage = area(screen, 78, 100, 324, CONTENT_HEIGHT);
  for (unsigned i = 0; i < std::size(lines); ++i) {
    lines[i] = label(captions, 12, 0, LINE_WIDTH, profile->assistant);
    lv_obj_set_height(lines[i], caption_font->line_height);
    lv_obj_set_style_text_font(lines[i], caption_font, 0);
    dots[i] = area(captions, 1, 0, 3, 3);
    lv_obj_set_style_radius(dots[i], LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_opa(dots[i], LV_OPA_COVER, 0);
    show(lines[i], false);
    show(dots[i], false);
  }
  for (int i = 0; i < live_usage_view::ROW_COUNT; ++i) {
    text(label(usage, 0, i * 36, 88, 0x82949B), live_usage_view::KEYS[i]);
    values[i] = label(usage, 96, i * 36, 228, profile->assistant);
    lv_obj_set_style_text_font(values[i], &live_font_18, 0);
  }
  button = lv_button_create(screen);
  lv_obj_set_size(button, 208, 54);
  lv_obj_set_pos(button, 136, 388);
  lv_obj_set_style_radius(button, LV_RADIUS_CIRCLE, 0);
  control_large = false;
  lv_obj_set_style_shadow_width(button, 0, 0);
  lv_obj_set_style_border_width(button, 1, 0);
  lv_obj_set_ext_click_area(button, 10);
  lv_obj_add_event_cb(button, press, LV_EVENT_CLICKED, nullptr);
  button_text = label(button, 0, 0, LV_SIZE_CONTENT, profile->start);
  lv_obj_center(button_text);
  photo_label = label(screen, 185, 358, 110, profile->assistant);
  lv_obj_set_style_text_font(photo_label, &live_font_18, 0);
  text(photo_label, "Photo");
  show(photo_label, false);
  photo_image = lv_image_create(screen);
  lv_obj_set_pos(photo_image, 80, 110);
  lv_obj_remove_flag(photo_image, LV_OBJ_FLAG_CLICKABLE);
  show(photo_image, false);
  // Keep the Stop control accessible while the photo covers the captions.
  lv_obj_move_foreground(button);
  lv_obj_move_foreground(photo_label);
  show(captions, false);
  show(usage, false);
  bsp_display_unlock();
  view_update();
}
void view_update() {
  live_esp32_status_t state{};
  live_esp32_status(&state);
  if (!bsp_display_lock(100))
    return;
  const int64_t now = esp_timer_get_time();
  uint8_t *next_photo = pending_photo.exchange(nullptr);
  if (next_photo || (shown_photo && now >= photo_expires_us)) {
    show(photo_image, false);
    if (shown_photo) {
      lv_image_set_src(photo_image, nullptr);
      lv_image_cache_drop(&photo_descriptor);
      free(shown_photo);
      ESP_LOGI("MosaicoView", "photo preview %s",
               next_photo ? "replaced" : "expired");
    }
    shown_photo = next_photo;
    if (next_photo) {
      photo_descriptor = {};
      photo_descriptor.header.magic = LV_IMAGE_HEADER_MAGIC;
      photo_descriptor.header.cf = LV_COLOR_FORMAT_RGB565;
      photo_descriptor.header.w = 320;
      photo_descriptor.header.h = 240;
      photo_descriptor.header.stride = 320 * 2;
      photo_descriptor.data_size = 320 * 240 * 2;
      photo_descriptor.data = shown_photo;
      lv_image_set_src(photo_image, &photo_descriptor);
      photo_expires_us = now + 2000000;
      show(photo_image, true);
      ESP_LOGI("MosaicoView", "photo preview shown for 2000 ms");
    }
  }
  const bool transcripts = state.active;
  show(photo_label, state.photo_busy);
  const bool final = !state.busy && state.usage.started;
  const bool large_start = !transcripts && !final && !state.busy;
  if (large_start != control_large) {
    lv_obj_set_size(button, large_start ? 256 : 208, large_start ? 136 : 54);
    lv_obj_set_pos(button, large_start ? 112 : 136, large_start ? 190 : 388);
    lv_obj_set_style_text_font(button_text,
                               large_start ? &live_font_36 : &live_font_28, 0);
    control_large = large_start;
    lv_obj_center(button_text);
  }
  show(welcome, !transcripts && !final);
  const char *status = wifi_ready() ? state.status : "Connecting Wi-Fi...";
  show(status_label,
       !transcripts && !final && strcmp(status, "Ready - tap Start") != 0);
  show(captions, transcripts && !shown_photo);
  show(usage, final);
  text(status_label, status);
  if (transcripts && !shown_photo && revision != state.transcript_revision)
    render_captions();
  if (final) {
    char value[160];
    for (int i = 0; i < live_usage_view::ROW_COUNT; ++i) {
      live_usage_view::format(state.usage, live_usage_view::Row(i), value,
                              sizeof(value));
      text(values[i], value);
    }
  }
  const uint32_t color = state.active   ? profile->stop
                         : state.busy   ? profile->assistant
                         : wifi_ready() ? profile->start
                                        : 0x82949B;
  const char *caption = state.busy ? "Stop" : "Start";
  if (strcmp(lv_label_get_text(button_text), caption)) {
    text(button_text, caption);
    lv_obj_center(button_text);
  }
  // Avoid invalidating the same button pixels on every 50 ms poll.
  if (control_color != color) {
    control_color = color;
    lv_obj_set_style_text_color(button_text, lv_color_hex(color), 0);
    lv_obj_set_style_bg_color(
        button, lv_color_mix(lv_color_hex(color), lv_color_black(), 32), 0);
    lv_obj_set_style_border_color(
        button,
        lv_color_mix(lv_color_hex(color), lv_color_black(), profile->border),
        0);
  }
  if (wifi_ready() || state.busy)
    lv_obj_remove_state(button, LV_STATE_DISABLED);
  else
    lv_obj_add_state(button, LV_STATE_DISABLED);
  bsp_display_unlock();
}
void view_photo(uint16_t *rgb565) {
  // Only the GUI task touches LVGL; ownership crosses through the atomic slot.
  free(pending_photo.exchange(reinterpret_cast<uint8_t *>(rgb565)));
}
} // namespace board
