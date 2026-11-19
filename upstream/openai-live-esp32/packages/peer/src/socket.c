#include <errno.h>
#include <string.h>

#include "socket.h"
#include "utils.h"

int udp_socket_open(UdpSocket *udp_socket, int family, int port) {
  return udp_socket_open_on(udp_socket, family, port, NULL);
}
int udp_socket_open_on(UdpSocket *udp_socket, int family, int port,
                       const char *bind_ip) {
  udp_socket->last_send_errno = 0;
  udp_socket->send_errors = 0;
  int ret;
  struct sockaddr *sa;
  socklen_t sock_len;

  udp_socket->bind_addr.family = family;
  switch (family) {
  case AF_INET6:
    udp_socket->fd = socket(AF_INET6, SOCK_DGRAM, 0);
    udp_socket->bind_addr.sin6.sin6_family = AF_INET6;
    udp_socket->bind_addr.sin6.sin6_port = htons(port);
    udp_socket->bind_addr.sin6.sin6_addr = in6addr_any;
    udp_socket->bind_addr.port = ntohs(udp_socket->bind_addr.sin6.sin6_port);
    sa = (struct sockaddr *)&udp_socket->bind_addr.sin6;
    sock_len = sizeof(struct sockaddr_in6);
    break;
  case AF_INET:
  default:
    udp_socket->fd = socket(AF_INET, SOCK_DGRAM, 0);
    udp_socket->bind_addr.sin.sin_family = AF_INET;
    udp_socket->bind_addr.sin.sin_port = htons(port);
    udp_socket->bind_addr.sin.sin_addr.s_addr = htonl(INADDR_ANY);
    if (bind_ip &&
        inet_pton(AF_INET, bind_ip, &udp_socket->bind_addr.sin.sin_addr) != 1) {
      udp_socket_close(udp_socket);
      return -1;
    }
    sa = (struct sockaddr *)&udp_socket->bind_addr.sin;
    sock_len = sizeof(struct sockaddr_in);
    break;
  }

  if (udp_socket->fd < 0) {
    LOGE("Failed to create socket");
    return -1;
  }

  do {
    if ((ret = bind(udp_socket->fd, sa, sock_len)) < 0) {
      LOGE("Failed to bind socket: %d", ret);
      break;
    }

    if ((ret = getsockname(udp_socket->fd, sa, &sock_len)) < 0) {
      LOGE("Get socket info failed");
      break;
    }
  } while (0);

  if (ret < 0) {
    udp_socket_close(udp_socket);
    return -1;
  }

  switch (udp_socket->bind_addr.family) {
  case AF_INET6:
    udp_socket->bind_addr.port = ntohs(udp_socket->bind_addr.sin6.sin6_port);
    break;
  case AF_INET:
  default:
    udp_socket->bind_addr.port = ntohs(udp_socket->bind_addr.sin.sin_port);
    break;
  }

  return 0;
}

void udp_socket_close(UdpSocket *udp_socket) {
  if (udp_socket->fd >= 0) {
    close(udp_socket->fd);
    udp_socket->fd = -1;
  }
}

int udp_socket_send_would_block(const UdpSocket *s) {
  return s &&
         (s->last_send_errno == ENOMEM || s->last_send_errno == ENOBUFS ||
          s->last_send_errno == EAGAIN || s->last_send_errno == EWOULDBLOCK);
}

int udp_socket_sendto(UdpSocket *udp_socket, Address *addr, const uint8_t *buf,
                      int len) {
  struct sockaddr *sa;
  socklen_t sock_len;
  int ret = -1;

  if (udp_socket->fd < 0) {
    udp_socket->last_send_errno = EBADF;
    LOGE("sendto before socket init");
    errno = EBADF;
    return -1;
  }

  switch (addr->family) {
  case AF_INET6:
    addr->sin6.sin6_family = AF_INET6;
    sa = (struct sockaddr *)&addr->sin6;
    sock_len = sizeof(struct sockaddr_in6);
    break;
  case AF_INET:
  default:
    addr->sin.sin_family = AF_INET;
    sa = (struct sockaddr *)&addr->sin;
    sock_len = sizeof(struct sockaddr_in);
    break;
  }

  if ((ret = sendto(udp_socket->fd, buf, len, MSG_DONTWAIT, sa, sock_len)) <
      0) {
    const int saved_errno = errno;
    udp_socket->last_send_errno = saved_errno;
    ++udp_socket->send_errors;
    /* Preserve errno across logging; control protocols need the actual error.
     */
    /* A sustained full queue must not turn into a blocking console flood. */
    if (!udp_socket_send_would_block(udp_socket) ||
        !(udp_socket->send_errors & (udp_socket->send_errors - 1)))
      LOGE("Failed to sendto: errno=%d (%s) total=%lu", saved_errno,
           strerror(saved_errno), (unsigned long)udp_socket->send_errors);
    errno = saved_errno;
    return -1;
  }

  udp_socket->last_send_errno = 0;
  return ret;
}

int udp_socket_recvfrom(UdpSocket *udp_socket, Address *addr, uint8_t *buf,
                        int len) {
  struct sockaddr_in6 sin6;
  struct sockaddr_in sin;
  struct sockaddr *sa;
  socklen_t sock_len;
  int ret;

  if (udp_socket->fd < 0) {
    LOGE("recvfrom before socket init");
    return -1;
  }

  switch (udp_socket->bind_addr.family) {
  case AF_INET6:
    sin6.sin6_family = AF_INET6;
    sa = (struct sockaddr *)&sin6;
    sock_len = sizeof(struct sockaddr_in6);
    break;
  case AF_INET:
  default:
    sin.sin_family = AF_INET;
    sa = (struct sockaddr *)&sin;
    sock_len = sizeof(struct sockaddr_in);
    break;
  }

  struct iovec iov = {.iov_base = buf, .iov_len = (size_t)len};
  struct msghdr msg = {.msg_name = sa,
                       .msg_namelen = sock_len,
                       .msg_iov = &iov,
                       .msg_iovlen = 1};
  ret = (int)recvmsg(udp_socket->fd, &msg, MSG_DONTWAIT);
  if (ret < 0)
    return errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR ? 0 : -1;
  /* A truncated authenticated datagram must never be interpreted as another
   * packet. */
  if (msg.msg_flags & MSG_TRUNC)
    return 0;

  if (addr) {
    switch (udp_socket->bind_addr.family) {
    case AF_INET6:
      addr->family = AF_INET6;
      addr->port = ntohs(sin6.sin6_port);
      memcpy(&addr->sin6, &sin6, sizeof(struct sockaddr_in6));
      break;
    case AF_INET:
    default:
      addr->family = AF_INET;
      addr->port = ntohs(sin.sin_port);
      memcpy(&addr->sin, &sin, sizeof(struct sockaddr_in));
      break;
    }
  }

  return ret;
}
