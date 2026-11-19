#pragma once
#include "CinemaPolicy.hpp"
#include <cstring>
namespace cinema {
// ASCII tokens, bounded work, no allocation/network. Non-Latin words and
// word order/negation are not modeled by this compact static encoder.
template <class Word, class Fn>
unsigned each_word(const char *text, const Word *words, size_t count,
                   const char *strings, Fn found) {
  if (!text || !words || !strings)
    return 0;
  unsigned used = 0;
  char token[49]{};
  size_t length = 0;
  bool overflow = false;
  auto flush = [&]() {
    if (!length || overflow) {
      length = 0;
      overflow = false;
      return;
    }
    token[length] = 0;
    size_t lo = 0, hi = count;
    while (lo < hi) {
      const size_t mid = lo + (hi - lo) / 2;
      if (strcmp(strings + words[mid].offset, token) < 0)
        lo = mid + 1;
      else
        hi = mid;
    }
    if (lo < count && !strcmp(strings + words[lo].offset, token)) {
      found(lo);
      ++used;
    }
    length = 0;
    overflow = false;
  };
  for (size_t i = 0; i < 2048 && text[i]; ++i) {
    unsigned char c = text[i];
    if (c >= 'A' && c <= 'Z')
      c += 'a' - 'A';
    if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) {
      if (length < sizeof(token) - 1)
        token[length++] = char(c);
      else
        overflow = true;
    } else
      flush();
  }
  flush();
  return used;
}
template <class Word>
bool embed_local(const char *text, float *out, unsigned dimensions,
                 const Word *words, size_t count, const char *strings,
                 unsigned *matched = nullptr) {
  if (!out || !dimensions || dimensions > 256)
    return false;
  std::fill(out, out + dimensions, 0.f);
  const auto used = each_word(text, words, count, strings, [&](size_t id) {
    for (unsigned d = 0; d < dimensions; ++d)
      out[d] += words[id].vector[d] * words[id].scale;
  });
  if (matched)
    *matched = used;
  return used && normalize(out, dimensions);
}
template <class Word>
unsigned keywords(const char *text, const Word *words, size_t count,
                  const char *strings, uint16_t *out, unsigned capacity) {
  unsigned used = 0;
  each_word(text, words, count, strings, [&](size_t id) {
    if (!capacity || id >= 65535)
      return;
    for (unsigned i = 0; i < used; ++i)
      if (out[i] == id)
        return;
    const float weight = words[id].scale * words[id].norm;
    unsigned at = 0;
    while (at < used && words[out[at]].scale * words[out[at]].norm >= weight)
      ++at;
    if (at >= capacity)
      return;
    used = std::min(used + 1, capacity);
    for (unsigned i = used - 1; i > at; --i)
      out[i] = out[i - 1];
    out[at] = uint16_t(id);
  });
  return used;
}
// Rerank the semantic/lexical candidate union: subjects in a short cue should
// not disappear into the average of a longer scene description. MaxSim uses the
// same tiny word vectors, with bounded query/document token budgets.
template <class Word>
float keyword_similarity(const uint16_t *query, unsigned n,
                         const uint16_t *document, unsigned limit,
                         const Word *words, unsigned count, unsigned dims) {
  if (!n)
    return 0;
  float total = 0, weight_sum = 0;
  for (unsigned i = 0; i < n; ++i) {
    float best = 0;
    if (query[i] >= count)
      continue;
    const auto &a = words[query[i]];
    for (unsigned j = 0; j < limit && document[j] != 65535; ++j) {
      if (document[j] >= count)
        continue;
      const auto &b = words[document[j]];
      int dot = 0;
      for (unsigned d = 0; d < dims; ++d)
        dot += int(a.vector[d]) * b.vector[d];
      if (a.norm > 0 && b.norm > 0)
        best = std::max(best, std::min(1.f, dot / (a.norm * b.norm)));
    }
    const float weight = a.scale * a.norm;
    total += weight * best;
    weight_sum += weight;
  }
  return weight_sum > 0 ? total / weight_sum : 0;
}
template <class Word>
float exact_coverage(const uint16_t *query, unsigned n,
                     const uint16_t *document, unsigned limit,
                     const Word *words, unsigned count) {
  float matched = 0, total = 0;
  for (unsigned i = 0; i < n; ++i) {
    if (query[i] >= count)
      continue;
    const float weight = words[query[i]].scale * words[query[i]].norm;
    total += weight;
    for (unsigned j = 0; j < limit && document[j] != 65535; ++j) {
      if (query[i] == document[j]) {
        matched += weight;
        break;
      }
    }
  }
  return total > 0 ? matched / total : 0;
}
} // namespace cinema
