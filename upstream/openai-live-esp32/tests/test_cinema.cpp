#include "CinemaCue.hpp"
#include "CinemaEmbedding.hpp"
#include "CinemaPolicy.hpp"
#include "CinemaStorage.hpp"
#include "CinemaTranscript.hpp"
#include "transcript.hpp"
#include <cassert>
#include <cstdio>
#include <fstream>
#include <iterator>
#include <limits>
#include <vector>
using namespace cinema;
void put16(std::vector<uint8_t> &b, size_t p, unsigned v) {
  b[p] = v;
  b[p + 1] = v >> 8;
}
void put32(std::vector<uint8_t> &b, size_t p, uint32_t v) {
  for (int i = 0; i < 4; ++i)
    b[p + i] = v >> (8 * i);
}
int main(int argc, char **argv) {
  {
    for (unsigned i = 0; i < 30000; ++i) {
      char name[16];
      snprintf(name, sizeof(name), "%04u.SCF", i);
      assert(film_index(name, 30000) == int(i));
    }
    assert(film_index("29999.sCf", 30000) == 29999);
    assert(film_index("0000.SCF", 0) == -1);
    assert(film_index("30000.SCF", 30000) == -1);
    for (const auto *name : {"", "0.SCF", "00000.SCF", "-001.SCF", "0000.SCFx",
                             "0000xSCF", "0000.SCX", "abcd.SCF", "../0.SCF"})
      assert(film_index(name, 30000) == -1);
    assert(film_index(nullptr, 30000) == -1);
    for (unsigned i = 0; i < 30000; ++i) {
      char path[40], expected[40];
      snprintf(expected, sizeof(expected), "CINEMA3/%02X/%04u.SCF", i / 256, i);
      assert(film_path(i, true, path, sizeof(path)) && !strcmp(path, expected));
      snprintf(expected, sizeof(expected), "CINEMA/%04u.SCF", i);
      assert(film_path(i, false, path, sizeof(path)) &&
             !strcmp(path, expected));
    }
    char small[8];
    assert(!film_path(30000, true, small, sizeof(small)));
    assert(!film_path(0, true, small, sizeof(small)));
    assert(!film_path(0, true, nullptr, 0));
  }

  struct Word {
    uint32_t offset;
    float scale, norm;
    int8_t vector[3];
  };
  const Word words[] = {{0, .5f, 2.f, {2, 0, 0}},
                        {4, .25f, 4.f, {0, 4, 0}},
                        {8, .2f, 5.f, {0, 0, 5}}};
  const char vocabulary[] = "cat\0dog\0train";
  float embedding[3];
  unsigned matched = 0;
  assert(embed_local("CAT, dog! cat", embedding, 3, words, 3, vocabulary,
                     &matched));
  assert(matched == 3 && std::abs(embedding[0] - 2 / std::sqrt(5.f)) < 1e-6 &&
         std::abs(embedding[1] - 1 / std::sqrt(5.f)) < 1e-6);
  assert(
      !embed_local("unknown \xe7\x8c\xab", embedding, 3, words, 3, vocabulary));
  assert(!embed_local((std::string(50, 'x') + "cat").c_str(), embedding, 3,
                      words, 3, vocabulary));
  assert(embed_local((std::string(50, 'x') + " cat").c_str(), embedding, 3,
                     words, 3, vocabulary));
  uint16_t query_ids[16]{};
  const unsigned nq =
      keywords("cat cat dog", words, 3, vocabulary, query_ids, 16);
  assert(nq == 2 && query_ids[0] == 0 && query_ids[1] == 1);
  const uint16_t exact[] = {0, 1, 65535}, unrelated[] = {2, 65535};
  assert(keyword_similarity(query_ids, nq, exact, 3, words, 3, 3) == 1.f);
  assert(keyword_similarity(query_ids, nq, unrelated, 2, words, 3, 3) == 0.f);
  assert(exact_coverage(query_ids, nq, exact, 3, words, 3) == 1.f);
  assert(exact_coverage(query_ids, nq, unrelated, 2, words, 3) == 0.f);
  Word salient[] = {words[0], words[1], words[2]};
  salient[2].scale = 1.f; // A late, important subject must displace filler.
  assert(keywords("cat dog train", salient, 3, vocabulary, query_ids, 2) == 2);
  assert(query_ids[0] == 2 && query_ids[1] == 0);
  assert(!embed_local("cat", embedding, 0, words, 3, vocabulary));
  auto *scene = cJSON_Parse(SCENE_TOOL);
  assert(scene && !strcmp(cJSON_GetObjectItem(scene, "name")->valuestring,
                          "set_visual_scene"));
  cJSON_Delete(scene);

  assert(crc32(reinterpret_cast<const uint8_t *>("123456789"), 9) ==
         0xcbf43926);
  std::vector<uint8_t> good(44);
  memcpy(good.data(), "SCFILM1\0", 8);
  put16(good, 8, 320);
  put16(good, 10, 240);
  put16(good, 12, 12);
  put16(good, 14, 1);
  put32(good, 16, 44);
  put32(good, 20, 4);
  put32(good, 32, 40);
  put32(good, 36, 4);
  good[40] = good[42] = 0xff;
  good[41] = 0xd8;
  good[43] = 0xd9;
  put32(good, 24, crc32(good.data() + 40, 4));
  Film f;
  assert(f.parse(good.data(), good.size()) && f.count == 1 && f.fps == 12);
  for (size_t size = 0; size < good.size(); ++size)
    assert(!f.parse(good.data(), size) && f.count == 0);
  for (auto p : {0u, 8u, 10u, 16u, 20u, 24u, 28u, 32u, 36u, 40u, 43u}) {
    auto bad = good;
    bad[p] ^= 1;
    assert(!f.parse(bad.data(), bad.size()) && f.count == 0);
  }
  for (auto value : {0u, 21u, 65535u}) {
    auto bad = good;
    put16(bad, 12, value);
    assert(!f.parse(bad.data(), bad.size()));
  }
  for (auto value : {0u, 145u, 65535u}) {
    auto bad = good;
    put16(bad, 14, value);
    assert(!f.parse(bad.data(), bad.size()));
  }
  for (auto value : {0u, 3u, 32769u, 0xffffffffu}) {
    auto bad = good;
    put32(bad, 36, value);
    assert(!f.parse(bad.data(), bad.size()));
  }
  assert(!f.parse(nullptr, 44));
  float q[] = {3, 4};
  assert(normalize(q, 2));
  int8_t v[] = {60, 80};
  assert(std::abs(cosine(q, v, 100, 2) - 1) < 1e-6);
  float zero[] = {0, 0};
  assert(!normalize(zero, 2));
  float nan[] = {std::numeric_limits<float>::quiet_NaN()};
  assert(!normalize(nan, 1));
  float inf[] = {std::numeric_limits<float>::infinity()};
  assert(!normalize(inf, 1));
  Ranking rank;
  History history;
  assert(rank.choose(history, 0) == -1);
  rank.add(1, .8f, 1);
  rank.add(2, .79f, 2);
  rank.add(3, .1f, 3);
  history.add(1, 1);
  assert(rank.choose(history, 0x80000000) == 2);
  assert(rank.choose(history, 0) ==
         2); // No immediate repeat when a relevant alternative exists.
  for (unsigned i = 0; i < 1000; ++i)
    assert(rank.choose(history, i * 4294967u) !=
           3); // No unrelated random picks.
  {
    History recent;
    assert(recent.score_penalty(1, 10) == 0);
    recent.add(1, 10);
    assert(std::abs(recent.score_penalty(1, 10) - .08f) < 1e-6);
    assert(std::abs(recent.score_penalty(2, 10) - .02f) < 1e-6);
    assert(recent.score_penalty(2, 20) == 0);
    float last = recent.score_penalty(1, 10);
    for (unsigned age = 1; age <= 8; ++age) {
      recent.add(100 + age, 100 + age);
      const float penalty = recent.score_penalty(1, 10);
      assert(penalty < last); // Old clips recover gradually, then fully.
      assert(std::abs(penalty - .08f * float(8 - age) / 8) < 1e-6);
      assert(std::abs(recent.score_penalty(2, 10) - penalty / 4) < 1e-6);
      last = penalty;
    }
    for (unsigned i = 0; i < 30; ++i)
      recent.add(1, 10);
    assert(std::abs(recent.score_penalty(1, 10) - .08f) < 1e-6);
    assert(std::abs(recent.score_penalty(2, 10) - .02f) < 1e-6);
  }
  {
    Ranking close;
    close.add(1, .90f, 10);
    close.add(2, .89f, 20);
    close.add(3, .82f, 30);
    History recent, empty;
    recent.add(1, 10);
    recent.add(99, 99); // Top match was recent, but is not the current clip.
    assert(close.choose(empty, 0, true) == 1);
    VisualTopic topic;
    for (int i = 0; i < 10; ++i) {
      assert(topic.update(close, i * 1000000, 'u') == (i == 0));
      assert(topic.fresh);
      assert(topic.ranking.choose(recent, 0, topic.fresh) == 2);
      // New transcript chunks cannot bypass the penalty on the first pick.
    }
    unsigned baseline_repeats = 0, penalized_repeats = 0;
    for (unsigned i = 0; i < 10000; ++i) {
      const uint32_t draw = i * 429496u;
      baseline_repeats += close.choose(empty, draw) == 1;
      const int chosen = close.choose(recent, draw);
      penalized_repeats += chosen == 1;
      assert(chosen == 1 || chosen == 2); // No weak match, even after penalty.
    }
    assert(penalized_repeats > 0); // A soft penalty, not a blanket ban.
    assert(penalized_repeats < baseline_repeats / 4);
    // Another clip from the same film gets a smaller preference adjustment.
    History source;
    source.add(42, 10);
    source.add(99, 99);
    assert(close.choose(source, 0, true) == 2);
    // Immediate repeats are skipped for every possible draw endpoint and fresh
    // cues, even when every good candidate has already been played.
    recent.add(2, 20);
    recent.add(1, 10);
    for (const auto draw : {0u, 0x80000000u, UINT32_MAX}) {
      assert(close.choose(recent, draw) == 2);
      assert(close.choose(recent, draw, true) == 2);
    }
    Ranking only_good;
    only_good.add(1, .90f, 10);
    only_good.add(3, .82f,
                  30); // Would win if the raw relevance guard vanished.
    assert(only_good.choose(recent, 0, true) == 1);
    assert(only_good.choose(recent, UINT32_MAX) == 1);
    Ranking one;
    one.add(1, .90f, 10);
    assert(one.choose(recent, UINT32_MAX, true) == 1);
    assert(one.choose(recent, UINT32_MAX) == 1);
    assert(Ranking{}.choose(recent, 0, true) == -1);
    for (unsigned i = 0; i < 8; ++i)
      recent.add(100 + i, 100 + i);
    assert(close.choose(recent, 0, true) == 1); // Recovery after eight plays.
    assert(close.best[0].score == .90f); // Never rewrite the library's scores.
  }
  for (unsigned i = 0; i < 100; ++i)
    rank.add(i + 10, float(i) / 100, i);
  assert(rank.count == 8 && rank.best[0].id == 109 && rank.best[7].id == 102);
  {
    VisualTopic topic;
    Ranking boats, sports, weak;
    boats.add(10, .95f, 1);
    sports.add(20, .89f, 2);
    weak.add(30, MIN_RELEVANCE - .001f, 3);
    assert(!topic.active(0));
    assert(!topic.update(weak, 0, 'u'));
    assert(!topic.active(0)); // A miss cannot invent a topic.
    assert(topic.update(boats, 0, 'u'));
    assert(topic.fresh && topic.ranking.best[0].id == 10);
    assert(!topic.update(weak, 1000000, 'a'));
    assert(topic.fresh); // A pending best match must survive filler too.
    topic.fresh = false; // First matching clip was actually displayed.
    for (int64_t seconds = 10; seconds < 180; seconds += 10) {
      const auto now = seconds * 1000000;
      assert(!topic.update(weak, now, 'a'));
      assert(!topic.update(Ranking{}, now, 'u')); // Unknown vocabulary.
      assert(topic.active(now) && topic.ranking.best[0].id == 10);
      assert(
          !topic.fresh); // Do not cancel prefetch or restart best-only picks.
      assert(topic.expires_at == 180000000); // Filler cannot renew forever.
    }
    assert(topic.active(179999999));
    assert(!topic.active(180000000));
    assert(topic.update(weak, 180000000, 'u'));
    assert(topic.ranking.count == 0);
    assert(topic.update(boats, 200000000, 'u'));
    assert(!topic.update(sports, 205000000, 'a'));
    assert(topic.ranking.best[0].id == 10 && topic.expires_at == 380000000);
    assert(topic.update(sports, 205000000, 'u'));
    assert(topic.fresh && topic.ranking.best[0].id == 20);
    assert(topic.expires_at == 385000000); // Strong topic changes take effect.
    assert(topic.update(boats, 210000000, 't'));
    assert(topic.expires_at == 255000000); // Explicit cues keep their policy.
    assert(!topic.update(weak, 220000000, 'u'));
    assert(topic.update(weak, 230000000, 't'));
    assert(!topic.active(230000000)); // Do not misrepresent a failed request.
    assert(topic.update(sports, 240000000, 'u'));
    topic.request(20, 2, 241000000, &sports);
    assert(topic.active(241000000) && topic.user_directed);
    assert(topic.expires_at == 421000000 && topic.ranking.best[0].id == 20);
    assert(!topic.update(boats, 242000000, 'a'));
    assert(topic.update(boats, 243000000, 'u'));
    topic.request(10, 1, 244000000); // Keep a matching active subject.
    assert(topic.ranking.best[0].id == 10);
    topic.request(99, 9,
                  245000000); // An exact-ID request has no invented topic.
    assert(topic.ranking.count == 1 && topic.ranking.best[0].id == 99);
    assert(!topic.update(boats, 246000000, 'a'));
    assert(topic.update(boats, 425000000,
                        'a')); // Assistant can seed after expiry.
    assert(!topic.user_directed);
    topic.clear(); // Session end / cinema off discards the held topic.
    assert(!topic.active(240000000) && !topic.fresh && !topic.expires_at);
  }
  {
    live_transcript_t captions{};
    TranscriptCursor cursor;
    assert(cursor.next(captions) == -1);
    live_captions::append(captions, LIVE_SPEAKER_USER, "cats", 0, 100);
    live_captions::append(captions, LIVE_SPEAKER_ASSISTANT, "A little kitten",
                          101, 200);
    assert(captions.last_speaker == LIVE_SPEAKER_ASSISTANT);
    assert(cursor.next(captions) == 0); // Fast replies cannot hide the user.
    assert(cursor.next(captions) == 0); // Failed enqueue must be retried.
    cursor.accept(captions, 0);
    assert(cursor.next(captions) == 1);
    cursor.accept(captions, 1);
    assert(cursor.next(captions) == -1);
    live_captions::append(captions, LIVE_SPEAKER_USER, " and boats", 201, 300);
    assert(cursor.next(captions) ==
           0); // Earlier blocks can grow during overlap.
    cursor.accept(captions, 0);
    for (unsigned i = 1; i <= 12; ++i) {
      live_captions::append(captions, LIVE_SPEAKER_USER, "cats", i * 4000,
                            i * 4000 + 100);
      live_captions::append(captions, LIVE_SPEAKER_ASSISTANT, "Same answer",
                            i * 4000 + 101, i * 4000 + 200);
      const int user = cursor.next(captions);
      assert(user >= 0 && captions.blocks[user].speaker == LIVE_SPEAKER_USER);
      cursor.accept(captions, unsigned(user));
      const int assistant = cursor.next(captions);
      assert(assistant >= 0 &&
             captions.blocks[assistant].speaker == LIVE_SPEAKER_ASSISTANT);
      cursor.accept(captions, unsigned(assistant));
      assert(cursor.next(captions) == -1); // Same text, new IDs, ring rollover.
    }
    live_captions::clear(captions);
    live_captions::append(captions, LIVE_SPEAKER_USER, "cats", 0, 100);
    assert(cursor.next(captions) == 0); // A new generation can reuse IDs.
    cursor.accept(captions, 0);
    live_captions::clear(captions);
    live_captions::append(captions, LIVE_SPEAKER_USER, "hi", 0, 100);
    live_captions::append(captions, LIVE_SPEAKER_ASSISTANT, "Welcome aboard",
                          101, 200);
    assert(cursor.next(captions) ==
           1); // Tiny user fragments cannot starve replies.
  }
  assert(frame_at(-1, 12, 96) == 0);
  assert(frame_at(3000000, 12, 96) == 36);
  assert(frame_at(1000000000, 12, 96) == 96);
  assert(frame_at(100, 0, 0) == 0);
  assert(frame_at(100, 1000001, 96) == 0);
  // A ready new cue/mode cannot replace an eight-second clip after two seconds.
  assert(!transition_due(2000000, 12, 96, 23, -1));
  assert(!transition_due(7999999, 12, 96, 95, 7900000));
  assert(transition_due(8000000, 12, 96, 95, 7900000));
  // Neither late decoding nor a failed display publication can skip the end.
  assert(!transition_due(9000000, 12, 96, 94, -1));
  assert(!transition_due(9000000, 12, 96, 95, -1));
  assert(!transition_due(9000000, 12, 96, 95, 9000000));
  assert(!transition_due(9083333, 12, 96, 95, 9000000));
  assert(transition_due(9083334, 12, 96, 95, 9000000));
  assert(!transition_due(9000000, 12, 96, 95, 9000001));
  assert(!transition_due(9000000, 0, 0, -1, -1));
  assert(!transition_due(9000000, 21, 96, 95, 0));
  for (unsigned fps = 1; fps <= 20; ++fps) {
    for (unsigned count : {1u, 24u, 96u, MAX_FRAMES}) {
      const auto end = clip_duration_us(fps, count);
      const auto final = end - clip_duration_us(fps, 1);
      assert(!transition_due(end - 1, fps, count, int(count - 1), final));
      assert(transition_due(end, fps, count, int(count - 1), final));
    }
  }
  assert(playback_frame(95, 96) == 95);
  assert(playback_frame(96, 96) == 95);
  assert(playback_frame(UINT64_MAX, 96) == 95);
  assert(playback_frame(UINT64_MAX, 0) == 0);
  assert(!hold_final_frame(95, 96, 95));
  assert(
      !hold_final_frame(96, 96, 94)); // Publish the final frame before holding.
  assert(hold_final_frame(96, 96, 95));
  assert(hold_final_frame(UINT64_MAX, 96, 95));
  assert(!hold_final_frame(0, 0, -1));
  {
    struct Clip {
      unsigned source = 0;
      unsigned neighbors[8]{};
    } clips[12]{};
    for (unsigned i = 0; i < 12; ++i)
      clips[i].source = i;
    for (unsigned i = 0; i < 8; ++i)
      clips[0].neighbors[i] = i + 1;
    History history;
    history.add(0, 0);
    auto usable = [](unsigned) { return true; };
    VisualTopic topic;
    Ranking single;
    single.add(0, .9f, 0);
    topic.update(single, 0, 'u');
    topic.presented(0);
    int current = 0;
    for (unsigned i = 0; i < 40; ++i) {
      // A single-hit topic used to freeze here until its 180-second TTL.
      assert(topic.active(i * 1000000) && !topic.remaining(current).count);
      const auto choices = association_candidates(
          topic.ranking.best[0].id, current, clips, 12, history, usable);
      const int next = choices.choose(history, i * 123456789u);
      assert(next > 0 && next <= 8 && next != current);
      if (i < 8)
        for (int old : history.clips)
          assert(old != next); // Visit every fresh neighbor before repeating.
      history.add(next, next);
      current = next;
      assert(!topic.update(Ranking{}, i * 1000000, 'a'));
      topic.update(single, i * 1000000, 'u'); // Same subject does not replay 0.
    }
    // Neighbors of the displayed neighbor point back to 0 by default. Staying
    // anchored to the topic is what prevents drifting or restarting that clip.
    assert(!association_candidates(-1, 0, clips, 12, history, usable).count);
    assert(!association_candidates(12, 0, clips, 12, history, usable).count);
    clips[0].neighbors[0] = 999;
    clips[0].neighbors[1] = 0;
    clips[0].neighbors[2] = 4; // Duplicate the next entry.
    const auto limited =
        association_candidates(0, 4, clips, 12, history,
                               [](unsigned id) { return id == 4 || id == 8; });
    assert(limited.count == 1 && limited.best[0].id == 8);
    assert(!association_candidates(0, 8, clips, 12, history, [](unsigned id) {
              return id == 8;
            }).count); // A one-playable-clip pack must not loop it.
    Ranking new_subject;
    new_subject.add(9, .9f, 9);
    assert(topic.update(new_subject, 50000000, 'u'));
    assert(topic.remaining(current).best[0].id == 9);
  }
  {
    VisualTopic topic;
    Ranking matches;
    matches.minimum = .5f;
    matches.add(1, .65f, 1);
    matches.add(2, .62f, 2);
    matches.add(3, .51f, 3); // Outside the original subject's relevance guard.
    assert(topic.update(matches, 1, 'u'));
    assert(topic.remaining(-1).count == 2);
    assert(topic.remaining(1).count == 1); // Do not prefetch the current clip.
    topic.presented(1);
    assert(topic.remaining(-1).best[0].id == 2);
    // Rephrasing preserves seen clips and does not cancel pending SD prefetch.
    topic.fresh = false;
    assert(!topic.update(matches, 2, 'u'));
    assert(!topic.fresh && topic.expires_at == 180000002);
    assert(topic.remaining(-1).count == 1);
    topic.presented(2);
    assert(topic.remaining(-1).count == 0);
    topic.request(1, 1, 3,
                  &matches); // Explicit requests bypass auto selection.
    assert(topic.active(4) && topic.remaining(-1).count == 0);
    Ranking other;
    other.minimum = .5f;
    other.add(9, .6f, 9);
    assert(topic.update(other, 5, 'u'));
    assert(topic.remaining(-1).best[0].id == 9);
    topic.presented(9);
    assert(topic.remaining(-1).count == 0);
    assert(topic.update(other, topic.expires_at + 1, 'u'));
    assert(topic.remaining(-1).count == 1); // A new topic lifetime can replay.
    topic.clear();
    assert(topic.shown == 0 && topic.remaining(-1).count == 0);
  }
  bool seen_visible = false;
  assert(!visibility_paused(true, false,
                            seen_visible)); // First GUI refresh pending.
  assert(!visibility_paused(true, true, seen_visible));
  assert(visibility_paused(true, false, seen_visible)); // Photo/usage overlay.
  assert(
      !visibility_paused(true, true, seen_visible)); // Resume existing movie.
  assert(!visibility_paused(false, false, seen_visible));
  assert(
      !visibility_paused(true, false, seen_visible)); // Re-enable can publish.
  {
    int64_t clock = 0;
    unsigned attempts = 0, reads = 0;
    bool cancelled = false;
    const auto now = [&] { return clock; };
    const auto stopped = [&] { return cancelled; };
    const auto wait = [&] { clock += 100000; };
    assert(retry_card_access(
               [&] {
                 if (++attempts < 3)
                   return false; // Busy display, not a bad SD file.
                 ++reads;
                 return true;
               },
               stopped, now, wait) == ReadResult::ok);
    assert(attempts == 3 && reads == 1);
    attempts = 0;
    assert(retry_card_access(
               [&] {
                 ++attempts;
                 return false;
               },
               stopped, now, wait) == ReadResult::retry);
    assert(attempts == 21); // Finite wait, preserves retryable classification.
    attempts = 0;
    assert(retry_card_access(
               [&] {
                 ++attempts;
                 cancelled = true;
                 return false;
               },
               stopped, now, wait) == ReadResult::cancelled);
    assert(attempts == 1); // Stop/photo cancels before another lock attempt.
  }
  char cue[257];
  transcript_cue(nullptr, cue);
  assert(!cue[0]);
  transcript_cue("a short thought", cue);
  assert(!strcmp(cue, "a short thought"));
  const std::string tail(254, 'x');
  transcript_cue((std::string(40, 'a') + "\xe7\x8c\xab" + tail).c_str(), cue);
  assert(cue == tail); // Cut starts inside the three-byte cat character.
  const std::string emoji_tail = "\xf0\x9f\x90\x88" + std::string(252, 'b');
  transcript_cue((std::string(40, 'a') + emoji_tail).c_str(), cue);
  assert(cue == emoji_tail); // Complete four-byte boundary survives.
  assert(parse_cue("{\"description\":\"old telephone\"}", cue));
  assert(!strcmp(cue, "old telephone"));
  for (auto bad :
       {"null", "[]", "{}", "{\"description\":1}", "{\"description\":\"xy\"}",
        "{\"description\":\"abc\",\"extra\":true}",
        "{\"description\":\"abc\",\"description\":\"def\"}",
        "{\"description\":\"abc\\u0000hidden\"}",
        "{\"description\":\"abc\"} trailing"})
    assert(!parse_cue(bad, cue) && !cue[0]);
  std::string huge = "{\"description\":\"" + std::string(257, 'a') + "\"}";
  assert(!parse_cue(huge.c_str(), cue));
  Mailbox mailbox;
  uint32_t old = 0, latest = 0;
  assert(!mailbox.take(cue, old));
  assert(mailbox.submit("first conversation", 0, false));
  assert(mailbox.take(cue, old));
  assert(mailbox.accepts(old));
  assert(mailbox.submit("camera counterpart", 1, true));
  assert(!mailbox.accepts(old));
  assert(!mailbox.submit("streamed delta", 20000000, false));
  assert(mailbox.take(cue, latest) && !strcmp(cue, "camera counterpart"));
  mailbox.invalidate(); // Stop/off must invalidate even a request already in
                        // flight.
  assert(!mailbox.accepts(latest));
  assert(mailbox.submit("next session", 20000001, false));
  assert(mailbox.take(cue, latest) && !strcmp(cue, "next session"));
  // Also validate real exported pack files, without needing the embedded codec.
  for (int i = 1; i < argc; ++i) {
    std::ifstream input(argv[i], std::ios::binary);
    std::vector<uint8_t> data((std::istreambuf_iterator<char>(input)), {});
    if (!f.parse(data.data(), data.size())) {
      fprintf(stderr, "Invalid film: %s\n", argv[i]);
      return 1;
    }
  }
  printf("Cinema parser/selection checks passed; %d exported files validated\n",
         argc - 1);
}
