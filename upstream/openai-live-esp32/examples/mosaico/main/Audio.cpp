#include "Board.hpp"
#include "bsp/esp_mosaico.h"
#include "esp_codec_dev_defaults.h"
#include "esp_log.h"
#include "esp_timer.h"
#include <algorithm>

namespace board {
namespace {
constexpr int RATE = 24000;
constexpr size_t CHUNK = 480;
i2s_chan_handle_t tx = nullptr, rx = nullptr;
esp_codec_dev_handle_t speaker = nullptr, microphone = nullptr;
bool speaker_open = false, microphone_open = false;
uint32_t starvations = 0;
portMUX_TYPE counter_lock = portMUX_INITIALIZER_UNLOCKED;
bool IRAM_ATTR tx_empty(i2s_chan_handle_t, i2s_event_data_t *, void *) {
  portENTER_CRITICAL_ISR(&counter_lock);
  ++starvations;
  portEXIT_CRITICAL_ISR(&counter_lock);
  return false;
}
} // namespace

void audio_init() {
  ESP_ERROR_CHECK(bsp_i2c_init());
  ESP_ERROR_CHECK(bsp_power_set_vcc_3v3(true));
  ESP_ERROR_CHECK(bsp_power_set_codec_3v3(true));
  i2s_chan_config_t channels =
      I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_0, I2S_ROLE_MASTER);
  channels.dma_desc_num = 6;
  // One 20 ms packet per descriptor; keep the SDK's full 120 ms reserve in
  // hardware instead of consuming half of it while the first write blocks.
  channels.dma_frame_num = CHUNK;
  channels.auto_clear = true;
  ESP_ERROR_CHECK(i2s_new_channel(&channels, &tx, &rx));
  i2s_std_config_t format{};
  format.clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(RATE);
  format.slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(
      I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_STEREO);
  format.gpio_cfg.mclk = BSP_AUDIO_I2S_MCLK;
  format.gpio_cfg.bclk = BSP_AUDIO_I2S_SCLK;
  format.gpio_cfg.ws = BSP_AUDIO_I2S_LRCLK;
  format.gpio_cfg.dout = BSP_AUDIO_I2S_SDOUT;
  format.gpio_cfg.din = BSP_AUDIO_I2S_DSIN;
  ESP_ERROR_CHECK(i2s_channel_init_std_mode(tx, &format));
  ESP_ERROR_CHECK(i2s_channel_init_std_mode(rx, &format));
  i2s_event_callbacks_t callbacks{};
  callbacks.on_send_q_ovf = tx_empty;
  ESP_ERROR_CHECK(i2s_channel_register_event_callback(tx, &callbacks, nullptr));
  audio_codec_i2s_cfg_t bus{};
  bus.port = I2S_NUM_0;
  bus.tx_handle = tx;
  bus.rx_handle = rx;
  const auto *data = audio_codec_new_i2s_data(&bus);
  ESP_ERROR_CHECK((data) ? ESP_OK : ESP_ERR_NO_MEM);
  audio_codec_i2c_cfg_t ctrl{};
  ctrl.port = BSP_I2C_PORT;
  ctrl.bus_handle = bsp_i2c_get_handle();
  ctrl.addr = BSP_AUDIO_CODEC_I2C_ADDR;
  const auto *control = audio_codec_new_i2c_ctrl(&ctrl);
  ESP_ERROR_CHECK(control ? ESP_OK : ESP_ERR_NO_MEM);
  es8311_codec_cfg_t es{};
  es.ctrl_if = control;
  es.gpio_if = audio_codec_new_gpio();
  ESP_ERROR_CHECK(es.gpio_if ? ESP_OK : ESP_ERR_NO_MEM);
  es.codec_mode = ESP_CODEC_DEV_WORK_MODE_BOTH;
  es.pa_pin = BSP_AUDIO_PA_CTRL;
  es.use_mclk = true;
  es.no_dac_ref = true;
  es.hw_gain.pa_voltage = 5.0f;
  es.hw_gain.codec_dac_voltage = 3.3f;
  const auto *codec = es8311_codec_new(&es);
  ESP_ERROR_CHECK(codec ? ESP_OK : ESP_ERR_NO_MEM);
  esp_codec_dev_cfg_t device{};
  device.data_if = data;
  device.codec_if = codec;
  device.dev_type = ESP_CODEC_DEV_TYPE_IN_OUT;
  speaker = microphone = esp_codec_dev_new(&device);
  ESP_ERROR_CHECK(speaker ? ESP_OK : ESP_ERR_NO_MEM);
  // These board resources live for the firmware lifetime. A reconnect opens
  // and closes the codecs, never allocates another I2S channel or codec.
  ESP_LOGI("MosaicoAudio", "ES8311: 24 kHz duplex, 120 ms DMA reserve");
}

esp_err_t audio_open(void *) {
  esp_codec_dev_sample_info_t format{};
  format.sample_rate = RATE;
  format.bits_per_sample = 16;
  format.channel = 2;
  speaker_open = esp_codec_dev_open(speaker, &format) == 0;
  if (!speaker_open)
    return ESP_FAIL;
  microphone_open = speaker_open;
  if (esp_codec_dev_set_out_vol(speaker, 65) != 0 ||
      esp_codec_dev_set_in_gain(microphone, 24) != 0) {
    audio_close(nullptr);
    return ESP_FAIL;
  }
  return ESP_OK;
}

void audio_close(void *) {
  if (speaker_open)
    esp_codec_dev_close(speaker);
  microphone_open = speaker_open = false;
}

esp_err_t audio_read(void *, int16_t *pcm, size_t samples) {
  if (!microphone_open || samples > CHUNK)
    return ESP_ERR_INVALID_STATE;
  int16_t stereo[CHUNK * 2];
  size_t read = 0;
  const size_t bytes = samples * 2 * sizeof(int16_t);
  const auto result = i2s_channel_read(rx, stereo, bytes, &read, 250);
  if (result != ESP_OK || read != bytes)
    return result == ESP_OK ? ESP_FAIL : result;
  for (size_t i = 0; i < samples; ++i)
    pcm[i] = stereo[2 * i];
  return ESP_OK;
}

esp_err_t audio_write(void *, const int16_t *pcm, size_t samples) {
  if (!speaker_open)
    return ESP_ERR_INVALID_STATE;
  int16_t stereo[CHUNK * 2];
  const int64_t deadline = esp_timer_get_time() + 500000;
  while (samples) {
    const auto count = std::min(samples, CHUNK);
    for (size_t i = 0; i < count; ++i)
      stereo[2 * i] = stereo[2 * i + 1] = pcm[i];
    const int64_t left_ms = (deadline - esp_timer_get_time()) / 1000;
    if (left_ms <= 0)
      return ESP_ERR_TIMEOUT;
    size_t written = 0;
    const size_t bytes = count * 2 * sizeof(int16_t);
    const auto result = i2s_channel_write(tx, stereo, bytes, &written, left_ms);
    if (result != ESP_OK || written != bytes)
      return result == ESP_OK ? ESP_FAIL : result;
    pcm += count;
    samples -= count;
  }
  return ESP_OK;
}

uint32_t audio_starvations(void *) {
  portENTER_CRITICAL(&counter_lock);
  const uint32_t value = starvations;
  portEXIT_CRITICAL(&counter_lock);
  return value;
}
} // namespace board
