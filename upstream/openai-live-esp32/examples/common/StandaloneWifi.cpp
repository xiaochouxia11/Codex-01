#include "StandaloneWifi.hpp"
#include "WifiSelection.hpp"
#include "esp_event.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_netif_sntp.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "freertos/idf_additions.h"
#include "live_esp32.h"
#include "live_voice_secrets.h"
#include <algorithm>
#include <atomic>
#include <cstring>

namespace board {
namespace {
constexpr const char *TAG = "LiveWifi";
std::atomic<bool> ready{false}, next{false};
std::atomic<uint32_t> associated_at{0};
void event(void *, esp_event_base_t base, int32_t id, void *data) {
  if (base == WIFI_EVENT && id == WIFI_EVENT_STA_CONNECTED) {
    associated_at = uint32_t(esp_timer_get_time() / 1000) | 1;
  } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
    ready = true;
    live_esp32_network_changed(true);
    ESP_LOGI(TAG, "IP acquired; ready");
  } else if ((base == WIFI_EVENT && (id == WIFI_EVENT_STA_DISCONNECTED ||
                                     id == WIFI_EVENT_STA_STOP)) ||
             (base == IP_EVENT && id == IP_EVENT_STA_LOST_IP)) {
    ready = false;
    associated_at = 0;
    live_esp32_network_changed(false);
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED)
      ESP_LOGW(TAG, "Disconnected reason=%u",
               static_cast<wifi_event_sta_disconnected_t *>(data)->reason);
  }
}
void run(void *) {
  auto *aps =
      static_cast<wifi_ap_record_t *>(calloc(64, sizeof(wifi_ap_record_t)));
  ESP_ERROR_CHECK(aps ? ESP_OK : ESP_ERR_NO_MEM);
  int attempt = -1;
  int64_t retry[live_wifi::MAX_PROFILES]{};
  int64_t next_scan = 0;
  for (;;) {
    vTaskDelay(pdMS_TO_TICKS(250));
    const int64_t now = esp_timer_get_time() / 1000;
    live_esp32_status_t status{};
    live_esp32_status(&status);
    if (status.busy) {
      if (status.network_required && !ready)
        live_esp32_stop();
      continue;
    }
    bool cycle = next.exchange(false);
    if (ready && !cycle) {
      if (attempt >= 0)
        retry[attempt] = 0;
      continue;
    }
    if (!cycle && (now < next_scan ||
                   live_wifi::waiting_for_dhcp(uint32_t(now), associated_at)))
      continue;
    if (attempt >= 0)
      retry[attempt] = now + 30000;
    attempt = -1;
    // This worker is the only writer of Wi-Fi configuration. No scan runs
    // during an active call or while a successful association awaits DHCP.
    esp_wifi_disconnect();
    vTaskDelay(pdMS_TO_TICKS(100));
    uint16_t count = 64;
    wifi_scan_config_t scan{};
    scan.show_hidden = true;
    auto result = esp_wifi_scan_start(&scan, true);
    if (result == ESP_OK)
      result = esp_wifi_scan_get_ap_records(&count, aps);
    next_scan = esp_timer_get_time() / 1000 + 5000;
    if (result != ESP_OK) {
      esp_wifi_clear_ap_list();
      ESP_LOGW(TAG, "Scan failed: %s", esp_err_to_name(result));
      continue;
    }
    int rssi[live_wifi::MAX_PROFILES];
    for (auto &value : rssi)
      value = -127;
    for (unsigned p = 0; p < LIVE_WIFI_PROFILE_COUNT; ++p)
      for (unsigned a = 0; a < count; ++a)
        if (!strncmp(reinterpret_cast<const char *>(aps[a].ssid),
                     LIVE_WIFI_PROFILES[p].ssid, sizeof(aps[a].ssid)))
          rssi[p] = std::max(rssi[p], int(aps[a].rssi));
    const int selected = live_wifi::select(rssi, retry, LIVE_WIFI_PROFILE_COUNT,
                                           esp_timer_get_time() / 1000);
    if (selected < 0) {
      ESP_LOGI(TAG, "No available saved network (%u APs)", count);
      continue;
    }
    const auto &profile = LIVE_WIFI_PROFILES[selected];
    wifi_config_t config{};
    memcpy(config.sta.ssid, profile.ssid, strlen(profile.ssid));
    memcpy(config.sta.password, profile.password, strlen(profile.password));
    config.sta.pmf_cfg.capable = true;
    config.sta.threshold.authmode =
        *profile.password ? WIFI_AUTH_WPA2_PSK : WIFI_AUTH_OPEN;
    config.sta.scan_method = WIFI_ALL_CHANNEL_SCAN;
    config.sta.sort_method = WIFI_CONNECT_AP_BY_SIGNAL;
    result = esp_wifi_set_config(WIFI_IF_STA, &config);
    if (result == ESP_OK)
      result = esp_wifi_connect();
    ESP_LOGI(TAG, "Profile %d rssi=%d: %s", selected + 1, rssi[selected],
             esp_err_to_name(result));
    attempt = selected;
    next_scan = esp_timer_get_time() / 1000 + 30000;
  }
}
} // namespace
void wifi_init() {
  static_assert(LIVE_WIFI_PROFILE_COUNT > 0 &&
                LIVE_WIFI_PROFILE_COUNT <= live_wifi::MAX_PROFILES);
  ESP_ERROR_CHECK(esp_netif_init());
  ESP_ERROR_CHECK(esp_event_loop_create_default());
  ESP_ERROR_CHECK(esp_netif_create_default_wifi_sta() ? ESP_OK
                                                      : ESP_ERR_NO_MEM);
  wifi_init_config_t config = WIFI_INIT_CONFIG_DEFAULT();
  ESP_ERROR_CHECK(esp_wifi_init(&config));
  ESP_ERROR_CHECK(esp_wifi_set_storage(WIFI_STORAGE_RAM));
  ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
  ESP_ERROR_CHECK(
      esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, event, nullptr));
  ESP_ERROR_CHECK(
      esp_event_handler_register(IP_EVENT, ESP_EVENT_ANY_ID, event, nullptr));
  ESP_ERROR_CHECK(esp_wifi_start());
  ESP_ERROR_CHECK(esp_wifi_set_ps(WIFI_PS_NONE));
  esp_sntp_config_t sntp = ESP_NETIF_SNTP_DEFAULT_CONFIG("pool.ntp.org");
  ESP_ERROR_CHECK(esp_netif_sntp_init(&sntp));
  TaskHandle_t worker;
  ESP_ERROR_CHECK(xTaskCreatePinnedToCoreWithCaps(
                      run, "live_wifi", 8192, nullptr, 2, &worker, 1,
                      MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT) == pdPASS
                      ? ESP_OK
                      : ESP_ERR_NO_MEM);
}
bool wifi_ready() { return ready; }
void wifi_next() { next = true; }
void wifi_status() {
  wifi_ap_record_t ap{};
  const bool associated = esp_wifi_sta_get_ap_info(&ap) == ESP_OK;
  ESP_LOGI(TAG, "ready=%d associated=%d rssi=%d channel=%u profiles=%u",
           bool(ready), associated, associated ? ap.rssi : -127, ap.primary,
           LIVE_WIFI_PROFILE_COUNT);
}
} // namespace board
