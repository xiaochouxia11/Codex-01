#pragma once
#include "esp_transport.h"

namespace live_https {
constexpr char HOST[] = "api.openai.com";
struct TlsTransport {
  esp_transport_handle_t handle = nullptr;
  bool begin();
  int poll();
  bool healthy();
  void close();
  esp_transport_handle_t release();
};
// Owns the transferred TLS transport. Destroy after HTTP client cleanup.
esp_transport_handle_t wrap(esp_transport_handle_t tls);
} // namespace live_https
