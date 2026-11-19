#pragma once
#include "live_transcript.h"
#include <cstddef>
#include <cstring>
#include <initializer_list>

namespace cinema {
// A short user turn and an assistant reply can both arrive between sampling
// ticks. Process unseen user text first, even when the latest delta is from the
// assistant. IDs/generations remain stable across caption ring rollover.
struct TranscriptCursor {
  struct Seen {
    uint32_t generation = 0, id = 0;
    size_t length = 0;
    bool valid = false;
  } seen[2];

  int next(const live_transcript_t &transcript) const {
    for (auto speaker : {LIVE_SPEAKER_USER, LIVE_SPEAKER_ASSISTANT}) {
      const auto &old = seen[speaker];
      for (unsigned i = transcript.count; i; --i) {
        const auto &block = transcript.blocks[i - 1];
        if (block.speaker != speaker)
          continue;
        const auto length = strlen(block.text);
        if (length >= 3 &&
            (!old.valid || old.generation != transcript.generation ||
             old.id != block.id || old.length != length))
          return int(i - 1);
        break;
      }
    }
    return -1;
  }
  // Only advance after enqueue succeeds, so playback priority cannot discard
  // a new user topic while an explicit clip is still playing.
  void accept(const live_transcript_t &transcript, unsigned index) {
    const auto &block = transcript.blocks[index];
    seen[block.speaker] = {transcript.generation, block.id, strlen(block.text),
                           true};
  }
};
} // namespace cinema
