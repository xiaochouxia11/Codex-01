#pragma once
#include <errno.h>
#include <stdint.h>
#include <sys/socket.h>
/* usrsctp still uses sizeof(struct ip) for conservative overhead accounting
 * in its AF_CONN-only build. No IP header is parsed or emitted by this port. */
struct ip {
  uint8_t header[20];
};
#ifndef IPPORT_RESERVED
#define IPPORT_RESERVED 1024
#endif
#ifndef UIO_MAXIOV
#define UIO_MAXIOV 16
#endif
#ifndef ERESTART
#define ERESTART EINTR
#endif
#ifndef CMSG_ALIGN
#define CMSG_ALIGN(n) (((n) + sizeof(size_t) - 1) & ~(sizeof(size_t) - 1))
#endif
