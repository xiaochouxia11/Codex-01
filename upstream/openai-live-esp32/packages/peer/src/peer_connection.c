#include "peer_connection.h"
#include "agent.h"
#include "dtls_srtp.h"
#include "peer_runtime.h"
#include "ports.h"
#include "rtcp.h"
#include "rtp.h"
#include "sctp.h"
#include "sdp.h"
#include "wire.h"
#include <limits.h>
#include <mbedtls/platform_util.h>
#include <string.h>

struct PeerConnection {
  PeerConfiguration config;
  char stun_urls[5][256];
  PeerConnectionState state;
  Agent agent;
  DtlsSrtp dtls;
  Sctp sctp;
  RtpEncoder encoder;
  RtpDecoder decoder;
  // The complete answer is validated in temporary storage. Credentials and
  // candidates live in Agent; only the media source and DTLS pin remain here.
  struct {
    char fingerprint[DTLS_SRTP_FINGERPRINT_LENGTH];
    uint32_t ssrc;
  } remote;
  PeerConnectionStats stats;
  char *sdp;
  size_t sdp_size;
  uint8_t packet[STUN_ATTR_BUF_SIZE], plain[STUN_ATTR_BUF_SIZE];
  int packet_size, offered, remote_set, audio_send_result;
  uint32_t check_started;
  uint32_t last_rtp_ms;
  uint16_t last_rtp_sequence;
  int have_rtp_sequence;
  void (*onstate)(PeerConnectionState, void *);
  void (*onoffer)(char *, void *);
  void (*onloss)(float, uint32_t, void *);
};
static void transition(PeerConnection *pc, PeerConnectionState state) {
  if (pc->state == state)
    return;
  pc->state = state;
  if (pc->onstate)
    pc->onstate(state, pc->config.user_data);
}
static void release(PeerConnection *pc) {
  sctp_destroy_association(&pc->sctp);
  dtls_srtp_deinit(&pc->dtls);
  agent_destroy(&pc->agent);
  mbedtls_platform_zeroize(&pc->remote, sizeof(pc->remote));
  if (pc->sdp) {
    mbedtls_platform_zeroize(pc->sdp, pc->sdp_size);
    free(pc->sdp);
    pc->sdp = NULL;
    pc->sdp_size = 0;
  }
  mbedtls_platform_zeroize(pc->packet, sizeof(pc->packet));
  mbedtls_platform_zeroize(pc->plain, sizeof(pc->plain));
  mbedtls_platform_zeroize(&pc->encoder, sizeof(pc->encoder));
  mbedtls_platform_zeroize(pc->decoder.pending, sizeof(pc->decoder.pending));
  pc->decoder.buffered = 0;
}
static int fail_at(PeerConnection *pc, const char *site, int line) {
  LOGE("peer failure site=%s:%d state=%d consent_age_ms=%lu revoked=%d "
       "dtls=%d sctp_failed=%d udp_errno=%d udp_errors=%lu",
       site, line, pc->state,
       (unsigned long)(ports_get_epoch_time() - pc->agent.last_consent),
       pc->agent.consent_revoked, pc->dtls.state, pc->sctp.failed,
       pc->agent.udp_sockets[0].last_send_errno,
       (unsigned long)pc->agent.udp_sockets[0].send_errors);
  release(pc);
  transition(pc, PEER_CONNECTION_FAILED);
  return -1;
}
#define fail(pc) fail_at(pc, __func__, __LINE__)

static int recv_dtls(void *ctx, unsigned char *buf, size_t capacity) {
  DtlsSrtp *d = ctx;
  PeerConnection *pc = d->user_data;
  int n = pc->packet_size;
  pc->packet_size = 0;
  if (n <= 0 && pc->state == PEER_CONNECTION_CHECKING)
    n = agent_recv(&pc->agent, pc->packet, sizeof(pc->packet));
  if (n < 13 || (size_t)n > capacity || !dtls_srtp_probe(pc->packet))
    return MBEDTLS_ERR_SSL_WANT_READ;
  memcpy(buf, pc->packet, (size_t)n);
  return n;
}
static int send_dtls(void *ctx, const unsigned char *buf, size_t size) {
  DtlsSrtp *d = ctx;
  PeerConnection *pc = d->user_data;
  if (!buf || !size || size > STUN_ATTR_BUF_SIZE ||
      !agent_has_consent(&pc->agent))
    return -1;
  int sent = agent_send(&pc->agent, buf, (int)size);
  /* This is an unreliable datagram BIO: local queue pressure can drop the
     packet just like network loss. DTLS handshake flights and SCTP retain
     their own retransmission state. Complete this BIO write (no pending SSL
     buffer/retry contract), while preserving the socket's error counters.
     Other errors remain fatal; RTP sends still return the actual failure. */
  if (sent < 0 && agent_has_consent(&pc->agent) &&
      udp_socket_send_would_block(&pc->agent.udp_sockets[0]))
    return (int)size;
  return sent;
}
static void send_rtp(uint8_t *packet, size_t size, void *ctx) {
  PeerConnection *pc = ctx;
  int n = (int)size;
  pc->audio_send_result = -1;
  if (!dtls_srtp_encrypt_rtp_packet(&pc->dtls, packet, &n))
    pc->audio_send_result = agent_send(&pc->agent, packet, n) == n ? 0 : -1;
}
PeerConnection *peer_connection_create(PeerConfiguration *config) {
  if (!peer_runtime_ready() || !config ||
      (config->audio_codec != CODEC_NONE &&
       config->audio_codec != CODEC_OPUS) ||
      config->video_codec != CODEC_NONE ||
      (config->datachannel != DATA_CHANNEL_NONE &&
       config->datachannel != DATA_CHANNEL_STRING &&
       config->datachannel != DATA_CHANNEL_BINARY) ||
      (!config->audio_codec && !config->datachannel))
    return NULL;
  for (size_t i = 0; i < 5; ++i) {
    char hostname[128];
    uint16_t port;
    if (config->ice_servers[i].urls &&
        agent_parse_stun_url(config->ice_servers[i].urls, hostname, &port))
      return NULL;
  }
  PeerConnection *pc = calloc(1, sizeof(*pc));
  if (!pc)
    return NULL;
  pc->config = *config;
  for (size_t i = 0; i < 5; ++i) {
    if (config->ice_servers[i].urls) {
      strcpy(pc->stun_urls[i], config->ice_servers[i].urls);
      pc->config.ice_servers[i].urls = pc->stun_urls[i];
    }
    pc->config.ice_servers[i].username = pc->config.ice_servers[i].credential =
        NULL;
  }
  pc->config.local_address = NULL;
  if (agent_create(&pc->agent)) {
    free(pc);
    return NULL;
  }
  if (config->local_address) {
    if (!addr_from_string(config->local_address, &pc->agent.host_addr) ||
        pc->agent.host_addr.family != AF_INET)
      goto bad;
    udp_socket_close(&pc->agent.udp_sockets[0]);
    if (udp_socket_open_on(&pc->agent.udp_sockets[0], AF_INET, 0,
                           config->local_address))
      goto bad;
  }
  if (config->audio_codec) {
    rtp_encoder_init(&pc->encoder, config->audio_codec, send_rtp, pc);
    if (!pc->encoder.ssrc)
      goto bad;
    rtp_decoder_init(&pc->decoder, config->audio_codec, config->onaudiotrack,
                     config->user_data);
  }
  pc->sctp.userdata = config->user_data;
  peer_runtime_add();
  return pc;
bad:
  release(pc);
  free(pc);
  return NULL;
}
void peer_connection_close(PeerConnection *pc) {
  if (!pc || pc->state == PEER_CONNECTION_CLOSED)
    return;
  release(pc);
  transition(pc, PEER_CONNECTION_CLOSED);
}
void peer_connection_destroy(PeerConnection *pc) {
  if (!pc)
    return;
  release(pc);
  mbedtls_platform_zeroize(pc, sizeof(*pc));
  free(pc);
  peer_runtime_remove();
}
PeerConnectionState peer_connection_get_state(PeerConnection *pc) {
  return pc ? pc->state : PEER_CONNECTION_FAILED;
}
const char *peer_connection_state_to_string(PeerConnectionState state) {
  static const char *names[] = {"new",          "checking", "connected",
                                "disconnected", "failed",   "closed"};
  return state >= 0 && state <= PEER_CONNECTION_CLOSED ? names[state]
                                                       : "unknown";
}
void peer_connection_get_stats(PeerConnection *pc, PeerConnectionStats *stats) {
  if (pc && stats) {
    pc->stats.rtp_late_dropped = pc->decoder.late_dropped;
    pc->stats.rtp_buffer_dropped = pc->decoder.overflow_dropped;
    pc->stats.rtp_playout_gaps = pc->decoder.skipped;
    *stats = pc->stats;
  }
}
void *peer_connection_get_sctp(PeerConnection *pc) {
  return pc ? &pc->sctp : NULL;
}
const char *peer_connection_create_offer(PeerConnection *pc) {
  if (!pc || pc->state != PEER_CONNECTION_NEW)
    return NULL;
  if (pc->offered)
    return pc->sdp;
  if (dtls_srtp_init(&pc->dtls, DTLS_SRTP_ROLE_SERVER, pc)) {
    fail(pc);
    return NULL;
  }
  pc->dtls.udp_recv = recv_dtls;
  pc->dtls.udp_send = send_dtls;
  agent_create_ice_credential(&pc->agent);
  if (!pc->agent.local_ufrag[0] || !pc->agent.local_upwd[0]) {
    fail(pc);
    return NULL;
  }
  pc->agent.mode = AGENT_MODE_CONTROLLING;
  agent_gather_candidate(&pc->agent, NULL, NULL, NULL);
  for (size_t i = 0; i < 5; ++i)
    if (pc->config.ice_servers[i].urls)
      agent_gather_candidate(&pc->agent, pc->config.ice_servers[i].urls, NULL,
                             NULL);
  char candidates[2048];
  agent_get_local_description(&pc->agent, candidates, sizeof(candidates));
  char *scratch = malloc(PEER_SDP_LIMIT);
  int result = !scratch || !candidates[0] ||
               peer_sdp_offer(scratch, PEER_SDP_LIMIT, pc->agent.local_ufrag,
                              pc->agent.local_upwd, pc->dtls.local_fingerprint,
                              pc->encoder.ssrc, !!pc->config.audio_codec,
                              !!pc->config.datachannel, candidates);
  if (!result) {
    size_t size = strlen(scratch) + 1;
    pc->sdp = malloc(size);
    if (pc->sdp) {
      memcpy(pc->sdp, scratch, size);
      pc->sdp_size = size;
    } else
      result = -1;
  }
  if (scratch) {
    // A shrinking realloc could release an unwiped copy of ICE credentials.
    mbedtls_platform_zeroize(scratch, PEER_SDP_LIMIT);
    free(scratch);
  }
  if (result) {
    fail(pc);
    return NULL;
  }
  pc->offered = 1;
  if (pc->onoffer)
    pc->onoffer(pc->sdp, pc->config.user_data);
  return pc->sdp;
}
/* The initial bounded API is an offerer. Renegotiation/restarts require a new
 * peer. */
const char *peer_connection_create_answer(PeerConnection *pc) {
  (void)pc;
  return NULL;
}
void peer_connection_set_local_description(PeerConnection *pc, const char *sdp,
                                           SdpType type) {
  if (!sdp && type == SDP_TYPE_OFFER)
    peer_connection_create_offer(pc);
}
int peer_connection_set_remote_description_n(PeerConnection *pc,
                                             const char *sdp, size_t size,
                                             SdpType type) {
  if (!pc || !pc->offered || pc->remote_set ||
      pc->state != PEER_CONNECTION_NEW || type != SDP_TYPE_ANSWER)
    return -1;
  PeerSdp remote;
  if (peer_sdp_parse(sdp, size, &remote) || remote.setup == 3 ||
      remote.audio != !!pc->config.audio_codec ||
      remote.data != !!pc->config.datachannel ||
      (remote.audio && strcmp(remote.audio_mid, "audio")) ||
      (remote.data && strcmp(remote.data_mid, "data"))) {
    mbedtls_platform_zeroize(&remote, sizeof(remote));
    return -1;
  }
  if (dtls_srtp_set_role(&pc->dtls, remote.setup == 1
                                        ? DTLS_SRTP_ROLE_SERVER
                                        : DTLS_SRTP_ROLE_CLIENT)) {
    mbedtls_platform_zeroize(&remote, sizeof(remote));
    return fail(pc);
  }
  memcpy(pc->remote.fingerprint, remote.fingerprint,
         sizeof(remote.fingerprint));
  pc->remote.ssrc = remote.ssrc;
  memcpy(pc->agent.remote_ufrag, remote.ufrag, sizeof(remote.ufrag));
  memcpy(pc->agent.remote_upwd, remote.password, sizeof(remote.password));
  pc->agent.remote_candidates_count = (int)remote.candidate_count;
  memcpy(pc->agent.remote_candidates, remote.candidates,
         remote.candidate_count * sizeof(IceCandidate));
  pc->sctp.remote_port = remote.sctp_port;
  pc->sctp.remote_max_message = remote.max_message_size;
  mbedtls_platform_zeroize(&remote, sizeof(remote));
  agent_update_candidate_pairs(&pc->agent);
  pc->remote_set = 1;
  pc->check_started = ports_get_epoch_time();
  transition(pc, PEER_CONNECTION_CHECKING);
  return 0;
}
int peer_connection_set_remote_description(PeerConnection *pc, const char *sdp,
                                           SdpType type) {
  return sdp ? peer_connection_set_remote_description_n(
                   pc, sdp, strnlen(sdp, PEER_SDP_LIMIT), type)
             : -1;
}
int peer_connection_add_ice_candidate(PeerConnection *pc, char *candidate) {
  (void)pc;
  (void)candidate;
  return -1;
}
static int read_dtls(PeerConnection *pc) {
  /* Bound work per poll, but preserve Mbed TLS's buffered records and any
     not-yet-consumed datagram for the next poll, even when UDP is idle. */
  for (int i = 0; i < 4; ++i) {
    int result = dtls_srtp_read(&pc->dtls, pc->plain, sizeof(pc->plain));
    if (result == MBEDTLS_ERR_SSL_WANT_READ ||
        result == MBEDTLS_ERR_SSL_WANT_WRITE)
      break;
    if (result <= 0) {
      ++pc->stats.dtls_failures;
      return fail(pc);
    }
    if (pc->config.datachannel)
      sctp_incoming_data(&pc->sctp, (char *)pc->plain, (size_t)result);
    if (pc->sctp.failed || pc->dtls.state == DTLS_SRTP_STATE_FAILED)
      return fail(pc);
  }
  return 0;
}
int peer_connection_loop(PeerConnection *pc) {
  if (!pc || pc->state == PEER_CONNECTION_FAILED)
    return -1;
  if (pc->state == PEER_CONNECTION_CONNECTED &&
      (!agent_has_consent(&pc->agent) || pc->sctp.failed ||
       pc->dtls.state == DTLS_SRTP_STATE_FAILED))
    return fail(pc);
  sctp_tick();
  if (pc->state == PEER_CONNECTION_CHECKING) {
    if ((uint32_t)(ports_get_epoch_time() - pc->check_started) > 20000)
      return fail(pc);
    if (!pc->agent.selected_pair) {
      if (agent_connectivity_check(&pc->agent))
        return fail(pc);
      pc->stats.ice_connected = pc->agent.selected_pair != NULL;
    } else {
      if (dtls_srtp_handshake(&pc->dtls, &pc->agent.selected_pair->remote->addr,
                              pc->remote.fingerprint)) {
        ++pc->stats.dtls_failures;
        return fail(pc);
      }
      if (pc->dtls.state == DTLS_SRTP_STATE_CONNECTED) {
        if (pc->config.datachannel &&
            sctp_create_association(&pc->sctp, &pc->dtls))
          return fail(pc);
        transition(pc, PEER_CONNECTION_CONNECTED);
      }
    }
  } else if (pc->state == PEER_CONNECTION_CONNECTED) {
    uint32_t now = ports_get_epoch_time();
    if (pc->sctp.failed || pc->dtls.state == DTLS_SRTP_STATE_FAILED)
      return fail(pc);
    // Expire reorder gaps even when the next UDP packet never arrives or
    // buffered DTLS records occupy this poll.
    rtp_decoder_flush(&pc->decoder, now);
    if ((uint32_t)(now - pc->agent.binding_request_sent_time) >=
            pc->agent.consent_interval &&
        agent_send_binding_request(&pc->agent) < 0)
      return fail(pc);
    if (pc->packet_size || mbedtls_ssl_check_pending(&pc->dtls.ssl))
      return read_dtls(pc);
    int n = agent_recv(&pc->agent, pc->packet, sizeof(pc->packet));
    if (n < 0)
      return fail(pc);
    if (n < 1)
      return 0;
    if (rtcp_probe(pc->packet, (size_t)n)) {
      uint32_t ssrc = n >= 8 ? wire_u32(pc->packet + 4) : 0;
      /* RTCP cannot select the audio source: a report sender need not be the
         RTP sender. Wait for SDP or valid authenticated RTP to bind it. */
      if (!pc->config.audio_codec || !ssrc || ssrc != pc->remote.ssrc ||
          dtls_srtp_decrypt_rtcp_packet(&pc->dtls, pc->packet, &n))
        ++pc->stats.rejected_rtcp;
      else {
        if (rtcp_validate(pc->packet, (size_t)n))
          ++pc->stats.rejected_rtcp;
        else
          ++pc->stats.accepted_rtcp;
      }
    } else if (dtls_srtp_probe(pc->packet)) {
      pc->packet_size = n;
      return read_dtls(pc);
    } else if (rtp_packet_validate(pc->packet, (size_t)n) &&
               pc->config.audio_codec) {
      uint32_t ssrc = rtp_get_ssrc(pc->packet);
      if (!ssrc || (pc->packet[1] & 127) != pc->decoder.type ||
          (pc->remote.ssrc && pc->remote.ssrc != ssrc) ||
          dtls_srtp_decrypt_rtp_packet(&pc->dtls, pc->packet, &n))
        ++pc->stats.rejected_rtp;
      else {
        size_t offset, length;
        if (rtp_payload(pc->packet, (size_t)n, &offset, &length)) {
          /* libSRTP clones a wildcard stream on successful authentication.
             Invalid first packets must neither pin the source nor retain a
             stream for every attacker-chosen SSRC. Keep an established
             stream's replay state intact. */
          if (!pc->remote.ssrc &&
              srtp_remove_stream(pc->dtls.srtp_in, htonl(ssrc)))
            return fail(pc);
          ++pc->stats.rejected_rtp;
          return 0;
        }
        pc->remote.ssrc = ssrc;
        if (rtp_decoder_push(&pc->decoder, pc->packet, (size_t)n, now) < 0)
          ++pc->stats.rejected_rtp;
        else {
          uint16_t seq = wire_u16(pc->packet + 2);
          if (pc->have_rtp_sequence) {
            uint16_t delta = seq - pc->last_rtp_sequence;
            if (delta >= 0x8000)
              ++pc->stats.rtp_reordered;
            else if (delta > 1)
              pc->stats.rtp_sequence_gaps += delta - 1;
            uint32_t gap = now - pc->last_rtp_ms;
            if (gap > pc->stats.rtp_max_gap_ms)
              pc->stats.rtp_max_gap_ms = gap;
            if (delta && delta < 0x8000)
              pc->last_rtp_sequence = seq;
          } else
            pc->last_rtp_sequence = seq;
          pc->have_rtp_sequence = 1;
          pc->last_rtp_ms = now;
          ++pc->stats.accepted_rtp;
        }
      }
    }
  }
  return 0;
}
static int send_audio(PeerConnection *pc, const uint8_t *packet, size_t size,
                      const uint32_t *capture_timestamp) {
  if (!pc || pc->state != PEER_CONNECTION_CONNECTED || !pc->config.audio_codec)
    return -1;
  if (!agent_has_consent(&pc->agent) || pc->sctp.failed ||
      pc->dtls.state != DTLS_SRTP_STATE_CONNECTED)
    return -1;
  if (capture_timestamp ? rtp_encoder_encode_at(&pc->encoder, packet, size,
                                                *capture_timestamp)
                        : rtp_encoder_encode(&pc->encoder, packet, size))
    return -1;
  return pc->audio_send_result;
}
int peer_connection_send_audio(PeerConnection *pc, const uint8_t *packet,
                               size_t size) {
  return send_audio(pc, packet, size, NULL);
}
int peer_connection_send_audio_at(PeerConnection *pc, const uint8_t *packet,
                                  size_t size, uint32_t capture_timestamp) {
  return send_audio(pc, packet, size, &capture_timestamp);
}
int peer_connection_send_video(PeerConnection *pc, const uint8_t *packet,
                               size_t size) {
  (void)pc;
  (void)packet;
  (void)size;
  return -1;
}
int peer_connection_datachannel_send_sid(PeerConnection *pc, char *message,
                                         size_t size, uint16_t sid) {
  if (!pc || pc->state != PEER_CONNECTION_CONNECTED ||
      !agent_has_consent(&pc->agent))
    return -1;
  return sctp_outgoing_data(
      &pc->sctp, message, size,
      pc->config.datachannel == DATA_CHANNEL_STRING ? PPID_STRING : PPID_BINARY,
      sid);
}
int peer_connection_datachannel_send(PeerConnection *pc, char *message,
                                     size_t size) {
  if (pc)
    for (int i = 0; i < pc->sctp.stream_count; ++i)
      if (pc->sctp.stream_table[i].state == 2)
        return peer_connection_datachannel_send_sid(
            pc, message, size, pc->sctp.stream_table[i].sid);
  return -1;
}
int peer_connection_create_datachannel_sid(PeerConnection *pc,
                                           DecpChannelType type,
                                           uint16_t priority,
                                           uint32_t reliability, char *label,
                                           char *protocol, uint16_t sid) {
  if (!pc || pc->state != PEER_CONNECTION_CONNECTED ||
      !agent_has_consent(&pc->agent) || type != DATA_CHANNEL_RELIABLE ||
      priority || reliability)
    return -1;
  return sctp_open_channel(&pc->sctp, label, protocol, sid);
}
int peer_connection_create_datachannel(PeerConnection *pc, DecpChannelType type,
                                       uint16_t priority, uint32_t reliability,
                                       char *label, char *protocol) {
  if (!pc)
    return -1;
  uint16_t sid = pc->dtls.role == DTLS_SRTP_ROLE_CLIENT ? 0 : 1;
  for (; sid < SCTP_STREAM_LIMIT; sid += 2)
    if (!peer_connection_lookup_sid_label(pc, sid))
      return peer_connection_create_datachannel_sid(
          pc, type, priority, reliability, label, protocol, sid);
  return -1;
}
int peer_connection_lookup_sid(PeerConnection *pc, const char *label,
                               uint16_t *sid) {
  if (!pc || !label || !sid)
    return -1;
  for (int i = 0; i < pc->sctp.stream_count; ++i)
    if (!strcmp(pc->sctp.stream_table[i].label, label)) {
      *sid = pc->sctp.stream_table[i].sid;
      return 0;
    }
  return -1;
}
char *peer_connection_lookup_sid_label(PeerConnection *pc, uint16_t sid) {
  if (pc)
    for (int i = 0; i < pc->sctp.stream_count; ++i)
      if (pc->sctp.stream_table[i].sid == sid)
        return pc->sctp.stream_table[i].label;
  return NULL;
}
void peer_connection_onicecandidate(PeerConnection *pc,
                                    void (*cb)(char *, void *)) {
  if (pc)
    pc->onoffer = cb;
}
void peer_connection_oniceconnectionstatechange(PeerConnection *pc,
                                                void (*cb)(PeerConnectionState,
                                                           void *)) {
  if (pc)
    pc->onstate = cb;
}
void peer_connection_on_receiver_packet_loss(PeerConnection *pc,
                                             void (*cb)(float, uint32_t,
                                                        void *)) {
  if (pc)
    pc->onloss = cb;
}
void peer_connection_ondatachannel(
    PeerConnection *pc, void (*message)(char *, size_t, void *, uint16_t),
    void (*open)(void *), void (*close)(void *)) {
  if (pc) {
    pc->sctp.onmessage = message;
    pc->sctp.onopen = open;
    pc->sctp.onclose = close;
  }
}
