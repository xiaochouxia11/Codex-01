#include "CaptionText.hpp"
#include "TranscriptPage.hpp"
#include "transcript.hpp"
#include <cassert>
#include <string>

static bool ascii_only(uint32_t) { return false; }
static std::string simplified(const std::string &s) {
  char text[LIVE_TRANSCRIPT_BYTES]{};
  assert(s.size() < sizeof(text));
  std::memcpy(text, s.data(), s.size());
  live_caption_view::simplify(text, sizeof(text), ascii_only);
  return text;
}

int main() {
  assert(simplified("“I’d like a goldfish.” ‘Really?’") ==
         "\"I'd like a goldfish.\" 'Really?'");
  assert(simplified("a–b—c−d… «yes» ‹no›") == "a-b-c-d... \"yes\" 'no'");
  assert(simplified("Café crème brûlée naïve Æsir Straße Œuvre Łódź") ==
         "Cafe creme brulee naive AEsir Strasse OEuvre Lodz");
  assert(simplified("a\u00a0b\u202fc\td\u2009e\u2028f") == "a b c d e\nf");
  assert(simplified("cafe\u0301 🐟\ufe0f 👩\u200d💻 中文") == "cafe ? ?? ??");

  // Keep actual glyphs when the font provides them; simplify only the rest.
  char mixed[] = "“Café”—🐟";
  live_caption_view::simplify(mixed, sizeof(mixed), [](uint32_t c) {
    return c == 0x201C || c == 0x201D || c == 0xE9;
  });
  assert(std::string(mixed) == "“Café”-?");

  // Roboto 2 has vertical arrows; absent horizontal arrows stay readable.
  char arrows[] = "← ↑ → ↓";
  live_caption_view::simplify(arrows, sizeof(arrows), [](uint32_t c) {
    return c == 0x2191 || c == 0x2193;
  });
  assert(std::string(arrows) == "<- ↑ -> ↓");

  // Invalid and truncated UTF-8 cannot read past the buffer or survive as a
  // claimed supported glyph, even if the font supports U+FFFD itself.
  for (const auto &bad :
       {std::string("\xe2"), std::string("\xe2\x80"), std::string("\xc0\xaf"),
        std::string("\xed\xa0\x80"), std::string("\xf4\x90\x80\x80")}) {
    assert(simplified(bad) == std::string(bad.size(), '?'));
    std::string buffer = bad;
    buffer.push_back('\0');
    live_caption_view::simplify(&buffer[0], buffer.size(),
                                [](uint32_t) { return true; });
    assert(std::string(buffer.c_str()) == std::string(bad.size(), '?'));
  }
  char truncated[] = {'A', char(0xE2), char(0x80), 0};
  live_caption_view::simplify(truncated, sizeof(truncated), ascii_only);
  assert(std::string(truncated) == "A??");
  char unterminated[] = {'x', 'x', 'x'};
  live_caption_view::simplify(unterminated, sizeof(unterminated), ascii_only);
  assert(std::string(unterminated) == "xx");
  live_caption_view::simplify(nullptr, 0, ascii_only);

  const std::string full = std::string(249, 'x') + "…é";
  assert(simplified(full) == std::string(249, 'x') + "...e");

  // Normalize fresh display copies before wrapping, retaining raw SDK bytes,
  // IDs, and revisions. Repeated streaming snapshots must not duplicate text
  // after the smart quote shrinks from three UTF-8 bytes to one ASCII byte.
  live_transcript_t raw{};
  live_caption_view::Page page;
  auto update = [&] {
    const auto saved = raw;
    auto display = raw;
    live_caption_view::simplify(display, ascii_only);
    assert(std::memcmp(&saved, &raw, sizeof(raw)) == 0);
    assert(display.generation == raw.generation &&
           display.revision == raw.revision);
    page.update(display, 20, 10, 0, 0, [](const char *s) {
      return std::min(size_t(4), std::strlen(s));
    });
  };
  live_captions::append(raw, LIVE_SPEAKER_USER, "“abc", 0, 0);
  update();
  assert(std::string(page.blocks[0].text) == "\"abc");
  live_captions::append(raw, LIVE_SPEAKER_USER, "def”", 0, 0);
  update();
  assert(std::string(page.blocks[0].text) == "\"abcdef\"");
  assert(page.clears == 0);
  update();
  assert(page.clears == 0);
  live_captions::append(raw, LIVE_SPEAKER_ASSISTANT, "…", 0, 0);
  update();
  assert(page.clears == 1 && std::string(page.blocks[0].text) == "...");
  assert(page.blocks[0].speaker == LIVE_SPEAKER_ASSISTANT);
  update();
  assert(page.clears == 1);
}
