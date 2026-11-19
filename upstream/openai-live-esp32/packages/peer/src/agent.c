/* Bounded UDP ICE checks. TURN allocations and TCP candidates are not
 * supported. */
#include "agent.h"
#include "ports.h"
#include "wire.h"
#include <errno.h>
#include <sys/select.h>

#if defined(LIVE_PEER_TRACE_ICE) && LIVE_PEER_TRACE_ICE
#define ICE_TRACE(...) LOGI(__VA_ARGS__)
#else
#define ICE_TRACE(...) ((void)0)
#endif

void agent_clear_candidates(Agent *a) {
  a->local_candidates_count = a->remote_candidates_count =
      a->candidate_pairs_num = 0;
  a->selected_pair = a->nominated_pair = NULL;
  a->binding_request_pending = 0;
  a->early_hello_head = a->early_hello_count = 0;
}
int agent_create(Agent *a) {
  memset(a, 0, sizeof(*a));
  a->udp_sockets[0].fd = a->udp_sockets[1].fd = -1;
  return udp_socket_open(&a->udp_sockets[0], AF_INET, 0);
}
void agent_destroy(Agent *a) {
  udp_socket_close(&a->udp_sockets[0]);
  udp_socket_close(&a->udp_sockets[1]);
  agent_clear_candidates(a);
  memset(a->local_upwd, 0, sizeof(a->local_upwd));
  memset(a->remote_upwd, 0, sizeof(a->remote_upwd));
}
static int receive(Agent *a, Address *address, uint8_t *buf, int capacity,
                   int wait) {
  int fd = a->udp_sockets[0].fd;
  if (fd < 0 || fd >= FD_SETSIZE || capacity <= 0)
    return -1;
  if (wait) {
    // Synchronous STUN gathering needs a wait to avoid spinning for its whole
    // one-second budget. Owner-driven ICE/media polls already have a scheduler.
    fd_set fds;
    FD_ZERO(&fds);
    FD_SET(fd, &fds);
    struct timeval timeout = {0, 1000};
    int ret = select(fd + 1, &fds, NULL, NULL, &timeout);
    if (ret <= 0)
      return ret < 0 && errno != EINTR ? -1 : 0;
  }
  // recvmsg(MSG_DONTWAIT) already distinguishes an empty queue, truncation and
  // fatal errors. Do not create a second readiness wait for every media poll.
  return udp_socket_recvfrom(&a->udp_sockets[0], address, buf, capacity);
}
static int send_to(Agent *a, Address *address, const uint8_t *buf, int len) {
  if (!address || address->family != AF_INET || !address->port || len <= 0 ||
      len > STUN_ATTR_BUF_SIZE)
    return -1;
  return udp_socket_sendto(&a->udp_sockets[0], address, buf, len);
}
int agent_parse_stun_url(const char *url, char hostname[128], uint16_t *port) {
  if (!url || strnlen(url, 256) == 256 || strncasecmp(url, "stun:", 5))
    return -1;
  const char *host = url + 5, *colon = strchr(host, ':');
  size_t length = colon ? (size_t)(colon - host) : strlen(host);
  if (!length || length >= 128)
    return -1;
  memcpy(hostname, host, length);
  hostname[length] = 0;
  Address numeric;
  if (addr_from_string(hostname, &numeric)) {
    if (numeric.family != AF_INET)
      return -1;
  } else if (!ice_hostname_valid(hostname))
    return -1;
  unsigned value = 3478;
  if (colon) {
    value = 0;
    if (!colon[1])
      return -1;
    for (const char *p = colon + 1; *p; ++p) {
      if (*p < '0' || *p > '9' || value > (65535u - (*p - '0')) / 10)
        return -1;
      value = value * 10 + (*p - '0');
    }
    if (!value)
      return -1;
  }
  *port = (uint16_t)value;
  return 0;
}
void agent_gather_candidate(Agent *a, const char *url, const char *username,
                            const char *credential) {
  (void)username;
  (void)credential;
  if (a->local_candidates_count >= AGENT_MAX_CANDIDATES)
    return;
  Address address = a->udp_sockets[0].bind_addr;
  if (a->host_addr.family == AF_INET)
    address = a->host_addr;
  else if (ports_get_host_addr(&address, CONFIG_IFACE_PREFIX) != 1)
    return;
  addr_set_port(&address, a->udp_sockets[0].bind_addr.port);
  if (!url) {
    ice_candidate_create(&a->local_candidates[a->local_candidates_count],
                         a->local_candidates_count, ICE_CANDIDATE_TYPE_HOST,
                         &address);
    ++a->local_candidates_count;
    return;
  }
  Address base = address;
  /* Hostnames come from application configuration, never remote SDP. */
  char hostname[128];
  uint16_t port;
  if (agent_parse_stun_url(url, hostname, &port) ||
      ports_resolve_addr(hostname, &address))
    return;
  addr_set_port(&address, port);
  StunMessage request, response;
  stun_msg_create(&request, STUN_METHOD_BINDING);
  if (request.error || send_to(a, &address, request.buf, (int)request.size) < 0)
    return;
  uint32_t deadline = ports_get_epoch_time();
  int retried = 0;
  while ((uint32_t)(ports_get_epoch_time() - deadline) < 1000) {
    /* Keep gathering bounded, but tolerate one lost request or response. A
       retransmission belongs to the same STUN transaction. */
    if (!retried && (uint32_t)(ports_get_epoch_time() - deadline) >= 500) {
      retried = 1;
      if (send_to(a, &address, request.buf, (int)request.size) < 0)
        return;
    }
    Address source;
    uint8_t buf[STUN_ATTR_BUF_SIZE];
    int n = receive(a, &source, buf, sizeof(buf), 1);
    if (n <= 0 || !addr_equal(&source, &address) ||
        stun_msg_parse(&response, buf, (size_t)n) || wire_u16(buf) != 0x0101 ||
        !wire_equal(buf + 8, request.buf + 8, 12) ||
        response.mapped_addr.family != AF_INET || !response.mapped_addr.port ||
        stun_msg_check_fingerprint(&response))
      continue;
    uint32_t host = ntohl(response.mapped_addr.sin.sin_addr.s_addr);
    if ((host >> 24) == 0 || (host >> 28) >= 0xe)
      continue;
    ice_candidate_create(&a->local_candidates[a->local_candidates_count],
                         a->local_candidates_count, ICE_CANDIDATE_TYPE_SRFLX,
                         &response.mapped_addr);
    a->local_candidates[a->local_candidates_count].raddr = base;
    ++a->local_candidates_count;
    return;
  }
}
void agent_create_ice_credential(Agent *a) {
  if (utils_random_string(a->local_ufrag, 16) ||
      utils_random_string(a->local_upwd, 32) ||
      utils_random_bytes(a->tie_breaker, 8)) {
    a->local_ufrag[0] = a->local_upwd[0] = 0;
  }
}
void agent_get_local_description(Agent *a, char *out, int capacity) {
  if (capacity <= 0)
    return;
  out[0] = 0;
  for (int i = 0; i < a->local_candidates_count; ++i) {
    char line[256];
    ice_candidate_to_description(&a->local_candidates[i], line, sizeof(line));
    size_t used = strlen(out), n = strlen(line);
    if (used + n >= (size_t)capacity) {
      out[0] = 0;
      return;
    }
    memcpy(out + used, line, n + 1);
  }
}
int agent_send(Agent *a, const uint8_t *buf, int len) {
  if (!agent_has_consent(a))
    return -1;
  return send_to(a, &a->selected_pair->remote->addr, buf, len);
}
int agent_has_consent(Agent *a) {
  if (!a || !a->selected_pair || a->consent_revoked)
    return 0;
  /* Latch expiry: a late response cannot resurrect an expired transport. */
  if ((uint32_t)(ports_get_epoch_time() - a->last_consent) >= 30000) {
    a->consent_revoked = 1;
    return 0;
  }
  return 1;
}
int agent_send_binding_request(Agent *a) {
  if (!a->nominated_pair || a->consent_revoked ||
      (a->selected_pair && !agent_has_consent(a)))
    return -1;
  if (a->binding_request_pending && !a->selected_pair) {
    a->binding_request_sent_time = ports_get_epoch_time();
    int sent = send_to(a, &a->nominated_pair->remote->addr, a->binding_packet,
                       (int)a->binding_packet_size);
    return sent < 0 && udp_socket_send_would_block(&a->udp_sockets[0]) ? 0
                                                                       : sent;
  }
  StunMessage msg;
  stun_msg_create(&msg, STUN_METHOD_BINDING);
  uint8_t jitter[2];
  if (utils_random_bytes(jitter, sizeof(jitter)))
    return -1;
  char username[514];
  snprintf(username, sizeof(username), "%s:%s", a->remote_ufrag,
           a->local_ufrag);
  uint8_t priority[4];
  wire_put32(priority, a->nominated_pair->local->priority);
  stun_msg_write_attr(&msg, STUN_ATTR_TYPE_USERNAME, (uint16_t)strlen(username),
                      username);
  stun_msg_write_attr(&msg, STUN_ATTR_TYPE_PRIORITY, 4, (char *)priority);
  stun_msg_write_attr(&msg,
                      a->mode == AGENT_MODE_CONTROLLING
                          ? STUN_ATTR_TYPE_ICE_CONTROLLING
                          : STUN_ATTR_TYPE_ICE_CONTROLLED,
                      8, (char *)a->tie_breaker);
  if (a->mode == AGENT_MODE_CONTROLLING && !a->selected_pair)
    stun_msg_write_attr(&msg, STUN_ATTR_TYPE_USE_CANDIDATE, 0, NULL);
  if (stun_msg_finish(&msg, STUN_CREDENTIAL_SHORT_TERM, a->remote_upwd,
                      strlen(a->remote_upwd)))
    return -1;
  memcpy(a->binding_packet, msg.buf, msg.size);
  a->binding_packet_size = msg.size;
  memcpy(a->binding_request_transaction_id, msg.buf + 8, 12);
  a->binding_request_sent_time = ports_get_epoch_time();
  /* RFC 7675: randomize each consent interval in [4, 6] seconds. */
  a->consent_interval = 4000 + wire_u16(jitter) % 2001;
  a->binding_request_pending = 1;
  int sent =
      send_to(a, &a->nominated_pair->remote->addr, msg.buf, (int)msg.size);
  ICE_TRACE("ice tx connected=%d sent=%d errno=%d age_ms=%lu interval_ms=%lu",
            a->selected_pair != NULL, sent, a->udp_sockets[0].last_send_errno,
            (unsigned long)(ports_get_epoch_time() - a->last_consent),
            (unsigned long)a->consent_interval);
  /* Losing one consent probe is not revocation. Keep the normal randomized
     cadence and the last authenticated response's 30-second deadline. Do not
     spin/retransmit a consent transaction or grant consent on send success. */
  if (sent < 0 && udp_socket_send_would_block(&a->udp_sockets[0]))
    return 0;
  return sent;
}
int agent_recv(Agent *a, uint8_t *buf, int capacity) {
  if (a->selected_pair && a->early_hello_count) {
    unsigned slot = a->early_hello_head++;
    --a->early_hello_count;
    size_t n = a->early_hello_size[slot];
    if (capacity <= 0 || n > (size_t)capacity)
      return 0;
    memcpy(buf, a->early_hello[slot], n);
    return (int)n;
  }
  Address source;
  int n = receive(a, &source, buf, capacity, 0);
  if (n <= 0)
    return n;
  /* RFC 7983: STUN is 0..3; DTLS (20..63) also has its top two bits clear. */
  if (buf[0] <= 3) {
    StunMessage msg;
    if (stun_msg_parse(&msg, buf, (size_t)n) ||
        msg.stunmethod != STUN_METHOD_BINDING)
      return 0;
    if (msg.stunclass == STUN_CLASS_RESPONSE ||
        msg.stunclass == STUN_CLASS_ERROR) {
      ICE_TRACE(
          "ice rx class=%x pending=%d source=%d transaction=%d auth=%d "
          "mapping=%d code=%u rtt_ms=%lu",
          msg.stunclass, a->binding_request_pending,
          a->nominated_pair &&
              addr_equal(&source, &a->nominated_pair->remote->addr),
          wire_equal(buf + 8, a->binding_request_transaction_id, 12),
          !stun_msg_is_valid(buf, (size_t)n, a->remote_upwd),
          a->nominated_pair &&
              addr_equal(&msg.mapped_addr, &a->nominated_pair->local->addr),
          msg.error_code,
          (unsigned long)(ports_get_epoch_time() -
                          a->binding_request_sent_time));
    }
    if (msg.stunclass == STUN_CLASS_REQUEST) {
      char expected[514];
      snprintf(expected, sizeof(expected), "%s:%s", a->local_ufrag,
               a->remote_ufrag);
      ICE_TRACE("ice request username=%d priority=%lu controlled=%d "
                "controlling=%d auth=%d",
                !strcmp(msg.username, expected), (unsigned long)msg.priority,
                msg.controlled, msg.controlling,
                !stun_msg_is_valid(buf, (size_t)n, a->local_upwd));
      if (!a->remote_ufrag[0] || strcmp(msg.username, expected) ||
          !msg.priority ||
          (a->mode == AGENT_MODE_CONTROLLING ? !msg.controlled
                                             : !msg.controlling) ||
          stun_msg_is_valid(buf, (size_t)n, a->local_upwd))
        return 0;
      StunMessage reply;
      stun_msg_create(&reply, 0x0101);
      if (reply.error)
        return 0;
      memcpy(reply.buf + 8, buf + 8, 12);
      uint8_t mapped[20];
      int count =
          stun_set_mapped_address((char *)mapped, reply.buf + 4, &source);
      stun_msg_write_attr(&reply, STUN_ATTR_TYPE_XOR_MAPPED_ADDRESS,
                          (uint16_t)count, (char *)mapped);
      if (!stun_msg_finish(&reply, STUN_CREDENTIAL_SHORT_TERM, a->local_upwd,
                           strlen(a->local_upwd)))
        send_to(a, &source, reply.buf, (int)reply.size);
    } else if ((msg.stunclass == STUN_CLASS_RESPONSE ||
                msg.stunclass == STUN_CLASS_ERROR) &&
               a->nominated_pair && a->binding_request_pending &&
               !a->consent_revoked &&
               (!a->selected_pair || agent_has_consent(a)) &&
               addr_equal(&source, &a->nominated_pair->remote->addr) &&
               wire_equal(buf + 8, a->binding_request_transaction_id, 12) &&
               !stun_msg_is_valid(buf, (size_t)n, a->remote_upwd)) {
      if (msg.stunclass == STUN_CLASS_ERROR) {
        if (msg.error_code == 403) {
          a->consent_revoked = 1;
          a->binding_request_pending = 0;
          return -1;
        }
        return 0;
      }
      if (!msg.xor_mapped || msg.mapped_addr.family != AF_INET ||
          !msg.mapped_addr.port)
        return 0;
      if (!addr_equal(&msg.mapped_addr, &a->nominated_pair->local->addr)) {
        /* The authenticated response tells us this socket's NAT mapping. It
           never changes the remote destination. Learn one bounded local
           peer-reflexive candidate only during initial nomination; a changed
           mapping after selection needs a new connection. */
        uint32_t ip = ntohl(msg.mapped_addr.sin.sin_addr.s_addr);
        if (a->selected_pair || (ip >> 24) == 0 || (ip >> 24) == 127 ||
            (ip >> 28) >= 0xe)
          return 0;
        ice_candidate_create(&a->learned_local, AGENT_MAX_CANDIDATES,
                             ICE_CANDIDATE_TYPE_PRFLX, &msg.mapped_addr);
        a->learned_local.priority = a->nominated_pair->local->priority;
        a->learned_local.raddr = a->nominated_pair->local->addr;
        a->nominated_pair->local = &a->learned_local;
      }
      a->nominated_pair->state = ICE_CANDIDATE_STATE_SUCCEEDED;
      a->binding_request_pending = 0;
      a->last_consent = ports_get_epoch_time();
    }
    return 0;
  }
  if (!a->selected_pair) {
    /* A peer can start DTLS before our outbound ICE response arrives. Cache at
       most two ClientHello fragments from the pair being checked, but never
       expose them to DTLS until that pair passes authenticated ICE checks. */
    if (a->nominated_pair && a->early_hello_count < 2 && n >= 25 &&
        n <= STUN_ATTR_BUF_SIZE && buf[0] == 22 && buf[3] == 0 && buf[4] == 0 &&
        buf[13] == 1 && addr_equal(&source, &a->nominated_pair->remote->addr)) {
      unsigned slot = a->early_hello_count++;
      memcpy(a->early_hello[slot], buf, (size_t)n);
      a->early_hello_size[slot] = (size_t)n;
    }
    return 0;
  }
  if (!addr_equal(&source, &a->selected_pair->remote->addr))
    return 0;
  return n;
}
static uint64_t pair_priority(const IceCandidatePair *p) {
  uint64_t g = p->local->priority, d = p->remote->priority;
  return ((g < d ? g : d) << 32) + 2 * (g > d ? g : d) + (g > d);
}
static int compare_pairs(const void *left, const void *right) {
  uint64_t a = pair_priority(left), b = pair_priority(right);
  return a < b ? 1 : a > b ? -1 : 0;
}
void agent_update_candidate_pairs(Agent *a) {
  a->selected_pair = a->nominated_pair = NULL;
  a->candidate_pairs_num = 0;
  for (int i = 0; i < a->local_candidates_count; ++i)
    for (int j = 0; j < a->remote_candidates_count; ++j) {
      if (a->candidate_pairs_num >= AGENT_MAX_CANDIDATE_PAIRS)
        goto done;
      if (a->local_candidates[i].addr.family !=
          a->remote_candidates[j].addr.family)
        continue;
      IceCandidatePair *p = &a->candidate_pairs[a->candidate_pairs_num++];
      memset(p, 0, sizeof(*p));
      p->local = &a->local_candidates[i];
      p->remote = &a->remote_candidates[j];
      p->state = ICE_CANDIDATE_STATE_FROZEN;
    }
done:
  qsort(a->candidate_pairs, (size_t)a->candidate_pairs_num,
        sizeof(a->candidate_pairs[0]), compare_pairs);
}
int agent_select_candidate_pair(Agent *a) {
  if (a->selected_pair)
    return 0;
  if (a->nominated_pair &&
      a->nominated_pair->state == ICE_CANDIDATE_STATE_INPROGRESS &&
      (uint32_t)(ports_get_epoch_time() - a->check_started) >= 1500)
    a->nominated_pair->state = ICE_CANDIDATE_STATE_FAILED;
  for (int i = 0; i < a->candidate_pairs_num; ++i) {
    IceCandidatePair *p = &a->candidate_pairs[i];
    if (p->state == ICE_CANDIDATE_STATE_FROZEN) {
      a->nominated_pair = p;
      a->early_hello_head = a->early_hello_count = 0;
      p->state = ICE_CANDIDATE_STATE_INPROGRESS;
      a->binding_request_pending = 0;
      a->check_started = ports_get_epoch_time();
      return 0;
    }
    if (p->state == ICE_CANDIDATE_STATE_INPROGRESS ||
        p->state == ICE_CANDIDATE_STATE_SUCCEEDED)
      return 0;
  }
  return -1;
}
int agent_connectivity_check(Agent *a) {
  if (agent_select_candidate_pair(a))
    return -1;
  if (!a->binding_request_pending ||
      (uint32_t)(ports_get_epoch_time() - a->binding_request_sent_time) >= 250)
    if (agent_send_binding_request(a) < 0)
      return -1;
  uint8_t buf[STUN_ATTR_BUF_SIZE];
  if (agent_recv(a, buf, sizeof(buf)) < 0)
    return -1;
  if (a->nominated_pair->state == ICE_CANDIDATE_STATE_SUCCEEDED)
    a->selected_pair = a->nominated_pair;
  return 0;
}
