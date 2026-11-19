// Host-only parity/latency probe. Compile against an external prepared pack;
// no model/media is checked into the repository. One input query per line.
#include "CinemaAssets.hpp"
#include "CinemaSearch.hpp"
#include <chrono>
#include <iostream>
#include <string>

int main(int argc, char **argv) {
  const bool encode = argc == 2 && std::string(argv[1]) == "--encode";
  std::string line;
  while (std::getline(std::cin, line)) {
    if (line.size() > 8192)
      return 2;
    const auto start = std::chrono::steady_clock::now();
    cinema::Ranking ranking;
    auto usable = [](unsigned) { return true; };
    auto proceed = [] { return true; };
#ifdef CINEMA_ENCODER_POTION
    if (encode) {
      cinema::potion::Query q;
      const auto result = cinema::potion::prepare_query(
          line.c_str(), cinema::assets::WORDS, cinema::assets::WORD_COUNT,
          cinema::assets::WORD_STRINGS, q);
      std::cout << "{\"status\":" << unsigned(result) << ",\"vector\":[";
      for (unsigned i = 0; result == cinema::potion::QueryResult::ok && i < 128;
           ++i)
        std::cout << (i ? "," : "") << q.pooled[i];
      std::cout << "]}\n";
      continue;
    }
    const auto result = cinema::search_potion(
#else
    (void)encode;
    const auto result = cinema::search_library(
#endif
        line.c_str(), cinema::assets::CLIPS, cinema::assets::VECTORS,
        cinema::assets::COUNT, cinema::assets::WORDS,
        cinema::assets::WORD_COUNT, cinema::assets::WORD_STRINGS, usable,
        proceed, ranking);
    const auto us = std::chrono::duration_cast<std::chrono::microseconds>(
                        std::chrono::steady_clock::now() - start)
                        .count();
    std::cout << "{\"status\":" << unsigned(result) << ",\"us\":" << us
              << ",\"minimum\":" << ranking.minimum << ",\"results\":[";
    for (unsigned i = 0; i < ranking.count; ++i)
      std::cout << (i ? "," : "") << "{\"index\":" << ranking.best[i].id
                << ",\"score\":" << ranking.best[i].score << "}";
    std::cout << "]}\n";
  }
}
