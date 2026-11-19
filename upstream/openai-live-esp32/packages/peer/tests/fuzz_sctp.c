/* Stateful SCTP fuzzing after DTLS authentication: two usrsctp associations use
   a bounded in-memory datagram bridge. The DTLS write stub is test-only. */
#include "sctp.h"
#include "wire.h"
#include <stdlib.h>
#include <string.h>
#include <usrsctp.h>
static Sctp peers[2];
static DtlsSrtp dtls[2];
static uint32_t tags[2], tsns[2];
static struct {
  uint8_t bytes[1536];
  size_t size;
  int destination;
} packets[64];
static unsigned head, tail;
int dtls_srtp_write(DtlsSrtp *d, const uint8_t *data, size_t size) {
  unsigned from = d == &dtls[1] ? 1 : 0;
  if (size >= 32 && data[12] == 1) {
    tags[from] = wire_u32(data + 16);
    tsns[from] = wire_u32(data + 28);
  }
  if (size > 1536 || tail == 64)
    return -1;
  memcpy(packets[tail].bytes, data, size);
  packets[tail].size = size;
  packets[tail++].destination = 1 - from;
  return (int)size;
}
static void drain(void) {
  while (head < tail) {
    unsigned i = head++;
    sctp_incoming_data(&peers[packets[i].destination], (char *)packets[i].bytes,
                       packets[i].size);
  }
  head = tail = 0;
}
int LLVMFuzzerTestOneInput(const uint8_t *input, size_t size) {
  if (!size || size > 8192)
    return 0;
  sctp_usrsctp_init();
  memset(peers, 0, sizeof(peers));
  memset(dtls, 0, sizeof(dtls));
  head = tail = 0;
  for (unsigned i = 0; i < 2; ++i) {
    dtls[i].state = DTLS_SRTP_STATE_CONNECTED;
    dtls[i].role = i ? DTLS_SRTP_ROLE_CLIENT : DTLS_SRTP_ROLE_SERVER;
    peers[i].remote_port = 5000;
    peers[i].remote_max_message = PEER_MESSAGE_LIMIT;
    if (sctp_create_association(&peers[i], &dtls[i]))
      abort();
  }
  drain();
  if (!peers[0].connected || !peers[1].connected)
    abort();
  /* The generated tag and checksum are repaired so mutations reach chunk and
     association-state parsing rather than stopping at the outer header. */
  for (unsigned i = 0; size && i < 8; ++i) {
    size_t n = size < 1500 ? size : 1500;
    uint8_t packet[1536] = {0};
    wire_put16(packet, 5000);
    wire_put16(packet + 2, 5000);
    wire_put32(packet + 4, tags[0]);
    memcpy(packet + 12, input, n);
    if (n >= 16 && packet[12] == 0)
      wire_put32(packet + 16, tsns[1]++);
    uint32_t checksum = usrsctp_crc32c(packet, n + 12);
    memcpy(packet + 8, &checksum, 4);
    sctp_incoming_data(&peers[0], (char *)packet, n + 12);
    drain();
    input += n;
    size -= n;
  }
  sctp_destroy_association(&peers[0]);
  sctp_destroy_association(&peers[1]);
  head = tail = 0;
  if (sctp_usrsctp_deinit())
    abort();
  return 0;
}
