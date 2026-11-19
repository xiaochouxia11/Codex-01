/* Deterministic audio timing regressions; no wall-clock sleeps or network. */
#include "rtp.h"
#include "wire.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* This executable links RTP only; replace its entropy source so the initial
 * sequence-number regression deterministically exercises the upper boundary. */
int utils_random_bytes(uint8_t *out, size_t size) {
  memset(out, 0xff, size);
  return 0;
}
static unsigned checks;
#define CHECK(x)                                                               \
  do {                                                                         \
    ++checks;                                                                  \
    if (!(x)) {                                                                \
      fprintf(stderr, "%s:%d: %s\n", __FILE__, __LINE__, #x);                  \
      abort();                                                                 \
    }                                                                          \
  } while (0)
typedef struct {
  unsigned n;
  uint16_t values[64];
  uint32_t stamps[64];
} Capture;
static void received(uint8_t *p, size_t n, void *ctx) {
  Capture *c = ctx;
  CHECK(n == 2 && c->n < 64);
  c->values[c->n++] = wire_u16(p);
}
static void sent(uint8_t *p, size_t n, void *ctx) {
  Capture *c = ctx;
  CHECK(n == 15 && c->n < 64);
  c->values[c->n] = wire_u16(p + 2);
  c->stamps[c->n++] = wire_u32(p + 4);
}
static int push(RtpDecoder *d, uint16_t sequence, uint32_t time) {
  uint8_t p[14] = {0x80, PT_OPUS};
  wire_put16(p + 2, sequence);
  wire_put16(p + 12, sequence);
  return rtp_decoder_push(d, p, sizeof(p), time);
}
static void receive_order(void) {
  RtpDecoder d;
  Capture c = {0};
  rtp_decoder_init(&d, CODEC_OPUS, received, &c);
  CHECK(push(&d, 100, 0) == 0);
  CHECK(push(&d, 102, 20) == 0);
  CHECK(c.n == 1 && d.buffered == 1);
  CHECK(push(&d, 102, 21) == 1); /* queued duplicate */
  CHECK(push(&d, 101, 39) == 0);
  CHECK(c.n == 3 && c.values[0] == 100 && c.values[1] == 101 &&
        c.values[2] == 102);
  CHECK(push(&d, 101, 40) == 1); /* already played */
  CHECK(d.late_dropped == 2 && !d.buffered && !d.skipped);
  CHECK(push(&d, 105, 50) == 0);
  rtp_decoder_flush(&d, 89);
  CHECK(c.n == 3);
  rtp_decoder_flush(&d, 90); /* expiry works without another packet */
  CHECK(c.n == 4 && c.values[3] == 105 && d.skipped == 2);
  CHECK(push(&d, 104, 91) == 1 && c.n == 4);
  CHECK(push(&d, 106, 92) == 0 && c.values[4] == 106);
  /* Several missing packets do not multiply the hold deadline. */
  CHECK(push(&d, 108, 100) == 0);
  CHECK(push(&d, 110, 100) == 0);
  rtp_decoder_flush(&d, 140);
  CHECK(c.n == 7 && c.values[5] == 108 && c.values[6] == 110 && d.skipped == 4);
}
static void receive_wrap_and_bounds(void) {
  RtpDecoder d;
  Capture c = {0};
  rtp_decoder_init(&d, CODEC_OPUS, received, &c);
  CHECK(push(&d, 65534, UINT32_MAX - 30) == 0);
  CHECK(push(&d, 0, UINT32_MAX - 20) == 0);
  CHECK(push(&d, 65535, UINT32_MAX - 10) == 0);
  CHECK(c.n == 3 && c.values[1] == 65535 && c.values[2] == 0);
  CHECK(push(&d, 2, UINT32_MAX - 10) == 0);
  rtp_decoder_flush(&d, 28);
  CHECK(c.n == 3);
  rtp_decoder_flush(&d, 29);
  CHECK(c.n == 4 && c.values[3] == 2 && d.skipped == 1);
  CHECK(push(&d, 65535, 30) == 1);
  CHECK(push(&d, 32771, 30) == 1); /* ambiguous half-range is rejected */

  memset(&c, 0, sizeof(c));
  rtp_decoder_init(&d, CODEC_OPUS, received, &c);
  uint8_t bad[14] = {0x80, 112};
  CHECK(rtp_decoder_push(&d, bad, sizeof(bad), 0) == -1 && !d.started);
  bad[1] = PT_OPUS;
  bad[0] = 0x90; /* truncated extension */
  CHECK(rtp_decoder_push(&d, bad, sizeof(bad), 0) == -1 && !d.started);
  CHECK(rtp_decoder_push(&d, bad, 11, 0) == -1);
  CHECK(rtp_decoder_push(&d, bad, RTP_RECEIVE_MAX_BYTES + 1, 0) == -1);
  CHECK(rtp_decoder_push(NULL, bad, 14, 0) == -1);
  CHECK(push(&d, 0, 0) == 0);
  for (uint16_t i = 3; i < 3 + RTP_REORDER_CAPACITY; ++i)
    CHECK(push(&d, i, 1) == 0);
  CHECK(d.buffered == RTP_REORDER_CAPACITY && c.n == 1);
  CHECK(push(&d, 11, 2) == 0); /* pressure: skip the hole, retain the burst */
  CHECK(c.n == 10 && !d.buffered);
  CHECK(!d.overflow_dropped && d.skipped == 2);
  for (unsigned i = 1; i < c.n; ++i)
    CHECK(c.values[i] == i + 2);
  CHECK(push(&d, 2, 3) == 1 && push(&d, 1, 4) == 1);
  CHECK(push(&d, 12, 5) == 0);
  rtp_decoder_flush(&d, 45);
  CHECK(c.n == 11 && c.values[10] == 12 && d.skipped == 2);
  /* Empty/padding-only payload advances sequence without an audio callback. */
  uint8_t padding[13] = {0xa0, PT_OPUS};
  wire_put16(padding + 2, 13);
  padding[12] = 1;
  CHECK(rtp_decoder_push(&d, padding, sizeof(padding), 46) == 0 && c.n == 11);
  CHECK(push(&d, 14, 47) == 0 && c.values[11] == 14);
}
static void receive_burst_pressure(void) {
  /* One missing packet followed by a burst must not turn into additional
   * drops just because the missing packet's 40 ms deadline has not elapsed. */
  for (unsigned wrap = 0; wrap < 2; ++wrap) {
    RtpDecoder d;
    Capture c = {0};
    uint16_t first = wrap ? 65530 : 100;
    rtp_decoder_init(&d, CODEC_OPUS, received, &c);
    CHECK(push(&d, first, 0) == 0);
    for (unsigned i = 2; i <= 30; ++i) {
      CHECK(push(&d, first + i, 500) == 0);
      CHECK(d.buffered <= RTP_REORDER_CAPACITY);
    }
    CHECK(c.n == 30 && !d.buffered && d.skipped == 1);
    CHECK(!d.overflow_dropped);
    for (unsigned i = 1; i < c.n; ++i)
      CHECK(c.values[i] == (uint16_t)(first + i + 1));
    CHECK(push(&d, first + 1, 501) == 1);
  }

  RtpDecoder d;
  Capture c = {0};
  rtp_decoder_init(&d, CODEC_OPUS, received, &c);
  CHECK(push(&d, 0, 0) == 0);
  for (unsigned i = 3; i < 3 + RTP_REORDER_CAPACITY; ++i)
    CHECK(push(&d, i, 1) == 0);
  /* A duplicate cannot force an early gap decision. A closer new packet
   * must be played before the queued packets, without evicting any of them. */
  CHECK(push(&d, 5, 2) == 1 && c.n == 1);
  CHECK(push(&d, 2, 3) == 0 && c.n == 10);
  CHECK(c.values[0] == 0 && !d.buffered && d.skipped == 1);
  for (unsigned i = 1; i < c.n; ++i)
    CHECK(c.values[i] == i + 1);
  CHECK(push(&d, 1, 4) == 1 && !d.overflow_dropped);

  /* If the missing packet is already being received, consume it before
   * making a capacity/deadline decision about the queued burst. */
  memset(&c, 0, sizeof(c));
  rtp_decoder_init(&d, CODEC_OPUS, received, &c);
  CHECK(push(&d, 0, 0) == 0);
  for (unsigned i = 2; i < 2 + RTP_REORDER_CAPACITY; ++i)
    CHECK(push(&d, i, 1) == 0);
  CHECK(push(&d, 1, 41) == 0 && c.n == 10 && !d.skipped);
  for (unsigned i = 0; i < c.n; ++i)
    CHECK(c.values[i] == i);

  memset(&c, 0, sizeof(c));
  rtp_decoder_init(&d, CODEC_OPUS, received, &c);
  CHECK(push(&d, 0, 0) == 0);
  for (unsigned i = 0; i < RTP_REORDER_CAPACITY; ++i)
    CHECK(push(&d, 3 + 2 * i, 1) == 0);
  CHECK(push(&d, 19, 2) == 0);
  CHECK(c.n == 2 && c.values[1] == 3 && d.buffered == RTP_REORDER_CAPACITY);
  CHECK(d.skipped == 2 && !d.overflow_dropped);
  rtp_decoder_flush(&d, 42);
  CHECK(c.n == 10 && !d.buffered && d.skipped == 10);
  for (unsigned i = 1; i < c.n; ++i)
    CHECK(c.values[i] == 2 * i + 1);

  /* With expired, noncontiguous buffered packets, merge a newly arrived
   * packet before flushing past its sequence number. */
  memset(&c, 0, sizeof(c));
  rtp_decoder_init(&d, CODEC_OPUS, received, &c);
  CHECK(push(&d, 0, 0) == 0);
  for (unsigned i = 0; i < RTP_REORDER_CAPACITY; ++i)
    CHECK(push(&d, 3 + 2 * i, 1) == 0);
  CHECK(push(&d, 4, 100) == 0);
  CHECK(c.n == 10 && !d.buffered && d.skipped == 8);
  CHECK(c.values[1] == 3 && c.values[2] == 4 && c.values[3] == 5);
  CHECK(d.expected_sequence == 18);
}
static void transmit_clock(void) {
  RtpEncoder e;
  Capture c = {0};
  const uint8_t silence[] = {0xf8, 0xff, 0xfe};
  rtp_encoder_init(&e, CODEC_OPUS, sent, &c);
  CHECK(e.ssrc != 0);
  CHECK(e.seq_number < 0x8000);
  e.seq_number = 65535;
  e.timestamp = UINT32_MAX - 959;
  CHECK(rtp_encoder_encode_at(&e, NULL, 3, 0) == -1 && !e.timestamp_mode);
  CHECK(rtp_encoder_encode_at(&e, silence, sizeof(silence), 0) == 0);
  CHECK(rtp_encoder_encode_at(&e, silence, sizeof(silence), 960) == 0);
  CHECK(rtp_encoder_encode_at(&e, silence, sizeof(silence), 2880) == 0);
  CHECK(c.n == 3 && c.values[0] == 65535 && c.values[1] == 0 &&
        c.values[2] == 1);
  CHECK(c.stamps[0] == UINT32_MAX - 959 && c.stamps[1] == 0 &&
        c.stamps[2] == 1920);
  uint32_t next = e.timestamp;
  CHECK(rtp_encoder_encode_at(&e, silence, 3, 2880) == -1);
  CHECK(rtp_encoder_encode_at(&e, silence, 3, 2879) == -1);
  CHECK(rtp_encoder_encode_at(&e, silence, 3, 3000) == -1);
  CHECK(rtp_encoder_encode_at(&e, silence, 3, 2880u + 0x80000000u) == -1);
  CHECK(rtp_encoder_encode(&e, silence, 3) == -1);
  CHECK(c.n == 3 && e.timestamp == next && e.last_capture_timestamp == 2880);
  CHECK(rtp_encoder_encode_at(&e, silence, 3, 3840) == 0 &&
        c.stamps[3] == 2880);

  memset(&c, 0, sizeof(c));
  rtp_encoder_init(&e, CODEC_OPUS, sent, &c);
  CHECK(rtp_encoder_encode_at(&e, silence, 3, UINT32_MAX - 959) == 0);
  CHECK(rtp_encoder_encode_at(&e, silence, 3, 0) == 0);
  CHECK(rtp_encoder_encode_at(&e, silence, 3, 1920) == 0);
  CHECK(c.stamps[1] - c.stamps[0] == 960 && c.stamps[2] - c.stamps[1] == 1920);

  memset(&c, 0, sizeof(c));
  rtp_encoder_init(&e, CODEC_OPUS, sent, &c);
  CHECK(rtp_encoder_encode(&e, silence, 0) == -1 && !e.timestamp_mode);
  CHECK(rtp_encoder_encode(&e, silence, 3) == 0);
  CHECK(rtp_encoder_encode_at(&e, silence, 3, 960) == -1);
  CHECK(rtp_encoder_encode(&e, silence, 3) == 0);
  CHECK(c.stamps[1] - c.stamps[0] == 960 && c.n == 2);
}
int main(void) {
  receive_order();
  receive_wrap_and_bounds();
  receive_burst_pressure();
  transmit_clock();
  printf("Audio regressions: %u checks passed\n", checks);
  return 0;
}
