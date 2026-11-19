/* Inject real socket error returns below the owner-loop/BIO boundary. No
 * production fault hooks and no external endpoints are used. */
#include "socket.h"
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
static unsigned checks, calls;
static int next_error;
#define CHECK(x)                                                               \
  do {                                                                         \
    ++checks;                                                                  \
    if (!(x)) {                                                                \
      fprintf(stderr, "%s:%d: %s\n", __FILE__, __LINE__, #x);                  \
      abort();                                                                 \
    }                                                                          \
  } while (0)
static ssize_t injected_sendto(int fd, const void *p, size_t n, int flags,
                               const struct sockaddr *sa, socklen_t len) {
  ++calls;
  if (next_error) {
    errno = next_error;
    next_error = 0;
    return -1;
  }
  return sendto(fd, p, n, flags, sa, len);
}
#define sendto injected_sendto
#include "../src/socket.c"
#undef sendto
#include "../src/peer_connection.c"
#include "peer.h"
static PeerConnection *connected(UdpSocket *remote) {
  PeerConfiguration c = {.local_address = "127.0.0.1",
                         .audio_codec = CODEC_OPUS};
  PeerConnection *pc = peer_connection_create(&c);
  CHECK(pc);
  CHECK(peer_connection_create_offer(pc));
  CHECK(!udp_socket_open_on(remote, AF_INET, 0, "127.0.0.1"));
  Agent *a = &pc->agent;
  a->remote_candidates_count = 1;
  a->remote_candidates[0].addr = remote->bind_addr;
  strcpy(a->remote_ufrag, "remote");
  strcpy(a->remote_upwd, "abcdefghijklmnopqrstuvwxyz");
  agent_update_candidate_pairs(a);
  CHECK(!agent_select_candidate_pair(a));
  a->selected_pair = a->nominated_pair;
  a->last_consent = ports_get_epoch_time() - 1000;
  a->binding_request_sent_time = ports_get_epoch_time() - 5000;
  a->consent_interval = 4000;
  pc->state = PEER_CONNECTION_CONNECTED;
  pc->dtls.state = DTLS_SRTP_STATE_CONNECTED;
  return pc;
}
static void consent_pressure(int error) {
  UdpSocket remote = {.fd = -1};
  PeerConnection *pc = connected(&remote);
  uint32_t consent = pc->agent.last_consent;
  next_error = error;
  unsigned before = calls;
  CHECK(!peer_connection_loop(pc));
  CHECK(calls == before + 1 && !next_error); /* no retry spin or sleep */
  CHECK(pc->state == PEER_CONNECTION_CONNECTED);
  CHECK(pc->agent.last_consent == consent); /* No fabricated consent. */
  CHECK(!peer_connection_loop(pc) && calls == before + 1); /* paced */
  pc->agent.binding_request_sent_time = ports_get_epoch_time() - 6000;
  CHECK(!peer_connection_loop(pc) &&
        calls == before + 2); /* next check goes out */
  pc->agent.last_consent = ports_get_epoch_time() - 30000;
  CHECK(peer_connection_loop(pc) == -1 && pc->state == PEER_CONNECTION_FAILED);
  CHECK(calls == before + 2); /* expiry still stops transmission */
  peer_connection_destroy(pc);
  udp_socket_close(&remote);
}
static void dtls_pressure(int error) {
  UdpSocket remote = {.fd = -1};
  PeerConnection *pc = connected(&remote);
  const uint8_t record[13] = {22, 0xfe, 0xfd};
  next_error = error;
  unsigned before = calls;
  CHECK(send_dtls(&pc->dtls, record, sizeof(record)) == sizeof(record));
  CHECK(calls == before + 1 && pc->agent.udp_sockets[0].send_errors == 1);
  CHECK(pc->agent.udp_sockets[0].last_send_errno == error);
  CHECK(send_dtls(&pc->dtls, record, STUN_ATTR_BUF_SIZE + 1) == -1 &&
        calls == before + 1);
  CHECK(send_dtls(&pc->dtls, record, sizeof(record)) == sizeof(record));
  CHECK(pc->agent.udp_sockets[0].last_send_errno == 0);
  next_error = EBADF;
  CHECK(send_dtls(&pc->dtls, record, sizeof(record)) == -1);
  /* Stale pressure cannot bypass the latched consent-expiry gate. */
  pc->agent.udp_sockets[0].last_send_errno = error;
  pc->agent.last_consent = ports_get_epoch_time() - 30000;
  before = calls;
  CHECK(send_dtls(&pc->dtls, record, sizeof(record)) == -1 && calls == before);
  peer_connection_destroy(pc);
  udp_socket_close(&remote);
}
static void initial_pressure(void) {
  UdpSocket remote = {.fd = -1};
  PeerConnection *pc = connected(&remote);
  Agent *a = &pc->agent;
  a->selected_pair = NULL;
  pc->state = PEER_CONNECTION_CHECKING;
  pc->dtls.state = DTLS_SRTP_STATE_INIT;
  pc->check_started = ports_get_epoch_time();
  next_error = ENOMEM;
  unsigned before = calls;
  CHECK(!peer_connection_loop(pc) && pc->state == PEER_CONNECTION_CHECKING);
  CHECK(calls == before + 1 && a->binding_request_pending);
  uint8_t transaction[12];
  memcpy(transaction, a->binding_request_transaction_id, 12);
  CHECK(!peer_connection_loop(pc) && calls == before + 1);
  a->binding_request_sent_time = ports_get_epoch_time() - 251;
  next_error = EAGAIN;
  CHECK(!peer_connection_loop(pc) && calls == before + 2);
  CHECK(!memcmp(transaction, a->binding_request_transaction_id, 12));
  a->binding_request_sent_time = ports_get_epoch_time() - 251;
  CHECK(!peer_connection_loop(pc) && calls == before + 3);
  CHECK(!a->selected_pair); /* A successful send is still not consent. */
  peer_connection_destroy(pc);
  udp_socket_close(&remote);
}
static void rtp_pressure(void) {
  UdpSocket remote = {.fd = -1};
  PeerConnection *pc = connected(&remote);
  uint8_t key[30] = {0};
  srtp_policy_t p = {0};
  srtp_crypto_policy_set_rtp_default(&p.rtp);
  srtp_crypto_policy_set_rtcp_default(&p.rtcp);
  p.ssrc.type = ssrc_any_outbound;
  p.key = key;
  CHECK(!srtp_create(&pc->dtls.srtp_out, &p));
  const uint8_t opus[] = {0xf8, 0xff, 0xfe};
  next_error = ENOMEM;
  CHECK(peer_connection_send_audio(pc, opus, sizeof(opus)) == -1);
  CHECK(pc->state == PEER_CONNECTION_CONNECTED &&
        pc->agent.udp_sockets[0].send_errors == 1);
  CHECK(!peer_connection_send_audio(pc, opus, sizeof(opus)));
  peer_connection_destroy(pc);
  udp_socket_close(&remote);
}
int main(void) {
  CHECK(!peer_init());
  initial_pressure();
  rtp_pressure();
  consent_pressure(ENOMEM);
  consent_pressure(ENOBUFS);
  consent_pressure(EAGAIN);
  dtls_pressure(ENOMEM);
  dtls_pressure(ENOBUFS);
  dtls_pressure(EAGAIN);
  UdpSocket remote = {.fd = -1};
  PeerConnection *pc = connected(&remote);
  next_error = EBADF;
  CHECK(peer_connection_loop(pc) == -1 && pc->state == PEER_CONNECTION_FAILED);
  peer_connection_destroy(pc);
  udp_socket_close(&remote);
  CHECK(!peer_deinit());
  printf("Backpressure checks: %u passed\n", checks);
}
