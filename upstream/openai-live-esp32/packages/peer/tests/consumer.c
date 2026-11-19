/* Public-header-only embedding smoke test. */
#include "peer.h"
int main(void) {
  if (peer_init())
    return 1;
  PeerConfiguration config = {.local_address = "127.0.0.1",
                              .audio_codec = CODEC_OPUS};
  PeerConnection *peer = peer_connection_create(&config);
  if (!peer)
    return 2;
  int result = peer_connection_create_offer(peer) ? 0 : 3;
  peer_connection_destroy(peer);
  return peer_deinit() ? 4 : result;
}
