#include "TranscriptPage.hpp"
#include "transcript.hpp"
#include <cassert>
#include <string>

// Four Unicode codepoints per line, or an explicit newline. Real display code
// supplies LVGL's own font/word-wrap calculation through this same boundary.
static size_t next_line(const char *s) {
  size_t n = 0;
  for (unsigned chars = 0; s[n] && chars < 4; ++chars) {
    if (s[n++] == '\n')
      break;
    while ((static_cast<unsigned char>(s[n]) & 0xC0) == 0x80)
      ++n;
  }
  if (n && s[n - 1] != '\n' && s[n] == '\n')
    ++n;
  return n;
}
int main() {
  live_transcript_t source{};
  live_caption_view::Page page;
  auto update = [&](int height = 20) {
    page.update(source, height, 10, 0, 0, next_line);
  };
  auto add = [&](const char *text, unsigned ms = 0,
                 live_speaker_t speaker = LIVE_SPEAKER_USER) {
    live_captions::append(source, speaker, text, ms, ms);
    update();
  };
  add("12345678"); // Exact fit leaves the full page visible.
  assert(page.count == 1 && std::string(page.blocks[0].text) == "12345678");
  assert(page.clears == 0);
  update();
  assert(page.clears == 0);
  add("9"); // Overflow clears the whole old page, not a line at a time.
  assert(page.clears == 1 && std::string(page.blocks[0].text) == "9");
  add("abc");
  assert(std::string(page.blocks[0].text) == "9abc");

  live_captions::clear(source);
  add("user");
  add("help", 0, LIVE_SPEAKER_ASSISTANT);
  assert(page.count == 2);
  add("more"); // An older speaker block can still grow after the reply.
  assert(page.count == 1 && std::string(page.blocks[0].text) == "more");
  assert(page.blocks[0].speaker == LIVE_SPEAKER_USER);
  update();
  assert(std::string(page.blocks[0].text) == "more");

  // Identical text/timestamps do not confuse block identity after rollover.
  for (unsigned i = 1; i < 20; ++i)
    add("abcd", i * 3000);
  assert(source.count == LIVE_TRANSCRIPT_BLOCKS);
  const auto last = source.blocks[source.count - 1].id;
  assert(page.blocks[page.count - 1].id == last);
  const unsigned cleared = page.clears;
  update();
  assert(page.clears == cleared);

  live_captions::clear(source);
  add("1234\n5678\n");
  assert(page.count == 1 && std::string(page.blocks[0].text).empty());
  add("x");
  assert(std::string(page.blocks[0].text) == "x");
  live_captions::clear(source);
  add("é€🙂aé€🙂b");
  add("🙂");
  assert(std::string(page.blocks[0].text) == "🙂");

  // Session resets can be missed between UI ticks: generation prevents stale
  // text even when IDs and lengths in the new session match the previous one.
  live_captions::clear(source);
  add("new");
  assert(page.count == 1 && std::string(page.blocks[0].text) == "new");
  live_captions::clear(source);
  live_captions::append(source, LIVE_SPEAKER_USER, "deferred", 0, 0);
  update(0);
  assert(std::string(page.blocks[0].text) == "new");
  update();
  assert(std::string(page.blocks[0].text) == "deferred");

  // Large deltas remain bounded; repeated page breaks are iterative.
  live_captions::clear(source);
  std::string huge(10000, 'x');
  live_captions::append(source, LIVE_SPEAKER_ASSISTANT, huge.c_str(), 0, 0);
  update(10);
  assert(page.count == 1 && std::strlen(page.blocks[0].text) <= 4);
  update(10);
  assert(page.count == 1);

  // A viewport resize consumes no new deltas and cannot restore old pages.
  live_captions::clear(source);
  add("12345678");
  update(10);
  assert(std::string(page.blocks[0].text) == "5678");
  update(20);
  assert(std::string(page.blocks[0].text) == "5678");

  // Line spacing and gaps between speakers count toward the exact fit.
  live_captions::clear(source);
  live_captions::append(source, LIVE_SPEAKER_USER, "12345678", 0, 0);
  live_captions::append(source, LIVE_SPEAKER_ASSISTANT, "reply", 0, 0);
  page.update(source, 34, 10, 2, 3, next_line);
  assert(page.count == 1 && std::string(page.blocks[0].text) == "reply");
  assert(page.blocks[0].speaker == LIVE_SPEAKER_ASSISTANT);
}
