#pragma once
#include "live_transcript.h"
#include <algorithm>
#include <cstring>

namespace live_captions {
inline void clear(live_transcript_t &captions) {
  const uint32_t revision = captions.revision + 1;
  const uint32_t generation = captions.generation + 1;
  captions = {};
  captions.revision = revision;
  captions.generation = generation;
}
inline void append(live_transcript_t &captions, live_speaker_t speaker,
                   const char *text, uint32_t start_ms, uint32_t end_ms) {
  if (!text || !*text)
    return;
  int selected = -1;
  for (unsigned i = captions.count; i > 0; --i) {
    const auto &block = captions.blocks[i - 1];
    if (block.speaker == speaker) {
      // This is a display grouping heuristic, not a server turn boundary.
      if (start_ms >= block.start_ms &&
          uint64_t(start_ms) <= uint64_t(block.end_ms) + 1500)
        selected = static_cast<int>(i - 1);
      break;
    }
  }
  size_t remaining = strlen(text);
  while (remaining) {
    if (selected < 0) {
      if (captions.count == LIVE_TRANSCRIPT_BLOCKS) {
        memmove(captions.blocks, captions.blocks + 1,
                (LIVE_TRANSCRIPT_BLOCKS - 1) * sizeof(captions.blocks[0]));
        --captions.count;
      }
      selected = static_cast<int>(captions.count++);
      captions.blocks[selected] = {};
      captions.blocks[selected].id = ++captions.last_block_id;
      captions.blocks[selected].speaker = speaker;
      captions.blocks[selected].start_ms = start_ms;
    }
    auto &block = captions.blocks[selected];
    const size_t used = strlen(block.text);
    size_t n = std::min(remaining, sizeof(block.text) - 1 - used);
    // A delta is valid UTF-8; keep a multibyte character in the next block
    // when it cannot fit entirely in this one.
    if (n < remaining)
      while (n && (static_cast<unsigned char>(text[n]) & 0xC0) == 0x80)
        --n;
    if (!n && !used) // Ensure progress even for malformed UTF-8 from a peer.
      n = std::min(remaining, sizeof(block.text) - 1);
    if (!n) {
      selected = -1;
      continue;
    }
    memcpy(block.text + used, text, n);
    block.text[used + n] = 0;
    block.end_ms = std::max(block.end_ms, end_ms);
    text += n;
    remaining -= n;
    if (remaining)
      selected = -1;
  }
  captions.last_speaker = speaker;
  ++captions.revision;
}
} // namespace live_captions
