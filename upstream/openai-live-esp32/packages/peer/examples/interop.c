/* Local interoperability driver: no service endpoints or credentials. */
#include "peer.h"
#include <fcntl.h>
#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#ifndef PEER_INTEROP_SECONDS
#define PEER_INTEROP_SECONDS 6
#endif

static PeerConnection *peer;
static unsigned audio_received, messages_received;
static void state(PeerConnectionState value, void *ctx) {
  (void)ctx;
  fprintf(stderr, "STATE %s\n", peer_connection_state_to_string(value));
}
static void audio(uint8_t *data, size_t size, void *ctx) {
  (void)data;
  (void)ctx;
  if (size)
    ++audio_received;
}
static void message(char *data, size_t size, void *ctx, uint16_t sid) {
  (void)ctx;
  ++messages_received;
  if (size == 4 && !memcmp(data, "ping", 4))
    peer_connection_datachannel_send_sid(peer, "pong", 4, sid);
  else
    peer_connection_datachannel_send_sid(peer, data, size, sid);
}
static void association_open(void *ctx) {
  (void)ctx;
  if (peer_connection_create_datachannel(peer, DATA_CHANNEL_RELIABLE, 0, 0,
                                         "native", ""))
    fprintf(stderr, "Native channel creation failed\n");
}
static double monotonic(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return ts.tv_sec + ts.tv_nsec / 1e9;
}
static int open_descriptors(void) {
  int n = 0;
  for (int fd = 0; fd < 1024; ++fd)
    if (fcntl(fd, F_GETFD) != -1)
      ++n;
  return n;
}
int main(int argc, char **argv) {
  unsigned rounds = argc > 1 ? (unsigned)strtoul(argv[1], NULL, 10) : 1;
  int reject = argc > 2 && !strcmp(argv[2], "reject");
  int use_audio = argc < 4 || strcmp(argv[3], "data");
  int use_data = argc < 4 || strcmp(argv[3], "audio");
  if (!rounds || rounds > 100)
    return 1;
  setbuf(stdout, NULL);
  if (peer_init())
    return 1;
  int ret = 0, baseline_fds = open_descriptors();
  for (unsigned round = 0; round < rounds && !ret; ++round) {
    audio_received = messages_received = 0;
    PeerConfiguration config = {
        .local_address = argc > 4 ? argv[4] : "127.0.0.1",
        .audio_codec = use_audio ? CODEC_OPUS : CODEC_NONE,
        .datachannel = use_data ? DATA_CHANNEL_STRING : DATA_CHANNEL_NONE,
        .onaudiotrack = audio};
    peer = peer_connection_create(&config);
    if (!peer) {
      ret = 2;
      break;
    }
    peer_connection_oniceconnectionstatechange(peer, state);
    peer_connection_ondatachannel(peer, message, association_open, NULL);
    const char *offer = peer_connection_create_offer(peer);
    if (!offer) {
      ret = 3;
      break;
    }
    printf("OFFER %zu\n%s", strlen(offer), offer);
    char line[64], answer[8192];
    unsigned size;
    if (!fgets(line, sizeof(line), stdin) ||
        sscanf(line, "ANSWER %u", &size) != 1 || size >= sizeof(answer) ||
        fread(answer, 1, size, stdin) != size) {
      ret = 4;
      break;
    }
    answer[size] = 0;
    if (peer_connection_set_remote_description_n(peer, answer, size,
                                                 SDP_TYPE_ANSWER)) {
      ret = 6;
      break;
    }
    double start = monotonic(), next_audio = start;
    uint32_t capture_frame = 0;
    while (monotonic() - start < PEER_INTEROP_SECONDS) {
      if (peer_connection_loop(peer))
        break;
      if (peer_connection_get_state(peer) == PEER_CONNECTION_CONNECTED &&
          monotonic() >= next_audio) {
        const uint8_t silence[] = {0xf8, 0xff, 0xfe};
        if (use_audio) {
          if (capture_frame == 20)
            ++capture_frame; /* Simulate one capture queue drop. */
          if (peer_connection_send_audio_at(peer, silence, sizeof(silence),
                                            capture_frame++ * 960)) {
            ret = 11;
            break;
          }
        }
        next_audio = monotonic() + .02;
      }
      usleep(1000);
    }
    PeerConnectionStats stats;
    peer_connection_get_stats(peer, &stats);
    printf("RESULT audio=%u messages=%u rtp=%" PRIu64 " bad_rtp=%" PRIu64
           " rtcp=%" PRIu64 " bad_rtcp=%" PRIu64 " dtls_failures=%" PRIu64
           " late=%" PRIu32 " reordered=%" PRIu32 " playout_lost=%" PRIu32 "\n",
           audio_received, messages_received, stats.accepted_rtp,
           stats.rejected_rtp, stats.accepted_rtcp, stats.rejected_rtcp,
           stats.dtls_failures, stats.rtp_late_dropped, stats.rtp_reordered,
           stats.rtp_playout_gaps);
    if (ret)
      break;
    if (reject)
      ret = peer_connection_get_state(peer) == PEER_CONNECTION_FAILED &&
                    stats.dtls_failures && !audio_received && !messages_received
                ? 0
                : 7;
    else
      ret = (!use_audio || audio_received >= 10) &&
                    (!use_data || messages_received) &&
                    peer_connection_get_state(peer) == PEER_CONNECTION_CONNECTED
                ? 0
                : 5;
    if (reject && !ret) {
      /* A terminal failure remains an error on every subsequent poll. */
      for (int i = 0; i < 3; ++i)
        if (peer_connection_loop(peer) != -1 ||
            peer_connection_get_state(peer) != PEER_CONNECTION_FAILED ||
            peer_connection_send_audio(peer, (const uint8_t *)"abc", 3) != -1 ||
            peer_connection_send_audio_at(peer, (const uint8_t *)"abc", 3, 0) !=
                -1 ||
            peer_connection_datachannel_send(peer, "x", 1) != -1 ||
            peer_connection_datachannel_send_sid(peer, "x", 1, 0) != -1)
          ret = 10;
    }
    peer_connection_close(peer);
    peer_connection_destroy(peer);
    peer = NULL;
    if (open_descriptors() != baseline_fds)
      ret = 9;
  }
  if (peer)
    peer_connection_destroy(peer);
  if (peer_deinit())
    return 8;
  return ret;
}
