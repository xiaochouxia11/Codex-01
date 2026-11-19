#include "Board.hpp"
#include "CaptionText.hpp"
#include "LiveFonts.h"
#include "TranscriptPage.hpp"
#include "UsageSummary.hpp"
#include "bsp/m5stack_core_s3.h"
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

static_assert(LVGL_VERSION_MAJOR == 9 && LVGL_VERSION_MINOR == 6 &&
                  LVGL_VERSION_PATCH == 0,
              "Build with the LVGL version pinned in idf_component.yml");

namespace board {
namespace {
constexpr int CONTENT_HEIGHT = 176, LINE_WIDTH = 292;
const lv_font_t *caption_font = &live_font_22;
bool control_large = false;
uint32_t button_color = UINT32_MAX;
struct DisplayProfile {
  uint32_t user, assistant, start, stop;
  uint8_t brightness, border;
};
constexpr DisplayProfile ORIGINAL{0x83D9E5, 0xE5C78F, 0x8CDBAD,
                                  0xE89CA0, 85,       64};
constexpr DisplayProfile VIVID{0x3CD9F0, 0xFFBF50, 0x37D995, 0xFF607B, 65, 144};
const DisplayProfile *profile = &VIVID;
int brightness = VIVID.brightness;
lv_obj_t *display_test = nullptr, *test_title, *test_user, *test_assistant;
int64_t display_test_expires_us = 0;
lv_obj_t *welcome, *status_label, *captions, *usage, *button, *button_text;
lv_obj_t *photo_label;
lv_obj_t *photo_image;
std::atomic<uint8_t *> pending_photo{nullptr};
uint8_t *shown_photo = nullptr;
lv_image_dsc_t photo_descriptor{};
int64_t photo_expires_us = 0;
lv_obj_t *movie_image = nullptr;
lv_image_dsc_t movie_descriptors[2]{};
bool movie_loaded = false, was_busy = false;
std::atomic<bool> movie_visible{false};
int64_t controls_until_us = 0;
uint32_t movie_sequence = 0, movie_rendered_sequence = 0;
std::atomic<uint32_t> movie_renders{0};
std::atomic<int64_t> movie_max_gap{0};
int64_t movie_last_render_us = 0;
lv_indev_read_cb_t touch_reader = nullptr;
std::atomic<uint32_t> touch_samples{0}, touch_presses{0}, button_actions{0};
std::atomic<uint32_t> touch_gap_us{0}, touch_read_us{0}, flush_max_us{0};
int64_t touch_last_us = 0, flush_start_us = 0;
bool touch_pressed = false;
void observe(std::atomic<uint32_t> &maximum, uint32_t value) {
  auto previous = maximum.load();
  while (previous < value && !maximum.compare_exchange_weak(previous, value)) {
  }
}
void measured_touch_read(lv_indev_t *input, lv_indev_data_t *data) {
  const auto now = esp_timer_get_time();
  if (touch_last_us && movie_visible.load())
    observe(touch_gap_us, uint32_t(now - touch_last_us));
  touch_last_us = now;
  touch_reader(input, data);
  observe(touch_read_us, uint32_t(esp_timer_get_time() - now));
  ++touch_samples;
  const bool down = data->state == LV_INDEV_STATE_PRESSED;
  if (down && !touch_pressed)
    ++touch_presses;
  touch_pressed = down;
}
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
  ++button_actions;
  live_esp32_status_t state{};
  live_esp32_status(&state);
  if (state.busy)
    live_esp32_stop();
  else if (wifi_ready())
    live_esp32_start();
}
void reveal_controls(lv_event_t *) {
  controls_until_us = esp_timer_get_time() + 7000000;
  // This callback already owns the LVGL lock: no extra main-loop round trip.
  show(button, true);
}
void movie_rendered(lv_event_t *event) {
  auto *display = static_cast<lv_display_t *>(lv_event_get_target(event));
  if (lv_event_get_code(event) == LV_EVENT_FLUSH_START) {
    flush_start_us = esp_timer_get_time();
    return;
  }
  if (flush_start_us)
    observe(flush_max_us, uint32_t(esp_timer_get_time() - flush_start_us));
  if (!lv_display_flush_is_last(display) || !movie_visible.load() ||
      movie_sequence == movie_rendered_sequence)
    return;
  movie_rendered_sequence = movie_sequence;
  ++movie_renders;
  const auto now = esp_timer_get_time();
  if (movie_last_render_us)
    movie_max_gap.store(
        std::max(movie_max_gap.load(), now - movie_last_render_us));
  movie_last_render_us = now;
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
void view_init(const char *title) {
  bsp_display_cfg_t config{};
  config.lvgl_port_cfg = ESP_LVGL_PORT_INIT_CONFIG();
  config.lvgl_port_cfg.task_priority = 3;
  config.lvgl_port_cfg.task_affinity = 1;
  config.buffer_size = 320 * 20;
  config.double_buffer = true;
  config.flags.buff_dma = true;
  ESP_ERROR_CHECK(bsp_display_start_with_config(&config) ? ESP_OK : ESP_FAIL);
  ESP_ERROR_CHECK(bsp_display_brightness_set(brightness));
  ESP_ERROR_CHECK(bsp_display_lock(0) ? ESP_OK : ESP_FAIL);
  auto *screen = lv_screen_active();
  lv_obj_set_style_bg_color(screen, lv_color_black(), 0);
  lv_obj_remove_flag(screen, LV_OBJ_FLAG_SCROLLABLE);
  welcome = label(screen, 20, 55, 280, 0xE5E9EB);
  text(welcome, title);
  lv_obj_set_style_text_align(welcome, LV_TEXT_ALIGN_CENTER, 0);
  status_label = label(screen, 20, 90, 280, 0x82949B);
  lv_label_set_long_mode(status_label, LV_LABEL_LONG_WRAP);
  lv_obj_set_style_text_align(status_label, LV_TEXT_ALIGN_CENTER, 0);
  captions = area(screen, 8, 8, 304, CONTENT_HEIGHT);
  usage = area(screen, 12, 10, 296, CONTENT_HEIGHT);
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
    text(label(usage, 0, i * 26, 88, 0x82949B), live_usage_view::KEYS[i]);
    values[i] = label(usage, 90, i * 26, 206, profile->assistant);
    lv_obj_set_style_text_font(values[i], &live_font_16, 0);
  }
  button = lv_button_create(screen);
  lv_obj_set_size(button, 156, 40);
  lv_obj_set_pos(button, 82, 193);
  lv_obj_set_style_radius(button, LV_RADIUS_CIRCLE, 0);
  control_large = false;
  lv_obj_set_style_shadow_width(button, 0, 0);
  lv_obj_set_style_border_width(button, 1, 0);
  lv_obj_set_ext_click_area(button, 10);
  lv_obj_add_event_cb(button, press, LV_EVENT_CLICKED, nullptr);
  button_text = label(button, 0, 0, LV_SIZE_CONTENT, profile->start);
  lv_obj_center(button_text);
  photo_label = label(screen, 8, 210, 68, profile->assistant);
  lv_obj_set_style_text_font(photo_label, &live_font_16, 0);
  text(photo_label, "Photo");
  show(photo_label, false);
  photo_image = lv_image_create(screen);
  lv_obj_set_pos(photo_image, 0, 0);
  lv_obj_remove_flag(photo_image, LV_OBJ_FLAG_CLICKABLE);
  show(photo_image, false);
  movie_image = lv_image_create(screen);
  lv_obj_set_pos(movie_image, 0, 0);
  lv_obj_add_flag(movie_image, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_add_event_cb(movie_image, reveal_controls, LV_EVENT_PRESSED, nullptr);
  show(movie_image, false);
  lv_display_add_event_cb(lv_display_get_default(), movie_rendered,
                          LV_EVENT_FLUSH_FINISH, nullptr);
  lv_display_add_event_cb(lv_display_get_default(), movie_rendered,
                          LV_EVENT_FLUSH_START, nullptr);
  if (auto *input = bsp_display_get_input_dev()) {
    touch_reader = lv_indev_get_read_cb(input);
    if (touch_reader)
      lv_indev_set_read_cb(input, measured_touch_read);
  }
  lv_obj_move_foreground(photo_image);
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
      ESP_LOGI("M5View", "photo preview %s",
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
      ESP_LOGI("M5View", "photo preview shown for 2000 ms");
    }
  }
  if (display_test) {
    // Diagnostic objects exist only while idle and are released on expiry.
    if (now >= display_test_expires_us || state.busy || shown_photo) {
      lv_obj_delete(display_test);
      display_test = test_title = test_user = test_assistant = nullptr;
    } else {
      char title[64];
      snprintf(title, sizeof(title), "%s - backlight %d%%",
               profile == &VIVID ? "Vivid" : "Original", brightness);
      text(test_title, title);
    }
  }
  if (state.busy != was_busy) {
    controls_until_us = now + (state.busy ? 4000000 : 10000000);
    was_busy = state.busy;
  }
  const bool controls = !movie_loaded || now < controls_until_us;
  const bool final = !state.busy && state.usage.started;
  const bool movie =
      movie_loaded && !shown_photo && !display_test && !(final && controls);
  show(movie_image, movie);
  movie_visible.store(movie, std::memory_order_relaxed);
  if (!movie)
    movie_last_render_us = 0;
  const bool transcripts = state.active && !movie;
  show(photo_label, state.photo_busy);
  const bool large_start = !state.active && !final && !state.busy;
  if (large_start != control_large) {
    lv_obj_set_size(button, large_start ? 240 : 156, large_start ? 80 : 40);
    lv_obj_set_pos(button, large_start ? 40 : 82, large_start ? 153 : 193);
    lv_obj_set_style_text_font(button_text,
                               large_start ? &live_font_22 : &live_font_18, 0);
    control_large = large_start;
    lv_obj_center(button_text);
  }
  show(welcome, !state.active && !final && !movie);
  const char *status = wifi_ready() ? state.status : "Connecting Wi-Fi...";
  show(status_label, !state.active && !final && !movie &&
                         strcmp(status, "Ready - tap Start") != 0);
  show(captions, transcripts && !shown_photo);
  show(usage, final && !movie);
  show(button, controls || shown_photo || !movie);
  text(status_label, status);
  if (transcripts && !shown_photo && revision != state.transcript_revision)
    render_captions();
  if (final && !movie) {
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
  const char *control_text = state.busy ? "Stop" : "Start";
  if (strcmp(lv_label_get_text(button_text), control_text)) {
    text(button_text, control_text);
    lv_obj_center(button_text);
  }
  if (button_color != color) {
    button_color = color;
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
// These controls run on the main/UI task, just like view_update().
esp_err_t view_brightness(int percent) {
  if (percent < 0 || percent > 100)
    return ESP_ERR_INVALID_ARG;
  const auto result = bsp_display_brightness_set(percent);
  if (result == ESP_OK)
    brightness = percent;
  return result;
}
esp_err_t view_display_profile(bool vivid) {
  if (!bsp_display_lock(100))
    return ESP_ERR_TIMEOUT;
  const auto *next = vivid ? &VIVID : &ORIGINAL;
  const auto result = view_brightness(next->brightness);
  if (result == ESP_OK) {
    profile = next;
    button_color = UINT32_MAX;
    revision = UINT32_MAX;
    for (auto *value : values)
      lv_obj_set_style_text_color(value, lv_color_hex(profile->assistant), 0);
    lv_obj_set_style_text_color(photo_label, lv_color_hex(profile->assistant),
                                0);
    if (display_test) {
      lv_obj_set_style_text_color(test_user, lv_color_hex(profile->user), 0);
      lv_obj_set_style_text_color(test_assistant,
                                  lv_color_hex(profile->assistant), 0);
    }
    ESP_LOGI("M5View", "display profile=%s backlight=%d%%",
             vivid ? "vivid" : "original", brightness);
  }
  bsp_display_unlock();
  return result;
}
esp_err_t view_display_test() {
  live_esp32_status_t state{};
  live_esp32_status(&state);
  if (state.busy)
    return ESP_ERR_INVALID_STATE;
  if (!bsp_display_lock(100))
    return ESP_ERR_TIMEOUT;
  if (!display_test) {
    display_test = area(lv_screen_active(), 0, 0, 320, 150);
    lv_obj_set_style_bg_color(display_test, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(display_test, LV_OPA_COVER, 0);
    test_title = label(display_test, 10, 4, 300, 0xE5E9EB);
    constexpr uint32_t colors[] = {0xFF0000, 0x00FF00, 0x0000FF, 0xFFFFFF};
    for (unsigned i = 0; i < 4; ++i) {
      auto *patch = area(display_test, 10 + i * 75, 30, 72, 22);
      lv_obj_set_style_bg_color(patch, lv_color_hex(colors[i]), 0);
      lv_obj_set_style_bg_opa(patch, LV_OPA_COVER, 0);
    }
    constexpr uint8_t grays[] = {0, 8, 16, 32, 64, 128, 192, 255};
    for (unsigned i = 0; i < 8; ++i) {
      auto *patch = area(display_test, 10 + i * 37, 57, 37, 16);
      lv_obj_set_style_bg_color(patch,
                                lv_color_make(grays[i], grays[i], grays[i]), 0);
      lv_obj_set_style_bg_opa(patch, LV_OPA_COVER, 0);
    }
    test_user = label(display_test, 10, 81, 300, profile->user);
    test_assistant = label(display_test, 10, 112, 300, profile->assistant);
    lv_obj_set_style_text_font(test_user, caption_font, 0);
    lv_obj_set_style_text_font(test_assistant, caption_font, 0);
    text(test_user, "Cyan user transcript");
    text(test_assistant, "Gold assistant transcript");
    lv_obj_remove_flag(display_test, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_move_foreground(button);
  }
  display_test_expires_us = esp_timer_get_time() + 30000000;
  bsp_display_unlock();
  return ESP_OK;
}
void view_photo(uint8_t *rgb565) {
  // Called only by the low-priority capture worker. LVGL and the currently
  // displayed buffer remain exclusively owned by the GUI task under its lock.
  free(pending_photo.exchange(rgb565));
}
bool view_movie_frame(const uint8_t *rgb565, unsigned slot, uint32_t *receipt) {
  if (slot > 1 || !movie_image || !bsp_display_lock(30))
    return false;
  if (!rgb565) {
    show(movie_image, false);
    lv_image_set_src(movie_image, nullptr);
    movie_loaded = false;
    movie_visible.store(false, std::memory_order_relaxed);
  } else {
    if (!movie_loaded) {
      controls_until_us = esp_timer_get_time() + 5000000;
      if (auto *input = bsp_display_get_input_dev())
        if (auto *timer = lv_indev_get_read_timer(input))
          lv_timer_set_period(timer, 16);
      lv_obj_set_ext_click_area(button, 20);
    }
    auto &d = movie_descriptors[slot];
    lv_image_cache_drop(&d);
    d = {};
    d.header.magic = LV_IMAGE_HEADER_MAGIC;
    d.header.cf = LV_COLOR_FORMAT_RGB565;
    d.header.w = 320;
    d.header.h = 240;
    d.header.stride = 640;
    d.data_size = 320 * 240 * 2;
    d.data = rgb565;
    lv_image_set_src(movie_image, &d);
    lv_obj_invalidate(movie_image);
    movie_loaded = true;
    ++movie_sequence;
    if (receipt)
      *receipt = movie_sequence;
  }
  bsp_display_unlock();
  return true;
}
bool view_movie_presented(uint32_t receipt, int64_t &at_us) {
  if (!bsp_display_lock(5))
    return false;
  const bool rendered = movie_rendered_sequence == receipt && movie_visible;
  if (rendered)
    at_us = movie_last_render_us;
  bsp_display_unlock();
  return rendered;
}
bool view_movie_visible() {
  return movie_visible.load(std::memory_order_relaxed);
}
void view_movie_stats(uint32_t &rendered, int64_t &max_gap_us) {
  rendered = movie_renders.load();
  max_gap_us = movie_max_gap.load();
}
void view_movie_diagnostics() {
  ESP_LOGI(
      "M5View",
      "touch_window samples=%lu presses=%lu actions=%lu poll_gap_max_us=%lu "
      "read_max_us=%lu flush_submit_max_us=%lu",
      (unsigned long)touch_samples.load(), (unsigned long)touch_presses.load(),
      (unsigned long)button_actions.load(),
      (unsigned long)touch_gap_us.exchange(0),
      (unsigned long)touch_read_us.exchange(0),
      (unsigned long)flush_max_us.exchange(0));
}
} // namespace board
