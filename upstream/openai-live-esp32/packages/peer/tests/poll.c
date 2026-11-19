/* Ordinary peer polls must not register a blocking readiness wait. Gathering
 * still waits; queued datagrams, truncation, and socket errors keep semantics.
 */
#include <stdio.h>
#include <stdlib.h>
#include <sys/select.h>
static unsigned checks, waits;
#define CHECK(x)                                                               \
  do {                                                                         \
    ++checks;                                                                  \
    if (!(x)) {                                                                \
      fprintf(stderr, "%s:%d: %s\n", __FILE__, __LINE__, #x);                  \
      abort();                                                                 \
    }                                                                          \
  } while (0)
static int count_select(int fd, fd_set *read, fd_set *write, fd_set *error,
                        struct timeval *timeout) {
  ++waits;
  return select(fd, read, write, error, timeout);
}
#define select count_select
#include "../src/agent.c"
#undef select
static void ready(int fd) {
  fd_set fds;
  FD_ZERO(&fds);
  FD_SET(fd, &fds);
  struct timeval timeout = {1, 0};
  CHECK(select(fd + 1, &fds, NULL, NULL, &timeout) == 1);
}
int main(void) {
  Agent a;
  CHECK(!agent_create(&a));
  uint8_t data[1536];
  for (unsigned i = 0; i < 1000; ++i)
    CHECK(agent_recv(&a, data, sizeof(data)) == 0);
  CHECK(!waits);
  Address source;
  CHECK(!receive(&a, &source, data, sizeof(data), 1) && waits == 1);
  UdpSocket remote = {.fd = -1};
  CHECK(!udp_socket_open_on(&remote, AF_INET, 0, "127.0.0.1"));
  IceCandidate candidate = {.addr = remote.bind_addr};
  IceCandidatePair pair = {.remote = &candidate};
  a.selected_pair = &pair;
  Address target = a.udp_sockets[0].bind_addr;
  CHECK(addr_from_string("127.0.0.1", &target));
  uint8_t packet[1537] = {0x80};
  CHECK(udp_socket_sendto(&remote, &target, packet, sizeof(packet)) ==
        sizeof(packet));
  ready(a.udp_sockets[0].fd);
  CHECK(agent_recv(&a, data, sizeof(data)) ==
        0); // A truncated datagram is discarded.
  for (unsigned i = 1; i <= 3; ++i) {
    packet[1] = i;
    CHECK(udp_socket_sendto(&remote, &target, packet, 12) == 12);
  }
  for (unsigned i = 1; i <= 3; ++i) {
    ready(a.udp_sockets[0].fd);
    CHECK(agent_recv(&a, data, sizeof(data)) == 12);
    CHECK(data[1] == i);
  }
  CHECK(!agent_recv(&a, data, sizeof(data)) && waits == 1);
  udp_socket_close(&a.udp_sockets[0]);
  CHECK(agent_recv(&a, data, sizeof(data)) == -1);
  udp_socket_close(&remote);
  agent_destroy(&a);
  printf("Nonblocking poll checks: %u passed\n", checks);
}
