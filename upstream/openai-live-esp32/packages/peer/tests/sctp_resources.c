/* Test the adapter's bounded message allocations and failure cleanup. The
 * allocator shim covers only sctp.c, not upstream usrsctp or crypto heaps. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static unsigned checks, delivered, allocations, releases, fail_next;
static void *owned[16];
#define CHECK(x)                                                               \
  do {                                                                         \
    ++checks;                                                                  \
    if (!(x)) {                                                                \
      fprintf(stderr, "%s:%d: %s\n", __FILE__, __LINE__, #x);                  \
      abort();                                                                 \
    }                                                                          \
  } while (0)
static void *test_malloc(size_t n) {
  if (fail_next) {
    fail_next = 0;
    return NULL;
  }
  void *p = malloc(n);
  CHECK(p);
  for (unsigned i = 0; i < 16; ++i)
    if (!owned[i]) {
      owned[i] = p;
      ++allocations;
      return p;
    }
  abort();
}
static void test_free(void *p) {
  if (!p)
    return;
  for (unsigned i = 0; i < 16; ++i)
    if (owned[i] == p) {
      owned[i] = NULL;
      ++releases;
      break;
    }
  free(p);
}
#define malloc test_malloc
#define free test_free
#include "../src/sctp.c"
#undef malloc
#undef free
static void message(char *p, size_t n, void *ctx, uint16_t sid) {
  (void)ctx;
  CHECK(sid < SCTP_MAX_STREAMS);
  CHECK(n == PEER_MESSAGE_LIMIT || n == 4);
  for (size_t i = 0; i < n; ++i)
    CHECK(p[i] == 'a');
  ++delivered;
}
int main(void) {
  uint8_t *data = malloc(PEER_MESSAGE_LIMIT);
  CHECK(data);
  memset(data, 'a', PEER_MESSAGE_LIMIT);
  for (unsigned round = 0; round < 20; ++round) {
    DtlsSrtp d = {.role = DTLS_SRTP_ROLE_CLIENT};
    Sctp s = {.dtls_srtp = &d,
              .connected = 1,
              .onmessage = message,
              .stream_count = SCTP_MAX_STREAMS};
    for (unsigned i = 0; i < SCTP_MAX_STREAMS; ++i) {
      s.stream_table[i].sid = i;
      s.stream_table[i].state = 2;
      sctp_receive_chunk(&s, data, PEER_MESSAGE_LIMIT - 1, PPID_STRING, i, 0);
      CHECK(allocations - releases == i + 1);
    }
    unsigned before = delivered;
    for (unsigned i = 0; i < SCTP_MAX_STREAMS; ++i) {
      if (round % 3 ==
          0) { /* Oversize discards the entire message, then recovers. */
        sctp_receive_chunk(&s, data, 2, PPID_STRING, i, 0);
        CHECK(s.stream_table[i].discarding && !s.stream_table[i].partial);
        sctp_receive_chunk(&s, data, 4, PPID_STRING, i, 1);
        CHECK(delivered == before + i);
        sctp_receive_chunk(&s, data, 4, PPID_STRING, i, 1);
        CHECK(delivered == before + i + 1);
      } else if (round % 3 == 1) {
        sctp_receive_chunk(&s, data, 1, PPID_STRING, i, 1);
        CHECK(delivered == before + i + 1 && !s.stream_table[i].partial);
      } /* round % 3 == 2 closes with all channels partially assembled. */
    }
    sctp_destroy_association(&s);
    CHECK(allocations == releases);
    sctp_destroy_association(&s);
    CHECK(allocations == releases);
  }
  DtlsSrtp d = {.role = DTLS_SRTP_ROLE_CLIENT};
  Sctp s = {
      .dtls_srtp = &d, .connected = 1, .onmessage = message, .stream_count = 1};
  s.stream_table[0].state = 2;
  fail_next = 1;
  unsigned before = delivered;
  sctp_receive_chunk(&s, data, 10, PPID_STRING, 0, 0);
  CHECK(!fail_next && s.stream_table[0].discarding);
  sctp_receive_chunk(&s, data, 4, PPID_STRING, 0, 1);
  CHECK(delivered == before && !s.stream_table[0].discarding);
  sctp_receive_chunk(&s, data, 4, PPID_STRING, 0, 1);
  CHECK(delivered == before + 1);
  sctp_destroy_association(&s);
  CHECK(allocations == releases);
  free(data);
  printf("SCTP resource checks: %u passed; %u allocations released; bound %u "
         "bytes\n",
         checks, releases, SCTP_MAX_STREAMS * PEER_MESSAGE_LIMIT);
}
