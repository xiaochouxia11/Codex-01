#include "https_transport.hpp"
#include "esp_crt_bundle.h"
#include "esp_log.h"
#include "esp_transport_ssl.h"
#include <cstring>
#include <fcntl.h>
#include <sys/socket.h>

namespace live_https {
bool TlsTransport::begin() {
  handle = esp_transport_ssl_init();
  if (!handle)
    return false;
  // Custom HTTP transports configure their own certificate and hostname
  // verification; the HTTP client's TLS configuration does not apply to them.
  esp_transport_ssl_crt_bundle_attach(handle, esp_crt_bundle_attach);
  ESP_LOGI("LiveVoice", "preconnect preparing");
  return true;
}
int TlsTransport::poll() {
  // TLS advances without blocking. IDF's initial DNS/TCP step may block and
  // uses the full connection deadline (short TCP select timeouts can lose the
  // pending fd set in IDF 5.5.2). All of this runs off the GUI/event tasks.
  return esp_transport_connect_async(handle, HOST, 443, 30000);
}
bool TlsTransport::healthy() {
  // No HTTP has been sent, so incoming data or EOF makes this idle connection
  // unsuitable for reuse. Conservatively replace it, including TLS control data.
  return esp_transport_poll_read(handle, 0) == 0;
}
void TlsTransport::close() {
  if (handle) {
    esp_transport_destroy(handle);
    handle = nullptr;
  }
}
esp_transport_handle_t TlsTransport::release() {
  auto result = handle;
  handle = nullptr;
  return result;
}

namespace {
esp_transport_handle_t inner(esp_transport_handle_t wrapper) {
  return static_cast<esp_transport_handle_t>(esp_transport_get_context_data(wrapper));
}
int connect(esp_transport_handle_t wrapper, const char *host, int port, int timeout) {
  if (strcmp(host, HOST) || port != 443)
    return -1;
  // The handshake is finished. Restore blocking I/O and request timeouts for
  // esp_http_client's synchronous streaming API without reconnecting TLS.
  const int fd = esp_transport_get_socket(inner(wrapper));
  const int flags = fcntl(fd, F_GETFL, 0);
  timeval tv{timeout / 1000, (timeout % 1000) * 1000};
  if (flags < 0 || fcntl(fd, F_SETFL, flags & ~O_NONBLOCK) < 0 ||
      setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv)) < 0 ||
      setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv)) < 0)
    return -1;
  return 0;
}
int read(esp_transport_handle_t t, char *data, int size, int timeout) {
  return esp_transport_read(inner(t), data, size, timeout);
}
int write(esp_transport_handle_t t, const char *data, int size, int timeout) {
  return esp_transport_write(inner(t), data, size, timeout);
}
int close(esp_transport_handle_t t) { return esp_transport_close(inner(t)); }
int poll_read(esp_transport_handle_t t, int timeout) {
  return esp_transport_poll_read(inner(t), timeout);
}
int poll_write(esp_transport_handle_t t, int timeout) {
  return esp_transport_poll_write(inner(t), timeout);
}
int destroy(esp_transport_handle_t t) {
  esp_transport_destroy(inner(t));
  return 0;
}
} // namespace

esp_transport_handle_t wrap(esp_transport_handle_t tls) {
  if (!tls)
    return nullptr;
  auto wrapper = esp_transport_init();
  if (!wrapper) {
    esp_transport_destroy(tls);
    return nullptr;
  }
  esp_transport_set_context_data(wrapper, tls);
  esp_transport_set_func(wrapper, connect, read, write, close, poll_read,
                         poll_write, destroy);
  esp_transport_set_parent_transport_func(wrapper, inner);
  return wrapper;
}
} // namespace live_https
