#include "Board.hpp"
#include "CaptionText.hpp"
#include "LiveFonts.h"
#include "TranscriptPage.hpp"
#include "UsageSummary.hpp"
#include "bsp/esp32_s3_touch_amoled_1_75.h"
#include "bsp/touch.h"
#include "src/misc/lv_text_private.h"
#include <algorithm>
#include <cstdio>
#include <cstring>
#include <iterator>

static_assert(LVGL_VERSION_MAJOR == 9 && LVGL_VERSION_MINOR == 6 &&
                  LVGL_VERSION_PATCH == 0,
              "Build with the LVGL version pinned in idf_component.yml");

namespace board {
namespace {
// This rectangle stays inside the round glass, including its four corners.
// Fixed-width pagination avoids reflow and scrolling during streamed replies.
constexpr int CONTENT_HEIGHT = 276, LINE_WIDTH = 306;
const lv_font_t *caption_font = &live_font_28;
bool control_large = false;
lv_obj_t *welcome, *status_label, *captions, *usage, *button, *button_text;
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
  page.update(snapshot, CONTENT_HEIGHT, caption_font->line_height, 0, 2, next_line);
  unsigned index = 0;
  int y = 0;
  for (unsigned i = 0; i < page.count; ++i) {
    const auto &block = page.blocks[i];
    const auto color =
        lv_color_hex(block.speaker == LIVE_SPEAKER_USER ? 0x83D9E5 : 0xE5C78F);
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
static void update_view();
void view_init() {
  bsp_display_cfg_t config{};
  config.lv_adapter_cfg = ESP_LV_ADAPTER_DEFAULT_CONFIG();
  config.lv_adapter_cfg.task_priority = 3;
  config.lv_adapter_cfg.task_core_id = 1;
  config.rotation = ESP_LV_ADAPTER_ROTATE_0;
  config.tear_avoid_mode = ESP_LV_ADAPTER_TEAR_AVOID_MODE_NONE;
  config.touch_flags.mirror_x = 1;
  config.touch_flags.mirror_y = 1;
  ESP_ERROR_CHECK(esp_lv_adapter_init(&config.lv_adapter_cfg));
  // The BSP convenience function uses 50-line PSRAM buffers. SPI must then
  // allocate a ~46 KB internal DMA bounce buffer for every flush, which fails
  // once TLS/DTLS fragment the internal heap. Reserve two small internal strips
  // at boot instead, so display flushes do not need that transient allocation.
  constexpr int STRIP_LINES = 12;
  bsp_display_config_t bus{};
  bus.max_transfer_sz = BSP_LCD_H_RES * STRIP_LINES * sizeof(uint16_t);
  esp_lcd_panel_handle_t panel = nullptr;
  esp_lcd_panel_io_handle_t io = nullptr;
  ESP_ERROR_CHECK(bsp_display_new(&bus, &panel, &io));
  esp_lv_adapter_display_config_t display_config{};
  display_config.panel = panel;
  display_config.panel_io = io;
  display_config.profile.interface = ESP_LV_ADAPTER_PANEL_IF_OTHER;
  display_config.profile.rotation = config.rotation;
  display_config.profile.hor_res = BSP_LCD_H_RES;
  display_config.profile.ver_res = BSP_LCD_V_RES;
  display_config.profile.buffer_height = STRIP_LINES;
  display_config.profile.use_psram = false;
  display_config.profile.require_double_buffer = true;
  display_config.tear_avoid_mode = config.tear_avoid_mode;
  auto *display = esp_lv_adapter_register_display(&display_config);
  ESP_ERROR_CHECK(display ? ESP_OK : ESP_ERR_NO_MEM);
  // CO5300 partial updates require even origins and even dimensions.
  lv_display_add_event_cb(display, [](lv_event_t *event) {
    auto *rect = static_cast<lv_area_t *>(lv_event_get_param(event));
    rect->x1 &= ~1;
    rect->y1 &= ~1;
    rect->x2 |= 1;
    rect->y2 |= 1;
  }, LV_EVENT_INVALIDATE_AREA, nullptr);
  esp_lcd_touch_handle_t touch = nullptr;
  ESP_ERROR_CHECK(bsp_touch_new(&config, &touch));
  const esp_lv_adapter_touch_config_t touch_config =
      ESP_LV_ADAPTER_TOUCH_DEFAULT_CONFIG(display, touch);
  ESP_ERROR_CHECK(esp_lv_adapter_register_touch(&touch_config) ? ESP_OK
                                                            : ESP_ERR_NO_MEM);
  ESP_ERROR_CHECK(esp_lv_adapter_start());
  ESP_ERROR_CHECK(bsp_display_brightness_set(85));
  // This BSP returns esp_err_t; the M5Stack BSP's similarly named API is bool.
  ESP_ERROR_CHECK(bsp_display_lock(UINT32_MAX));
  auto *screen = lv_screen_active();
  lv_obj_set_style_bg_color(screen, lv_color_black(), 0);
  lv_obj_remove_flag(screen, LV_OBJ_FLAG_SCROLLABLE);
  welcome = label(screen, 93, 120, 280, 0xE5E9EB);
  lv_obj_set_style_text_font(welcome, &live_font_28, 0);
  text(welcome, "Live Voice");
  lv_obj_set_style_text_align(welcome, LV_TEXT_ALIGN_CENTER, 0);
  status_label = label(screen, 83, 170, 300, 0x82949B);
  lv_obj_set_height(status_label, 64);
  lv_label_set_long_mode(status_label, LV_LABEL_LONG_WRAP);
  lv_obj_set_style_text_align(status_label, LV_TEXT_ALIGN_CENTER, 0);
  captions = area(screen, 74, 76, 318, CONTENT_HEIGHT);
  usage = area(screen, 88, 106, 290, 216);
  for (unsigned i = 0; i < std::size(lines); ++i) {
    lines[i] = label(captions, 12, 0, LINE_WIDTH, 0xE5C78F);
    lv_obj_set_height(lines[i], caption_font->line_height);
    lv_obj_set_style_text_font(lines[i], caption_font, 0);
    dots[i] = area(captions, 1, 0, 3, 3);
    lv_obj_set_style_radius(dots[i], LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_opa(dots[i], LV_OPA_COVER, 0);
    show(lines[i], false);
    show(dots[i], false);
  }
  for (int i = 0; i < live_usage_view::ROW_COUNT; ++i) {
    text(label(usage, 0, i * 34, 88, 0x82949B), live_usage_view::KEYS[i]);
    values[i] = label(usage, 90, i * 34, 200, 0xE5C78F);
    lv_obj_set_style_text_font(values[i], &live_font_16, 0);
  }
  button = lv_button_create(screen);
  lv_obj_set_size(button, 180, 54);
  lv_obj_set_pos(button, 143, 368);
  lv_obj_set_style_radius(button, LV_RADIUS_CIRCLE, 0);
  control_large = false;
  lv_obj_set_style_shadow_width(button, 0, 0);
  lv_obj_set_style_border_width(button, 1, 0);
  lv_obj_set_ext_click_area(button, 16);
  lv_obj_add_event_cb(button, press, LV_EVENT_CLICKED, nullptr);
  button_text = label(button, 0, 0, LV_SIZE_CONTENT, 0x8CDBAD);
  lv_obj_center(button_text);
  show(captions, false);
  show(usage, false);
  update_view();
  // Run updates on LVGL's own task. The USB command loop remains responsive
  // and does not repeatedly time out acquiring the GUI mutex during TLS work.
  ESP_ERROR_CHECK(lv_timer_create([](lv_timer_t *) { update_view(); }, 100,
                                  nullptr) ? ESP_OK : ESP_ERR_NO_MEM);
  bsp_display_unlock();
}
static void update_view() {
  live_esp32_status_t state{};
  live_esp32_status(&state);
  const bool transcripts = state.active;
  const bool final = !state.busy && state.usage.started;
  const bool large_start = !transcripts && !final && !state.busy;
  if (large_start != control_large) {
    lv_obj_set_size(button, large_start ? 260 : 180, large_start ? 100 : 54);
    lv_obj_set_pos(button, large_start ? 103 : 143, large_start ? 245 : 368);
    lv_obj_set_style_text_font(button_text,
                              large_start ? &live_font_28 : &live_font_22, 0);
    control_large = large_start;
  }
  show(welcome, !transcripts && !final);
  const char *status = wifi_ready() ? state.status : "Connecting Wi-Fi...";
  show(status_label, !transcripts && !final &&
                         strcmp(status, "Ready - tap Start") != 0);
  show(captions, transcripts);
  show(usage, final);
  text(status_label, status);
  if (transcripts && revision != state.transcript_revision)
    render_captions();
  if (final) {
    char value[160];
    for (int i = 0; i < live_usage_view::ROW_COUNT; ++i) {
      live_usage_view::format(state.usage, live_usage_view::Row(i), value,
                              sizeof(value));
      text(values[i], value);
    }
  }
  const uint32_t color = state.active   ? 0xE89CA0
                         : state.busy   ? 0xE5C78F
                         : wifi_ready() ? 0x8CDBAD
                                        : 0x82949B;
  text(button_text, state.busy ? "Stop" : "Start");
  lv_obj_center(button_text);
  lv_obj_set_style_text_color(button_text, lv_color_hex(color), 0);
  lv_obj_set_style_bg_color(
      button, lv_color_mix(lv_color_hex(color), lv_color_black(), 32), 0);
  lv_obj_set_style_border_color(
      button, lv_color_mix(lv_color_hex(color), lv_color_black(), 64), 0);
  if (wifi_ready() || state.busy)
    lv_obj_remove_state(button, LV_STATE_DISABLED);
  else
    lv_obj_add_state(button, LV_STATE_DISABLED);
}
esp_err_t view_snapshot() {
  if (bsp_display_lock(100) != ESP_OK)
    return ESP_ERR_TIMEOUT;
  live_esp32_status_t state{};
  live_esp32_status(&state);
  // Debug captures are intentionally idle-only: no extra rendering or USB
  // framebuffer transfer is needed during normal voice playback.
  if (state.busy) {
    bsp_display_unlock();
    return ESP_ERR_INVALID_STATE;
  }
  lv_obj_update_layout(lv_screen_active());
  auto *shot = lv_snapshot_take(lv_screen_active(), LV_COLOR_FORMAT_RGB565);
  bsp_display_unlock();
  if (!shot)
    return ESP_ERR_NO_MEM;
  printf("LVGL_RGB565 %lu %lu %lu\n", (unsigned long)shot->header.w,
         (unsigned long)shot->header.h, (unsigned long)shot->header.stride);
  constexpr char hex[] = "0123456789abcdef";
  const size_t size = size_t(shot->header.stride) * shot->header.h;
  for (size_t offset = 0; offset < size; offset += 128) {
    char line[257];
    const size_t count = std::min(size_t(128), size - offset);
    for (size_t i = 0; i < count; ++i) {
      line[2 * i] = hex[shot->data[offset + i] >> 4];
      line[2 * i + 1] = hex[shot->data[offset + i] & 15];
    }
    line[2 * count] = 0;
    printf("LVGL_DATA %s\n", line);
  }
  printf("LVGL_END\n");
  ESP_ERROR_CHECK(bsp_display_lock(UINT32_MAX));
  lv_draw_buf_destroy(shot);
  bsp_display_unlock();
  return ESP_OK;
}
} // namespace board
