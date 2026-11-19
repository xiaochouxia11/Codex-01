#ifndef LIVE_TRANSCRIPT_H
#define LIVE_TRANSCRIPT_H
#include <stdint.h>

#define LIVE_TRANSCRIPT_BLOCKS 8
#define LIVE_TRANSCRIPT_BYTES 256
typedef enum { LIVE_SPEAKER_USER, LIVE_SPEAKER_ASSISTANT } live_speaker_t;
typedef struct {
  live_speaker_t speaker;
  uint32_t id; /* Stable within a generation, including ring-buffer rollover. */
  uint32_t start_ms, end_ms;
  char text[LIVE_TRANSCRIPT_BYTES];
} live_transcript_block_t;
/* Bounded captions in block-creation order. Each speaker's latest block can
 * continue growing independently during overlapping speech. */
typedef struct {
  uint32_t revision;
  uint32_t generation, last_block_id;
  unsigned count;
  live_transcript_block_t blocks[LIVE_TRANSCRIPT_BLOCKS];
  /* Speaker of the latest nonempty delta; valid when count is nonzero.
   * Overlapping speech may update a block before the last block. */
  live_speaker_t last_speaker;
} live_transcript_t;
#endif
