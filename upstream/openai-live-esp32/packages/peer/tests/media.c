/* Exercise the real owner loop/UDP/SRTP boundary. White-box setup supplies a
 * completed handshake's keys, so malicious plaintext can receive valid tags.
 * Handshake authentication is tested separately, not bypassed in production. */
#include "../src/peer_connection.c"
#include "peer.h"
#include "wire.h"
#include <stdio.h>
#include <stdlib.h>
#include <sys/select.h>
static unsigned checks, delivered;
#define CHECK(x)                                                               \
  do {                                                                         \
    ++checks;                                                                  \
    if (!(x)) {                                                                \
      fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #x);             \
      abort();                                                                 \
    }                                                                          \
  } while (0)
static void audio(uint8_t *data, size_t size, void *ctx) {
  (void)ctx;
  CHECK(data && size);
  ++delivered;
}
static void policy(srtp_t *ctx, uint8_t key[30], int outbound) {
  srtp_policy_t p = {0};
  srtp_crypto_policy_set_rtp_default(&p.rtp);
  srtp_crypto_policy_set_rtcp_default(&p.rtcp);
  p.ssrc.type = outbound ? ssrc_any_outbound : ssrc_any_inbound;
  p.key = key;
  CHECK(srtp_create(ctx, &p) == srtp_err_status_ok);
}
typedef struct {
  PeerConnection *pc;
  UdpSocket sender;
  srtp_t outgoing;
  Address target;
} Media;
static Media make_media(void) {
  Media m = {.sender = {.fd = -1}};
  PeerConfiguration c = {.local_address = "127.0.0.1",
                         .audio_codec = CODEC_OPUS,
                         .onaudiotrack = audio};
  m.pc = peer_connection_create(&c);
  CHECK(m.pc);
  CHECK(peer_connection_create_offer(m.pc));
  CHECK(!udp_socket_open_on(&m.sender, AF_INET, 0, "127.0.0.1"));
  m.target = m.pc->agent.udp_sockets[0].bind_addr;
  CHECK(addr_from_string("127.0.0.1", &m.target));
  m.pc->agent.remote_candidates[0].addr = m.sender.bind_addr;
  m.pc->agent.candidate_pairs[0].remote = &m.pc->agent.remote_candidates[0];
  m.pc->agent.selected_pair = &m.pc->agent.candidate_pairs[0];
  m.pc->agent.last_consent = m.pc->agent.binding_request_sent_time =
      ports_get_epoch_time();
  m.pc->agent.consent_interval = UINT32_MAX;
  m.pc->dtls.state = DTLS_SRTP_STATE_CONNECTED;
  m.pc->state = PEER_CONNECTION_CONNECTED;
  uint8_t key[30];
  memset(key, 0x5a, sizeof(key));
  policy(&m.pc->dtls.srtp_in, key, 0);
  policy(&m.outgoing, key, 1);
  delivered = 0;
  return m;
}
static void receive_packet(Media *m, uint8_t *p, int size, int rtcp,
                           int corrupt) {
  CHECK((rtcp ? srtp_protect_rtcp(m->outgoing, p, &size)
              : srtp_protect(m->outgoing, p, &size)) == srtp_err_status_ok);
  if (corrupt)
    p[size - 1] ^= 1;
  CHECK(udp_socket_sendto(&m->sender, &m->target, p, size) == size);
  fd_set fds;
  FD_ZERO(&fds);
  FD_SET(m->pc->agent.udp_sockets[0].fd, &fds);
  struct timeval timeout = {1, 0};
  CHECK(select(m->pc->agent.udp_sockets[0].fd + 1, &fds, NULL, NULL,
               &timeout) == 1);
  CHECK(!peer_connection_loop(m->pc));
}
static void rtp(uint8_t *p, uint16_t seq, uint32_t ssrc) {
  memset(p, 0, 128);
  p[0] = 0x80;
  p[1] = 111;
  wire_put16(p + 2, seq);
  wire_put32(p + 4, seq * 960u);
  wire_put32(p + 8, ssrc);
  p[12] = 0xf8;
  p[13] = 0xff;
  p[14] = 0xfe;
}
static void close_media(Media *m) {
  peer_connection_close(m->pc);
  CHECK(peer_connection_send_audio(m->pc, (const uint8_t *)"abc", 3) == -1);
  CHECK(peer_connection_send_audio_at(m->pc, (const uint8_t *)"abc", 3, 0) ==
        -1);
  CHECK(peer_connection_datachannel_send(m->pc, "x", 1) == -1);
  peer_connection_destroy(m->pc);
  srtp_dealloc(m->outgoing);
  udp_socket_close(&m->sender);
}
static void poison(int mode) {
  Media m = make_media();
  uint8_t p[128];
  rtp(p, 100, 123);
  if (mode == 0)
    p[1] = 112; /* Unsupported payload must not choose the audio SSRC. */
  if (mode == 1) {
    p[0] |= 0x20;
    p[14] = 0;
  } /* Authenticated invalid padding. */
  if (mode >= 2) {
    memset(p, 0, sizeof(p));
    p[0] = mode == 2 ? 0x9f : 0x80;
    p[1] = 201;
    wire_put16(p + 2, 1);
    wire_put32(p + 4, 123);
  }
  receive_packet(&m, p, mode >= 2 ? 8 : 15, mode >= 2, 0);
  CHECK(!m.pc->remote.ssrc && delivered == 0);
  rtp(p, 101, 456);
  receive_packet(&m, p, 15, 0, 0);
  CHECK(m.pc->remote.ssrc == 456 && delivered == 1);
  close_media(&m);
}
static void source_churn(void) {
  Media m = make_media();
  uint8_t p[128];
  for (unsigned i = 1; i <= 2000; ++i) {
    rtp(p, 1, i);
    receive_packet(&m, p, 15, 0, 1);
    CHECK(!m.pc->remote.ssrc && !delivered);
    uint32_t roc;
    CHECK(srtp_get_stream_roc(m.pc->dtls.srtp_in, i, &roc) ==
          srtp_err_status_bad_param);
  }
  /* Valid tags alone must not let malformed packets grow the wildcard table. */
  for (unsigned i = 4001; i <= 6000; ++i) {
    rtp(p, 1, i);
    p[0] |= 0x20;
    p[14] = 0;
    receive_packet(&m, p, 15, 0, 0);
    CHECK(!m.pc->remote.ssrc && !delivered);
    uint32_t roc;
    CHECK(srtp_get_stream_roc(m.pc->dtls.srtp_in, i, &roc) ==
          srtp_err_status_bad_param);
  }
  rtp(p, 100, 123);
  receive_packet(&m, p, 15, 0, 0);
  CHECK(delivered == 1);
  for (unsigned i = 2001; i <= 4000; ++i) {
    rtp(p, 1, i);
    receive_packet(&m, p, 15, 0, 0);
    CHECK(m.pc->remote.ssrc == 123 && delivered == 1);
    uint32_t roc;
    CHECK(srtp_get_stream_roc(m.pc->dtls.srtp_in, i, &roc) ==
          srtp_err_status_bad_param);
  }
  rtp(p, 101, 123);
  receive_packet(&m, p, 15, 0, 0);
  CHECK(delivered == 2);
  close_media(&m);
}
static void compound_padding(void) {
  Media m = make_media();
  uint8_t p[128];
  rtp(p, 100, 123);
  receive_packet(&m, p, 15, 0, 0);
  /* Chromium RemoteEstimate bug: packet length includes padding; data size
   * after removing padding is too short for an APP header. */
  memset(p, 0, sizeof(p));
  p[0] = 0xa0;
  p[1] = 204;
  wire_put16(p + 2, 3);
  wire_put32(p + 4, 123);
  p[15] = 8;
  receive_packet(&m, p, 16, 1, 0);
  CHECK(m.pc->stats.rejected_rtcp == 1);
  memset(p, 0, sizeof(p));
  p[0] = 0x80;
  p[1] = 201;
  wire_put16(p + 2, 1);
  wire_put32(p + 4, 123);
  p[8] = 0x80;
  p[9] = 201;
  wire_put16(p + 10, 0xffff);
  receive_packet(&m, p, 12, 1, 0);
  CHECK(m.pc->stats.rejected_rtcp == 2);
  rtp(p, 101, 123);
  receive_packet(&m, p, 15, 0, 0);
  CHECK(delivered == 2);
  close_media(&m);
}
static void receive_lengths(void) {
  Media m = make_media();
  const int sizes[] = {1200, 13, 999, 25, 1536, 12};
  uint8_t out[1536];
  for (unsigned i = 0; i < sizeof(sizes) / sizeof(sizes[0]); ++i) {
    memset(m.pc->packet, 0x5a, sizeof(m.pc->packet));
    m.pc->packet[0] = 22;
    m.pc->packet_size = sizes[i];
    memset(out, 0xa5, sizeof(out));
    int n = recv_dtls(&m.pc->dtls, out, sizeof(out));
    CHECK(n == (sizes[i] < 13 ? MBEDTLS_ERR_SSL_WANT_READ : sizes[i]));
    CHECK(!m.pc->packet_size);
    for (size_t j = n > 0 ? (size_t)n : 0; j < sizeof(out); ++j)
      CHECK(out[j] == 0xa5);
  }
  m.pc->packet_size = 25;
  CHECK(recv_dtls(&m.pc->dtls, out, 24) == MBEDTLS_ERR_SSL_WANT_READ);
  close_media(&m);
}
static void rollover(void) {
  uint8_t key[30];
  memset(key, 0x5a, sizeof(key));
  srtp_t sender, receiver;
  policy(&sender, key, 1);
  policy(&receiver, key, 0);
  uint8_t p[128];
  int n;
  rtp(p, 65535, 1);
  n = 15;
  CHECK(srtp_protect(sender, p, &n) == 0); /* initial packet lost */
  rtp(p, 0, 1);
  n = 15;
  CHECK(srtp_protect(sender, p, &n) == 0);
  CHECK(srtp_unprotect(receiver, p, &n) !=
        0); /* Demonstrates the ROC ambiguity. */
  srtp_dealloc(sender);
  srtp_dealloc(receiver);
  policy(&sender, key, 1);
  policy(&receiver, key, 0);
  /* Safe startup has headroom; first receive succeeds despite startup loss. */
  rtp(p, 32767, 1);
  n = 15;
  CHECK(srtp_protect(sender, p, &n) == 0);
  rtp(p, 32768, 1);
  n = 15;
  CHECK(srtp_protect(sender, p, &n) == 0);
  CHECK(srtp_unprotect(receiver, p, &n) == 0);
  /* Once synchronized, loss and reorder across rollover remain legitimate. */
  rtp(p, 65534, 1);
  n = 15;
  CHECK(srtp_protect(sender, p, &n) == 0);
  CHECK(srtp_unprotect(receiver, p, &n) == 0);
  rtp(p, 65535, 1);
  n = 15;
  CHECK(srtp_protect(sender, p, &n) == 0);
  uint8_t held[128];
  int held_n = n;
  memcpy(held, p, n);
  rtp(p, 0, 1);
  n = 15;
  CHECK(srtp_protect(sender, p, &n) == 0);
  CHECK(srtp_unprotect(receiver, p, &n) == 0);
  CHECK(srtp_unprotect(receiver, held, &held_n) == 0);
  srtp_dealloc(sender);
  srtp_dealloc(receiver);
}
static void rtcp_matrix(void) {
  uint8_t p[1024];
  const unsigned types[] = {200, 201, 203, 204, 205, 206, 207};
  for (unsigned t = 0; t < sizeof(types) / sizeof(types[0]); ++t) {
    for (unsigned count = 0; count < 32; ++count) {
      unsigned type = types[t];
      size_t minimum = type == 200   ? 28 + 24 * count
                       : type == 201 ? 8 + 24 * count
                       : type == 203 ? 4 + 4 * count
                       : type == 207 ? 8
                                     : 12;
      memset(p, 0, sizeof(p));
      p[0] = 0x80 | count;
      p[1] = type;
      wire_put16(p + 2, (uint16_t)(minimum / 4 - 1));
      CHECK(!rtcp_validate(p, minimum));
      CHECK(rtcp_validate(p, minimum - 1));
      if (minimum > 4) {
        wire_put16(p + 2, (uint16_t)(minimum / 4 - 2));
        CHECK(rtcp_validate(p, minimum - 4));
      }
      /* Sufficient wire bytes cannot rescue too few unpadded report bytes. */
      p[0] |= 0x20;
      wire_put16(p + 2, (uint16_t)(minimum / 4));
      p[minimum + 3] = 4;
      CHECK(!rtcp_validate(p, minimum + 4));
      p[minimum + 3] = 8;
      CHECK(rtcp_validate(p, minimum + 4));
    }
  }
  /* Every compound member must be RTCP, not merely the first one. */
  for (unsigned type = 0; type < 256; ++type) {
    memset(p, 0, sizeof(p));
    p[0] = 0x80;
    p[1] = 201;
    p[3] = 1;
    p[8] = 0x80;
    p[9] = type;
    p[11] = 6;
    CHECK((rtcp_validate(p, 36) == 0) == (type >= 192 && type <= 223));
  }
  for (unsigned padding = 0; padding <= 16; ++padding) {
    memset(p, 0, sizeof(p));
    p[0] = 0xa0;
    p[1] = 204;
    p[3] = 3;
    p[15] = padding;
    CHECK((rtcp_validate(p, 16) == 0) == (padding == 4));
  }
}
int main(int argc, char **argv) {
  CHECK(peer_init() == 0);
  if (argc > 1 && atoi(argv[1]) == 4)
    rtcp_matrix();
  else if (argc > 1)
    poison(atoi(argv[1]));
  else {
    for (int i = 0; i < 4; ++i)
      poison(i);
    source_churn();
    compound_padding();
    receive_lengths();
    rollover();
    rtcp_matrix();
  }
  CHECK(peer_deinit() == 0);
  printf("Media boundary checks: %u passed\n", checks);
  return 0;
}
