#include "Board.hpp"
#include "CameraEncoding.hpp"
#include "bsp/m5stack_core_s3.h"
#include "esp_heap_caps.h"
#include "esp_jpeg_enc.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "esp_video_device.h"
#include "esp_video_init.h"
#include "esp_video_ioctl.h"
#include <cerrno>
#include <climits>
#include <cstdlib>
#include <cstring>
#include <fcntl.h>
#include <initializer_list>
#include <linux/videodev2.h>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <unistd.h>

namespace board {
namespace {
constexpr char TAG[] = "M5Camera";
using namespace m5_camera;
// Capture is serialized by the SDK's photo worker. Nothing streams while idle.
struct Camera {
  int fd = -1;
  bool initialized = false, streaming = false, powered = false;
  void close() {
    if (fd >= 0) {
      v4l2_buf_type type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
      if (streaming)
        ioctl(fd, VIDIOC_STREAMOFF, &type);
      streaming = false;
      ::close(fd); // The driver owns and releases its MMAP frame buffers.
      fd = -1;
    }
    if (initialized)
      esp_video_deinit();
    initialized = false;
    if (powered)
      bsp_feature_enable(BSP_FEATURE_CAMERA, false);
    powered = false;
  }
  ~Camera() { close(); }
};
} // namespace

esp_err_t capture_photo(void *, uint8_t *jpeg, size_t capacity,
                        size_t *length) {
  if (!jpeg || !length || capacity > INT_MAX)
    return ESP_ERR_INVALID_ARG;
  *length = 0;
  const int64_t began = esp_timer_get_time();
  Camera camera;
  camera.powered =
      true; // Also switch power off after a partial initialization.
  bsp_camera_cfg_t cfg{};
  esp_err_t result = bsp_camera_start(&cfg);
  if (result != ESP_OK)
    return result;
  camera.initialized = true;
  camera.fd = open(BSP_CAMERA_DEVICE, O_RDWR);
  if (camera.fd < 0)
    return ESP_FAIL;
  v4l2_format format{};
  format.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
  if (ioctl(camera.fd, VIDIOC_G_FMT, &format) ||
      format.fmt.pix.width != WIDTH || format.fmt.pix.height != HEIGHT ||
      format.fmt.pix.pixelformat != V4L2_PIX_FMT_RGB565X) {
    ESP_LOGE(TAG, "Camera must be configured for QVGA RGB565 big-endian");
    return ESP_ERR_NOT_SUPPORTED;
  }
  timeval timeout{0, 250000};
  if (ioctl(camera.fd, VIDIOC_S_DQBUF_TIMEOUT, &timeout))
    return ESP_FAIL;
  v4l2_requestbuffers request{};
  request.count = 2;
  request.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
  request.memory = V4L2_MEMORY_MMAP;
  if (ioctl(camera.fd, VIDIOC_REQBUFS, &request) || request.count != 2)
    return ESP_ERR_NO_MEM;
  uint8_t *frames[2]{};
  for (unsigned i = 0; i < 2; ++i) {
    v4l2_buffer buffer{};
    buffer.type = request.type;
    buffer.memory = request.memory;
    buffer.index = i;
    if (ioctl(camera.fd, VIDIOC_QUERYBUF, &buffer) ||
        buffer.length != FRAME_BYTES)
      return ESP_FAIL;
    frames[i] = static_cast<uint8_t *>(mmap(nullptr, buffer.length,
                                            PROT_READ | PROT_WRITE, MAP_SHARED,
                                            camera.fd, buffer.m.offset));
    if (frames[i] == MAP_FAILED || ioctl(camera.fd, VIDIOC_QBUF, &buffer))
      return ESP_FAIL;
  }
  auto *raw = static_cast<uint8_t *>(heap_caps_aligned_alloc(
      16, FRAME_BYTES, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  if (!raw)
    return ESP_ERR_NO_MEM;
  v4l2_buf_type type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
  bool captured = false;
  if (!ioctl(camera.fd, VIDIOC_STREAMON, &type)) {
    camera.streaming = true;
    // Allow exposure/white balance to settle, but bound all dequeue waits.
    for (unsigned i = 0; i < 10 && esp_timer_get_time() - began < 2000000;
         ++i) {
      v4l2_buffer buffer{};
      buffer.type = request.type;
      buffer.memory = request.memory;
      if (ioctl(camera.fd, VIDIOC_DQBUF, &buffer) || buffer.index >= 2 ||
          buffer.bytesused != FRAME_BYTES ||
          (buffer.flags & V4L2_BUF_FLAG_ERROR))
        break;
      if (i == 9) {
        memcpy(raw, frames[buffer.index], FRAME_BYTES);
        captured = true;
        break;
      }
      if (ioctl(camera.fd, VIDIOC_QBUF, &buffer))
        break;
    }
  }
  camera.close(); // Stop DMA and release camera memory before JPEG encoding.
  const int64_t captured_at = esp_timer_get_time();
  result = ESP_ERR_TIMEOUT;
  if (captured) {
    auto *workspace = static_cast<uint8_t *>(heap_caps_aligned_alloc(
        16, JPEG_WORKSPACE_BYTES + 64, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    if (!workspace) {
      free(raw);
      return ESP_ERR_NO_MEM;
    }
    memset(workspace + JPEG_WORKSPACE_BYTES, 0xa5, 64);
    uint8_t quality = 0;
    const bool encoded_ok = m5_camera::encode_to_budget(
        jpeg, capacity, *length, workspace, JPEG_WORKSPACE_BYTES, quality,
        [&](uint8_t q, uint8_t *encoded_output,
            size_t encoded_capacity) -> int {
          jpeg_enc_config_t settings = DEFAULT_JPEG_ENC_CONFIG();
          settings.width = WIDTH;
          settings.height = HEIGHT;
          settings.src_type = JPEG_PIXEL_FORMAT_RGB565_BE;
          settings.quality = q;
          settings.task_enable = false; // Stay on the low-priority photo task.
          jpeg_enc_handle_t encoder = nullptr;
          if (jpeg_enc_open(&settings, &encoder) != JPEG_ERR_OK)
            return -1;
          int bytes = 0;
          auto encoded =
              jpeg_enc_process(encoder, raw, FRAME_BYTES, encoded_output,
                               int(encoded_capacity), &bytes);
          jpeg_enc_close(encoder);
          bool guard_ok = true;
          for (unsigned i = 0; i < 64; ++i)
            guard_ok &= workspace[JPEG_WORKSPACE_BYTES + i] == 0xa5;
          if (!guard_ok) {
            ESP_LOGE(TAG, "JPEG workspace guard changed");
            return -1;
          }
          vTaskDelay(1);
          return encoded == JPEG_ERR_OK ? bytes : -1;
        });
    result = encoded_ok ? ESP_OK : ESP_FAIL;
    if (encoded_ok) {
      ESP_LOGI(
          TAG,
          "snapshot %ux%u quality=%u bytes=%u capture_ms=%lld encode_ms=%lld",
          WIDTH, HEIGHT, quality, unsigned(*length),
          (captured_at - began) / 1000,
          (esp_timer_get_time() - captured_at) / 1000);
    }
    free(workspace);
  }
  if (result == ESP_OK) {
    // JPEG consumes big-endian sensor pixels; LVGL uses native little-endian
    // RGB565. Convert on the photo worker and transfer the buffer, avoiding a
    // second full-frame allocation or JPEG decode on the GUI/audio tasks.
    m5_camera::rgb565_to_native(raw, FRAME_BYTES);
    view_photo(raw);
  } else {
    free(raw);
  }
  return result;
}
} // namespace board
