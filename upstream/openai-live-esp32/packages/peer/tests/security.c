#include "agent.h"
#include "dtls_srtp.h"
#include "peer.h"
#include "ports.h"
#include "rtcp.h"
#include "rtp.h"
#include "sctp.h"
#include "sdp.h"
#include "stun.h"
#include "utils.h"
#include "wire.h"
#include <assert.h>
#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <sys/select.h>
#include <sys/wait.h>
#include <usrsctp.h>

static unsigned checks;
#define CHECK(x)                                                               \
  do {                                                                         \
    ++checks;                                                                  \
    if (!(x)) {                                                                \
      fprintf(stderr, "FAILED %s:%d: %s\n", __FILE__, __LINE__, #x);           \
      abort();                                                                 \
    }                                                                          \
  } while (0)
static void test_stun(void) {
  StunMessage a, b;
  char password[] = "test-password-with-at-least-22-characters";
  stun_msg_create(&a, 1);
  stun_msg_create(&b, 1);
  CHECK(!wire_equal(a.buf + 8, b.buf + 8, 12));
  CHECK(!stun_msg_write_attr(&a, STUN_ATTR_TYPE_USERNAME, 9, "abcd:efgh"));
  CHECK(!stun_msg_finish(&a, STUN_CREDENTIAL_SHORT_TERM, password,
                         strlen(password)));
  CHECK(!stun_msg_is_valid(a.buf, a.size, password));
  CHECK(stun_msg_is_valid(a.buf, a.size, "wrong"));
  for (size_t i = 0; i < a.size; ++i) {
    uint8_t changed[STUN_ATTR_BUF_SIZE];
    memcpy(changed, a.buf, a.size);
    changed[i] ^= 1;
    CHECK(stun_msg_is_valid(changed, a.size, password));
  }
  for (size_t i = 0; i < a.size; ++i)
    CHECK(stun_msg_parse(&b, a.buf, i));
  uint8_t long_message[STUN_ATTR_BUF_SIZE + 1] = {0};
  CHECK(stun_msg_parse(&b, long_message, sizeof(long_message)));
  stun_msg_create(&b, 1);
  CHECK(stun_msg_is_valid(b.buf, b.size, password));
  uint8_t value[600] = {0};
  memset(value, 'a', sizeof(value));
  CHECK(!stun_msg_write_attr(&b, STUN_ATTR_TYPE_USERNAME, sizeof(value),
                             (char *)value));
  CHECK(stun_parse_msg_buf(&b));
  /* MAPPED-ADDRESS may coexist with XOR-MAPPED-ADDRESS; order must not select
     a different address. Duplicate copies of either attribute are rejected. */
  for (int reverse = 0; reverse < 2; ++reverse) {
    stun_msg_create(&b, 0x0101);
    Address expected = {.family = AF_INET, .port = 12345};
    CHECK(addr_from_string("127.0.0.1", &expected));
    uint8_t xor_value[20], plain_value[8] = {0, 1, 0, 1, 127, 0, 0, 2};
    int length =
        stun_set_mapped_address((char *)xor_value, b.buf + 4, &expected);
    for (int i = 0; i < 2; ++i) {
      int use_xor = i == reverse;
      CHECK(!stun_msg_write_attr(&b,
                                 use_xor ? STUN_ATTR_TYPE_XOR_MAPPED_ADDRESS
                                         : STUN_ATTR_TYPE_MAPPED_ADDRESS,
                                 use_xor ? (uint16_t)length : 8,
                                 (char *)(use_xor ? xor_value : plain_value)));
    }
    CHECK(!stun_parse_msg_buf(&b));
    CHECK(addr_equal(&b.mapped_addr, &expected));
  }
  stun_msg_create(&b, 1);
  CHECK(stun_msg_write_attr(&b, STUN_ATTR_TYPE_USERNAME, UINT16_MAX,
                            (char *)value));
  CHECK(stun_msg_finish(&b, STUN_CREDENTIAL_SHORT_TERM, password,
                        strlen(password)));
  stun_msg_create(&b, 1);
  CHECK(!stun_msg_write_attr(&b, STUN_ATTR_TYPE_MESSAGE_INTEGRITY, 19,
                             (char *)value));
  CHECK(stun_parse_msg_buf(&b));
  CHECK(!stun_msg_parse(&b, a.buf, a.size));
  CHECK(!strcmp(b.username, "abcd:efgh"));
  uint8_t unaligned[STUN_ATTR_BUF_SIZE + 1];
  memcpy(unaligned + 1, a.buf, a.size);
  CHECK(!stun_msg_is_valid(unaligned + 1, a.size, password));
  stun_msg_create(&b, 1);
  uint8_t zero_priority[4] = {0};
  CHECK(!stun_msg_write_attr(&b, STUN_ATTR_TYPE_PRIORITY, 4,
                             (char *)zero_priority));
  CHECK(!stun_msg_write_attr(&b, STUN_ATTR_TYPE_PRIORITY, 4,
                             (char *)zero_priority));
  CHECK(stun_parse_msg_buf(&b));
  uint8_t mapped[8] = {0, 1, 0, 1, 127, 0, 0, 1};
  stun_msg_create(&b, 0x0101);
  CHECK(!stun_msg_write_attr(&b, STUN_ATTR_TYPE_XOR_MAPPED_ADDRESS, 8,
                             (char *)mapped));
  CHECK(!stun_msg_write_attr(&b, STUN_ATTR_TYPE_XOR_MAPPED_ADDRESS, 8,
                             (char *)mapped));
  CHECK(stun_parse_msg_buf(&b));
}
static void test_rtp_rtcp(void) {
  uint8_t p[128] = {0x80, 111};
  size_t offset, size;
  for (size_t i = 0; i < 12; ++i)
    CHECK(rtp_payload(p, i, &offset, &size));
  CHECK(!rtp_payload(p, 15, &offset, &size));
  CHECK(offset == 12 && size == 3);
  p[0] = 0x8f;
  CHECK(rtp_payload(p, 15, &offset, &size));
  p[0] = 0x90;
  wire_put16(p + 14, 65535);
  CHECK(rtp_payload(p, 16, &offset, &size));
  wire_put16(p + 14, 1);
  CHECK(!rtp_payload(p, 23, &offset, &size));
  CHECK(offset == 20 && size == 3);
  p[0] = 0xa0;
  p[14] = 0;
  CHECK(rtp_payload(p, 15, &offset, &size));
  p[14] = 4;
  CHECK(rtp_payload(p, 15, &offset, &size));
  p[14] = 3;
  CHECK(!rtp_payload(p, 15, &offset, &size));
  CHECK(size == 0);
  uint8_t rr[16] = {0x80, 201, 0, 1, 0, 0, 0, 1};
  CHECK(!rtcp_validate(rr, 8));
  rr[0] = 0x81;
  CHECK(rtcp_validate(rr, 8));
  rr[0] = 0x80;
  CHECK(rtcp_validate(rr, 7));
  CHECK(rtcp_validate(rr, 9));
  wire_put16(rr + 2, 65535);
  CHECK(rtcp_validate(rr, 8));
  wire_put16(rr + 2, 1);
  rr[0] = 0xa0;
  rr[7] = 0;
  CHECK(rtcp_validate(rr, 8));
}
static void mutate_sdp(const char *source, const char *needle,
                       const char *replacement) {
  char bad[PEER_SDP_LIMIT];
  const char *at = strstr(source, needle);
  CHECK(at != NULL);
  size_t prefix = (size_t)(at - source), suffix = strlen(at + strlen(needle)),
         n = strlen(replacement);
  CHECK(prefix + n + suffix < sizeof(bad));
  memcpy(bad, source, prefix);
  memcpy(bad + prefix, replacement, n);
  memcpy(bad + prefix + n, at + strlen(needle), suffix + 1);
  PeerSdp parsed;
  CHECK(peer_sdp_parse(bad, prefix + n + suffix, &parsed));
}
static void test_sdp(void) {
  char fp[96], offer[PEER_SDP_LIMIT];
  for (int i = 0; i < 32; ++i)
    snprintf(fp + 3 * i, 4, "AA%s", i == 31 ? "" : ":");
  CHECK(!peer_sdp_offer(
      offer, sizeof(offer), "abcdefghijklmnop",
      "abcdefghijklmnopqrstuvwxyz012345", fp, 1234, 1, 1,
      "a=candidate:1 1 UDP 2122260223 127.0.0.1 12345 typ host\r\n"));
  PeerSdp parsed;
  CHECK(!peer_sdp_parse(offer, strlen(offer), &parsed));
  CHECK(parsed.audio && parsed.data && parsed.candidate_count == 1 &&
        parsed.ssrc == 1234);
  CHECK(strlen(parsed.tls_id) == 32);
  mutate_sdp(offer, "a=rtcp-mux", "a=rtcp-mux\r\na=ice-mismatch");
  mutate_sdp(offer, "a=mid:data", "a=mid:data\r\na=tls-id:short");
  mutate_sdp(offer, "a=mid:data",
             "a=mid:data\r\na=tls-id:abcdefghijklmnopqrst");
  mutate_sdp(offer, "a=ice-ufrag:abcdefghijklmnop", "a=ice-ufrag:x");
  mutate_sdp(offer, "a=ice-pwd:abcdefghijklmnopqrstuvwxyz012345",
             "a=ice-pwd:short");
  mutate_sdp(offer, "a=setup:actpass", "a=setup:garbage");
  mutate_sdp(offer, "sha-256 AA:", "sha-256 ZZ:");
  mutate_sdp(offer, "UDP 2122260223", "UDP 99999999999999999999999999999");
  mutate_sdp(offer, "127.0.0.1 12345", "127.0.0.1 65536");
  mutate_sdp(offer, "127.0.0.1 12345", "224.0.0.1 12345");
  mutate_sdp(offer, "candidate:1 1 UDP", "candidate:1 1 TCP");
  mutate_sdp(offer, "a=rtcp-mux", "a=unsupported");
  mutate_sdp(offer, "a=sendrecv", "a=inactive");
  mutate_sdp(offer, "a=rtpmap:111 opus/48000/2", "a=rtpmap:111 H264/90000");
  mutate_sdp(offer, "UDP/TLS/RTP/SAVPF", "UDP/TLS/RTP/SAVP");
  mutate_sdp(offer, "a=group:BUNDLE audio data",
             "a=group:BUNDLE audio unknown");
  mutate_sdp(offer, "a=sctp-port:5000", "a=sctp-port:0");
  mutate_sdp(offer, "a=ice-ufrag:abcdefghijklmnop",
             "a=ignored:abcdefghijklmnop");
  mutate_sdp(offer, "a=group:BUNDLE audio data", "a=group:BUNDLE data audio");
  mutate_sdp(offer, "a=max-message-size:65536",
             "a=max-message-size:65536\r\na=max-message-size:1");
  char huge[1100];
  memset(huge, 'a', sizeof(huge) - 1);
  huge[sizeof(huge) - 1] = 0;
  mutate_sdp(offer, "abcdefghijklmnop", huge);
  char candidates[2048] = {0};
  size_t pos = 0;
  for (int i = 0; i < 11; ++i)
    pos += (size_t)snprintf(
        candidates + pos, sizeof(candidates) - pos,
        "a=candidate:%d 1 UDP 2122260223 127.0.0.1 %d typ host\r\n", i,
        10000 + i);
  CHECK(!peer_sdp_offer(offer, sizeof(offer), "abcdefghijklmnop",
                        "abcdefghijklmnopqrstuvwxyz012345", fp, 1234, 1, 1,
                        candidates));
  CHECK(peer_sdp_parse(offer, strlen(offer), &parsed));
  CHECK(peer_sdp_parse(offer, PEER_SDP_LIMIT, &parsed));
  char tiny[10];
  CHECK(peer_sdp_offer(tiny, sizeof(tiny), "abcd", "long-password", fp, 1, 1, 1,
                       ""));
  CHECK(!tiny[0]);
  // Public ICE-lite servers advertise TCP fallback alongside UDP. Unsupported
  // candidates are skipped without weakening validation of usable candidates.
  const char *mixed =
      "a=candidate:1 1 udp 2130706431 192.0.2.1 3478 typ host ufrag abcd\r\n"
      "a=candidate:2 1 tcp 1671430143 192.0.2.1 443 typ host tcptype "
      "passive\r\n"
      "a=candidate:3 1 UDP 2130706431 2001:db8::1 3478 typ host\r\n"
      "a=candidate:4 2 UDP 2130706431 192.0.2.1 3479 typ host\r\n"
      "a=candidate:5 1 UDP 2130706431 a8b9.local 3478 typ host\r\n";
  CHECK(!peer_sdp_offer(offer, sizeof(offer), "abcdefghijklmnop",
                        "abcdefghijklmnopqrstuvwxyz012345", fp, 1234, 1, 1,
                        mixed));
  CHECK(!peer_sdp_parse(offer, strlen(offer), &parsed));
  CHECK(parsed.candidate_count == 1 && parsed.candidates[0].addr.port == 3478);
  mutate_sdp(offer, "tcptype passive", "tcptype invalid");
  mutate_sdp(offer, "tcptype passive", "tcptype passive tcptype active");
  mutate_sdp(offer, "udp 2130706431", "tcp 2130706431");
  mutate_sdp(offer, "a8b9.local", "a8b9..local");
  mutate_sdp(offer, "a8b9.local", "999.999.999.999");
  CHECK(!peer_sdp_offer(offer, sizeof(offer), "abcdefghijklmnop",
                        "abcdefghijklmnopqrstuvwxyz012345", fp, 1234, 1, 1,
                        strchr(mixed, '\n') + 1));
  CHECK(peer_sdp_parse(offer, strlen(offer), &parsed));
}
static void test_crypto(void) {
  uint8_t key[30] = {0};
  for (size_t i = 0; i < sizeof(key); ++i)
    key[i] = (uint8_t)i;
  DtlsSrtp d = {.state = DTLS_SRTP_STATE_CONNECTED};
  srtp_policy_t policy = {0};
  srtp_crypto_policy_set_rtp_default(&policy.rtp);
  srtp_crypto_policy_set_rtcp_default(&policy.rtcp);
  policy.key = key;
  policy.ssrc.type = ssrc_any_outbound;
  CHECK(srtp_create(&d.srtp_out, &policy) == 0);
  policy.ssrc.type = ssrc_any_inbound;
  CHECK(srtp_create(&d.srtp_in, &policy) == 0);
  uint8_t p[128] = {0x80, 111, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0xf8, 0xff, 0xfe};
  int n = 15;
  CHECK(!dtls_srtp_encrypt_rtp_packet(&d, p, &n));
  uint8_t replay[128], bad[128];
  memcpy(replay, p, (size_t)n);
  memcpy(bad, p, (size_t)n);
  bad[n - 1] ^= 1;
  int bad_n = n;
  CHECK(dtls_srtp_decrypt_rtp_packet(&d, bad, &bad_n));
  CHECK(bad_n == 0);
  int original_n = n;
  CHECK(!dtls_srtp_decrypt_rtp_packet(&d, p, &n));
  CHECK(n == 15 && p[12] == 0xf8);
  CHECK(dtls_srtp_decrypt_rtp_packet(&d, replay, &original_n));
  CHECK(original_n == 0);
  uint8_t rtcp[128] = {0x80, 201, 0, 1, 0, 0, 0, 1};
  n = 8;
  CHECK(!dtls_srtp_encrypt_rctp_packet(&d, rtcp, &n));
  memcpy(replay, rtcp, (size_t)n);
  original_n = n;
  CHECK(!dtls_srtp_decrypt_rtcp_packet(&d, rtcp, &n));
  CHECK(!rtcp_validate(rtcp, (size_t)n));
  CHECK(dtls_srtp_decrypt_rtcp_packet(&d, replay, &original_n));
  CHECK(original_n == 0);
  n = 8;
  CHECK(dtls_srtp_decrypt_rtcp_packet(&d, rtcp, &n));
  CHECK(n == 0);
  srtp_dealloc(d.srtp_in);
  srtp_dealloc(d.srtp_out);
}
/* A real pair of DTLS engines, connected only through bounded memory queues. */
typedef struct DtlsTestLink {
  DtlsSrtp dtls;
  struct DtlsTestLink *other;
  uint8_t packets[32][1536];
  size_t sizes[32];
  unsigned head, tail, sends;
  int send_error;
} DtlsTestLink;
static int test_dtls_send(void *ctx, const unsigned char *data, size_t size) {
  DtlsTestLink *link = ((DtlsSrtp *)ctx)->user_data;
  ++link->sends;
  if (link->send_error)
    return link->send_error;
  DtlsTestLink *other = link->other;
  CHECK(other->tail - other->head < 32 && size <= 1536);
  unsigned slot = other->tail++ % 32;
  memcpy(other->packets[slot], data, size);
  other->sizes[slot] = size;
  return (int)size;
}
static int test_dtls_recv(void *ctx, unsigned char *data, size_t capacity) {
  DtlsTestLink *link = ((DtlsSrtp *)ctx)->user_data;
  if (link->head == link->tail)
    return MBEDTLS_ERR_SSL_WANT_READ;
  unsigned slot = link->head++ % 32;
  CHECK(link->sizes[slot] <= capacity);
  memcpy(data, link->packets[slot], link->sizes[slot]);
  return (int)link->sizes[slot];
}
static void drain_test_sctp(DtlsTestLink *links, Sctp *associations) {
  for (int step = 0; step < 100; ++step) {
    int received = 0;
    for (int i = 0; i < 2; ++i) {
      uint8_t packet[1536];
      int n = dtls_srtp_read(&links[i].dtls, packet, sizeof(packet));
      CHECK(n > 0 || n == MBEDTLS_ERR_SSL_WANT_READ);
      if (n > 0) {
        sctp_incoming_data(&associations[i], (char *)packet, (size_t)n);
        received = 1;
      }
    }
    if (!received)
      return;
  }
  CHECK(0); /* No unbounded SCTP send/receive spin. */
}
static void test_dtls_errors(void) {
  /* Both a fatal BIO error and a pending-write result must be terminal: the
     SCTP caller releases its send buffer and cannot satisfy SSL retry rules. */
  const int errors[] = {-1, MBEDTLS_ERR_SSL_WANT_WRITE};
  for (size_t error = 0; error < sizeof(errors) / sizeof(errors[0]); ++error) {
    DtlsTestLink *links = calloc(2, sizeof(*links));
    CHECK(links != NULL);
    Address remote = {.family = AF_INET, .port = 12345};
    CHECK(addr_from_string("127.0.0.1", &remote));
    for (int i = 0; i < 2; ++i) {
      links[i].other = &links[1 - i];
      CHECK(!dtls_srtp_init(&links[i].dtls,
                            i ? DTLS_SRTP_ROLE_SERVER : DTLS_SRTP_ROLE_CLIENT,
                            &links[i]));
      links[i].dtls.udp_send = test_dtls_send;
      links[i].dtls.udp_recv = test_dtls_recv;
    }
    for (int step = 0; step < 100; ++step) {
      for (int i = 0; i < 2; ++i)
        CHECK(!dtls_srtp_handshake(&links[i].dtls, &remote,
                                   links[1 - i].dtls.local_fingerprint));
      if (links[0].dtls.state == DTLS_SRTP_STATE_CONNECTED &&
          links[1].dtls.state == DTLS_SRTP_STATE_CONNECTED)
        break;
    }
    CHECK(links[0].dtls.state == DTLS_SRTP_STATE_CONNECTED);
    CHECK(links[1].dtls.state == DTLS_SRTP_STATE_CONNECTED);
    const uint8_t hello[] = "hello";
    CHECK(dtls_srtp_write(&links[0].dtls, hello, sizeof(hello)) ==
          sizeof(hello));
    uint8_t plain[32];
    CHECK(dtls_srtp_read(&links[1].dtls, plain, sizeof(plain)) ==
          sizeof(hello));
    CHECK(!memcmp(plain, hello, sizeof(hello)));
    Sctp associations[2] = {0};
    for (int i = 0; i < 2; ++i) {
      associations[i].remote_port = 5000;
      associations[i].remote_max_message = PEER_MESSAGE_LIMIT;
      CHECK(!sctp_create_association(&associations[i], &links[i].dtls));
    }
    drain_test_sctp(links, associations);
    CHECK(associations[0].connected && associations[1].connected);
    associations[0].remote_max_message = 11;
    unsigned before_open = links[0].sends;
    CHECK(sctp_open_channel(&associations[0], "", "", 0) == -1);
    CHECK(links[0].sends == before_open && !associations[0].stream_count);
    associations[0].remote_max_message = 12;
    CHECK(!sctp_open_channel(&associations[0], "", "", 0));
    drain_test_sctp(links, associations);
    CHECK(associations[0].stream_table[0].state == 2);
    associations[0].remote_max_message = 4;
    CHECK(sctp_outgoing_data(&associations[0], "12345", 5, PPID_STRING, 0) ==
          -1);
    CHECK(!sctp_outgoing_data(&associations[0], "1234", 4, PPID_STRING, 0));
    drain_test_sctp(links, associations);
    for (int i = 0; i < 2; ++i)
      sctp_destroy_association(&associations[i]);
    links[0].send_error = errors[error];
    CHECK(dtls_srtp_write(&links[0].dtls, hello, sizeof(hello)) == -1);
    CHECK(links[0].dtls.state == DTLS_SRTP_STATE_FAILED);
    unsigned sends = links[0].sends;
    CHECK(dtls_srtp_write(&links[0].dtls, (const uint8_t *)"different", 9) ==
          -1);
    CHECK(dtls_srtp_read(&links[0].dtls, plain, sizeof(plain)) == -1);
    CHECK(links[0].sends == sends);
    dtls_srtp_deinit(&links[0].dtls);
    dtls_srtp_deinit(&links[1].dtls);
    free(links);
  }
}
static unsigned messages;
static void on_message(char *p, size_t n, void *ctx, uint16_t sid) {
  (void)p;
  (void)n;
  (void)ctx;
  (void)sid;
  ++messages;
}
static void test_dcep(void) {
  DtlsSrtp dtls = {.role = DTLS_SRTP_ROLE_SERVER};
  Sctp s = {.dtls_srtp = &dtls,
            .connected = 1,
            .onmessage = on_message,
            .stream_count = 1};
  s.stream_table[0].sid = 1;
  s.stream_table[0].state = 1;
  uint8_t ack = 2;
  CHECK(!sctp_handle_message(&s, &ack, 1, PPID_CONTROL, 1));
  CHECK(!sctp_handle_message(&s, (const uint8_t *)"hello", 5, PPID_STRING, 1));
  CHECK(messages == 1);
  s.stream_table[0].state = 1;
  uint8_t padded_ack[5] = {2, 0, 0, 0, 0};
  CHECK(sctp_handle_message(&s, padded_ack, 2, PPID_CONTROL, 1));
  CHECK(sctp_handle_message(&s, padded_ack, 3, PPID_CONTROL, 1));
  CHECK(sctp_handle_message(&s, padded_ack, 5, PPID_CONTROL, 1));
  padded_ack[3] = 1;
  CHECK(sctp_handle_message(&s, padded_ack, 4, PPID_CONTROL, 1));
  CHECK(s.stream_table[0].state == 1);
  padded_ack[3] = 0;
  CHECK(!sctp_handle_message(&s, padded_ack, 4, PPID_CONTROL, 1));
  CHECK(s.stream_table[0].state == 2);
  CHECK(sctp_handle_message(&s, padded_ack, 4, PPID_CONTROL, 1));
  CHECK(sctp_handle_message(&s, (const uint8_t *)"hello", 5, PPID_STRING, 3));
  const uint8_t invalid[] = {0xc0, 0x80};
  CHECK(sctp_handle_message(&s, invalid, sizeof(invalid), PPID_STRING, 1));
  CHECK(messages == 1);
  uint8_t open[12] = {3};
  wire_put16(open + 8, 65535);
  CHECK(sctp_handle_message(&s, open, sizeof(open), PPID_CONTROL, 0));
  CHECK(s.stream_count == 1);
  CHECK(!wire_utf8(invalid, 2));
  CHECK(!wire_utf8((const uint8_t *)"\xed\xa0\x80", 3));
  CHECK(wire_utf8((const uint8_t *)"\xf0\x9f\x8e\x99", 4));
  unsigned before = messages;
  sctp_handle_association_state(&s, SCTP_RESTART);
  CHECK(!s.connected && s.failed);
  CHECK(sctp_handle_message(&s, (const uint8_t *)"hello", 5, PPID_STRING, 1));
  sctp_handle_association_state(&s, SCTP_COMM_UP);
  CHECK(!s.connected && messages == before);
}
static void readable(int fd) {
  fd_set fds;
  FD_ZERO(&fds);
  FD_SET(fd, &fds);
  struct timeval timeout = {1, 0};
  CHECK(select(fd + 1, &fds, NULL, NULL, &timeout) == 1);
}
static void test_udp_boundary(void) {
  Agent a;
  CHECK(!agent_create(&a));
  UdpSocket sender = {.fd = -1}, stranger = {.fd = -1};
  CHECK(!udp_socket_open_on(&sender, AF_INET, 0, "127.0.0.1"));
  CHECK(!udp_socket_open_on(&stranger, AF_INET, 0, "127.0.0.1"));
  IceCandidate remote = {.addr = sender.bind_addr};
  IceCandidatePair pair = {.remote = &remote};
  a.selected_pair = &pair;
  Address target = a.udp_sockets[0].bind_addr;
  CHECK(addr_from_string("127.0.0.1", &target));
  uint8_t dtls[13] = {22, 0xfe, 0xfd}, out[STUN_ATTR_BUF_SIZE];
  CHECK(udp_socket_sendto(&sender, &target, dtls, sizeof(dtls)) ==
        sizeof(dtls));
  readable(a.udp_sockets[0].fd);
  CHECK(agent_recv(&a, out, sizeof(out)) ==
        sizeof(dtls)); /* DTLS must not be consumed as STUN. */
  CHECK(udp_socket_sendto(&stranger, &target, dtls, sizeof(dtls)) ==
        sizeof(dtls));
  readable(a.udp_sockets[0].fd);
  CHECK(agent_recv(&a, out, sizeof(out)) ==
        0); /* A different source port is not the selected peer. */
  uint8_t large[STUN_ATTR_BUF_SIZE + 1] = {22};
  CHECK(udp_socket_sendto(&sender, &target, large, sizeof(large)) ==
        sizeof(large));
  readable(a.udp_sockets[0].fd);
  CHECK(agent_recv(&a, out, sizeof(out)) == 0); /* Reject, never truncate. */
  a.selected_pair = NULL;
  CHECK(udp_socket_sendto(&sender, &target, dtls, sizeof(dtls)) ==
        sizeof(dtls));
  readable(a.udp_sockets[0].fd);
  CHECK(agent_recv(&a, out, sizeof(out)) ==
        0); /* No DTLS before ICE authentication. */
  uint8_t hello[25] = {22, 0xfe, 0xfd};
  hello[13] = 1;
  a.nominated_pair = &pair;
  for (int i = 0; i < 3; ++i) {
    hello[24] = (uint8_t)i;
    CHECK(udp_socket_sendto(&sender, &target, hello, sizeof(hello)) ==
          sizeof(hello));
    readable(a.udp_sockets[0].fd);
    CHECK(agent_recv(&a, out, sizeof(out)) == 0);
  }
  CHECK(a.early_hello_count == 2);
  a.selected_pair = &pair; /* Simulate subsequent successful ICE validation. */
  CHECK(agent_recv(&a, out, sizeof(out)) == sizeof(hello) && out[24] == 0);
  CHECK(agent_recv(&a, out, sizeof(out)) == sizeof(hello) && out[24] == 1);
  CHECK(agent_recv(&a, out, sizeof(out)) == 0);
  agent_destroy(&a);
  udp_socket_close(&sender);
  udp_socket_close(&stranger);
}
static void test_stun_discovery(int lose_first) {
  Agent a;
  CHECK(!agent_create(&a));
  a.host_addr.family = AF_INET;
  CHECK(addr_from_string("127.0.0.1", &a.host_addr));
  UdpSocket server = {.fd = -1};
  CHECK(!udp_socket_open_on(&server, AF_INET, 0, "127.0.0.1"));
  char url[64];
  snprintf(url, sizeof(url), "stun:127.0.0.1:%u", server.bind_addr.port);
  pid_t child = fork();
  CHECK(child >= 0);
  if (!child) {
    readable(server.fd);
    Address source;
    uint8_t request[1536];
    int n = udp_socket_recvfrom(&server, &source, request, sizeof(request));
    CHECK(n >= 20 && !stun_probe(request, (size_t)n));
    if (lose_first) {
      uint8_t retry[1536];
      Address retry_source;
      readable(server.fd);
      int retry_n =
          udp_socket_recvfrom(&server, &retry_source, retry, sizeof(retry));
      CHECK(retry_n == n && !memcmp(retry, request, (size_t)n));
      CHECK(addr_equal(&retry_source, &source));
    }
    for (int invalid = 1; invalid >= 0; --invalid) {
      StunMessage response;
      stun_msg_create(&response, 0x0101);
      memcpy(response.buf + 8, request + 8, 12);
      Address mapped = source;
      CHECK(addr_from_string("192.0.2.20", &mapped));
      addr_set_port(&mapped, 45678);
      if (invalid)
        addr_set_port(&mapped,
                      1); /* A bad fingerprint must not select this mapping. */
      uint8_t attr[20];
      int length =
          stun_set_mapped_address((char *)attr, response.buf + 4, &mapped);
      CHECK(!stun_msg_write_attr(&response, STUN_ATTR_TYPE_XOR_MAPPED_ADDRESS,
                                 (uint16_t)length, (char *)attr));
      uint32_t fingerprint;
      wire_put16(response.buf + 2, (uint16_t)(response.size + 8 - 20));
      stun_calculate_fingerprint((char *)response.buf, response.size,
                                 &fingerprint);
      if (invalid)
        fingerprint ^= 1;
      CHECK(!stun_msg_write_attr(&response, STUN_ATTR_TYPE_FINGERPRINT, 4,
                                 (char *)&fingerprint));
      CHECK(udp_socket_sendto(&server, &source, response.buf,
                              (int)response.size) > 0);
    }
    _exit(0);
  }
  agent_gather_candidate(&a, NULL, NULL, NULL);
  agent_gather_candidate(&a, url, NULL, NULL);
  int status;
  CHECK(waitpid(child, &status, 0) == child);
  CHECK(WIFEXITED(status) && WEXITSTATUS(status) == 0);
  CHECK(a.local_candidates_count == 2);
  CHECK(a.local_candidates[1].addr.port == 45678);
  CHECK(a.local_candidates[1].type == ICE_CANDIDATE_TYPE_SRFLX);
  CHECK(addr_equal(&a.local_candidates[1].raddr, &a.local_candidates[0].addr));
  char description[256], related[96];
  ice_candidate_to_description(&a.local_candidates[1], description,
                               sizeof(description));
  snprintf(related, sizeof(related), "typ srflx raddr 127.0.0.1 rport %u\r\n",
           a.udp_sockets[0].bind_addr.port);
  CHECK(strstr(description, related) != NULL);
  agent_gather_candidate(&a, "turn:invalid", NULL, NULL);
  CHECK(a.local_candidates_count == 2);
  agent_gather_candidate(&a, "stun:127.0.0.1:70000", NULL, NULL);
  CHECK(a.local_candidates_count == 2);
  agent_destroy(&a);
  udp_socket_close(&server);
  Address loopback = {.family = AF_INET};
  CHECK(ports_get_host_addr(&loopback, "lo") == 1);
  CHECK(ports_get_host_addr(&loopback, "no-such-peer-interface") == 0);
}
static void test_stun_urls(void) {
  char hostname[128];
  uint16_t port;
  CHECK(!agent_parse_stun_url("stun:stun.example", hostname, &port));
  CHECK(!strcmp(hostname, "stun.example") && port == 3478);
  CHECK(!agent_parse_stun_url("STUN:127.0.0.1:19302", hostname, &port));
  CHECK(!strcmp(hostname, "127.0.0.1") && port == 19302);
  const char *invalid[] = {
      "stun:",           "stun:host:",      "stun:host:0",
      "stun:host:65536", "stun:host:+3478", "stun:host:3478?transport=tcp",
      "stun:user@host",  "stun:bad..host",  "stun:999.999.999.999",
      "stuns:host",      "stun:[::1]:3478"};
  PeerConfiguration config = {.local_address = "127.0.0.1",
                              .audio_codec = CODEC_OPUS};
  for (size_t i = 0; i < sizeof(invalid) / sizeof(invalid[0]); ++i) {
    CHECK(agent_parse_stun_url(invalid[i], hostname, &port) == -1);
    config.ice_servers[0].urls = invalid[i];
    CHECK(peer_connection_create(&config) == NULL);
  }
  config.ice_servers[0].urls = "stun:stun.example";
  PeerConnection *pc = peer_connection_create(&config);
  CHECK(pc != NULL);
  peer_connection_destroy(pc);
}
static void test_ice_authentication(int nat) {
  Agent a;
  CHECK(!agent_create(&a));
  UdpSocket remote = {.fd = -1}, stranger = {.fd = -1};
  CHECK(!udp_socket_open_on(&remote, AF_INET, 0, "127.0.0.1"));
  CHECK(!udp_socket_open_on(&stranger, AF_INET, 0, "127.0.0.1"));
  a.host_addr.family = AF_INET;
  CHECK(addr_from_string("127.0.0.1", &a.host_addr));
  agent_create_ice_credential(&a);
  agent_gather_candidate(&a, NULL, NULL, NULL);
  strcpy(a.remote_ufrag, "abcdefghijklmnop");
  strcpy(a.remote_upwd, "abcdefghijklmnopqrstuvwxyz012345");
  a.remote_candidates_count = 1;
  a.remote_candidates[0].addr = remote.bind_addr;
  a.mode = AGENT_MODE_CONTROLLING;
  agent_update_candidate_pairs(&a);
  CHECK(!agent_select_candidate_pair(&a));
  CHECK(agent_send_binding_request(&a) > 0);
  Address destination;
  uint8_t packet[STUN_ATTR_BUF_SIZE], replybuf[STUN_ATTR_BUF_SIZE];
  readable(remote.fd);
  int n = udp_socket_recvfrom(&remote, &destination, packet, sizeof(packet));
  CHECK(n > 0);
  CHECK(!stun_msg_is_valid(packet, (size_t)n, a.remote_upwd));
  StunMessage response;
  stun_msg_create(&response, 0x0101);
  memcpy(response.buf + 8, packet + 8, 12);
  uint8_t mapped[20];
  Address observed = destination;
  if (nat) {
    CHECK(addr_from_string("192.0.2.10", &observed));
    addr_set_port(&observed, 54321);
  }
  int mapped_size =
      stun_set_mapped_address((char *)mapped, response.buf + 4, &observed);
  CHECK(!stun_msg_write_attr(&response, STUN_ATTR_TYPE_XOR_MAPPED_ADDRESS,
                             (uint16_t)mapped_size, (char *)mapped));
  CHECK(!stun_msg_finish(&response, STUN_CREDENTIAL_SHORT_TERM, a.remote_upwd,
                         strlen(a.remote_upwd)));
  for (int variant = 0; variant < 3; ++variant) {
    StunMessage invalid;
    stun_msg_create(&invalid, 0x0101);
    memcpy(invalid.buf + 8, packet + 8, 12);
    if (variant) {
      Address wrong = destination;
      if (variant == 1)
        addr_set_port(&wrong, 1);
      int length =
          stun_set_mapped_address((char *)mapped, invalid.buf + 4, &wrong);
      CHECK(!stun_msg_write_attr(&invalid, STUN_ATTR_TYPE_XOR_MAPPED_ADDRESS,
                                 (uint16_t)length, (char *)mapped));
    }
    const char *key = variant == 2 ? "wrong" : a.remote_upwd;
    CHECK(!stun_msg_finish(&invalid, STUN_CREDENTIAL_SHORT_TERM, key,
                           strlen(key)));
    CHECK(udp_socket_sendto(&remote, &destination, invalid.buf,
                            (int)invalid.size) > 0);
    readable(a.udp_sockets[0].fd);
    CHECK(!agent_recv(&a, replybuf, sizeof(replybuf)));
    CHECK(a.binding_request_pending && !a.selected_pair);
  }
  CHECK(udp_socket_sendto(&stranger, &destination, response.buf,
                          (int)response.size) > 0);
  readable(a.udp_sockets[0].fd);
  CHECK(!agent_recv(&a, replybuf, sizeof(replybuf)));
  CHECK(a.binding_request_pending);
  StunMessage wrong_id;
  stun_msg_create(&wrong_id, 0x0101);
  memcpy(wrong_id.buf + 8, packet + 8, 12);
  wrong_id.buf[8] ^= 1;
  CHECK(!stun_msg_finish(&wrong_id, STUN_CREDENTIAL_SHORT_TERM, a.remote_upwd,
                         strlen(a.remote_upwd)));
  CHECK(udp_socket_sendto(&remote, &destination, wrong_id.buf,
                          (int)wrong_id.size) > 0);
  readable(a.udp_sockets[0].fd);
  CHECK(!agent_recv(&a, replybuf, sizeof(replybuf)));
  CHECK(a.binding_request_pending);
  response.buf[response.size - 1] ^= 1;
  /* Preserve the outstanding transaction across a delayed retransmission. */
  a.binding_request_sent_time = ports_get_epoch_time() - 600;
  CHECK(agent_send_binding_request(&a) > 0);
  readable(remote.fd);
  Address retry_source;
  int retry_n =
      udp_socket_recvfrom(&remote, &retry_source, replybuf, sizeof(replybuf));
  CHECK(retry_n == n && !memcmp(packet, replybuf, (size_t)n));
  CHECK(udp_socket_sendto(&remote, &destination, response.buf,
                          (int)response.size) > 0);
  readable(a.udp_sockets[0].fd);
  CHECK(!agent_recv(&a, replybuf, sizeof(replybuf)));
  CHECK(a.binding_request_pending);
  response.buf[response.size - 1] ^= 1;
  CHECK(udp_socket_sendto(&remote, &destination, response.buf,
                          (int)response.size) > 0);
  readable(a.udp_sockets[0].fd);
  CHECK(!agent_recv(&a, replybuf, sizeof(replybuf)));
  CHECK(!a.binding_request_pending);
  CHECK(a.nominated_pair->state == ICE_CANDIDATE_STATE_SUCCEEDED);
  CHECK(addr_equal(&a.nominated_pair->local->addr, &observed));
  CHECK(addr_equal(&a.nominated_pair->remote->addr, &remote.bind_addr));
  if (nat) {
    CHECK(a.nominated_pair->local == &a.learned_local);
    CHECK(a.learned_local.type == ICE_CANDIDATE_TYPE_PRFLX);
    CHECK(a.local_candidates_count == 1);
  }
  a.last_consent = 42; /* A replay of the old authenticated response cannot
                          refresh consent. */
  CHECK(udp_socket_sendto(&remote, &destination, response.buf,
                          (int)response.size) > 0);
  readable(a.udp_sockets[0].fd);
  CHECK(!agent_recv(&a, replybuf, sizeof(replybuf)));
  CHECK(a.last_consent == 42);
  a.selected_pair = a.nominated_pair;
  a.last_consent = ports_get_epoch_time();
  CHECK(agent_has_consent(&a));
  CHECK(agent_send(&a, (const uint8_t *)"x", 1) == 1);
  a.last_consent = ports_get_epoch_time() - 30000;
  CHECK(agent_send(&a, (const uint8_t *)"x", 1) == -1);
  CHECK(a.consent_revoked);
  a.last_consent = ports_get_epoch_time();
  CHECK(
      !agent_has_consent(&a)); /* Expiry is terminal, even after clock wrap. */
  a.consent_revoked = 0;       /* New test fixture, not production recovery. */
  CHECK(agent_send_binding_request(&a) > 0);
  CHECK(a.consent_interval >= 4000 && a.consent_interval <= 6000);
  StunMessage forbidden;
  stun_msg_create(&forbidden, 0x0111);
  memcpy(forbidden.buf + 8, a.binding_request_transaction_id, 12);
  uint8_t code[] = {0, 0, 4, 3};
  CHECK(!stun_msg_write_attr(&forbidden, (StunAttrType)9, sizeof(code),
                             (char *)code));
  CHECK(!stun_msg_finish(&forbidden, STUN_CREDENTIAL_SHORT_TERM, a.remote_upwd,
                         strlen(a.remote_upwd)));
  CHECK(udp_socket_sendto(&stranger, &destination, forbidden.buf,
                          (int)forbidden.size) > 0);
  readable(a.udp_sockets[0].fd);
  CHECK(!agent_recv(&a, replybuf, sizeof(replybuf)));
  CHECK(agent_has_consent(&a));
  CHECK(udp_socket_sendto(&remote, &destination, forbidden.buf,
                          (int)forbidden.size) > 0);
  readable(a.udp_sockets[0].fd);
  CHECK(agent_recv(&a, replybuf, sizeof(replybuf)) == -1);
  CHECK(!agent_has_consent(&a));
  CHECK(agent_send(&a, (const uint8_t *)"x", 1) == -1);
  agent_destroy(&a);
  udp_socket_close(&remote);
  udp_socket_close(&stranger);
}
static void test_ice_priority(void) {
  Agent a = {0};
  a.local_candidates_count = 1;
  a.local_candidates[0].addr.family = AF_INET;
  a.local_candidates[0].priority = 0x7effffff;
  a.remote_candidates_count = 3;
  const uint32_t priorities[] = {1, 0x7fffffff, 100};
  for (int i = 0; i < 3; ++i) {
    a.remote_candidates[i].addr.family = AF_INET;
    a.remote_candidates[i].priority = priorities[i];
  }
  agent_update_candidate_pairs(&a);
  CHECK(a.candidate_pairs_num == 3);
  CHECK(!agent_select_candidate_pair(&a));
  CHECK(a.nominated_pair->remote == &a.remote_candidates[1]);
  a.early_hello_count = 2;
  a.check_started = ports_get_epoch_time() - 1501;
  CHECK(!agent_select_candidate_pair(&a));
  CHECK(a.nominated_pair->remote == &a.remote_candidates[2]);
  CHECK(a.early_hello_count == 0);
}
static void test_fragments(void) {
  DtlsSrtp dtls = {.role = DTLS_SRTP_ROLE_SERVER};
  Sctp s = {.dtls_srtp = &dtls,
            .connected = 1,
            .onmessage = on_message,
            .stream_count = 1};
  s.stream_table[0].sid = 1;
  s.stream_table[0].state = 2;
  uint8_t *large = malloc(PEER_MESSAGE_LIMIT);
  CHECK(large != NULL);
  memset(large, 'a', PEER_MESSAGE_LIMIT);
  unsigned before = messages;
  sctp_receive_chunk(&s, large, PEER_MESSAGE_LIMIT, PPID_STRING, 1, 0);
  sctp_receive_chunk(&s, large, 1, PPID_STRING, 1, 0);
  sctp_receive_chunk(&s, large, 4, PPID_STRING, 1, 1);
  CHECK(messages == before);
  sctp_receive_chunk(&s, large, 4, PPID_STRING, 1, 1);
  CHECK(messages == before + 1);
  sctp_receive_chunk(&s, large, 3, PPID_STRING, 1, 0);
  sctp_receive_chunk(&s, large, 3, PPID_BINARY, 1, 1);
  CHECK(messages == before + 1);
  s.stream_table[0].state = 1;
  uint8_t ack = 2;
  sctp_receive_chunk(&s, &ack, 1, PPID_CONTROL, 1, 0);
  sctp_receive_chunk(&s, &ack, 1, PPID_CONTROL, 1, 1);
  CHECK(s.stream_table[0].state == 1);
  sctp_receive_chunk(&s, &ack, 1, PPID_CONTROL, 1, 1);
  CHECK(s.stream_table[0].state == 2);
  sctp_destroy_association(&s);
  free(large);
}
static int descriptor_count(void) {
  int count = 0;
  for (int i = 0; i < 256; ++i)
    if (fcntl(i, F_GETFD) != -1)
      ++count;
  return count;
}
static void test_lifecycle(void) {
  int baseline = descriptor_count();
  PeerConfiguration config = {.local_address = "127.0.0.1",
                              .audio_codec = CODEC_OPUS};
  CHECK(peer_connection_create(NULL) == NULL);
  for (int i = 0; i < 30; ++i) {
    PeerConnection *pc = peer_connection_create(&config);
    CHECK(pc != NULL);
    CHECK(peer_deinit() == -1);
    const char *sdp = peer_connection_create_offer(pc);
    CHECK(sdp != NULL);
    CHECK(peer_connection_set_remote_description(pc, sdp, SDP_TYPE_ANSWER));
    CHECK(peer_connection_get_state(pc) == PEER_CONNECTION_NEW);
    CHECK(peer_connection_set_remote_description_n(pc, "bad", 3,
                                                   SDP_TYPE_ANSWER));
    peer_connection_close(pc);
    peer_connection_close(pc);
    CHECK(peer_connection_get_state(pc) == PEER_CONNECTION_CLOSED);
    CHECK(peer_connection_send_audio(pc, (const uint8_t *)"a", 1));
    peer_connection_destroy(pc);
  }
  CHECK(descriptor_count() == baseline);
  config.video_codec = CODEC_H264;
  CHECK(peer_connection_create(&config) == NULL);
  config.video_codec = CODEC_NONE;
  config.ice_servers[0].urls = "turn:example.com:3478";
  CHECK(peer_connection_create(&config) == NULL);
  char a[33], b[33];
  CHECK(!utils_random_string(a, 32));
  CHECK(!utils_random_string(b, 32));
  CHECK(strcmp(a, b));
}
int main(void) {
  CHECK(!peer_init());
  test_stun();
  test_rtp_rtcp();
  test_sdp();
  test_crypto();
  test_dtls_errors();
  test_dcep();
  test_fragments();
  test_udp_boundary();
  test_ice_authentication(0);
  test_ice_authentication(1);
  test_ice_priority();
  test_stun_discovery(0);
  test_stun_discovery(1);
  test_stun_urls();
  test_lifecycle();
  CHECK(!peer_deinit());
  for (int i = 0; i < 10; ++i) {
    CHECK(!peer_init());
    CHECK(!peer_init());
    CHECK(!peer_deinit());
    CHECK(!peer_deinit());
  }
  printf("PASS %u security assertions\n", checks);
  return 0;
}
