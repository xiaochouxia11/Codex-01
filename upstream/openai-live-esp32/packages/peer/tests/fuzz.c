/* One input selector covers independently reachable network parsers. */
#include "rtcp.h"
#include "rtp.h"
#include "sctp.h"
#include "sdp.h"
#include "stun.h"
#include "wire.h"
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
int LLVMFuzzerTestOneInput(const uint8_t *input, size_t size) {
  if (!size || size > 8193)
    return 0;
  unsigned kind = *input++ % 5;
  --size;
  if (kind == 0) {
    StunMessage msg;
    stun_msg_parse(&msg, input, size);
    stun_msg_is_valid((uint8_t *)input, size,
                      "test-password-with-at-least-22-characters");
  } else if (kind == 1) {
    PeerSdp parsed;
    memset(&parsed, 0xa5, sizeof(parsed));
    if (peer_sdp_parse((const char *)input, size, &parsed)) {
      const unsigned char *p = (const unsigned char *)&parsed;
      for (size_t i = 0; i < sizeof(parsed); ++i)
        if (p[i] != 0xa5)
          abort(); /* Rejection must not publish partial negotiation state. */
    } else {
      if (!parsed.ufrag[0] || !parsed.password[0] ||
          strlen(parsed.fingerprint) != 95 || !parsed.candidate_count ||
          parsed.candidate_count > PEER_SDP_CANDIDATES)
        abort();
      for (size_t i = 0; i < parsed.candidate_count; ++i)
        if (parsed.candidates[i].addr.family != AF_INET ||
            !parsed.candidates[i].addr.port)
          abort();
    }
  } else if (kind == 2) {
    size_t offset, length;
    if (!rtp_payload(input, size, &offset, &length) &&
        (offset > size || length > size - offset))
      abort();
    rtcp_validate(input, size);
    RtpDecoder decoder;
    rtp_decoder_init(&decoder, CODEC_OPUS, NULL, NULL);
    rtp_decoder_push(&decoder, input, size, UINT32_MAX - 10);
    /* Repeated, split and wrapped-time inputs exercise bounded queue state. */
    for (size_t pos = 0; pos + 2 <= size;) {
      size_t n = wire_u16(input + pos);
      pos += 2;
      if (n > size - pos)
        break;
      rtp_decoder_push(&decoder, input + pos, n, (uint32_t)pos);
      pos += n;
    }
    rtp_decoder_flush(&decoder, 9000);
  } else if (kind == 3 && size >= 3) {
    DtlsSrtp d = {.role = input[0] & 1 ? DTLS_SRTP_ROLE_SERVER
                                       : DTLS_SRTP_ROLE_CLIENT};
    Sctp s = {.dtls_srtp = &d, .connected = 1, .stream_count = 1};
    s.stream_table[0].sid = 1;
    s.stream_table[0].state = 1 + (input[0] >> 1 & 1);
    sctp_handle_message(&s, input + 3, size - 3, input[1], input[2]);
    size_t half = (size - 3) / 2;
    sctp_receive_chunk(&s, input + 3, half, input[1], input[2], 0);
    sctp_receive_chunk(&s, input + 3 + half, size - 3 - half, input[1],
                       input[2], 1);
    sctp_destroy_association(&s);
  } else {
    IceCandidate c;
    ice_candidate_from_description(&c, (char *)input, (char *)input + size);
    wire_utf8(input, size);
  }
  return 0;
}
