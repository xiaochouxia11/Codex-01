#pragma once
#include "live_transcript.h"
#include <algorithm>
#include <cstddef>
#include <cstring>

namespace live_caption_view {
// Retain only the visible page and a cursor for each source block. Updates to
// overlapping speakers and source-ring rollover must not replay old captions.
class Page {
public:
  live_transcript_block_t blocks[LIVE_TRANSCRIPT_BLOCKS]{};
  unsigned count = 0, clears = 0;

  // next_line returns the byte length of one wrapped line, using the same font
  // and width as the display. The returned offset must be a UTF-8 boundary.
  template <typename NextLine>
  void update(const live_transcript_t &source, int height, int line_height,
              int line_space, int gap, NextLine next_line) {
    if (height < line_height || line_height <= 0)
      return; // Layout is not ready; do not consume any text yet.
    if (generation_ != source.generation) {
      count = 0;
      std::memset(seen_, 0, sizeof(seen_));
      generation_ = source.generation;
    }
    for (unsigned i = 0; i < source.count; ++i) {
      const auto &block = source.blocks[i];
      const size_t length = std::strlen(block.text);
      size_t used = 0;
      for (const auto &seen : seen_)
        if (seen.id == block.id)
          used = seen.bytes;
      if (used >= length)
        continue;
      if (!count || blocks[count - 1].id != block.id) {
        if (count == LIVE_TRANSCRIPT_BLOCKS) {
          count = 0;
          ++clears;
        }
        blocks[count] = {};
        blocks[count].id = block.id;
        blocks[count++].speaker = block.speaker;
      }
      auto &last = blocks[count - 1];
      const size_t at = std::strlen(last.text);
      // Each source block is bounded. Visible text is a suffix of its consumed
      // bytes, so the new suffix always fits even after a page break.
      const size_t n = std::min(length - used, sizeof(last.text) - 1 - at);
      std::memcpy(last.text + at, block.text + used, n);
      last.text[at + n] = 0;
      fit(height, line_height, line_space, gap, next_line);
    }
    std::memset(seen_, 0, sizeof(seen_));
    for (unsigned i = 0; i < source.count; ++i)
      seen_[i] = {source.blocks[i].id, std::strlen(source.blocks[i].text)};
    fit(height, line_height, line_space, gap, next_line);
  }

private:
  struct Seen {
    uint32_t id;
    size_t bytes;
  } seen_[LIVE_TRANSCRIPT_BLOCKS]{};
  uint32_t generation_ = UINT32_MAX;

  template <typename NextLine>
  void fit(int height, int line_height, int line_space, int gap,
           NextLine next_line) {
    int y = 0;
    for (unsigned i = 0; i < count; ++i) {
      const size_t length = std::strlen(blocks[i].text);
      size_t offset = 0;
      for (;;) {
        if (y + line_height > height) {
          // Keep the first overflowing line and all following blocks. Nothing
          // scrolls: the old page disappears, and this line starts at the top.
          std::memmove(blocks, blocks + i, (count - i) * sizeof(blocks[0]));
          count -= i;
          std::memmove(blocks[0].text, blocks[0].text + offset,
                       length - offset + 1);
          ++clears;
          // Restart iteratively: a large delta on a tiny viewport must not
          // create a recursion chain on the GUI task stack.
          i = unsigned(-1);
          y = 0;
          break;
        }
        y += line_height;
        if (offset == length)
          break; // Empty text or the blank line after a final newline.
        size_t step = next_line(blocks[i].text + offset);
        if (!step || step > length - offset)
          step = length - offset;
        offset += step;
        if (offset == length && blocks[i].text[offset - 1] != '\n' &&
            blocks[i].text[offset - 1] != '\r')
          break;
        y += line_space;
      }
      if (i != unsigned(-1))
        y += gap;
    }
  }
};
} // namespace live_caption_view
