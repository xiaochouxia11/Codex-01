#include "AudioFormat.hpp"
#include "Board.hpp"
#include "BootButton.hpp"
#include "driver/gpio.h"
#include "driver/i2s_std.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include <algorithm>
#include <atomic>

namespace board {
namespace {
constexpr int RATE = 24000;
constexpr size_t CHUNK = 480, DESCRIPTORS = 6;
constexpr gpio_num_t MUTE = GPIO_NUM_14, AMPS = GPIO_NUM_48;
constexpr gpio_num_t BOOT_MCLK = GPIO_NUM_0;
i2s_chan_handle_t tx = nullptr, rx = nullptr;
i2s_std_gpio_config_t tx_pins{};
bool tx_enabled = false, rx_enabled = false, clock_owned = false;
StaticSemaphore_t pin_mutex_storage;
SemaphoreHandle_t pin_mutex = nullptr;
struct PinLock {
  PinLock() { xSemaphoreTake(pin_mutex, portMAX_DELAY); }
  ~PinLock() { xSemaphoreGive(pin_mutex); }
};
std::atomic<unsigned> volume{20};
uint32_t starvations = 0;
portMUX_TYPE counter_lock = portMUX_INITIALIZER_UNLOCKED;
bool IRAM_ATTR tx_empty(i2s_chan_handle_t, i2s_event_data_t *, void *) {
  portENTER_CRITICAL_ISR(&counter_lock);
  ++starvations;
  portEXIT_CRITICAL_ISR(&counter_lock);
  return false;
}
void button_input() {
  // Disabling I2S DMA does not stop MCLK. Explicitly disconnect the output
  // before exposing this pin as a button, including after failed opens.
  ESP_ERROR_CHECK(gpio_reset_pin(BOOT_MCLK));
  gpio_config_t input{};
  input.pin_bit_mask = 1ULL << BOOT_MCLK;
  input.mode = GPIO_MODE_INPUT;
  input.pull_up_en = GPIO_PULLUP_ENABLE;
  ESP_ERROR_CHECK(gpio_config(&input));
}
void close_locked() {
  gpio_set_level(MUTE, 0);
  // WM8524 soft-mutes over 800 samples. Keep clocks running for that ramp.
  if (tx_enabled)
    vTaskDelay(pdMS_TO_TICKS(35));
  gpio_set_level(AMPS, 0);
  if (rx_enabled)
    ESP_ERROR_CHECK(i2s_channel_disable(rx));
  if (tx_enabled)
    ESP_ERROR_CHECK(i2s_channel_disable(tx));
  rx_enabled = tx_enabled = false;
  button_input();
  // Release the driver's pin reservation as well as the physical output.
  ESP_ERROR_CHECK(i2s_channel_reconfig_std_gpio(tx, &tx_pins));
  clock_owned = false;
}
} // namespace

void audio_init() {
  pin_mutex = xSemaphoreCreateMutexStatic(&pin_mutex_storage);
  configASSERT(pin_mutex);
  button_input();
  // Sonatino revision 3.1.x. Do not apply these gain/enable pins to revision 2.
  gpio_config_t pins{};
  pins.pin_bit_mask = (1ULL << MUTE) | (1ULL << AMPS) | (1ULL << 18) |
                      (1ULL << 21) | (1ULL << 46) | (1ULL << 47);
  pins.mode = GPIO_MODE_OUTPUT;
  ESP_ERROR_CHECK(gpio_config(&pins));
  ESP_ERROR_CHECK(gpio_set_level(MUTE, 0));
  ESP_ERROR_CHECK(gpio_set_level(AMPS, 0));
  ESP_ERROR_CHECK(gpio_set_level(GPIO_NUM_18, 0)); // WM8782 <=48 kHz range
  ESP_ERROR_CHECK(gpio_set_level(GPIO_NUM_21, 0)); // WM8782 16-bit words
  ESP_ERROR_CHECK(gpio_set_level(GPIO_NUM_46, 0)); // TPA6132A2 gain1/gain0=00
  ESP_ERROR_CHECK(gpio_set_level(GPIO_NUM_47, 0)); // -6 dB headphone gain

  i2s_chan_config_t channel =
      I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_0, I2S_ROLE_MASTER);
  channel.dma_desc_num = DESCRIPTORS;
  channel.dma_frame_num = CHUNK;
  channel.auto_clear = true;
  ESP_ERROR_CHECK(i2s_new_channel(&channel, &tx, nullptr));
  channel.id = I2S_NUM_1;
  ESP_ERROR_CHECK(i2s_new_channel(&channel, nullptr, &rx));

  i2s_std_config_t format{};
  format.clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(RATE);
  format.slot_cfg = I2S_STD_PHILIP_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_16BIT,
                                                       I2S_SLOT_MODE_STEREO);
  // The DAC accepts 24-bit I2S. Transmit 16-bit PCM in 32-bit slots; hardware
  // pads the remaining bits with zeros. RX also uses 32-bit slots for 64fs
  // BCLK.
  format.slot_cfg.slot_bit_width = I2S_SLOT_BIT_WIDTH_32BIT;
  format.slot_cfg.ws_width = 32;
  // IDF starts MCLK at init, before channel_enable. Leave it disconnected
  // until audio_open has checked that BOOT is released.
  format.gpio_cfg.mclk = I2S_GPIO_UNUSED;
  format.gpio_cfg.bclk = GPIO_NUM_15;
  format.gpio_cfg.ws = GPIO_NUM_16;
  format.gpio_cfg.dout = GPIO_NUM_17;
  format.gpio_cfg.din = I2S_GPIO_UNUSED;
  tx_pins = format.gpio_cfg;
  ESP_ERROR_CHECK(i2s_channel_init_std_mode(tx, &format));
  // The board shares one MCLK wire between ADC and DAC. Only TX drives it;
  // both I2S controllers use the same PLL source, rate, and MCLK divider.
  format.gpio_cfg.mclk = I2S_GPIO_UNUSED;
  format.gpio_cfg.bclk = GPIO_NUM_38;
  format.gpio_cfg.ws = GPIO_NUM_39;
  format.gpio_cfg.dout = I2S_GPIO_UNUSED;
  format.gpio_cfg.din = GPIO_NUM_40;
  ESP_ERROR_CHECK(i2s_channel_init_std_mode(rx, &format));
  i2s_event_callbacks_t callbacks{};
  callbacks.on_send_q_ovf = tx_empty;
  ESP_ERROR_CHECK(i2s_channel_register_event_callback(tx, &callbacks, nullptr));
  ESP_LOGI("SonatinoAudio",
           "24 kHz duplex ready; headphones 20%%, hardware -6 dB");
}

esp_err_t audio_open(void *) {
  PinLock lock;
  if (clock_owned || tx_enabled || rx_enabled)
    return ESP_ERR_INVALID_STATE;
  // Also guard USB starts/tests: never begin driving a button held to ground.
  // The mutex keeps the main-loop button sampler out of this pin handoff.
  const int64_t released_at = esp_timer_get_time();
  do {
    if (!gpio_get_level(BOOT_MCLK)) {
      ESP_LOGW("SonatinoAudio", "Release BOOT before starting audio");
      return ESP_ERR_INVALID_STATE;
    }
    vTaskDelay(pdMS_TO_TICKS(5));
  } while (esp_timer_get_time() - released_at < BootButton::DEBOUNCE_MS * 1000);
  if (!gpio_get_level(BOOT_MCLK))
    return ESP_ERR_INVALID_STATE;
  auto clock_pins = tx_pins;
  clock_pins.mclk = BOOT_MCLK;
  auto result = i2s_channel_reconfig_std_gpio(tx, &clock_pins);
  if (result != ESP_OK) {
    close_locked();
    return result;
  }
  clock_owned = true;
  // Clear every descriptor before each session, including aborted playback.
  // Never replay buffered speech when the next session enables the DAC.
  const int16_t silence[CHUNK * 2]{};
  for (size_t i = 0; i < DESCRIPTORS; ++i) {
    size_t loaded = 0;
    result = i2s_channel_preload_data(tx, silence, sizeof(silence), &loaded);
    if (result != ESP_OK || loaded != sizeof(silence)) {
      close_locked();
      return result == ESP_OK ? ESP_FAIL : result;
    }
  }
  result = i2s_channel_enable(tx);
  if (result != ESP_OK) {
    close_locked();
    return result;
  }
  tx_enabled = true;
  result = i2s_channel_enable(rx);
  if (result != ESP_OK) {
    close_locked();
    return result;
  }
  rx_enabled = true;
  gpio_set_level(AMPS, 1);
  // Let clocks, ADC reference and headphone charge pump settle while muted.
  vTaskDelay(pdMS_TO_TICKS(100));
  gpio_set_level(MUTE, 1);
  return ESP_OK;
}

void audio_close(void *) {
  PinLock lock;
  close_locked();
}

bool boot_button_read(bool &pressed) {
  if (xSemaphoreTake(pin_mutex, 0) != pdTRUE)
    return false;
  const bool available = !clock_owned;
  if (available)
    pressed = gpio_get_level(BOOT_MCLK) == 0;
  xSemaphoreGive(pin_mutex);
  return available;
}

void audio_log_pin() {
  PinLock lock;
  gpio_io_config_t config{};
  ESP_ERROR_CHECK(gpio_get_io_config(BOOT_MCLK, &config));
  ESP_LOGI("SonatinoAudio", "GPIO0 role=%s input=%d output=%d peripheral_oe=%d",
           clock_owned ? "MCLK" : "BOOT", config.ie, config.oe,
           config.oe_ctrl_by_periph);
}

esp_err_t audio_read(void *, int16_t *pcm, size_t samples) {
  if (!rx_enabled)
    return ESP_ERR_INVALID_STATE;
  if (!pcm || !samples || samples > CHUNK)
    return ESP_ERR_INVALID_ARG;
  int16_t stereo[CHUNK * 2];
  size_t read = 0;
  const size_t bytes = samples * 2 * sizeof(int16_t);
  const auto result = i2s_channel_read(rx, stereo, bytes, &read, 250);
  if (result != ESP_OK || read != bytes)
    return result == ESP_OK ? ESP_FAIL : result;
  microphone_mono(stereo, pcm, samples);
  return ESP_OK;
}

esp_err_t audio_write(void *, const int16_t *pcm, size_t samples) {
  if (!tx_enabled)
    return ESP_ERR_INVALID_STATE;
  if (!pcm || !samples)
    return ESP_ERR_INVALID_ARG;
  int16_t stereo[CHUNK * 2];
  const int64_t deadline = esp_timer_get_time() + 500000;
  while (samples) {
    const auto count = std::min(samples, CHUNK);
    headphone_stereo(pcm, stereo, count, volume.load());
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
void audio_volume(unsigned percent) { volume = std::min(percent, 100u); }
} // namespace board
