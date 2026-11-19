#ifndef SOCKET_H_
#define SOCKET_H_

#include "address.h"

typedef struct UdpSocket {
  int fd;
  int last_send_errno;
  uint32_t send_errors;
  Address bind_addr;
} UdpSocket;

int udp_socket_open_on(UdpSocket *, int, int, const char *);

int udp_socket_open(UdpSocket *udp_socket, int family, int port);

void udp_socket_close(UdpSocket *udp_socket);

/* Temporary datagram loss/backpressure, rather than an invalid socket. */
int udp_socket_send_would_block(const UdpSocket *udp_socket);

int udp_socket_sendto(UdpSocket *udp_socket, Address *bind_addr,
                      const uint8_t *buf, int len);

int udp_socket_recvfrom(UdpSocket *udp_sock, Address *bind_addr, uint8_t *buf,
                        int len);

#endif
