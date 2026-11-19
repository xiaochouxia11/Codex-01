/* SDP regressions use documentation/loopback addresses and synthetic identity.
 */
#include "sdp.h"
#include "peer.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define FP                                                                     \
  "AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:"   \
  "AA:AA:AA:AA:AA:AA:AA:AA"
#define FP384                                                                  \
  "BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:"   \
  "BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB"
#define TRANSPORT                                                              \
  "a=ice-ufrag:abcd\r\na=ice-pwd:abcdefghijklmnopqrstuvwxyz\r\na=fingerprint:" \
  "sha-256 " FP "\r\na=setup:active\r\n"
#define CANDIDATE "a=candidate:1 1 UDP 12345 127.0.0.1 12345 typ host\r\n"
static unsigned checks, failures;
#define CHECK(x)                                                               \
  do {                                                                         \
    ++checks;                                                                  \
    if (!(x)) {                                                                \
      ++failures;                                                              \
      fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #x);             \
    }                                                                          \
  } while (0)
static char text[PEER_SDP_LIMIT];
static void build(const char *session, const char *audio, const char *data) {
  int n = snprintf(
      text, sizeof(text),
      "v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\na=group:BUNDLE audio "
      "data\r\n%s"
      "m=audio 9 UDP/TLS/RTP/SAVPF 111\r\nc=IN IP4 "
      "0.0.0.0\r\na=mid:audio\r\na=rtpmap:111 opus/48000/2\r\na=rtcp-mux\r\n%s"
      "m=application 9 UDP/DTLS/SCTP "
      "webrtc-datachannel\r\na=mid:data\r\na=sctp-port:5000\r\n%s",
      session, audio, data);
  CHECK(n > 0 && (size_t)n < sizeof(text));
}
static void replace(const char *from, const char *to) {
  char copy[sizeof(text)];
  const char *at = strstr(text, from);
  CHECK(at != NULL);
  if (!at)
    return;
  size_t prefix = (size_t)(at - text);
  int n = snprintf(copy, sizeof(copy), "%.*s%s%s", (int)prefix, text, to,
                   at + strlen(from));
  CHECK(n > 0 && (size_t)n < sizeof(copy));
  memcpy(text, copy, (size_t)n + 1);
}
static PeerSdp parse(const char *name, int valid) {
  PeerSdp result, before;
  memset(&result, 0xa5, sizeof(result));
  memcpy(&before, &result, sizeof(before));
  int rc = peer_sdp_parse(text, strlen(text), &result);
  ++checks;
  if ((rc == 0) != valid) {
    ++failures;
    fprintf(stderr, "FAIL case %s: rc=%d wanted valid=%d\n", name, rc, valid);
  }
  if (rc)
    CHECK(!memcmp(&result, &before, sizeof(result)));
  return result;
}
static void transport_scope(void) {
  build("", TRANSPORT CANDIDATE, "");
  PeerSdp s = parse("BUNDLE transport only on tag", 1);
  CHECK(!strcmp(s.ufrag, "abcd") && s.candidate_count == 1);
  build(TRANSPORT,
        "a=ice-ufrag:efgh\r\na=ice-pwd:ABCDEFGHIJKLMNOPQRSTUVWXYZ\r\na=setup:"
        "passive\r\n" CANDIDATE,
        "");
  s = parse("media overrides session defaults", 1);
  CHECK(!strcmp(s.ufrag, "efgh") &&
        !strcmp(s.password, "ABCDEFGHIJKLMNOPQRSTUVWXYZ") && s.setup == 2);
  build(TRANSPORT, CANDIDATE "a=fingerprint:sha-384 " FP384 "\r\n", "");
  parse("unsupported media fingerprint must not inherit session SHA256", 0);
  build(TRANSPORT,
        CANDIDATE "a=fingerprint:SHA-256 " FP "\r\na=fingerprint:sha-384 " FP384
                  "\r\n",
        "");
  parse("media fingerprint set with SHA256 and SHA384", 1);
  build("", TRANSPORT CANDIDATE,
        TRANSPORT "a=candidate:2 1 UDP 2147483647 127.0.0.2 9999 typ host\r\n");
  s = parse("non-tag candidate is not a BUNDLE destination", 1);
  CHECK(s.candidate_count == 1 && s.candidates[0].addr.port == 12345);
  build("", TRANSPORT, TRANSPORT CANDIDATE);
  parse("non-tag candidate cannot rescue missing tag candidates", 0);
  build("", TRANSPORT CANDIDATE, "a=ice-ufrag:conflict\r\n");
  parse("conflicting repeated BUNDLE credential", 0);
  build("", TRANSPORT CANDIDATE, "a=fingerprint:sha-384 " FP384 "\r\n");
  parse("conflicting repeated fingerprint set", 0);
  build("", TRANSPORT CANDIDATE, TRANSPORT);
  replace("a=setup:active", "a=setup:active\r\na=setup:passive");
  parse("same-scope setup conflict", 0);
  build("", TRANSPORT CANDIDATE, TRANSPORT);
  replace("a=fingerprint:sha-256", "a=fingerprint:SHA-256");
  parse("case-insensitive hash algorithm", 1);
}
static void boundaries(void) {
  build(TRANSPORT, CANDIDATE, "");
  replace("a=mid:audio", "a=mid:au:dio");
  replace("BUNDLE audio data", "BUNDLE au:dio data");
  parse("invalid MID token even when BUNDLE matches", 0);
  build(TRANSPORT, CANDIDATE "a=ice-ufrag\r\n", "");
  parse("bare credential cannot inherit a default", 0);
  build(TRANSPORT, CANDIDATE "a=fingerprint\r\n", "");
  parse("bare fingerprint cannot inherit a default", 0);
  build(TRANSPORT, CANDIDATE "a=rtcp-mux:yes\r\n", "");
  parse("malformed flag attribute", 0);
  build(TRANSPORT, CANDIDATE, "");
  replace("a=mid:audio", "a=mid:audio\r\na=setup:passive");
  PeerSdp s = parse("independent setup override", 1);
  CHECK(s.setup == 2);
  build(TRANSPORT, CANDIDATE, "");
  replace("a=mid:audio", "a=mid:audio\r\na=fingerprint:sha-256 "
                         "BB:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:"
                         "AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA");
  s = parse("media identity replaces session identity", 1);
  CHECK(!strncmp(s.fingerprint, "BB:", 3));
  build(TRANSPORT, CANDIDATE "a=candidate\r\n", "");
  parse("bare candidate attribute", 0);
  build(TRANSPORT "a=group:BUNDLE\r\n", CANDIDATE, "");
  parse("empty second BUNDLE group", 0);
  build(TRANSPORT, CANDIDATE "a=ssrc:1 \r\n", "");
  parse("empty SSRC source attribute", 0);
  build(TRANSPORT "a=ssrc:1 cname:source\r\n", CANDIDATE, "");
  parse("session-level SSRC", 0);
  build(TRANSPORT, CANDIDATE, "a=ssrc:1 cname:source\r\n");
  parse("data-section SSRC", 0);
  build(TRANSPORT, CANDIDATE, "");
  size_t length = strlen(text);
  for (size_t i = 0; i < length; ++i) {
    PeerSdp out, before;
    memset(&out, 0x5a, sizeof(out));
    memcpy(&before, &out, sizeof(before));
    CHECK(peer_sdp_parse(text, i, &out) == -1);
    CHECK(!memcmp(&out, &before, sizeof(out)));
  }
  text[20] = 0;
  PeerSdp out;
  CHECK(peer_sdp_parse(text, length, &out) == -1);
  build(TRANSPORT, CANDIDATE, "");
  char extra[1026];
  memcpy(extra, "a=x:", 4);
  memset(extra + 4, 'x', 1019);
  memcpy(extra + 1023, "\r\n", 3);
  size_t base = strlen(text);
  memcpy(text + base, extra, sizeof(extra));
  parse("maximum line length", 1);
  text[base + 1023] = 'x';
  strcpy(text + base + 1024, "\r\n");
  parse("overlong line", 0);
  build(TRANSPORT, CANDIDATE, "");
  replace("s=-", "s=\xc0\x80");
  parse("invalid UTF8", 0);
}
static void grammar(void) {
  build(TRANSPORT, CANDIDATE, "");
  replace("s=-", "s=Voice \xe2\x98\x83");
  parse("UTF8 session name", 1);
  replace("opus/48000/2", "OpUs/48000/2");
  parse("case-insensitive Opus encoding name", 1);
  build(TRANSPORT "a=recvonly\r\n", CANDIDATE "a=sendrecv\r\n", "");
  parse("audio direction overrides session default", 1);
  replace("a=sendrecv", "a=sendrecv\r\na=sendrecv");
  parse("duplicate direction", 0);
  build(TRANSPORT, CANDIDATE, "");
  replace("s=-\r\n", "");
  parse("missing mandatory session name", 0);
  build(TRANSPORT, CANDIDATE, "");
  replace("o=- 1 1 IN IP4 0.0.0.0\r\n", "");
  parse("missing origin", 0);
  build(TRANSPORT, CANDIDATE, "");
  replace("t=0 0\r\n", "");
  parse("missing timing", 0);
  build(TRANSPORT, CANDIDATE, "");
  replace("t=0 0", "t=not-a-time 0");
  parse("malformed timing", 0);
  build(TRANSPORT, CANDIDATE, "");
  replace("o=- 1 1 IN IP4 0.0.0.0", "o=garbage");
  parse("malformed origin", 0);
  build(TRANSPORT, CANDIDATE, "");
  replace("s=-", "v=1\r\ns=-");
  parse("second version", 0);
  build(TRANSPORT, CANDIDATE, "");
  replace("s=-", "s=-\r\nx=unknown");
  parse("unknown SDP field type", 0);
  build(TRANSPORT, CANDIDATE, "");
  replace("a=mid:audio", "a=mid:audio\r\nv=0");
  parse("session field after media", 0);
  build(TRANSPORT, CANDIDATE, "");
  replace("a=mid:data", "a=mid:bad:token");
  parse("invalid MID token", 0);
  build(TRANSPORT, CANDIDATE, "");
  replace("s=-", "s=-\r\na=x-description:\xe2\x98\x83");
  parse("unknown UTF8 attribute", 1);
}
static void candidates(void) {
  build(TRANSPORT, CANDIDATE, "");
  replace("typ host", "typ srflx raddr 192.0.2.1 rport 4567");
  PeerSdp s = parse("related address retained", 1);
  CHECK(s.candidates[0].raddr.port == 4567);
  replace("rport 4567", "rport 65536");
  parse("related port overflow", 0);
  build(TRANSPORT, CANDIDATE, "");
  replace("typ host", "typ srflx raddr 999.999.999.999 rport 4567");
  parse("malformed related address", 0);
  build(TRANSPORT, CANDIDATE, "");
  replace("typ host", "typ srflx raddr 0.0.0.0 rport 0");
  parse("obfuscated related address", 1);
  build(TRANSPORT, CANDIDATE, "");
  replace("typ host", "typ srflx raddr 192.0.2.1 rport 4 rport 5");
  parse("duplicate related port", 0);
  build(TRANSPORT, CANDIDATE, "");
  replace("typ host", "typ srflx");
  parse("missing related address", 0);
}
static void public_atomicity(void) {
  CHECK(peer_init() == 0);
  PeerConfiguration cfg = {.local_address = "127.0.0.1",
                           .audio_codec = CODEC_OPUS,
                           .datachannel = DATA_CHANNEL_STRING};
  PeerConnection *pc = peer_connection_create(&cfg);
  CHECK(pc != NULL);
  if (!pc)
    return;
  CHECK(peer_connection_create_offer(pc) != NULL);
  build(TRANSPORT, CANDIDATE "a=fingerprint:sha-384 " FP384 "\r\n", "");
  CHECK(peer_connection_set_remote_description_n(pc, text, strlen(text),
                                                 SDP_TYPE_ANSWER) == -1);
  CHECK(peer_connection_get_state(pc) == PEER_CONNECTION_NEW);
  build("", TRANSPORT CANDIDATE, "");
  CHECK(peer_connection_set_remote_description_n(pc, text, strlen(text),
                                                 SDP_TYPE_ANSWER) == 0);
  CHECK(peer_connection_get_state(pc) == PEER_CONNECTION_CHECKING);
  peer_connection_destroy(pc);
  CHECK(peer_deinit() == 0);
}
static void fingerprint_matrix(void) {
  const char *fp[] = {"", "a=fingerprint:sha-256 " FP "\r\n",
                      "a=fingerprint:sha-384 " FP384 "\r\n"};
  for (int role = 0; role < 2; ++role)
    for (int media = 0; media < 3; ++media)
      for (int session = 0; session < 3; ++session)
        for (int tag = 0; tag < 3; ++tag)
          for (int other = 0; other < (media == 2 ? 3 : 1); ++other) {
            int audio = media != 1, data = media != 0;
            int valid = (tag ? tag == 1 : session == 1) && other != 2;
            snprintf(text, sizeof(text),
                     "v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\n"
                     "a=group:BUNDLE %s\r\na=ice-ufrag:abcd\r\n"
                     "a=ice-pwd:abcdefghijklmnopqrstuvwxyz\r\na=setup:%s\r\n%s",
                     media == 2 ? "audio data"
                     : audio    ? "audio"
                                : "data",
                     role ? "passive" : "active", fp[session]);
            if (audio) {
              strcat(text,
                     "m=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:audio\r\n"
                     "a=rtpmap:111 opus/48000/2\r\na=rtcp-mux\r\n" CANDIDATE);
              strcat(text, fp[tag]);
            }
            if (data) {
              strcat(text,
                     "m=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n"
                     "a=mid:data\r\na=sctp-port:5000\r\n");
              if (!audio)
                strcat(text, CANDIDATE);
              strcat(text, fp[audio ? other : tag]);
            }
            PeerSdp s =
                parse("fingerprint presence / scope / algorithm matrix", valid);
            if (valid)
              CHECK(!strcmp(s.fingerprint, FP) && s.setup == role + 1);
          }
  /* Chromium excessive negotiated-count bugs: reject unsupported media rather
     than indexing another section into the fixed transport scopes. */
  build(TRANSPORT, CANDIDATE, "");
  strcat(text, "m=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:extra\r\n");
  parse("extra media section", 0);
  build(TRANSPORT, CANDIDATE, "");
  replace("m=audio 9 UDP/TLS/RTP/SAVPF 111", "m=video 9 UDP/TLS/RTP/SAVPF 96");
  parse("unsupported video / simulcast surface", 0);
  char candidates[2048] = "";
  for (unsigned i = 0; i <= PEER_SDP_CANDIDATES; ++i) {
    char candidate[128];
    snprintf(candidate, sizeof(candidate),
             "a=candidate:%u 1 UDP 12345 127.0.0.1 %u typ host\r\n", i + 1,
             12000 + i);
    strcat(candidates, candidate);
    build(TRANSPORT, candidates, "");
    parse("candidate count boundary", i < PEER_SDP_CANDIDATES);
  }
}
int main(void) {
  transport_scope();
  boundaries();
  grammar();
  candidates();
  public_atomicity();
  fingerprint_matrix();
  printf("SDP regressions: %u checks, %u failures\n", checks, failures);
  return failures ? 1 : 0;
}
