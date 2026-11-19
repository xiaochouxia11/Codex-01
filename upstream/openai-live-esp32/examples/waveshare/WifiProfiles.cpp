#include "WifiProfiles.hpp"
#include "WifiSelection.hpp"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "freertos/idf_additions.h"
#include "live_esp32.h"
#include "live_voice_secrets.h"
#include "system_status.hpp"
#include <atomic>
#include <cstdio>
#include <cstdlib>
#include <cstring>

namespace live_wifi {
namespace {
constexpr char TAG[] = "LiveWifi";
constexpr int64_t CONNECT_MS = 30000, RETRY_MS = 30000;
std::atomic<bool> has_ip{false}, next_requested{false};
std::atomic<uint32_t> associated_at{0}, disconnects{0}, last_reason{0};
TaskHandle_t worker = nullptr;

int current_profile() {
  wifi_config_t config{};
  if (esp_wifi_get_config(WIFI_IF_STA, &config) != ESP_OK)
    return -1;
  for (unsigned i = 0; i < LIVE_WIFI_PROFILE_COUNT; ++i)
    if (!strncmp(reinterpret_cast<const char *>(config.sta.ssid),
                 LIVE_WIFI_PROFILES[i].ssid, sizeof(config.sta.ssid)))
      return static_cast<int>(i);
  return -1;
}
void event(void *, esp_event_base_t base, int32_t id, void *data) {
  const uint32_t now = esp_timer_get_time() / 1000;
  if (base == WIFI_EVENT && id == WIFI_EVENT_STA_CONNECTED) {
    associated_at = now ? now : 1;
    wifi_ap_record_t ap{};
    esp_wifi_sta_get_ap_info(&ap);
    ESP_LOGI(TAG, "Associated channel=%u rssi=%d; waiting for DHCP",
             ap.primary, ap.rssi);
  } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
    has_ip = true;
    live_esp32_network_changed(true);
    auto *ip = static_cast<ip_event_got_ip_t *>(data);
    const uint32_t since = associated_at.load();
    ESP_LOGI(TAG, "Ready ip=" IPSTR " dhcp_ms=%lu", IP2STR(&ip->ip_info.ip),
             static_cast<unsigned long>(since ? now - since : 0));
  } else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
    has_ip = false;
    live_esp32_network_changed(false);
    associated_at = 0;
    auto *e = static_cast<wifi_event_sta_disconnected_t *>(data);
    ++disconnects;
    last_reason = e->reason;
    ESP_LOGW(TAG, "Disconnected reason=%u rssi=%d", e->reason, e->rssi);
  } else if ((base == WIFI_EVENT && id == WIFI_EVENT_STA_STOP) ||
             (base == IP_EVENT && id == IP_EVENT_STA_LOST_IP)) {
    has_ip = false;
    live_esp32_network_changed(false);
    if (base == WIFI_EVENT)
      associated_at = 0;
    else
      associated_at = now ? now : 1;
  }
}
void run(void *) {
  auto *aps =
      static_cast<wifi_ap_record_t *>(calloc(64, sizeof(wifi_ap_record_t)));
  if (!aps) {
    ESP_LOGE(TAG, "Could not allocate Wi-Fi scan records");
    vTaskDelete(nullptr);
    return;
  }
  int64_t retry_after[MAX_PROFILES]{};
  // Give the resident manager's saved configuration a DHCP window on boot.
  int64_t next_scan = esp_timer_get_time() / 1000 + CONNECT_MS;
  int attempt = current_profile();
  for (;;) {
    vTaskDelay(pdMS_TO_TICKS(1000));
    const int64_t now = esp_timer_get_time() / 1000;
    brookesia::system_status::Snapshot wifi{};
    brookesia::system_status::get_snapshot(wifi);
    if (!wifi.wifi_enabled)
      continue;
    live_esp32_status_t live{};
    live_esp32_status(&live);
    bool cycle = next_requested.exchange(false);
    if (live.busy) {
      if (cycle)
        ESP_LOGW(TAG, "Stop the Live session before changing Wi-Fi");
      if (ready())
        next_scan = now + CONNECT_MS;
      else if (now >= next_scan)
        live_esp32_stop();
      continue;
    }
    if (ready() && !cycle) {
      attempt = current_profile();
      if (attempt >= 0)
        retry_after[attempt] = 0;
      next_scan = now + CONNECT_MS;
      continue; // Never roam away from a working connection.
    }
    if (!cycle && (now < next_scan ||
                  waiting_for_dhcp(uint32_t(now), associated_at.load())))
      continue;
    if (attempt >= 0) {
      retry_after[attempt] = now + RETRY_MS;
      ESP_LOGI(TAG, "Trying alternatives to %s",
               LIVE_WIFI_PROFILES[attempt].ssid);
      attempt = -1;
    }
    uint16_t count = 64;
    esp_err_t result = brookesia::system_status::scan_wifi(aps, &count);
    next_scan = now + 10000;
    if (result != ESP_OK) {
      ESP_LOGW(TAG, "Scan failed: %s", esp_err_to_name(result));
      continue;
    }
    // Association or DHCP may complete during a blocking scan. Do not apply a
    // new profile based on the stale disconnected state from before the scan.
    if (!cycle &&
        (ready() || waiting_for_dhcp(esp_timer_get_time() / 1000,
                                   associated_at.load())))
      continue;
    int rssi[MAX_PROFILES];
    for (auto &value : rssi)
      value = -127;
    for (unsigned p = 0; p < LIVE_WIFI_PROFILE_COUNT; ++p)
      for (unsigned a = 0; a < count; ++a)
        if (!strncmp(reinterpret_cast<const char *>(aps[a].ssid),
                     LIVE_WIFI_PROFILES[p].ssid, sizeof(aps[a].ssid)) &&
            aps[a].rssi > rssi[p])
          rssi[p] = aps[a].rssi;
    const int selected =
        select(rssi, retry_after, LIVE_WIFI_PROFILE_COUNT, now);
    if (selected < 0) {
      ESP_LOGI(TAG, "No eligible saved network in %u scan results", count);
      continue;
    }
    const auto &profile = LIVE_WIFI_PROFILES[selected];
    wifi_config_t config{};
    // ESP-IDF accepts a full 32-byte SSID without a trailing NUL.
    memcpy(config.sta.ssid, profile.ssid, strlen(profile.ssid));
    memcpy(config.sta.password, profile.password, strlen(profile.password));
    config.sta.pmf_cfg.capable = true;
    // FAST_SCAN stops at the first matching AP, even if another channel has
    // a stronger one with the same SSID. Do not pin a BSSID across locations.
    config.sta.scan_method = WIFI_ALL_CHANNEL_SCAN;
    config.sta.sort_method = WIFI_CONNECT_AP_BY_SIGNAL;
    result = brookesia::system_status::connect_wifi(config);
    ESP_LOGI(TAG, "Selecting %s rssi=%d: %s", profile.ssid, rssi[selected],
             esp_err_to_name(result));
    attempt = selected;
    next_scan = esp_timer_get_time() / 1000 + CONNECT_MS;
  }
}
} // namespace
bool ready() { return has_ip.load(); }
void next() { next_requested = true; }
void print_status() {
  wifi_ap_record_t ap{};
  const bool associated = esp_wifi_sta_get_ap_info(&ap) == ESP_OK;
  wifi_ps_type_t ps = WIFI_PS_NONE;
  esp_wifi_get_ps(&ps);
  wifi_config_t config{};
  esp_wifi_get_config(WIFI_IF_STA, &config);
  ESP_LOGI(TAG, "saved=%u ssid=%.32s ip_ready=%d", LIVE_WIFI_PROFILE_COUNT,
           reinterpret_cast<const char *>(ap.ssid), ready());
  ESP_LOGI(TAG,
           "associated=%d channel=%u rssi=%d power_save=%d scan_method=%d "
           "disconnects=%lu last_reason=%lu",
           associated, ap.primary, associated ? ap.rssi : -127, int(ps),
           int(config.sta.scan_method),
           static_cast<unsigned long>(disconnects.load()),
           static_cast<unsigned long>(last_reason.load()));
}
void start() {
  static bool registered = false;
  if (registered)
    return;
  static_assert(LIVE_WIFI_PROFILE_COUNT <= MAX_PROFILES);
  static esp_event_handler_instance_t wifi_events, ip_events;
  ESP_ERROR_CHECK(esp_event_handler_instance_register(
      WIFI_EVENT, ESP_EVENT_ANY_ID, event, nullptr, &wifi_events));
  ESP_ERROR_CHECK(esp_event_handler_instance_register(
      IP_EVENT, ESP_EVENT_ANY_ID, event, nullptr, &ip_events));
  registered = true;
  esp_netif_ip_info_t ip{};
  wifi_ap_record_t ap{};
  auto *netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
  has_ip = netif && esp_netif_is_netif_up(netif) &&
           esp_netif_get_ip_info(netif, &ip) == ESP_OK && ip.ip.addr &&
           esp_wifi_sta_get_ap_info(&ap) == ESP_OK;
  live_esp32_network_changed(has_ip.load());
  if (esp_wifi_sta_get_ap_info(&ap) == ESP_OK)
    associated_at = uint32_t(esp_timer_get_time() / 1000) | 1u;
  ESP_ERROR_CHECK(brookesia::system_status::set_wifi_enabled(true));
  ESP_LOGI(TAG, "Remembering %u networks", LIVE_WIFI_PROFILE_COUNT);
  if (!LIVE_WIFI_PROFILE_COUNT)
    return;
  if (xTaskCreatePinnedToCoreWithCaps(
          run, "live_wifi", 8192, nullptr, 2, &worker, 1,
          MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT) != pdPASS)
    ESP_LOGE(TAG, "Could not start saved-network selection");
}
} // namespace live_wifi
