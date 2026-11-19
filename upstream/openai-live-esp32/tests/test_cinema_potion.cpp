#include "CinemaSearch.hpp"
#include <cassert>
#include <string>

using namespace cinema;
int main() {
  struct Word {
    uint32_t offset;
    float scale, norm;
    int8_t vector[128];
    uint8_t flags;
  };
  const char strings[] = "##s\0a\0cat\0dog\0hello\0kitten\0kittens\0not\0z";
  Word words[] = {{0, 1, 0, {}, 1},
                  {4, 1, 127, {127}, 1},
                  {6, 1, 127, {127}, 1},
                  {10, 1, 127, {0, 127}, 1},
                  {14, 1, 127, {127}, 3},
                  {20, 1, 127, {127}, 1},
                  {27, 1, 127, {127}, 0},
                  {35, 1, 127, {127}, 3},
                  {39, 1, 127, {0, 0, 127}, 1}};
  constexpr unsigned count = sizeof(words) / sizeof(words[0]);
  uint16_t ids[potion::MAX_WORD]{};
  assert(potion::pieces("kittens", words, count, strings, ids) == 2);
  assert(ids[0] == 5 && ids[1] == 0); // Cached lexeme did not change WordPiece.
  assert(potion::pieces("ax", words, count, strings, ids) == 0);
  float v[128];
  assert(!potion::encode("ax", words, count, strings, v));
  assert(potion::encode("ax cat", words, count, strings, v) && v[0] == 1);
  assert(
      !potion::encode(std::string(101, 'a').c_str(), words, count, strings, v));
  assert(!potion::encode(nullptr, words, count, strings, v));
  assert(!potion::encode("猫", words, count, strings, v));
  assert(potion::encode("CAT\0dog", words, count, strings, v) && v[0] == 1);
  assert(potion::encode("cat \xff dog", words, count, strings, v));
  assert(std::abs(v[0] - v[1]) < 1e-6);
  std::string long_text;
  for (unsigned i = 0; i < 256; ++i)
    long_text += "cat ";
  long_text += "dog";
  assert(potion::encode(long_text.c_str(), words, count, strings, v));
  assert(v[0] == 1 && v[1] == 0);
  assert(!potion::encode((std::string(2048, ' ') + "cat").c_str(), words, count,
                         strings, v));
  potion::Query q;
  assert(potion::prepare_query("hello CAT cat", words, count, strings, q) ==
         potion::QueryResult::ok);
  assert(q.count == 1 && q.pooled[0] == 1 && q.thresholds[0] == .65f);
  assert(potion::prepare_query("kittens", words, count, strings, q) ==
         potion::QueryResult::ok);
  assert(q.thresholds[0] == .90f);
  assert(potion::prepare_query("cat not dog", words, count, strings, q) ==
         potion::QueryResult::unsupported);
  assert(potion::prepare_query("hello", words, count, strings, q) ==
         potion::QueryResult::unknown);
  for (auto text : {"cat don't", "cat can ' t", "cat cannot", "cat no dog"})
    assert(potion::prepare_query(text, words, count, strings, q) ==
           potion::QueryResult::unsupported);
  Word greeting[] = {{0, 1, 127, {127}, 3}, {5, 1, 127, {127}, 1}};
  assert(potion::prepare_query("Good morning", greeting, 2, "good\0morning",
                               q) == potion::QueryResult::unknown);
  assert(potion::find("cat", words, 65535, strings) == -1);
  struct Clip {
    uint32_t source;
    float norm;
    uint16_t keywords[2];
  };
  Clip clips[] = {
      {1, 127, {5, 65535}}, {2, 127, {3, 65535}}, {3, 127, {65535, 65535}}};
  int8_t vectors[3][128] = {{127}, {0, 127}, {0, 0, 127}};
  auto available = [](unsigned) { return true; };
  auto proceed = [] { return true; };
  Ranking ranking;
  assert(search_potion("cat", clips, vectors, 3, words, count, strings,
                       available, proceed, ranking) == SearchResult::ok);
  assert(ranking.count == 1 && ranking.best[0].id == 0 &&
         ranking.minimum == .5f);
  VisualTopic topic;
  assert(topic.update(ranking, 1, 'u') && topic.active(2));
  topic.request(0, 1, 3, &ranking);
  assert(topic.ranking.minimum == .5f);
  assert(search_potion("z", clips, vectors, 3, words, count, strings, available,
                       proceed, ranking) == SearchResult::ok);
  assert(ranking.count == 0); // Pooled match alone is insufficient evidence.
  assert(search_potion("cat dog", clips, vectors, 3, words, count, strings,
                       available, proceed, ranking) == SearchResult::ok);
  assert(ranking.count == 0); // Do not average away a missing salient subject.
  unsigned calls = 0;
  auto cancel = [&] { return ++calls < 3; };
  assert(search_potion("cat", clips, vectors, 3, words, count, strings,
                       available, cancel, ranking) == SearchResult::cancelled);
  assert(search_potion("cat without dog", clips, vectors, 3, words, count,
                       strings, available, proceed,
                       ranking) == SearchResult::unsupported_query);
  assert(search_potion(
             "cat", clips, vectors, 3, words, count, strings,
             [](unsigned) { return false; }, proceed,
             ranking) == SearchResult::ok);
  assert(ranking.count == 0);
  // Bounded arbitrary UTF-8/invalid byte input, including long partial tokens.
  for (unsigned n = 1; n < 2048; n += 7) {
    std::string fuzz(n, ' ');
    for (unsigned i = 0; i < n; ++i)
      fuzz[i] = char((i * 37 + n) % 255 + 1);
    potion::prepare_query(fuzz.c_str(), words, count, strings, q);
  }
}
