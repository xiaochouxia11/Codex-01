/* Deterministic local UDP-loss injection for the independent-peer harness.
 * Replaces only this executable's socket translation unit, never production. */
#include "socket.h"
#include "wire.h"
#include <errno.h>
#include <stdio.h>
static unsigned connectivity_lost, handshake_lost, application_lost,
    consent_lost, rtp_sent;
static ssize_t fault_sendto(int fd, const void *data, size_t n, int flags,
                            const struct sockaddr *address, socklen_t length) {
  const uint8_t *p = data;
  if (n >= 20 && wire_u16(p) == 1 && !connectivity_lost) {
    ++connectivity_lost;
    errno = ENOMEM;
    return -1;
  }
  if (n >= 13 && p[0] == 22 && !handshake_lost) {
    ++handshake_lost;
    errno = ENOMEM;
    return -1;
  }
  if (n >= 13 && p[0] == 23 && !application_lost) {
    ++application_lost;
    errno = EAGAIN;
    return -1;
  }
  if (n >= 12 && (p[0] >> 6) == 2)
    ++rtp_sent;
  if (n >= 20 && wire_u16(p) == 1 && rtp_sent > 10 && !consent_lost) {
    ++consent_lost;
    errno = ENOBUFS;
    return -1;
  }
  return sendto(fd, data, n, flags, address, length);
}
#define sendto fault_sendto
#include "../../src/socket.c"
#undef sendto
#define main interop_main
/* The first consent probe can occur six seconds after ICE, which itself is
 * delayed by injected loss. A six-second session could pass media checks yet
 * never reach the consent fault. Keep all four injection assertions below. */
#define PEER_INTEROP_SECONDS 12
#include "../../examples/interop.c"
#undef main
int main(int argc, char **argv) {
  int rc = interop_main(argc, argv);
  fprintf(stderr, "Injected losses: ICE=%u handshake=%u SCTP=%u consent=%u\n",
          connectivity_lost, handshake_lost, application_lost, consent_lost);
  return rc ? rc
            : connectivity_lost != 1 || handshake_lost != 1 ||
                  application_lost != 1 || consent_lost != 1;
}
