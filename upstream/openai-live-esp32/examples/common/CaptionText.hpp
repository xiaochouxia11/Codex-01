#pragma once
#include "live_transcript.h"
#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <cstring>

namespace live_caption_view {
// Return one complete scalar or consume one bad byte. Never read past the
// bounded snapshot, including when a malformed sequence ends at the last byte.
inline size_t decode(const char *text, size_t remaining, uint32_t &codepoint) {
  const auto *s = reinterpret_cast<const unsigned char *>(text);
  const unsigned first = s[0];
  if (first < 0x80) {
    codepoint = first;
    return 1;
  }
  const size_t n = first >= 0xC2 && first <= 0xDF   ? 2
                   : first >= 0xE0 && first <= 0xEF ? 3
                   : first >= 0xF0 && first <= 0xF4 ? 4
                                                    : 0;
  if (n && remaining >= n) {
    uint32_t value = first & (0x7F >> n);
    bool valid = true;
    for (size_t i = 1; i < n; ++i) {
      valid &= (s[i] & 0xC0) == 0x80;
      value = (value << 6) | (s[i] & 0x3F);
    }
    if (valid &&
        value >= (n == 2   ? 0x80u
                  : n == 3 ? 0x800u
                           : 0x10000u) &&
        value <= 0x10FFFF && !(value >= 0xD800 && value <= 0xDFFF)) {
      codepoint = value;
      return n;
    }
  }
  codepoint = 0xFFFD;
  return 1;
}

// Every replacement is no longer in bytes than its original UTF-8 scalar.
// This keeps block capacity and append-only pagination cursors stable.
inline const char *ascii_fallback(uint32_t c) {
  if ((c >= 0x0300 && c <= 0x036F) || c == 0x200B || c == 0x200C ||
      c == 0x200D || c == 0x2060 || c == 0xFE0E || c == 0xFE0F || c == 0xFEFF)
    return "";
  if (c == 0xA0 || (c >= 0x2000 && c <= 0x200A) || c == 0x202F || c == 0x205F)
    return " ";
  if ((c >= 0x2010 && c <= 0x2015) || c == 0x2212)
    return "-";
  if ((c >= 0x2018 && c <= 0x201B) || c == 0x2032 || c == 0x2039 || c == 0x203A)
    return "'";
  if ((c >= 0x201C && c <= 0x201F) || c == 0xAB || c == 0xBB || c == 0x2033)
    return "\"";
  if (c == 0x2026)
    return "...";
  if (c == 0x2022 || c == 0x2023 || c == 0xB7)
    return "*";
  if (c == 0x2028 || c == 0x2029)
    return "\n";
  if (c == 0xAD)
    return "";
  // Latin-1 accents have a useful ASCII reading even with the basic font.
  if (c >= 0xC0 && c <= 0xC5)
    return "A";
  if (c >= 0xC8 && c <= 0xCB)
    return "E";
  if (c >= 0xCC && c <= 0xCF)
    return "I";
  if (c >= 0xD2 && c <= 0xD6)
    return "O";
  if (c >= 0xD9 && c <= 0xDC)
    return "U";
  if (c >= 0xE0 && c <= 0xE5)
    return "a";
  if (c >= 0xE8 && c <= 0xEB)
    return "e";
  if (c >= 0xEC && c <= 0xEF)
    return "i";
  if (c >= 0xF2 && c <= 0xF6)
    return "o";
  if (c >= 0xF9 && c <= 0xFC)
    return "u";
  // Latin Extended-A letters, indexed by Unicode scalar. Ligatures keep
  // both letters; every other entry is one ASCII letter plus a NUL.
  if (c >= 0x100 && c <= 0x17F) {
    if (c == 0x132)
      return "IJ";
    if (c == 0x133)
      return "ij";
    if (c == 0x152)
      return "OE";
    if (c == 0x153)
      return "oe";
    static constexpr char letters[] =
        "A\0a\0A\0a\0A\0a\0C\0c\0C\0c\0C\0c\0C\0c\0D\0d\0"
        "D\0d\0E\0e\0E\0e\0E\0e\0E\0e\0E\0e\0G\0g\0G\0g\0"
        "G\0g\0G\0g\0H\0h\0H\0h\0I\0i\0I\0i\0I\0i\0I\0i\0"
        "I\0i\0I\0i\0J\0j\0K\0k\0k\0L\0l\0L\0l\0L\0l\0L\0"
        "l\0L\0l\0N\0n\0N\0n\0N\0n\0n\0N\0n\0O\0o\0O\0o\0"
        "O\0o\0O\0o\0R\0r\0R\0r\0R\0r\0S\0s\0S\0s\0S\0s\0"
        "S\0s\0T\0t\0T\0t\0T\0t\0U\0u\0U\0u\0U\0u\0U\0u\0"
        "U\0u\0U\0u\0W\0w\0Y\0y\0Y\0Z\0z\0Z\0z\0Z\0z\0s\0";
    static_assert(sizeof(letters) == 257, "Latin fallback table size");
    return letters + (c - 0x100) * 2;
  }
  switch (c) {
  case 0xC6:
    return "AE";
  case 0xE6:
    return "ae";
  case 0xC7:
    return "C";
  case 0xE7:
    return "c";
  case 0xD0:
    return "D";
  case 0xF0:
    return "d";
  case 0xD1:
    return "N";
  case 0xF1:
    return "n";
  case 0xD8:
    return "O";
  case 0xF8:
    return "o";
  case 0xDD:
  case 0x178:
    return "Y";
  case 0xFD:
  case 0xFF:
    return "y";
  case 0xDE:
    return "Th";
  case 0xFE:
    return "th";
  case 0xDF:
    return "ss";
  case 0x141:
    return "L";
  case 0x142:
    return "l";
  case 0x152:
    return "OE";
  case 0x153:
    return "oe";
  case 0x2190:
    return "<-";
  case 0x2191:
    return "^";
  case 0x2192:
    return "->";
  case 0x2193:
    return "v";
  default:
    return "?";
  }
}

template <typename Supports>
void simplify(char *text, size_t capacity, Supports supports) {
  if (!text || !capacity)
    return;
  text[capacity - 1] = 0;
  size_t remaining = std::strlen(text);
  char *read = text, *write = text;
  while (remaining) {
    uint32_t c;
    const size_t bytes = decode(read, remaining, c);
    const bool ascii = c >= 0x20 && c <= 0x7E;
    const bool valid = c != 0xFFFD || bytes == 3;
    if (ascii || c == '\n' || c == '\r' ||
        (valid && c >= 0xA0 && supports(c))) {
      std::memmove(write, read, bytes);
      write += bytes;
    } else {
      const char *replacement = c == '\t' ? " " : ascii_fallback(c);
      const size_t length = std::strlen(replacement);
      // Enforce the no-expansion contract even if the table changes later.
      if (length <= bytes) {
        std::memcpy(write, replacement, length);
        write += length;
      } else
        *write++ = '?';
    }
    read += bytes;
    remaining -= bytes;
  }
  *write = 0;
}

template <typename Supports>
void simplify(live_transcript_t &snapshot, Supports supports) {
  for (unsigned i = 0;
       i < std::min(snapshot.count, unsigned(LIVE_TRANSCRIPT_BLOCKS)); ++i)
    simplify(snapshot.blocks[i].text, sizeof(snapshot.blocks[i].text),
             supports);
}
} // namespace live_caption_view
