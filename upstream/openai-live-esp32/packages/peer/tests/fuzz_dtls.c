/* Fuzz both DTLS roles before certificate authentication. Cookie checks are
   deliberately disabled here to expose deeper parser states; production enables
   them. This harness does not open sockets or accept external traffic. */
#include "dtls_srtp.h"
#include "wire.h"
#include <stdlib.h>
#include <string.h>
static DtlsSrtp d;
static const uint8_t *input;
static size_t remaining;
static int sends;
static int discard(void *ctx, const unsigned char *buf, size_t n) {
  (void)ctx;
  (void)buf;
  return ++sends > 32 ? -1 : (int)n;
}
static int receive(void *ctx, unsigned char *buf, size_t capacity) {
  (void)ctx;
  if (remaining < 2)
    return MBEDTLS_ERR_SSL_WANT_READ;
  size_t n = wire_u16(input);
  input += 2;
  remaining -= 2;
  if (!n || n > remaining || n > capacity || n > 1536) {
    remaining = 0;
    return MBEDTLS_ERR_SSL_WANT_READ;
  }
  memcpy(buf, input, n);
  input += n;
  remaining -= n;
  return (int)n;
}
int LLVMFuzzerInitialize(int *argc, char ***argv) {
  (void)argc;
  (void)argv;
  if (dtls_srtp_init(&d, DTLS_SRTP_ROLE_SERVER, NULL))
    abort();
  return 0;
}
int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size) {
  if (size < 3 || size > 16384)
    return 0;
  if (d.srtp_in) {
    srtp_dealloc(d.srtp_in);
    d.srtp_in = NULL;
  }
  if (d.srtp_out) {
    srtp_dealloc(d.srtp_out);
    d.srtp_out = NULL;
  }
  d.state = DTLS_SRTP_STATE_INIT;
  d.have_exported = 0;
  if (dtls_srtp_set_role(&d, data[0] & 1 ? DTLS_SRTP_ROLE_CLIENT
                                         : DTLS_SRTP_ROLE_SERVER))
    abort();
  mbedtls_ssl_conf_dtls_cookies(&d.conf, NULL, NULL, NULL);
  d.udp_recv = receive;
  d.udp_send = discard;
  input = data + 1;
  remaining = size - 1;
  sends = 0;
  Address address = {.family = AF_INET, .port = 12345};
  addr_from_string("127.0.0.1", &address);
  char fingerprint[96];
  for (int i = 0; i < 32; ++i)
    snprintf(fingerprint + 3 * i, 4, "00%s", i == 31 ? "" : ":");
  for (int i = 0; i < 16 && remaining; ++i) {
    size_t before = remaining;
    if (dtls_srtp_handshake(&d, &address, fingerprint) || remaining == before)
      break;
  }
  if (d.state == DTLS_SRTP_STATE_CONNECTED)
    abort(); /* All-zero fingerprint must never authenticate. */
  return 0;
}
