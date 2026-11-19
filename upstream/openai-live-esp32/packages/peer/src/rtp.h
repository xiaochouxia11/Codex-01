#ifndef RTP_H_
#define RTP_H_

#include <stdint.h>

#include "config.h"
#include "peer_connection.h"

typedef enum { PT_OPUS = 111 } RtpPayloadType;

typedef struct RtpEncoder RtpEncoder;
typedef struct RtpDecoder RtpDecoder;
typedef void (*RtpOnPacket)(uint8_t *packet, size_t bytes, void *user_data);

#define RTP_REORDER_CAPACITY 8
#define RTP_REORDER_WAIT_MS 40
#define RTP_RECEIVE_MAX_BYTES 1536
typedef struct {
  uint8_t packet[RTP_RECEIVE_MAX_BYTES];
  size_t size;
  uint32_t arrived_ms;
  uint16_t sequence;
} RtpPending;

struct RtpDecoder {
  RtpPayloadType type;
  RtpOnPacket on_packet;
  int (*decode_func)(RtpDecoder *rtp_decoder, uint8_t *data, size_t size);
  void *user_data;
  RtpPending pending[RTP_REORDER_CAPACITY];
  uint16_t expected_sequence;
  unsigned buffered;
  int started;
  uint32_t late_dropped, overflow_dropped, skipped;
};

struct RtpEncoder {
  RtpPayloadType type;
  RtpOnPacket on_packet;
  int (*encode_func)(RtpEncoder *rtp_encoder, uint8_t *data, size_t size);
  void *user_data;
  uint16_t seq_number;
  uint32_t ssrc;
  uint32_t timestamp;
  uint32_t timestamp_increment;
  uint32_t last_capture_timestamp;
  int timestamp_mode; /* 0: unset, 1: implicit 20 ms, 2: capture clock. */
  uint8_t buf[CONFIG_MTU + 128];
};

int rtp_packet_validate(uint8_t *packet, size_t size);
int rtp_payload(const uint8_t *, size_t, size_t *, size_t *);

void rtp_encoder_init(RtpEncoder *rtp_encoder, MediaCodec codec,
                      RtpOnPacket on_packet, void *user_data);

int rtp_encoder_encode(RtpEncoder *rtp_encoder, const uint8_t *data,
                       size_t size);
int rtp_encoder_encode_at(RtpEncoder *, const uint8_t *, size_t,
                          uint32_t capture_timestamp);

void rtp_decoder_init(RtpDecoder *rtp_decoder, MediaCodec codec,
                      RtpOnPacket on_packet, void *user_data);

int rtp_decoder_decode(RtpDecoder *rtp_decoder, const uint8_t *data,
                       size_t size);

/* Call only after SRTP authentication. 0: accepted, 1: late/duplicate/full,
 * -1: invalid. Flush on every owner poll, including when UDP is idle. */
int rtp_decoder_push(RtpDecoder *, const uint8_t *, size_t, uint32_t now_ms);
void rtp_decoder_flush(RtpDecoder *, uint32_t now_ms);

uint32_t rtp_get_ssrc(uint8_t *packet);

#endif // RTP_H_
