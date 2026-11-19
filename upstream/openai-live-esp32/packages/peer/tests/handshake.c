/* Deterministic adversarial flights between the real Mbed TLS endpoints.
 * Mutations are confined to this in-memory transport; no network or
 * credentials.
 */
#ifdef PEER_TEST_MBEDTLS_INTERNALS
#include <mbedtls/version.h>
#if MBEDTLS_VERSION_MAJOR >= 4
#include "mbedtls_common.h"
#else
#include "common.h"
#endif
#endif
#include "dtls_srtp.h"
#include "peer.h"
#include "sctp.h"
#include "wire.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef PEER_TEST_MBEDTLS_INTERNALS
#include "ssl_misc.h"
#endif
static unsigned checks;
#define CHECK(x)                                                               \
  do {                                                                         \
    ++checks;                                                                  \
    if (!(x)) {                                                                \
      fprintf(stderr, "%s:%d: %s\n", __FILE__, __LINE__, #x);                  \
      abort();                                                                 \
    }                                                                          \
  } while (0)
typedef struct Link {
  DtlsSrtp d;
  struct Link *other;
  uint8_t packets[32][1536];
  size_t sizes[32];
  unsigned head, tail, changed, encrypted;
  int target_type, mutation;
  uint8_t proof[512];
  size_t proof_size;
  uint64_t last_counter;
} Link;
static uint32_t u24(const uint8_t *p) {
  return (uint32_t)p[0] << 16 | (uint32_t)p[1] << 8 | p[2];
}
static void put24(uint8_t *p, size_t n) {
  p[0] = (uint8_t)(n >> 16);
  p[1] = (uint8_t)(n >> 8);
  p[2] = (uint8_t)n;
}
static void enqueue(Link *l, const uint8_t *p, size_t n) {
  CHECK(n <= 1536 && l->tail - l->head < 32);
  unsigned i = l->tail++ % 32;
  memcpy(l->packets[i], p, n);
  l->sizes[i] = n;
}
static int send_packet(void *ctx, const unsigned char *data, size_t size) {
  Link *l = ((DtlsSrtp *)ctx)->user_data;
  for (size_t pos = 0; pos < size;) {
    CHECK(size - pos >= 13);
    size_t n = 13 + wire_u16(data + pos + 11);
    CHECK(n <= size - pos && n <= 1536);
    uint8_t packet[1536];
    memcpy(packet, data + pos, n);
    pos += n;
    if (wire_u16(packet + 3)) {
      /* GCM's explicit nonce is epoch || sequence, not a random sample. */
      CHECK(n >= 37 && !memcmp(packet + 3, packet + 13, 8));
      uint64_t counter =
          (uint64_t)wire_u32(packet + 3) << 32 | wire_u32(packet + 7);
      CHECK(!l->encrypted || counter > l->last_counter);
      l->last_counter = counter;
      ++l->encrypted;
    } else if (packet[0] == 22 && n >= 25 && packet[13] == l->target_type) {
      CHECK(!u24(packet + 19) && u24(packet + 22) == n - 25);
      if (!l->mutation) {
        CHECK(n - 25 <= sizeof(l->proof));
        l->proof_size = n - 25;
        memcpy(l->proof, packet + 25, l->proof_size);
      } else {
        ++l->changed;
        if (l->mutation == 1)
          packet[n - 1] ^= 1; /* invalid signature */
        if (l->mutation == 2)
          packet[13] = 14;      /* no CertificateVerify */
        if (l->mutation == 3) { /* previous connection's signed proof */
          CHECK(l->proof_size);
          n = 25 + l->proof_size;
          memcpy(packet + 25, l->proof, l->proof_size);
          wire_put16(packet + 11, (uint16_t)(n - 13));
          put24(packet + 14, l->proof_size);
          put24(packet + 22, l->proof_size);
        }
      }
    }
    enqueue(l->other, packet, n);
  }
  return (int)size;
}
static int receive_packet(void *ctx, unsigned char *data, size_t size) {
  Link *l = ((DtlsSrtp *)ctx)->user_data;
  if (l->head == l->tail)
    return MBEDTLS_ERR_SSL_WANT_READ;
  unsigned i = l->head++ % 32;
  CHECK(l->sizes[i] <= size);
  memcpy(data, l->packets[i], l->sizes[i]);
  return (int)l->sizes[i];
}
static Address remote;
static void denied(DtlsSrtp *d) {
  uint8_t packet[128] = {0x80, 111};
  int n = 15;
  CHECK(dtls_srtp_write(d, packet, n) == -1);
  CHECK(dtls_srtp_read(d, packet, sizeof(packet)) == -1);
  CHECK(dtls_srtp_encrypt_rtp_packet(d, packet, &n) == -1);
  CHECK(dtls_srtp_decrypt_rtp_packet(d, packet, &n) == -1);
  CHECK(dtls_srtp_encrypt_rctp_packet(d, packet, &n) == -1);
  CHECK(dtls_srtp_decrypt_rtcp_packet(d, packet, &n) == -1);
  Sctp s = {.remote_port = 5000};
  CHECK(sctp_create_association(&s, d) == -1 && !s.registered && !s.sock);
}
static void drive(Link *links, int victim, int bad_pin) {
  for (unsigned poll = 0; poll < 100; ++poll) {
    for (int i = 0; i < 2; ++i) {
      char pin[96];
      memcpy(pin, links[1 - i].d.local_fingerprint, sizeof(pin));
      if (bad_pin && i == victim)
        pin[0] = pin[0] == 'A' ? 'B' : 'A';
      int rc = dtls_srtp_handshake(&links[i].d, &remote, pin);
      CHECK(rc == 0 || (i == victim && rc == -1));
      if (i == victim && rc)
        return;
    }
    if (links[0].d.state == DTLS_SRTP_STATE_CONNECTED &&
        links[1].d.state == DTLS_SRTP_STATE_CONNECTED)
      return;
  }
  CHECK(0); /* bounded polls, no silent stall */
}
static void reset_links(Link *links) {
  for (int i = 0; i < 2; ++i) {
    DtlsSrtp *d = &links[i].d;
    if (d->srtp_in)
      srtp_dealloc(d->srtp_in);
    if (d->srtp_out)
      srtp_dealloc(d->srtp_out);
    d->srtp_in = d->srtp_out = NULL;
    d->state = DTLS_SRTP_STATE_INIT;
    d->have_exported = 0;
    CHECK(!dtls_srtp_set_role(d, i ? DTLS_SRTP_ROLE_SERVER
                                   : DTLS_SRTP_ROLE_CLIENT));
    links[i].head = links[i].tail = links[i].changed = links[i].encrypted = 0;
    links[i].last_counter = 0;
    denied(d);
  }
}
static void authentication(void) {
  Link *links = calloc(2, sizeof(*links));
  CHECK(links);
  for (int i = 0; i < 2; ++i) {
    links[i].other = &links[1 - i];
    links[i].target_type =
        i ? 12 : 15; /* ServerKeyExchange / CertificateVerify */
    CHECK(!dtls_srtp_init(&links[i].d,
                          i ? DTLS_SRTP_ROLE_SERVER : DTLS_SRTP_ROLE_CLIENT,
                          &links[i]));
    links[i].d.udp_send = send_packet;
    links[i].d.udp_recv = receive_packet;
    denied(&links[i].d);
  }
  drive(links, -1, 0);
  CHECK(links[0].d.state == DTLS_SRTP_STATE_CONNECTED &&
        links[1].d.state == DTLS_SRTP_STATE_CONNECTED);
  CHECK(links[0].proof_size && links[1].proof_size);
  /* Both directions emit counter-based unique nonces, for short and long data.
   */
  for (int i = 0; i < 2; ++i) {
    for (size_t size = 1; size <= 1000; size += 999) {
      uint8_t data[1200], out[1200];
      memset(data, 0x53, sizeof(data));
      CHECK(dtls_srtp_write(&links[i].d, data, size) == (int)size);
      CHECK(dtls_srtp_read(&links[1 - i].d, out, sizeof(out)) == (int)size);
      CHECK(!memcmp(data, out, size));
    }
    CHECK(links[i].encrypted >= 3);
  }
  for (int attacker = 0; attacker < 2; ++attacker) {
    for (int mutation = 1; mutation <= 3; ++mutation) {
      if (attacker && mutation == 2)
        continue;
      reset_links(links);
      links[attacker].mutation = mutation;
      drive(links, 1 - attacker, 0);
      CHECK(links[attacker].changed &&
            links[1 - attacker].d.state == DTLS_SRTP_STATE_FAILED);
      /* Fail at the signed-proof stage, not merely on a later Finished MAC. */
      CHECK(links[1 - attacker].d.ssl.MBEDTLS_PRIVATE(state) ==
            (attacker ? MBEDTLS_SSL_SERVER_KEY_EXCHANGE
                      : MBEDTLS_SSL_CLIENT_CHANGE_CIPHER_SPEC));
      CHECK(!links[1 - attacker].d.srtp_in && !links[1 - attacker].d.srtp_out);
      denied(&links[1 - attacker].d);
      CHECK(dtls_srtp_handshake(&links[1 - attacker].d, &remote,
                                links[attacker].d.local_fingerprint) == -1);
      links[attacker].mutation = 0;
    }
  }
  reset_links(links);
  drive(links, -1, 0);
  uint8_t old_media[128] = {0x80, 111};
  wire_put16(old_media + 2, 100);
  wire_put32(old_media + 8, 1);
  old_media[12] = 0xf8;
  int old_size = 13;
  CHECK(!dtls_srtp_encrypt_rtp_packet(&links[0].d, old_media, &old_size));
  reset_links(links); /* Same certificates, fresh handshake/key material. */
  drive(links, -1, 0);
  CHECK(dtls_srtp_decrypt_rtp_packet(&links[1].d, old_media, &old_size));
  uint8_t new_media[128] = {0x80, 111};
  wire_put16(new_media + 2, 100);
  wire_put32(new_media + 8, 1);
  new_media[12] = 0xf8;
  int new_size = 13;
  CHECK(!dtls_srtp_encrypt_rtp_packet(&links[0].d, new_media, &new_size));
  CHECK(!dtls_srtp_decrypt_rtp_packet(&links[1].d, new_media, &new_size));
  for (int victim = 0; victim < 2; ++victim) {
    reset_links(links);
    drive(links, victim, 1);
    CHECK(links[victim].d.state == DTLS_SRTP_STATE_FAILED);
    CHECK(!links[victim].d.srtp_in && !links[victim].d.srtp_out);
    denied(&links[victim].d);
  }
  reset_links(links);
  /* Keep the same expected public identity but present no client certificate.
   */
  void *cert = links[0].d.conf.MBEDTLS_PRIVATE(key_cert);
  links[0].d.conf.MBEDTLS_PRIVATE(key_cert) = NULL;
  drive(links, 1, 0);
  CHECK(links[1].d.state == DTLS_SRTP_STATE_FAILED);
  CHECK(!links[1].d.srtp_in && !links[1].d.srtp_out);
  denied(&links[1].d);
  links[0].d.conf.MBEDTLS_PRIVATE(key_cert) = cert;
  for (int i = 0; i < 2; ++i)
    dtls_srtp_deinit(&links[i].d);
  free(links);
}
#ifdef PEER_TEST_MBEDTLS_INTERNALS
static int discard(void *ctx, const unsigned char *p, size_t n) {
  (void)ctx;
  (void)p;
  return (int)n;
}
static void fragments(void) {
  Link *l = calloc(1, sizeof(*l));
  CHECK(l);
  CHECK(!dtls_srtp_init(&l->d, DTLS_SRTP_ROLE_SERVER, l));
  l->d.udp_recv = receive_packet;
  l->d.udp_send = discard;
  /* Test-only: reach the reassembler before cookie validation. Production
     keeps cookies and authenticated ICE enabled. */
  mbedtls_ssl_conf_dtls_cookies(&l->d.conf, NULL, NULL, NULL);
  size_t peak = 0;
  for (unsigned i = 0; i < 2000; ++i) {
    uint8_t p[26] = {22, 0xfe, 0xfd};
    wire_put32(p + 7, i);
    wire_put16(p + 11, 13);
    p[13] = 1;
    put24(p + 14, 16000);
    wire_put16(p + 17, (uint16_t)(i % 16));
    put24(p + 19, (i % 100) + 1);
    put24(p + 22, 1);
    p[25] = 0x5a;
    enqueue(l, p, sizeof(p));
    CHECK(!dtls_srtp_handshake(&l->d, &remote, l->d.local_fingerprint));
    CHECK(l->d.state == DTLS_SRTP_STATE_HANDSHAKE && !l->d.srtp_in);
    size_t retained =
        l->d.ssl.MBEDTLS_PRIVATE(handshake)->buffering.total_bytes_buffered;
    CHECK(retained <= MBEDTLS_SSL_DTLS_MAX_BUFFERING);
    if (retained > peak)
      peak = retained;
  }
  CHECK(peak >
        16000); /* Ensure the test really reached allocating reassembly. */
  printf("DTLS fragment retained-byte peak: %zu (limit %u)\n", peak,
         MBEDTLS_SSL_DTLS_MAX_BUFFERING);
  dtls_srtp_deinit(&l->d);
  CHECK(!l->d.initialized);
  free(l);
}
#endif
int main(void) {
  CHECK(!peer_init());
  remote.family = AF_INET;
  remote.port = 12345;
  CHECK(addr_from_string("127.0.0.1", &remote));
  authentication();
#ifdef PEER_TEST_MBEDTLS_INTERNALS
  fragments();
#endif
  CHECK(!peer_deinit());
  printf("Handshake checks: %u passed\n", checks);
}
