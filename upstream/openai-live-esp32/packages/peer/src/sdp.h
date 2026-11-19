#ifndef LIVE_PEER_SDP_H
#define LIVE_PEER_SDP_H
#include "ice.h"
#define PEER_SDP_LIMIT 8192
#define PEER_SDP_CANDIDATES 10
#define PEER_MESSAGE_LIMIT 65536

typedef struct PeerSdp {
  char tls_id[256];
  char ufrag[257], password[257], fingerprint[96];
  IceCandidate candidates[PEER_SDP_CANDIDATES];
  size_t candidate_count;
  int audio, data, setup, rtcp_mux, opus;
  uint32_t ssrc;
  uint16_t sctp_port;
  size_t max_message_size;
  char audio_mid[33], data_mid[33];
} PeerSdp;

int peer_sdp_parse(const char *data, size_t size, PeerSdp *result);
int peer_sdp_offer(char *out, size_t capacity, const char *ufrag,
                   const char *password, const char *fingerprint, uint32_t ssrc,
                   int audio, int data, const char *candidates);
#endif
