/**
 * @file peer_connection.h
 * @brief Experimental, bounded WebRTC offerer for Opus and ordered data
 * channels.
 *
 * Call peer_init first. All peers and APIs, including callbacks and global
 * initialization, must use one owner thread. Poll peer_connection_loop
 * frequently (e.g. every 1-5 ms). Do not recursively poll or close/destroy a
 * peer inside a callback; enqueue those operations until the current API call
 * has returned. Sending from callbacks is supported. Callback buffers are
 * borrowed for the callback duration and are not NUL terminated. Copy anything
 * you retain.
 *
 * Configuration strings are copied/consumed at creation; user_data remains
 * application owned and must outlive the peer. SDP from create_offer is owned
 * by the peer until close/destruction. Remote SDP is copied and must come from
 * an authenticated, integrity-protected signaling channel. Network input limits
 * and unsupported features are documented in README.md.
 *
 * This is not a drop-in replacement for the complete upstream libpeer API.
 * Legacy enums/functions below are retained for migration: unsupported codecs,
 * video, TURN, trickle ICE, answer generation, and renegotiation fail
 * explicitly. The packet-loss callback is reserved and is not dispatched in
 * this version.
 */
#ifndef PEER_CONNECTION_H_
#define PEER_CONNECTION_H_

#include <stdint.h>
#include <stdlib.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef enum SdpType {
  SDP_TYPE_OFFER = 0,
  SDP_TYPE_ANSWER,
} SdpType;

typedef enum PeerConnectionState {
  PEER_CONNECTION_NEW,
  PEER_CONNECTION_CHECKING,
  PEER_CONNECTION_CONNECTED,
  PEER_CONNECTION_DISCONNECTED,
  PEER_CONNECTION_FAILED,
  PEER_CONNECTION_CLOSED,
} PeerConnectionState;

typedef enum DataChannelType {

  DATA_CHANNEL_NONE = 0,
  DATA_CHANNEL_STRING,
  DATA_CHANNEL_BINARY,

} DataChannelType;

typedef enum DecpChannelType {
  DATA_CHANNEL_RELIABLE = 0x00,
  DATA_CHANNEL_RELIABLE_UNORDERED = 0x80,
  DATA_CHANNEL_PARTIAL_RELIABLE_REXMIT = 0x01,
  DATA_CHANNEL_PARTIAL_RELIABLE_REXMIT_UNORDERED = 0x81,
  DATA_CHANNEL_PARTIAL_RELIABLE_TIMED = 0x02,
  DATA_CHANNEL_PARTIAL_RELIABLE_TIMED_UNORDERED = 0x82,
} DecpChannelType;

typedef enum MediaCodec {

  CODEC_NONE = 0,

  /* Video */
  CODEC_H264,
  CODEC_VP8,   // not implemented yet
  CODEC_MJPEG, // not implemented yet

  /* Audio */
  CODEC_OPUS, // 20 ms pre-encoded packets, 48 kHz RTP clock
  CODEC_PCMA,
  CODEC_PCMU,

} MediaCodec;

typedef struct IceServer {
  const char *urls;
  const char *username;
  const char *credential;

} IceServer;

typedef struct PeerConfiguration {
  IceServer ice_servers[5];
  const char *local_address; /* Optional numeric IPv4 bind address. */

  MediaCodec audio_codec;
  MediaCodec video_codec;
  DataChannelType datachannel;

  void (*onaudiotrack)(uint8_t *data, size_t size, void *userdata);
  void (*onvideotrack)(uint8_t *data, size_t size, void *userdata);
  void (*on_request_keyframe)(void *userdata);
  void *user_data;

} PeerConfiguration;

typedef struct PeerConnection PeerConnection;
typedef struct PeerConnectionStats {
  uint64_t accepted_rtp, rejected_rtp, accepted_rtcp, rejected_rtcp,
      dtls_failures;
  /* Sequence gaps observed on arrival can later be filled by reordering. */
  uint32_t rtp_sequence_gaps, rtp_reordered, rtp_max_gap_ms;
  /* Authenticated packets dropped after playout advanced, at buffer capacity,
   * and sequence numbers skipped after the 40 ms reorder deadline. */
  uint32_t rtp_late_dropped, rtp_buffer_dropped, rtp_playout_gaps;
  int ice_connected;
} PeerConnectionStats;
void peer_connection_get_stats(PeerConnection *, PeerConnectionStats *);
int peer_connection_set_remote_description_n(PeerConnection *, const char *,
                                             size_t, SdpType);

const char *peer_connection_state_to_string(PeerConnectionState state);

PeerConnectionState peer_connection_get_state(PeerConnection *pc);

void *peer_connection_get_sctp(PeerConnection *pc);

PeerConnection *peer_connection_create(PeerConfiguration *config);

/* Releases all resources. Every created peer must eventually be destroyed. */
void peer_connection_destroy(PeerConnection *pc);

void peer_connection_close(PeerConnection *pc);

/* Nonblocking UDP polling; the application schedules waits between calls.
 * Returns -1 on terminal failure and subsequent polls of a failed peer; the
 * state callback reports the transition once. A closed peer returns zero.
 */
int peer_connection_loop(PeerConnection *pc);

int peer_connection_create_datachannel(PeerConnection *pc,
                                       DecpChannelType channel_type,
                                       uint16_t priority,
                                       uint32_t reliability_parameter,
                                       char *label, char *protocol);

int peer_connection_create_datachannel_sid(
    PeerConnection *pc, DecpChannelType channel_type, uint16_t priority,
    uint32_t reliability_parameter, char *label, char *protocol, uint16_t sid);

/**
 * @brief Send to the first open data channel (use _sid when selecting a
 * channel).
 * @param[in] peer connection
 * @param[in] message buffer
 * @param[in] length of message
 */
int peer_connection_datachannel_send(PeerConnection *pc, char *message,
                                     size_t len);

int peer_connection_datachannel_send_sid(PeerConnection *pc, char *message,
                                         size_t len, uint16_t sid);

int peer_connection_send_audio(PeerConnection *pc, const uint8_t *packet,
                               size_t bytes);

/* Send a 20 ms Opus frame with its capture timestamp in 48 kHz sample units,
 * independent of encoder sample rate. Preserve gaps for captured frames dropped
 * before sending. The first value maps to a random RTP timestamp; later values
 * must advance by >=960 and <2^31 ticks, modulo 2^32. Do not mix the implicit
 * and explicit timestamp APIs within one peer. Invalid frames do not consume
 * time; an attempted network send does, even when transmission fails. */
int peer_connection_send_audio_at(PeerConnection *, const uint8_t *, size_t,
                                  uint32_t capture_timestamp);

int peer_connection_send_video(PeerConnection *pc, const uint8_t *packet,
                               size_t bytes);

int peer_connection_set_remote_description(PeerConnection *pc, const char *sdp,
                                           SdpType sdp_type);

void peer_connection_set_local_description(PeerConnection *pc, const char *sdp,
                                           SdpType sdp_type);

const char *peer_connection_create_offer(PeerConnection *pc);

const char *peer_connection_create_answer(PeerConnection *pc);

/**
 * @brief register callback function to handle packet loss from RTCP receiver
 * report
 * @param[in] peer connection
 * @param[in] callback function void (*cb)(float fraction_loss, uint32_t
 * total_loss, void *userdata)
 * @param[in] userdata for callback function
 */
void peer_connection_on_receiver_packet_loss(
    PeerConnection *pc,
    void (*on_receiver_packet_loss)(float fraction_loss, uint32_t total_loss,
                                    void *userdata));

/**
 * @brief Set the callback function to handle onicecandidate event.
 * @param A PeerConnection.
 * @param A callback function to handle onicecandidate event.
 * @param A userdata which is pass to callback function.
 */
void peer_connection_onicecandidate(PeerConnection *pc,
                                    void (*onicecandidate)(char *sdp_text,
                                                           void *userdata));

/**
 * @brief Set the callback function to handle oniceconnectionstatechange event.
 * @param A PeerConnection.
 * @param A callback function to handle oniceconnectionstatechange event.
 * @param A userdata which is pass to callback function.
 */
void peer_connection_oniceconnectionstatechange(
    PeerConnection *pc,
    void (*oniceconnectionstatechange)(PeerConnectionState state,
                                       void *userdata));

/**
 * @brief register callback function to handle event of datachannel
 * @param[in] peer connection
 * @param[in] callback function when message received
 * @param[in] callback function when connection is opened
 * @param[in] callback function when connection is closed
 */
void peer_connection_ondatachannel(
    PeerConnection *pc,
    void (*onmessage)(char *msg, size_t len, void *userdata, uint16_t sid),
    void (*onopen)(void *userdata), void (*onclose)(void *userdata));

int peer_connection_lookup_sid(PeerConnection *pc, const char *label,
                               uint16_t *sid);

char *peer_connection_lookup_sid_label(PeerConnection *pc, uint16_t sid);

/**
 * @brief adds a new remote candidate to the peer connection
 * @param[in] peer connection
 * @param[in] ice candidate
 */
int peer_connection_add_ice_candidate(PeerConnection *pc, char *ice_candidate);

#ifdef __cplusplus
}
#endif

#endif // PEER_CONNECTION_H_
