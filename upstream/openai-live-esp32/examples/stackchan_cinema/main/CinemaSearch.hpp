#pragma once
#include "CinemaEmbedding.hpp"
#include "CinemaPolicy.hpp"
#include "CinemaPotion.hpp"

namespace cinema {
enum class SearchResult { ok, unknown_words, unsupported_query, cancelled };
// Both transcript cues and explicit library searches use the same bounded
// retrieval/reranking path. All scratch space belongs to the calling task.
template <class Clip, class Word, class Usable, class Proceed>
SearchResult search_library(const char *text, const Clip *clips,
                            const int8_t (*vectors)[50], unsigned count,
                            const Word *words, unsigned word_count,
                            const char *strings, Usable usable, Proceed proceed,
                            Ranking &out) {
  out.count = 0;
  out.minimum = MIN_RELEVANCE;
  float query[50]{};
  if (!embed_local(text, query, 50, words, word_count, strings))
    return SearchResult::unknown_words;
  uint16_t query_words[16];
  const auto n = keywords(text, words, word_count, strings, query_words, 16);
  constexpr unsigned document_words =
      sizeof(clips[0].keywords) / sizeof(uint16_t);
  Candidates<64> semantic;
  Candidates<32> lexical;
  for (unsigned i = 0; i < count; ++i) {
    if (!(i & 127) && !proceed())
      return SearchResult::cancelled;
    if (!usable(i))
      continue;
    semantic.add(i, cosine(query, vectors[i], clips[i].norm, 50),
                 clips[i].source);
    const float exact = exact_coverage(query_words, n, clips[i].keywords,
                                       document_words, words, word_count);
    if (exact > 0)
      lexical.add(i, exact, clips[i].source);
  }
  Candidates<96> coarse;
  for (unsigned i = 0; i < semantic.count; ++i)
    coarse.add(semantic.best[i].id, semantic.best[i].score,
               semantic.best[i].source);
  for (unsigned i = 0; i < lexical.count; ++i) {
    const auto &c = lexical.best[i];
    bool present = false;
    for (unsigned j = 0; j < semantic.count; ++j)
      present |= semantic.best[j].id == c.id;
    if (!present)
      coarse.add(c.id, cosine(query, vectors[c.id], clips[c.id].norm, 50),
                 c.source);
  }
  for (unsigned i = 0; i < coarse.count; ++i) {
    if (!(i & 7) && !proceed())
      return SearchResult::cancelled;
    const auto &c = coarse.best[i];
    const float detail =
        keyword_similarity(query_words, n, clips[c.id].keywords, document_words,
                           words, word_count, 50);
    const float exact = exact_coverage(query_words, n, clips[c.id].keywords,
                                       document_words, words, word_count);
    out.add(c.id, .25f * c.score + .6f * detail + .15f * exact, c.source);
  }
  return SearchResult::ok;
}

template <class Clip, class Word, class Usable, class Proceed>
SearchResult search_potion(const char *text, const Clip *clips,
                           const int8_t (*vectors)[128], unsigned count,
                           const Word *words, unsigned word_count,
                           const char *strings, Usable usable, Proceed proceed,
                           Ranking &out) {
  out.count = 0;
  out.minimum = potion::MIN_SCORE;
  if (!proceed())
    return SearchResult::cancelled;
  potion::Query query;
  switch (potion::prepare_query(text, words, word_count, strings, query)) {
  case potion::QueryResult::unknown:
    return SearchResult::unknown_words;
  case potion::QueryResult::unsupported:
    return SearchResult::unsupported_query;
  case potion::QueryResult::ok:
    break;
  }
  Candidates<64> semantic;
  for (unsigned i = 0; i < count; ++i) {
    if (!(i & 127) && !proceed())
      return SearchResult::cancelled;
    if (usable(i))
      semantic.add(i, cosine(query.pooled, vectors[i], clips[i].norm, 128),
                   clips[i].source);
  }
  constexpr unsigned document_words =
      sizeof(clips[0].keywords) / sizeof(uint16_t);
  for (unsigned i = 0; i < semantic.count; ++i) {
    if (!(i & 7) && !proceed())
      return SearchResult::cancelled;
    const auto &c = semantic.best[i];
    if (c.score < potion::MIN_COSINE)
      continue;
    float support = 0;
    if (!potion::evidence(query, clips[c.id].keywords, document_words, words,
                          word_count, support))
      continue;
    const float score = .55f * c.score + .45f * support;
    if (score >= out.minimum)
      out.add(c.id, score, c.source);
  }
  return proceed() ? SearchResult::ok : SearchResult::cancelled;
}
} // namespace cinema
