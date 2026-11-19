#include "transcript.hpp"
#include <cassert>
#include <string>

int main() {
  live_transcript_t captions{};
  live_captions::append(captions, LIVE_SPEAKER_USER, "I'd like", 100, 300);
  live_captions::append(captions, LIVE_SPEAKER_ASSISTANT, "Sure", 250, 400);
  assert(captions.last_speaker == LIVE_SPEAKER_ASSISTANT);
  live_captions::append(captions, LIVE_SPEAKER_USER, " some help.", 400, 600);
  assert(captions.last_speaker == LIVE_SPEAKER_USER);
  assert(captions.count == 2);
  assert(std::string(captions.blocks[0].text) == "I'd like some help.");
  assert(std::string(captions.blocks[1].text) == "Sure");
  assert(captions.blocks[0].speaker == LIVE_SPEAKER_USER);
  assert(captions.blocks[1].speaker == LIVE_SPEAKER_ASSISTANT);
  live_captions::append(captions, LIVE_SPEAKER_USER, "New thought", 3000, 3300);
  assert(captions.count == 3);
  assert(captions.blocks[2].start_ms == 3000);

  // Buffer rollover preserves complete UTF-8 characters and the newest text.
  captions = {};
  const std::string prefix(LIVE_TRANSCRIPT_BYTES - 3, 'a');
  live_captions::append(captions, LIVE_SPEAKER_USER, prefix.c_str(), 0, 10);
  live_captions::append(captions, LIVE_SPEAKER_USER, "\xe2\x82\xac!", 10, 20);
  assert(captions.count == 2);
  assert(std::string(captions.blocks[0].text) == prefix);
  assert(std::string(captions.blocks[1].text) == "\xe2\x82\xac!");
  for (unsigned i = 0; i < LIVE_TRANSCRIPT_BLOCKS + 2; ++i)
    live_captions::append(captions, LIVE_SPEAKER_ASSISTANT,
                          std::to_string(i).c_str(), 3000 * (i + 1),
                          3000 * (i + 1));
  assert(captions.count == LIVE_TRANSCRIPT_BLOCKS);
  assert(std::string(captions.blocks[0].text) == "2");
  assert(std::string(captions.blocks[LIVE_TRANSCRIPT_BLOCKS - 1].text) == "9");

  // Empty events are inert; a single large delta remains bounded.
  auto revision = captions.revision;
  live_captions::append(captions, LIVE_SPEAKER_USER, "", 0, 0);
  assert(captions.revision == revision);
  assert(captions.last_speaker == LIVE_SPEAKER_ASSISTANT);
  live_captions::append(captions, LIVE_SPEAKER_USER, nullptr, 0, 0);
  assert(captions.revision == revision);
  assert(captions.last_speaker == LIVE_SPEAKER_ASSISTANT);
  const std::string large(10000, 'x');
  live_captions::append(captions, LIVE_SPEAKER_USER, large.c_str(), 50000,
                        50010);
  assert(captions.count == LIVE_TRANSCRIPT_BLOCKS);
  for (const auto &block : captions.blocks)
    assert(strlen(block.text) < LIVE_TRANSCRIPT_BYTES);
  assert(captions.blocks[LIVE_TRANSCRIPT_BLOCKS - 1].speaker ==
         LIVE_SPEAKER_USER);
  revision = captions.revision;
  live_captions::clear(captions);
  assert(captions.count == 0 && captions.revision == revision + 1);
  live_captions::append(captions, LIVE_SPEAKER_ASSISTANT, "New session", 0,
                        100);
  assert(captions.revision == revision + 2);
  assert(captions.count == 1);
  assert(captions.last_speaker == LIVE_SPEAKER_ASSISTANT);
}
