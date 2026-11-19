/* Observe only peer_connection.c allocations. Crypto/SCTP allocations are
 * covered by their own tests; the offer's borrowed pointer must remain valid.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static unsigned checks, allocs, frees, fail_at_alloc, attempts;
static struct {
  void *p;
  size_t n;
} owned[4];
#define CHECK(x)                                                               \
  do {                                                                         \
    ++checks;                                                                  \
    if (!(x)) {                                                                \
      fprintf(stderr, "%s:%d: %s\n", __FILE__, __LINE__, #x);                  \
      abort();                                                                 \
    }                                                                          \
  } while (0)
static void *offer_malloc(size_t n) {
  if (++attempts == fail_at_alloc)
    return NULL;
  void *p = malloc(n);
  CHECK(p);
  for (unsigned i = 0; i < 4; ++i)
    if (!owned[i].p) {
      owned[i].p = p;
      owned[i].n = n;
      ++allocs;
      return p;
    }
  abort();
}
static void offer_free(void *p) {
  for (unsigned i = 0; p && i < 4; ++i)
    if (owned[i].p == p) {
      // Both the temporary and retained SDP contain ICE credentials.
      for (size_t j = 0; j < owned[i].n; ++j)
        CHECK(((unsigned char *)p)[j] == 0);
      owned[i].p = NULL;
      ++frees;
      break;
    }
  free(p);
}
#define malloc offer_malloc
#define free offer_free
#include "../src/peer_connection.c"
#undef malloc
#undef free
#include "peer.h"
int main(void) {
  CHECK(!peer_init());
  for (unsigned round = 0; round < 12; ++round) {
    attempts = 0;
    fail_at_alloc =
        round % 3; // Scratch failure, retained-copy failure, success.
    PeerConfiguration cfg = {.audio_codec = CODEC_OPUS,
                             .datachannel = DATA_CHANNEL_STRING,
                             .local_address = "127.0.0.1"};
    PeerConnection *pc = peer_connection_create(&cfg);
    CHECK(pc);
    const char *offer = peer_connection_create_offer(pc);
    if (fail_at_alloc) {
      CHECK(!offer && pc->state == PEER_CONNECTION_FAILED);
      CHECK(!pc->sdp && !pc->sdp_size && allocs == frees);
    } else {
      CHECK(offer && pc->sdp_size == strlen(offer) + 1);
      CHECK(pc->sdp_size < PEER_SDP_LIMIT && allocs == frees + 1);
      CHECK(peer_connection_create_offer(pc) == offer && attempts == 2);
      char original[PEER_SDP_LIMIT], answer[PEER_SDP_LIMIT];
      strcpy(original, offer);
      strcpy(answer, offer);
      char *role = strstr(answer, "a=setup:actpass");
      while (role) {
        memcpy(role, "a=setup:active", 14);
        memmove(role + 14, role + 15, strlen(role + 15) + 1);
        role = strstr(role + 14, "a=setup:actpass");
      }
      PeerSdp parsed;
      CHECK(!peer_sdp_parse(answer, strlen(answer), &parsed));
      CHECK(
          !peer_connection_set_remote_description(pc, answer, SDP_TYPE_ANSWER));
      memset(answer, 0, sizeof(answer));
      CHECK(!strcmp(offer, original));
      CHECK(!strcmp(pc->agent.remote_ufrag, parsed.ufrag));
      CHECK(!strcmp(pc->agent.remote_upwd, parsed.password));
      CHECK(!strcmp(pc->remote.fingerprint, parsed.fingerprint));
      CHECK(pc->remote.ssrc == parsed.ssrc);
      CHECK(pc->agent.remote_candidates_count == (int)parsed.candidate_count);
      peer_connection_close(pc);
      CHECK(!pc->sdp && !pc->sdp_size && allocs == frees);
      peer_connection_close(pc);
    }
    peer_connection_destroy(pc);
    CHECK(allocs == frees);
  }
  CHECK(!peer_deinit());
  printf(
      "Peer memory checks: %u passed; %u SDP allocations wiped and released\n",
      checks, frees);
}
