#pragma once
#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstring>
#ifdef ESP_PLATFORM
#include "esp_rom_crc.h"
#endif

namespace cinema {
constexpr size_t MAX_FILM = 2 * 1024 * 1024, MAX_FRAME = 32768;
constexpr unsigned MAX_FRAMES = 144, PIXEL_BYTES = 320 * 240 * 2;
// Cap FAT directory scans at 256 clips instead of scanning the whole library.
// Legacy headers still use flat paths; neither layout accepts supplied paths.
inline bool film_path(unsigned id, bool sharded, char *out, size_t capacity) {
  if (id >= 30000 || !out || !capacity)
    return false;
  const int n =
      sharded ? snprintf(out, capacity, "CINEMA3/%02X/%04u.SCF", id / 256, id)
              : snprintf(out, capacity, "CINEMA/%04u.SCF", id);
  return n > 0 && size_t(n) < capacity;
}
// Canonical short FAT filenames, including the transition to five-digit IDs.
inline int film_index(const char *name, unsigned count) {
  if (!name)
    return -1;
  const size_t length = strlen(name);
  if (length != 8 && length != 9)
    return -1;
  const size_t digits = length - 4;
  if (name[digits] != '.' || (digits == 5 && name[0] == '0'))
    return -1;
  const char suffix[] = "SCF";
  for (size_t i = 0; i < 3; ++i)
    if (name[digits + 1 + i] != suffix[i] &&
        name[digits + 1 + i] != suffix[i] + ('a' - 'A'))
      return -1;
  unsigned id = 0;
  for (size_t i = 0; i < digits; ++i) {
    if (name[i] < '0' || name[i] > '9')
      return -1;
    id = id * 10 + unsigned(name[i] - '0');
  }
  return id < count ? int(id) : -1;
}
inline uint16_t u16(const uint8_t *p) { return p[0] | uint16_t(p[1]) << 8; }
inline uint32_t u32(const uint8_t *p) {
  return p[0] | uint32_t(p[1]) << 8 | uint32_t(p[2]) << 16 |
         uint32_t(p[3]) << 24;
}
inline uint32_t crc32(const uint8_t *p, size_t n) {
#ifdef ESP_PLATFORM
  return esp_rom_crc32_le(0, p, n);
#else
  uint32_t crc = ~0u;
  for (size_t i = 0; i < n; ++i) {
    crc ^= p[i];
    for (unsigned bit = 0; bit < 8; ++bit)
      crc = (crc >> 1) ^ (0xedb88320u & (0u - (crc & 1)));
  }
  return ~crc;
#endif
}
struct Frame {
  uint32_t offset = 0, size = 0;
};
struct Film {
  unsigned fps = 0, count = 0;
  std::array<Frame, MAX_FRAMES> frames{};
  bool parse(const uint8_t *data, size_t size) {
    *this = {};
    if (!data || size < 32 || size > MAX_FILM || memcmp(data, "SCFILM1\0", 8) ||
        u16(data + 8) != 320 || u16(data + 10) != 240 ||
        u32(data + 16) != size || u32(data + 20) > MAX_FRAME || u32(data + 28))
      return false;
    const unsigned rate = u16(data + 12), n = u16(data + 14);
    if (!rate || rate > 20 || !n || n > MAX_FRAMES || size < 32 + n * 8)
      return false;
    size_t end = 32 + n * 8;
    const size_t payload = end;
    size_t largest = 0;
    for (unsigned i = 0; i < n; ++i) {
      Frame f{u32(data + 32 + i * 8), u32(data + 36 + i * 8)};
      if (f.offset != end || f.size < 4 || f.size > MAX_FRAME || end > size ||
          f.size > size - end || data[end] != 0xff || data[end + 1] != 0xd8 ||
          data[end + f.size - 2] != 0xff || data[end + f.size - 1] != 0xd9)
        return false;
      frames[i] = f;
      end += f.size;
      largest = std::max(largest, size_t(f.size));
    }
    if (end != size || largest != u32(data + 20) ||
        crc32(data + payload, size - payload) != u32(data + 24))
      return false;
    fps = rate;
    count = n;
    return true;
  }
};

// Caption embeddings and query embeddings must use exactly the same model and
// dimensions. A unit query dotted with a per-row int8 vector / norm is cosine.
inline bool normalize(float *v, unsigned n) {
  double norm = 0;
  for (unsigned i = 0; i < n; ++i) {
    if (!std::isfinite(v[i]))
      return false;
    norm += double(v[i]) * v[i];
  }
  if (norm < 1e-20 || !std::isfinite(norm))
    return false;
  norm = std::sqrt(norm);
  for (unsigned i = 0; i < n; ++i)
    v[i] /= norm;
  return true;
}
inline float cosine(const float *query, const int8_t *row, float norm,
                    unsigned n) {
  if (!(norm > 0) || !std::isfinite(norm))
    return -1;
  float dot = 0;
  for (unsigned i = 0; i < n; ++i)
    dot += query[i] * row[i];
  return dot / norm;
}
struct History {
  int clips[8] = {-1, -1, -1, -1, -1, -1, -1, -1};
  uint32_t sources[8]{};
  void add(int clip, uint32_t source) {
    for (unsigned i = 7; i; --i) {
      clips[i] = clips[i - 1];
      sources[i] = sources[i - 1];
    }
    clips[0] = clip;
    sources[0] = source;
  }
  // Subtract from relevance at playback selection, including the first pick
  // for every new cue. History is not reset by transcript updates. Use the
  // strongest recent occurrence so repeated plays cannot compound indefinitely.
  float score_penalty(int clip, uint32_t source) const {
    float p = 0;
    for (unsigned i = 0; i < 8; ++i) {
      if (clips[i] < 0)
        continue;
      const float recency = float(8 - i) / 8;
      if (clips[i] == clip)
        p = std::max(p, .08f * recency);
      else if (sources[i] == source)
        p = std::max(p, .02f * recency);
    }
    return p;
  }
};
struct Candidate {
  int id = -1;
  float score = -2;
  uint32_t source = 0;
};
template <unsigned CAPACITY> struct Candidates {
  Candidate best[CAPACITY]{};
  unsigned count = 0;
  // Different encoders have different score distributions. Preserve the
  // default for legacy GloVe packs; carry the threshold with each ranking.
  float minimum = .72f;
  void add(int id, float score, uint32_t source) {
    if (!std::isfinite(score))
      return;
    unsigned at = 0;
    while (at < count && best[at].score >= score)
      ++at;
    if (at == CAPACITY)
      return;
    count = std::min(count + 1, CAPACITY);
    for (unsigned i = count - 1; i > at; --i)
      best[i] = best[i - 1];
    best[at] = {id, score, source};
  }
  int choose(const History &history, uint32_t random,
             bool best_only = false) const {
    if (!count)
      return -1;
    Candidates adjusted;
    bool alternative = false;
    for (unsigned i = 0; i < count; ++i)
      alternative |= best[i].id != history.clips[0] &&
                     best[i].score >= best[0].score - .06f;
    for (unsigned i = 0; i < count; ++i) {
      // Gate on unpenalized relevance: novelty must not admit an unrelated
      // clip. Scores reported by library search also remain pure relevance.
      if (best[i].score < best[0].score - .06f)
        continue;
      if (alternative && best[i].id == history.clips[0])
        continue;
      adjusted.add(best[i].id,
                   best[i].score -
                       history.score_penalty(best[i].id, best[i].source),
                   best[i].source);
    }
    if (best_only)
      return adjusted.best[0].id;
    float weights[CAPACITY]{};
    double total = 0;
    for (unsigned i = 0; i < adjusted.count; ++i) {
      weights[i] =
          std::exp((adjusted.best[i].score - adjusted.best[0].score) / .02f);
      total += weights[i];
    }
    double draw = (double(random) / 4294967296.0) * total;
    for (unsigned i = 0; i < adjusted.count; ++i) {
      draw -= weights[i];
      if (draw < 0)
        return adjusted.best[i].id;
    }
    return adjusted.best[adjusted.count - 1].id;
  }
};
using Ranking = Candidates<8>;
// After exact matches have played, keep motion through the original subject's
// neighbors. Do not walk neighbor-of-neighbor indefinitely (semantic drift),
// restart the anchor, or present these associations as confident query hits.
template <class Clip, class Usable>
Ranking association_candidates(int anchor, int current, const Clip *clips,
                               unsigned count, const History &history,
                               Usable usable) {
  Ranking all, unseen;
  if (anchor < 0 || unsigned(anchor) >= count)
    return all;
  unsigned position = 0;
  for (auto id : clips[anchor].neighbors) {
    const float score = .5f - .005f * position++;
    if (unsigned(id) >= count || int(id) == anchor || int(id) == current ||
        !usable(id))
      continue;
    bool duplicate = false, recent = false;
    for (unsigned i = 0; i < all.count; ++i)
      duplicate |= all.best[i].id == int(id);
    if (duplicate)
      continue;
    for (int played : history.clips)
      recent |= played == int(id);
    all.add(id, score, clips[id].source);
    if (!recent)
      unseen.add(id, score, clips[id].source);
  }
  // A small neighborhood can eventually repeat, but never the current clip.
  return unseen.count ? unseen : all;
}
constexpr float MIN_RELEVANCE = .72f;
struct VisualTopic {
  Ranking ranking;
  uint8_t shown = 0;
  bool fresh = false, user_directed = false;
  int64_t expires_at = 0;
  bool active(int64_t now) const { return ranking.count && now < expires_at; }
  void clear() {
    // Entries beyond count are never read. Avoid a large aggregate temporary
    // (also works around an Xtensa GCC gimplify failure in tool-enabled
    // builds).
    ranking.count = 0;
    shown = 0;
    fresh = false;
    user_directed = false;
    expires_at = 0;
  }
  // Return whether the scene changed, so weak transcript fragments neither
  // cancel prefetch nor reset the first-choice/repetition policy.
  bool update(const Ranking &next, int64_t now, char source) {
    const bool conversation = source == 'u' || source == 'a';
    // The assistant's acknowledgement/story must not replace the subject the
    // user just chose. A new confident user cue can still change it
    // immediately.
    if (source == 'a' && user_directed && active(now))
      return false;
    if (next.count && next.best[0].score >= next.minimum) {
      bool changed = !active(now) || ranking.best[0].id != next.best[0].id;
      const auto before = remaining(-1);
      // Rephrasing the same subject must not restart its already-seen clips.
      uint8_t retained = 0;
      if (active(now))
        for (unsigned i = 0; i < next.count; ++i)
          for (unsigned j = 0; j < ranking.count; ++j)
            if ((shown & (1u << j)) && next.best[i].id == ranking.best[j].id)
              retained |= 1u << i;
      ranking = next;
      shown = retained;
      const auto after = remaining(-1);
      changed |= before.count != after.count;
      for (unsigned i = 0; !changed && i < after.count; ++i) {
        bool present = false;
        for (unsigned j = 0; j < before.count; ++j)
          present |= after.best[i].id == before.best[j].id;
        changed |= !present;
      }
      // Refresh the topic deadline without cancelling an in-flight SD read
      // every time another transcript chunk matches the same eligible set.
      fresh |= changed;
      user_directed = source != 'a';
      expires_at = now + (conversation || source == 'p' ? 180000000 : 45000000);
      return changed;
    }
    // Filler/unknown words retain a recent topic but do not extend its life.
    // An intentional tool/manual miss must not keep showing the old request.
    if (conversation && active(now))
      return false;
    const bool changed = ranking.count != 0;
    clear();
    return changed;
  }
  void presented(int id) {
    for (unsigned i = 0; i < ranking.count; ++i)
      if (ranking.best[i].id == id)
        shown |= 1u << i;
  }
  Ranking remaining(int current) const {
    Ranking result;
    result.minimum = ranking.minimum;
    for (unsigned i = 0; i < ranking.count; ++i) {
      const auto &c = ranking.best[i];
      if (!(shown & (1u << i)) && c.id != current &&
          c.score >= ranking.minimum && c.score >= ranking.best[0].score - .06f)
        result.add(c.id, c.score, c.source);
    }
    return result;
  }
  // Keep the search's subject after its first explicitly requested playback.
  // An exact-ID request without matching context anchors associations to that
  // clip, rather than inventing a subject from a source-film title.
  void request(int clip, uint32_t source, int64_t now,
               const Ranking *matches = nullptr) {
    const Ranking &context = matches ? *matches : ranking;
    bool contains = false;
    for (unsigned i = 0; i < context.count; ++i)
      contains |= context.best[i].id == clip &&
                  context.best[i].score >= context.minimum;
    Ranking next;
    if (contains && (matches || active(now)))
      next = context;
    else
      next.add(clip, 1.f, source);
    update(next, now, 'p');
  }
};
// Publishing the first frame precedes the GUI's visibility update. Only treat
// later invisibility as an overlay/pause; otherwise startup cancels itself.
inline bool visibility_paused(bool enabled, bool visible, bool &seen) {
  if (!enabled)
    seen = false;
  else if (visible)
    seen = true;
  return seen && !visible;
}
inline int64_t clip_duration_us(unsigned fps, unsigned count) {
  return fps ? (int64_t(count) * 1000000 + fps - 1) / fps : 0;
}
// New cues only change the next selection. Even a ready replacement must wait
// for the full running time AND a successfully published final frame held for
// one frame interval. A late decoder/display cannot skip the ending. Elapsed
// times exclude photo/usage-overlay pauses.
inline bool transition_due(int64_t elapsed_us, unsigned fps, unsigned count,
                           int published_frame, int64_t final_presented_us) {
  return fps && fps <= 20 && count && count <= MAX_FRAMES &&
         published_frame == int(count - 1) && final_presented_us >= 0 &&
         elapsed_us >= clip_duration_us(fps, count) &&
         elapsed_us >= final_presented_us &&
         elapsed_us - final_presented_us >= clip_duration_us(fps, 1);
}
inline unsigned playback_frame(uint64_t tick, unsigned count) {
  return count ? unsigned(std::min<uint64_t>(tick, count - 1)) : 0;
}
inline bool hold_final_frame(uint64_t tick, unsigned count, int published) {
  return count && tick >= count && published == int(count - 1);
}
// Real-time presentation skips missed frames instead of playing a backlog.
inline unsigned frame_at(int64_t elapsed_us, unsigned fps, unsigned count) {
  if (elapsed_us <= 0 || !fps || fps > 20 || !count)
    return 0;
  const uint64_t frame = uint64_t(elapsed_us) / (1000000u / fps);
  return unsigned(std::min<uint64_t>(frame, count));
}
// Follow the newest words of a streaming turn, preserving a UTF-8 boundary.
inline void transcript_cue(const char *text, char (&out)[257]) {
  out[0] = 0;
  if (!text)
    return;
  const size_t length = strlen(text);
  size_t start = length > 256 ? length - 256 : 0;
  while ((uint8_t(text[start]) & 0xc0) == 0x80)
    ++start;
  memcpy(out, text + start, length - start);
  out[length - start] = 0;
}
// Caller supplies synchronization. Latest cue wins; an intentional camera/tool
// cue has a short hold so streamed transcript deltas cannot immediately erase
// it.
struct Mailbox {
  char text[257]{};
  uint32_t generation = 0;
  bool queued = false;
  int64_t protected_until = 0;
  char source = '?';
  bool submit(const char *value, int64_t now, bool priority,
              char origin = '?') {
    if (!value || !*value || strlen(value) > 256 ||
        (!priority && now < protected_until))
      return false;
    strcpy(text, value);
    source = origin;
    queued = true;
    ++generation;
    if (priority)
      protected_until = now + 20000000;
    return true;
  }
  bool take(char (&out)[257], uint32_t &ticket, char *origin = nullptr) {
    if (!queued)
      return false;
    memcpy(out, text, sizeof(text));
    ticket = generation;
    if (origin)
      *origin = source;
    queued = false;
    return true;
  }
  void invalidate() {
    ++generation;
    queued = false;
    protected_until = 0;
    text[0] = 0;
  }
  bool accepts(uint32_t ticket) const { return ticket == generation; }
};
} // namespace cinema
