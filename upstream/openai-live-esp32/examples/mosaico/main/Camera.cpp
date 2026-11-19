#include "Board.hpp"
#include "CameraPixels.hpp"
#include "driver/jpeg_encode.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "mosaico_module_camera.h"
#include <cstdlib>
#include <cstring>
#include <initializer_list>

namespace board {
namespace {
mosaico_camera_handle_t camera = nullptr;
constexpr size_t PIXELS = mosaico::PHOTO_WIDTH * mosaico::PHOTO_HEIGHT;
} // namespace
void camera_init() {
  if (camera)
    return;
  mosaico_camera_config_t cfg = MOSAICO_CAMERA_DEFAULT_CONFIG();
  cfg.discovery_timeout_ms = 2000;
  cfg.frame_timeout_ms = 500;
  const auto err = mosaico_camera_new(&cfg, &camera);
  ESP_LOGI("MosaicoCamera", "Camera registration: %s", esp_err_to_name(err));
}
esp_err_t capture_photo(void *, uint8_t *jpeg, size_t capacity,
                        size_t *length) {
  if (!jpeg || !length || !capacity)
    return ESP_ERR_INVALID_ARG;
  *length = 0;
  // A transient SCCB timeout during boot must not disable the camera until
  // reboot. Captures are serialized by the SDK; retry registration on demand
  // after other module initialization has settled.
  if (!camera)
    camera_init();
  if (!camera)
    return ESP_ERR_NOT_FOUND;
  // The SDK serializes captures on its low-priority tool worker. No background
  // video stream competes with Wi-Fi/audio; all DMA buffers are released below.
  esp_err_t err = mosaico_camera_open(camera);
  bool opened = err == ESP_OK, streaming = false, borrowed = false;
  mosaico_camera_frame_t frame{};
  jpeg_encoder_handle_t encoder = nullptr;
  uint8_t *input = nullptr, *output = nullptr;
  auto *preview =
      static_cast<uint16_t *>(heap_caps_malloc(PIXELS * 2, MALLOC_CAP_SPIRAM));
  size_t input_capacity = 0, output_capacity = 0;
  size_t stride = 0;
  if (err == ESP_OK) {
    err = mosaico_camera_start_stream(camera);
    streaming = err == ESP_OK;
  }
  if (err == ESP_OK) {
    err = mosaico_camera_get_frame(camera, &frame);
    borrowed = err == ESP_OK;
    if (borrowed)
      stride = mosaico::frame_stride(frame.width, frame.height,
                                     frame.bytes_per_line, frame.size);
  }
  if (err == ESP_OK &&
      (frame.pixel_format != V4L2_PIX_FMT_UYVY || !frame.data || !stride))
    err = ESP_ERR_INVALID_SIZE;
  if (err == ESP_OK) {
    jpeg_encode_memory_alloc_cfg_t mem{};
    mem.buffer_direction = JPEG_ENC_ALLOC_INPUT_BUFFER;
    input = static_cast<uint8_t *>(
        jpeg_alloc_encoder_mem(PIXELS * 2, &mem, &input_capacity));
    mem.buffer_direction = JPEG_ENC_ALLOC_OUTPUT_BUFFER;
    // Encode into an independent workspace before enforcing the SDK's 10 KiB
    // data-channel budget. Complex scenes need a lower quality setting.
    output = static_cast<uint8_t *>(
        jpeg_alloc_encoder_mem(PIXELS * 4, &mem, &output_capacity));
    if (!input || !output)
      err = ESP_ERR_NO_MEM;
  }
  if (err == ESP_OK) {
    for (unsigned y = 0; y < mosaico::PHOTO_HEIGHT; ++y) {
      mosaico::sample_row(
          static_cast<const uint8_t *>(frame.data), frame.width, frame.height,
          stride, y, input + y * mosaico::PHOTO_WIDTH * 2,
          preview ? preview + y * mosaico::PHOTO_WIDTH : nullptr);
      if (!(y % 16))
        vTaskDelay(1);
    }
  }
  if (borrowed) {
    const auto returned = mosaico_camera_return_frame(camera, &frame);
    if (err == ESP_OK)
      err = returned;
  }
  if (streaming) {
    const auto stopped = mosaico_camera_stop_stream(camera);
    if (err == ESP_OK)
      err = stopped;
  }
  if (opened) {
    const auto closed = mosaico_camera_close(camera);
    if (err == ESP_OK)
      err = closed;
  }
  if (err == ESP_OK) {
    jpeg_encode_engine_cfg_t engine{};
    engine.timeout_ms = 400;
    err = jpeg_new_encoder_engine(&engine, &encoder);
  }
  if (err == ESP_OK) {
    jpeg_encode_cfg_t config{};
    config.width = mosaico::PHOTO_WIDTH;
    config.height = mosaico::PHOTO_HEIGHT;
    config.src_type = JPEG_ENCODE_IN_FORMAT_YUV422;
    config.sub_sample = JPEG_DOWN_SAMPLING_YUV422;
    uint32_t size = 0;
    for (unsigned quality : {70U, 50U, 35U, 20U, 10U}) {
      config.image_quality = quality;
      err = jpeg_encoder_process(encoder, &config, input, PIXELS * 2, output,
                                 output_capacity, &size);
      if (err != ESP_OK || size <= capacity)
        break;
      vTaskDelay(1);
    }
    if (err == ESP_OK && (size < 4 || size > capacity || output[0] != 0xff ||
                          output[1] != 0xd8 || output[size - 2] != 0xff ||
                          output[size - 1] != 0xd9))
      err = ESP_ERR_INVALID_SIZE;
    if (err == ESP_OK) {
      memcpy(jpeg, output, size);
      *length = size;
      if (preview) {
        view_photo(preview);
        preview = nullptr;
      }
    }
  }
  if (encoder)
    jpeg_del_encoder_engine(encoder);
  free(input);
  free(output);
  free(preview);
  ESP_LOGI("MosaicoCamera", "Capture %s: %ux%u stride=%u bytes=%u JPEG=%u",
           esp_err_to_name(err), unsigned(frame.width), unsigned(frame.height),
           unsigned(stride), unsigned(frame.size), unsigned(*length));
  return err;
}
} // namespace board
