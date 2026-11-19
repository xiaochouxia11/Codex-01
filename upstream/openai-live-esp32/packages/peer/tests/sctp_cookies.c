/* Real usrsctp handshakes, before DTLS encryption, with no sockets. */
#include "sctp.h"
#include "wire.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static unsigned checks, cookies, echo_size, echo_destination, head, tail;
static int drop_output;
static Sctp peers[2];
static DtlsSrtp dtls[2];
static uint8_t echo[1536];
static struct {
  uint8_t data[1536];
  size_t size;
  unsigned destination;
} packets[64];
int peer_test_cookie_addresses_zero(const uint8_t *, size_t);
#define CHECK(x)                                                               \
  do {                                                                         \
    ++checks;                                                                  \
    if (!(x)) {                                                                \
      fprintf(stderr, "%s:%d: %s\n", __FILE__, __LINE__, #x);                  \
      abort();                                                                 \
    }                                                                          \
  } while (0)
int dtls_srtp_write(DtlsSrtp *d, const uint8_t *p, size_t n) {
  if (drop_output)
    return (int)n;
  unsigned from = d == &dtls[1] ? 1 : 0;
  CHECK(n >= 16 && n <= 1536);
  if (p[12] == 2) { /* INIT_ACK state cookie parameter */
    size_t end = 12 + wire_u16(p + 14);
    CHECK(end <= n);
    for (size_t pos = 32; pos < end;) {
      CHECK(end - pos >= 4);
      size_t size = wire_u16(p + pos + 2);
      CHECK(size >= 4 && size <= end - pos);
      if (wire_u16(p + pos) == 7) {
        CHECK(peer_test_cookie_addresses_zero(p + pos + 4, size - 4));
        ++cookies;
      }
      pos += (size + 3) & ~(size_t)3;
    }
  }
  if (p[12] ==
      10) { /* Save a full valid COOKIE_ECHO for a later association. */
    memcpy(echo, p, n);
    echo_size = n;
    echo_destination = 1 - from;
  }
  CHECK(tail < 64);
  memcpy(packets[tail].data, p, n);
  packets[tail].size = n;
  packets[tail++].destination = 1 - from;
  return (int)n;
}
static void drain(void) {
  while (head < tail) {
    unsigned i = head++;
    sctp_incoming_data(&peers[packets[i].destination], (char *)packets[i].data,
                       packets[i].size);
  }
  head = tail = 0;
}
int main(void) {
  for (unsigned round = 0; round < 10; ++round) {
    sctp_usrsctp_init();
    memset(peers, 0, sizeof(peers));
    memset(dtls, 0, sizeof(dtls));
    head = tail = 0;
    unsigned before = cookies;
    for (unsigned i = 0; i < 2; ++i) {
      dtls[i].state = DTLS_SRTP_STATE_CONNECTED;
      dtls[i].role = i ? DTLS_SRTP_ROLE_CLIENT : DTLS_SRTP_ROLE_SERVER;
      peers[i].remote_port = 5000;
      peers[i].remote_max_message = PEER_MESSAGE_LIMIT;
      CHECK(!sctp_create_association(&peers[i], &dtls[i]));
    }
    if (echo_size) {
      drop_output = 1; /* Discard the stale packet's ABORT, not new INITs. */
      sctp_incoming_data(&peers[echo_destination], (char *)echo, echo_size);
      drop_output = 0;
      CHECK(!peers[0].connected && !peers[1].connected);
    }
    drain();
    CHECK(cookies >= before + 2 && echo_size);
    CHECK(peers[0].connected && peers[1].connected);
    /* Teardown with pending output; stale output is not delivered afterward. */
    CHECK(!sctp_open_channel(&peers[1], "pending", "", 0));
    CHECK(tail > head);
    for (unsigned i = 0; i < 2; ++i)
      sctp_destroy_association(&peers[i]);
    head = tail = 0;
    sctp_tick();
    CHECK(!sctp_usrsctp_deinit());
  }
  printf("SCTP cookie/lifecycle checks: %u passed; %u cookies have zero "
         "addresses\n",
         checks, cookies);
}
