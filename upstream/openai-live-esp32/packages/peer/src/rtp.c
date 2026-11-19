/* Audio-only RTP framing. Video depacketizers are deliberately not included. */
#include "rtp.h"
#include "utils.h"
#include "wire.h"
#include <string.h>

int rtp_packet_validate(uint8_t *p, size_t n) {
  return p && n >= 12 && (p[0] >> 6) == 2 &&
         ((p[1] & 127) < 64 || (p[1] & 127) >= 96);
}
uint32_t rtp_get_ssrc(uint8_t *p) { return wire_u32(p + 8); }
int rtp_payload(const uint8_t *p, size_t n, size_t *offset, size_t *length) {
  if (!rtp_packet_validate((uint8_t *)p, n))
    return -1;
  size_t start = 12 + 4 * (size_t)(p[0] & 15);
  if (start > n)
    return -1;
  if (p[0] & 16) {
    if (n - start < 4)
      return -1;
    size_t ext = 4 + 4 * (size_t)wire_u16(p + start + 2);
    if (ext > n - start)
      return -1;
    start += ext;
  }
  size_t end = n;
  if (p[0] & 32) {
    size_t pad = p[n - 1];
    if (!pad || pad > n - start)
      return -1;
    end -= pad;
  }
  *offset = start;
  *length = end - start;
  return 0;
}
static int valid_frame(RtpEncoder *e, const uint8_t *data, size_t size) {
  return e && e->on_packet && e->ssrc && data && size &&
         size <= CONFIG_MTU - 12 - 32;
}
static int encode(RtpEncoder *e, uint8_t *data, size_t size) {
  if (!valid_frame(e, data, size))
    return -1;
  uint8_t *p = e->buf;
  p[0] = 0x80;
  p[1] = (uint8_t)e->type;
  wire_put16(p + 2, e->seq_number++);
  wire_put32(p + 4, e->timestamp);
  wire_put32(p + 8, e->ssrc);
  e->timestamp += e->timestamp_increment;
  memcpy(p + 12, data, size);
  e->on_packet(p, size + 12, e->user_data);
  return 0;
}
void rtp_encoder_init(RtpEncoder *e, MediaCodec codec, RtpOnPacket cb,
                      void *ctx) {
  memset(e, 0, sizeof(*e));
  if (codec != CODEC_OPUS)
    return;
  e->on_packet = cb;
  e->user_data = ctx;
  e->type = PT_OPUS;
  e->encode_func = encode;
  uint8_t random[10];
  if (utils_random_bytes(random, sizeof(random)))
    return;
  e->ssrc = wire_u32(random);
  if (!e->ssrc)
    e->ssrc = 1;
  /* Leave startup headroom before the first SRTP ROC increment. If the first
     packets are lost across that increment, a new receiver assumes ROC 0
     and cannot authenticate the stream. Keep the initial sequence random. */
  e->seq_number = wire_u16(random + 4) & 0x7fff;
  e->timestamp = wire_u32(random + 6);
  e->timestamp_increment = 960;
}
int rtp_encoder_encode(RtpEncoder *e, const uint8_t *data, size_t size) {
  if (!valid_frame(e, data, size) || !e->encode_func || e->timestamp_mode == 2)
    return -1;
  e->timestamp_mode = 1;
  return e->encode_func(e, (uint8_t *)data, size);
}
int rtp_encoder_encode_at(RtpEncoder *e, const uint8_t *data, size_t size,
                          uint32_t capture_timestamp) {
  if (!valid_frame(e, data, size) || !e->encode_func || e->timestamp_mode == 1)
    return -1;
  if (e->timestamp_mode == 2) {
    uint32_t elapsed = capture_timestamp - e->last_capture_timestamp;
    if (elapsed < e->timestamp_increment || elapsed >= UINT32_C(0x80000000))
      return -1;
    // timestamp already points one frame past the previous send. Preserve
    // missing capture frames without introducing nonexistent RTP packets.
    e->timestamp += elapsed - e->timestamp_increment;
  }
  e->timestamp_mode = 2;
  e->last_capture_timestamp = capture_timestamp;
  return e->encode_func(e, (uint8_t *)data, size);
}
static int decode(RtpDecoder *d, uint8_t *p, size_t n) {
  size_t offset, length;
  if ((p[1] & 127) != d->type || rtp_payload(p, n, &offset, &length))
    return -1;
  if (length && d->on_packet)
    d->on_packet(p + offset, length, d->user_data);
  return 0;
}
void rtp_decoder_init(RtpDecoder *d, MediaCodec codec, RtpOnPacket cb,
                      void *ctx) {
  memset(d, 0, sizeof(*d));
  if (codec != CODEC_OPUS)
    return;
  d->type = PT_OPUS;
  d->on_packet = cb;
  d->user_data = ctx;
  d->decode_func = decode;
}
int rtp_decoder_decode(RtpDecoder *d, const uint8_t *data, size_t size) {
  return d && d->decode_func && data && size >= 12
             ? d->decode_func(d, (uint8_t *)data, size)
             : -1;
}

void rtp_decoder_flush(RtpDecoder *d, uint32_t now_ms) {
  if (!d || !d->started)
    return;
  for (unsigned work = 0; work < RTP_REORDER_CAPACITY && d->buffered; ++work) {
    RtpPending *next = NULL;
    uint16_t distance = UINT16_MAX;
    uint32_t oldest_age = 0;
    for (unsigned i = 0; i < RTP_REORDER_CAPACITY; ++i) {
      RtpPending *p = &d->pending[i];
      if (!p->size)
        continue;
      uint16_t delta = p->sequence - d->expected_sequence;
      if (delta < distance) {
        next = p;
        distance = delta;
      }
      uint32_t age = now_ms - p->arrived_ms;
      if (age > oldest_age)
        oldest_age = age;
    }
    if (!next || (distance && oldest_age < RTP_REORDER_WAIT_MS))
      return;
    d->skipped += distance;
    d->expected_sequence = next->sequence + 1;
    --d->buffered;
    rtp_decoder_decode(d, next->packet, next->size);
    memset(next, 0, sizeof(*next));
  }
}

int rtp_decoder_push(RtpDecoder *d, const uint8_t *packet, size_t size,
                     uint32_t now_ms) {
  size_t offset, length;
  if (!d || !d->decode_func || !packet || size < 12 ||
      size > RTP_RECEIVE_MAX_BYTES || (packet[1] & 127) != d->type ||
      rtp_payload(packet, size, &offset, &length))
    return -1;
  uint16_t sequence = wire_u16(packet + 2);
  if (!d->started) {
    d->started = 1;
    d->expected_sequence = sequence;
  }
  uint16_t delta = sequence - d->expected_sequence;
  if (delta >= 0x8000) {
    ++d->late_dropped;
    return 1;
  }
  if (!delta) {
    ++d->expected_sequence;
    rtp_decoder_decode(d, packet, size);
    rtp_decoder_flush(d, now_ms);
    return 0;
  }
  RtpPending *free_slot = NULL, *nearest = NULL;
  uint16_t nearest_delta = UINT16_MAX;
  for (unsigned i = 0; i < RTP_REORDER_CAPACITY; ++i) {
    RtpPending *p = &d->pending[i];
    if (!p->size) {
      free_slot = p;
      continue;
    }
    if (p->sequence == sequence) {
      ++d->late_dropped;
      return 1;
    }
    uint16_t ahead = p->sequence - d->expected_sequence;
    if (ahead < nearest_delta) {
      nearest_delta = ahead;
      nearest = p;
    }
  }
  if (!free_slot) {
    /* A full reorder window is the other bound on waiting for a hole. Make
     * progress from the nearest received packet instead of throwing away the
     * rest of a recovered network burst. Keep the same allocation bound and
     * never deliver a farther packet ahead of a nearer one. */
    if (delta < nearest_delta) {
      d->skipped += delta;
      d->expected_sequence = sequence + 1;
      rtp_decoder_decode(d, packet, size);
      rtp_decoder_flush(d, now_ms);
      return 0;
    }
    d->skipped += nearest_delta;
    d->expected_sequence = nearest->sequence + 1;
    --d->buffered;
    rtp_decoder_decode(d, nearest->packet, nearest->size);
    memset(nearest, 0, sizeof(*nearest));
    /* Merge the incoming packet before flushing more expired holes: its
     * sequence may lie between two already-buffered packets. */
    free_slot = nearest;
  }
  ++d->buffered;
  memcpy(free_slot->packet, packet, size);
  free_slot->size = size;
  free_slot->arrived_ms = now_ms;
  free_slot->sequence = sequence;
  rtp_decoder_flush(d, now_ms);
  return 0;
}
