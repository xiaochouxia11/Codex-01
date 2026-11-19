/* Real usrsctp associations over an in-memory DTLS output stub. All endpoints
 * use the same SCTP ports to force long lookup chains, without touching crypto
 * validation (covered by the handshake and network interop tests). */
#include "sctp.h"
#include "wire.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#define ENDPOINTS 128
#define PACKETS 4096
static unsigned checks, delivered, head, tail, expected_round;
static Sctp peers[ENDPOINTS];
static DtlsSrtp dtls[ENDPOINTS];
static unsigned ids[ENDPOINTS];
static struct {
  uint8_t data[1536];
  size_t size;
  unsigned target;
} queue[PACKETS];
size_t peer_test_sctp_index_bytes(void);
unsigned peer_test_sctp_max_chain(void);
#define CHECK(x)                                                               \
  do {                                                                         \
    ++checks;                                                                  \
    if (!(x)) {                                                                \
      fprintf(stderr, "%s:%d: %s\n", __FILE__, __LINE__, #x);                  \
      abort();                                                                 \
    }                                                                          \
  } while (0)
int dtls_srtp_write(DtlsSrtp *d, const uint8_t *data, size_t size) {
  unsigned from = (unsigned)(d - dtls);
  CHECK(from < ENDPOINTS && size <= 1536 && tail - head < PACKETS);
  unsigned index = tail++ % PACKETS;
  memcpy(queue[index].data, data, size);
  queue[index].size = size;
  queue[index].target = from ^ 1;
  return (int)size;
}
static void drain(void) {
  unsigned budget = 10 * PACKETS;
  while (head != tail) {
    CHECK(budget--);
    unsigned index = head++ % PACKETS;
    sctp_incoming_data(&peers[queue[index].target], (char *)queue[index].data,
                       queue[index].size);
  }
}
static void message(char *data, size_t size, void *ctx, uint16_t sid) {
  unsigned to = *(unsigned *)ctx;
  CHECK(sid == 0 && size == 4096);
  CHECK(wire_u32((uint8_t *)data) == (to ^ 1));
  CHECK(wire_u32((uint8_t *)data + 4) == expected_round);
  for (size_t i = 8; i < size; ++i)
    CHECK((uint8_t)data[i] == (uint8_t)(to ^ 1));
  ++delivered;
}
int main(void) {
  unsigned longest = 0;
  for (unsigned cycle = 0; cycle < 3; ++cycle) {
    sctp_usrsctp_init();
    CHECK(peer_test_sctp_index_bytes() ==
          sizeof(void *) * (16 * LIVE_PEER_SCTP_HASH_BUCKETS +
                            2 * LIVE_PEER_SCTP_HASH_BUCKETS));
    memset(peers, 0, sizeof(peers));
    memset(dtls, 0, sizeof(dtls));
    head = tail = delivered = 0;
    for (unsigned i = 0; i < ENDPOINTS; ++i) {
      ids[i] = i;
      dtls[i].state = DTLS_SRTP_STATE_CONNECTED;
      dtls[i].role = i & 1 ? DTLS_SRTP_ROLE_SERVER : DTLS_SRTP_ROLE_CLIENT;
      peers[i].remote_port = 5000;
      peers[i].remote_max_message = PEER_MESSAGE_LIMIT;
      peers[i].onmessage = message;
      peers[i].userdata = &ids[i];
      CHECK(!sctp_create_association(&peers[i], &dtls[i]));
    }
    drain();
    unsigned chain = peer_test_sctp_max_chain();
    CHECK(chain >= ENDPOINTS / 2);
    if (chain > longest)
      longest = chain;
    for (unsigned i = 0; i < ENDPOINTS; ++i)
      CHECK(peers[i].connected);
    for (unsigned i = 0; i < ENDPOINTS; i += 2)
      CHECK(!sctp_open_channel(&peers[i], "events", "", 0));
    drain();
    for (unsigned round = 0; round < 3; ++round) {
      expected_round = round;
      for (unsigned i = 0; i < ENDPOINTS; ++i) {
        uint8_t payload[4096];
        memset(payload, i, sizeof(payload));
        wire_put32(payload, i);
        wire_put32(payload + 4, round);
        CHECK(!sctp_outgoing_data(&peers[i], (char *)payload, sizeof(payload),
                                  PPID_BINARY, 0));
        drain();
      }
      CHECK(delivered == ENDPOINTS * (round + 1));
    }
    // Close both ends of each pair in mixed order, then reinitialize globals.
    for (unsigned i = 0; i < ENDPOINTS; ++i)
      sctp_destroy_association(&peers[i ^ 1]);
    head = tail = 0;
    sctp_tick();
    CHECK(!sctp_usrsctp_deinit());
  }
  printf("SCTP profile: %u checks; %u endpoints; longest collision chain %u\n",
         checks, ENDPOINTS, longest);
}
