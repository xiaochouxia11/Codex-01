#pragma once
#include "CinemaPolicy.hpp"

namespace cinema::potion {
constexpr unsigned DIMENSIONS = 128, MAX_BYTES = 2048, MAX_TOKENS = 256;
constexpr unsigned MAX_WORD = 100, MAX_TERMS = 8;
constexpr float MIN_SCORE = .50f, MIN_COSINE = .20f;
constexpr uint8_t TOKENIZER = 1, STOP_WORD = 2;

inline bool alnum(unsigned char c) {
  return (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9');
}
// Same bounded ASCII profile as preparation. Non-ASCII bytes delimit words;
// punctuation is its own basic token. Overlong words are discarded whole.
template <class Fn> void basic_tokens(const char *text, Fn token) {
  if (!text)
    return;
  char word[MAX_WORD + 1]{};
  unsigned length = 0;
  bool overflow = false;
  auto flush = [&] {
    if (length && !overflow) {
      word[length] = 0;
      token(word);
    }
    length = 0;
    overflow = false;
  };
  for (unsigned i = 0; i < MAX_BYTES && text[i]; ++i) {
    auto c = static_cast<unsigned char>(text[i]);
    if (c >= 'A' && c <= 'Z')
      c += 'a' - 'A';
    if (alnum(c)) {
      if (length < MAX_WORD)
        word[length++] = char(c);
      else
        overflow = true;
    } else {
      flush();
      if (c > 32 && c < 127) {
        char punctuation[2] = {char(c), 0};
        token(punctuation);
      }
    }
  }
  flush();
}

template <class Word>
int find(const char *token, const Word *words, unsigned count,
         const char *strings) {
  if (!token || !words || !strings || count >= 65535)
    return -1;
  unsigned lo = 0, hi = count;
  while (lo < hi) {
    const auto mid = lo + (hi - lo) / 2;
    if (strcmp(strings + words[mid].offset, token) < 0)
      lo = mid + 1;
    else
      hi = mid;
  }
  return lo < count && !strcmp(strings + words[lo].offset, token) ? int(lo)
                                                                  : -1;
}

// Greedy WordPiece, with all-or-nothing rollback on an unknown suffix.
// Cached whole-word evidence rows never participate in the tokenizer.
template <class Word>
unsigned pieces(const char *word, const Word *words, unsigned count,
                const char *strings, uint16_t (&ids)[MAX_WORD]) {
  const size_t length = strlen(word);
  if (!length || length > MAX_WORD)
    return 0;
  unsigned start = 0, used = 0;
  while (start < length) {
    bool found = false;
    for (unsigned end = length; end > start; --end) {
      char part[MAX_WORD + 3]{};
      const unsigned prefix = start ? 2 : 0;
      if (prefix)
        part[0] = part[1] = '#';
      memcpy(part + prefix, word + start, end - start);
      const int id = find(part, words, count, strings);
      if (id < 0 || !(words[id].flags & TOKENIZER))
        continue;
      ids[used++] = uint16_t(id);
      start = end;
      found = true;
      break;
    }
    if (!found)
      return 0;
  }
  return used;
}

template <class Word>
bool encode(const char *text, const Word *words, unsigned count,
            const char *strings, float (&out)[DIMENSIONS],
            float *magnitude = nullptr) {
  std::fill(std::begin(out), std::end(out), 0.f);
  unsigned used = 0;
  basic_tokens(text, [&](const char *word) {
    if (used == MAX_TOKENS)
      return;
    uint16_t ids[MAX_WORD];
    const auto n = pieces(word, words, count, strings, ids);
    for (unsigned i = 0; i < n && used < MAX_TOKENS; ++i, ++used) {
      const auto &row = words[ids[i]];
      for (unsigned d = 0; d < DIMENSIONS; ++d)
        out[d] += row.vector[d] * row.scale;
    }
  });
  if (magnitude) {
    double norm = 0;
    for (float value : out)
      norm += double(value) * value;
    *magnitude = float(std::sqrt(norm));
  }
  return used && normalize(out, DIMENSIONS);
}

struct Query {
  float pooled[DIMENSIONS]{};
  float terms[MAX_TERMS][DIMENSIONS]{};
  float thresholds[MAX_TERMS]{};
  float weights[MAX_TERMS]{};
  unsigned count = 0;
};
enum class QueryResult { ok, unknown, unsupported };
template <class Word>
QueryResult prepare_query(const char *text, const Word *words,
                          unsigned word_count, const char *strings,
                          Query &out) {
  out.count = 0;
  char terms[MAX_TERMS][MAX_WORD + 1]{};
  bool unsupported = false, previous_good = false, ends_n = false,
       contraction = false;
  basic_tokens(text, [&](const char *word) {
    if (!alnum(word[0])) {
      contraction = ends_n && !strcmp(word, "'");
      ends_n = false;
      return;
    }
    unsupported |= !strcmp(word, "not") || !strcmp(word, "without") ||
                   !strcmp(word, "except") || !strcmp(word, "never") ||
                   !strcmp(word, "no") || !strcmp(word, "cannot") ||
                   (contraction && !strcmp(word, "t"));
    contraction = false;
    ends_n = word[strlen(word) - 1] == 'n';
    const bool greeting = previous_good && (!strcmp(word, "morning") ||
                                            !strcmp(word, "afternoon") ||
                                            !strcmp(word, "evening"));
    previous_good = !strcmp(word, "good");
    if (greeting)
      return;
    if (out.count == MAX_TERMS)
      return;
    const int id = find(word, words, word_count, strings);
    if (id >= 0 && words[id].flags & STOP_WORD)
      return;
    for (unsigned i = 0; i < out.count; ++i)
      if (!strcmp(word, terms[i]))
        return;
    strcpy(terms[out.count++], word);
  });
  if (unsupported)
    return QueryResult::unsupported;
  if (!out.count)
    return QueryResult::unknown;
  char joined[MAX_TERMS * (MAX_WORD + 1)]{};
  unsigned length = 0;
  for (unsigned i = 0; i < out.count; ++i) {
    if (i)
      joined[length++] = ' ';
    const unsigned n = strlen(terms[i]);
    memcpy(joined + length, terms[i], n);
    length += n;
    const int id = find(terms[i], words, word_count, strings);
    out.thresholds[i] = id >= 0 && words[id].flags & TOKENIZER ? .65f : .90f;
    if (id >= 0 && words[id].norm > 0) {
      out.weights[i] = words[id].scale * words[id].norm;
      for (unsigned d = 0; d < DIMENSIONS; ++d)
        out.terms[i][d] = words[id].vector[d] / words[id].norm;
    } else if (!encode(terms[i], words, word_count, strings, out.terms[i],
                       &out.weights[i]))
      return QueryResult::unknown;
  }
  return encode(joined, words, word_count, strings, out.pooled)
             ? QueryResult::ok
             : QueryResult::unknown;
}

// Whole-word evidence, not isolated subword matches: a shared suffix such as
// "##cycle" must not turn a motorcycle into a bicycle. Complex/unknown words
// need stronger support than a single pretrained token.
template <class Word>
bool evidence(const Query &query, const uint16_t *ids, unsigned limit,
              const Word *words, unsigned count, float &mean) {
  bool strong = false;
  float weight_sum = 0, maximum_weight = 0;
  mean = 0;
  for (unsigned i = 0; i < query.count; ++i)
    maximum_weight = std::max(maximum_weight, query.weights[i]);
  for (unsigned i = 0; i < query.count; ++i) {
    float best = 0;
    for (unsigned j = 0; j < limit && ids[j] != 65535; ++j) {
      if (ids[j] >= count)
        continue;
      const auto &row = words[ids[j]];
      best = std::max(best,
                      cosine(query.terms[i], row.vector, row.norm, DIMENSIONS));
    }
    best = std::min(1.f, best);
    if (query.weights[i] >= .8f * maximum_weight && best < .35f)
      return false;
    strong |= best >= query.thresholds[i];
    mean += query.weights[i] * best;
    weight_sum += query.weights[i];
  }
  if (weight_sum > 0)
    mean /= weight_sum;
  return strong;
}
} // namespace cinema::potion
