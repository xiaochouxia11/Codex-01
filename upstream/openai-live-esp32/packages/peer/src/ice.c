/* IPv4 UDP ICE candidate subset. No DNS resolution from untrusted SDP. */
#include "ice.h"
#include "utils.h"
#include <ctype.h>
#include <errno.h>
#include <inttypes.h>

void ice_candidate_create(IceCandidate *c, int foundation,
                          IceCandidateType type, Address *addr) {
  memset(c, 0, sizeof(*c));
  c->addr = *addr;
  c->type = type;
  c->component = 1;
  snprintf(c->foundation, sizeof(c->foundation), "%d", foundation);
  strcpy(c->transport, "UDP");
  c->priority = ((type == ICE_CANDIDATE_TYPE_HOST ? 126u : 100u) << 24) |
                (65535u << 8) | 255u;
}

void ice_candidate_to_description(IceCandidate *c, char *out, int length) {
  if (length <= 0)
    return;
  char address[ADDRSTRLEN];
  if (!addr_to_string(&c->addr, address, sizeof(address))) {
    out[0] = 0;
    return;
  }
  const char *types[] = {"host", "srflx", "prflx", "relay"};
  char related[ADDRSTRLEN + 32] = "";
  if (c->type < ICE_CANDIDATE_TYPE_HOST || c->type > ICE_CANDIDATE_TYPE_RELAY) {
    out[0] = 0;
    return;
  }
  if (c->type != ICE_CANDIDATE_TYPE_HOST) {
    char base[ADDRSTRLEN];
    if (!c->raddr.port || !addr_to_string(&c->raddr, base, sizeof(base))) {
      out[0] = 0;
      return;
    }
    snprintf(related, sizeof(related), " raddr %s rport %u", base,
             c->raddr.port);
  }
  int n = snprintf(out, (size_t)length,
                   "a=candidate:%s 1 UDP %" PRIu32 " %s %u typ %s%s\r\n",
                   c->foundation, c->priority, address, c->addr.port,
                   types[c->type], related);
  if (n < 0 || n >= length)
    out[0] = 0;
}

int ice_hostname_valid(const char *name) {
  size_t n = strlen(name), label = 0;
  int alphabetic = 0;
  if (!n || n > 253)
    return 0;
  for (size_t i = 0; i < n; ++i) {
    unsigned char c = (unsigned char)name[i];
    if (c == '.') {
      if (!label || name[i - 1] == '-')
        return 0;
      label = 0;
    } else {
      int alpha = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
      if ((!alpha && !(c >= '0' && c <= '9') && c != '-') ||
          (!label && c == '-') || ++label > 63)
        return 0;
      alphabetic |= alpha;
    }
  }
  /* Do not silently reinterpret a malformed numeric IPv4 address as DNS. */
  return alphabetic && name[n - 1] != '-';
}

static int number(const char *s, uint32_t max, uint32_t *out) {
  if (!s[0])
    return -1;
  uint32_t n = 0;
  for (; *s; ++s) {
    if (*s < '0' || *s > '9' || n > (max - (uint32_t)(*s - '0')) / 10)
      return -1;
    n = n * 10 + (uint32_t)(*s - '0');
  }
  *out = n;
  return 0;
}

int ice_candidate_from_description(IceCandidate *c, char *start, char *end) {
  if (!c || !start || !end || end < start || end - start > 1023)
    return -1;
  char line[1024];
  size_t n = (size_t)(end - start);
  memcpy(line, start, n);
  line[n] = 0;
  if (memchr(line, 0, n))
    return -1;
  char *s = line;
  if (!strncmp(s, "a=", 2))
    s += 2;
  if (strncmp(s, "candidate:", 10))
    return -1;
  s += 10;
  char *tokens[32], *save = NULL;
  size_t count = 0;
  for (char *t = strtok_r(s, " \t\r\n", &save); t;
       t = strtok_r(NULL, " \t\r\n", &save)) {
    if (count == 32)
      return -1;
    tokens[count++] = t;
  }
  if (count < 8 || (count - 8) % 2 || strlen(tokens[0]) > 32 || !tokens[0][0] ||
      strcmp(tokens[6], "typ"))
    return -1;
  int tcp = !strcasecmp(tokens[2], "TCP");
  if (!tcp && strcasecmp(tokens[2], "UDP"))
    return -1;
  IceCandidate result = {0};
  uint32_t port, component;
  if (number(tokens[1], 256, &component) || !component ||
      number(tokens[3], 0x7fffffff, &result.priority) || !result.priority ||
      number(tokens[5], 65535, &port) || !port)
    return -1;
  int numeric = addr_from_string(tokens[4], &result.addr);
  if (!numeric && !ice_hostname_valid(tokens[4]))
    return -1;
  if (result.addr.family == AF_INET) {
    uint32_t host = ntohl(result.addr.sin.sin_addr.s_addr);
    if ((host >> 24) == 0 || (host >> 28) >= 0xe)
      return -1;
  }
  for (const char *p = tokens[0]; *p; ++p)
    if ((unsigned char)*p > 127 ||
        (!isalnum((unsigned char)*p) && *p != '+' && *p != '/'))
      return -1;
  if (!strcmp(tokens[7], "host"))
    result.type = ICE_CANDIDATE_TYPE_HOST;
  else if (!strcmp(tokens[7], "srflx"))
    result.type = ICE_CANDIDATE_TYPE_SRFLX;
  else if (!strcmp(tokens[7], "prflx"))
    result.type = ICE_CANDIDATE_TYPE_PRFLX;
  else if (!strcmp(tokens[7], "relay"))
    result.type = ICE_CANDIDATE_TYPE_RELAY;
  else
    return -1;
  int tcp_type = 0, related_address = 0, related_port = 0;
  for (size_t i = 8; i < count; i += 2) {
    if (!strcmp(tokens[i], "raddr")) {
      if (related_address++ ||
          (!addr_from_string(tokens[i + 1], &result.raddr) &&
           !ice_hostname_valid(tokens[i + 1])))
        return -1;
    } else if (!strcmp(tokens[i], "rport")) {
      uint32_t related;
      if (related_port++ || number(tokens[i + 1], 65535, &related))
        return -1;
      result.raddr.port = (uint16_t)related;
    } else if (!strcmp(tokens[i], "tcptype")) {
      if (!tcp || tcp_type++ ||
          (strcmp(tokens[i + 1], "active") &&
           strcmp(tokens[i + 1], "passive") && strcmp(tokens[i + 1], "so")))
        return -1;
    }
  }
  if ((tcp && !tcp_type) || (result.type == ICE_CANDIDATE_TYPE_HOST
                                 ? related_address || related_port
                                 : !related_address || !related_port))
    return -1;
  if (result.raddr.family)
    addr_set_port(&result.raddr, result.raddr.port);
  // Remote SDP may advertise fallback transports alongside usable candidates.
  // Never select or allocate a socket for an unsupported candidate.
  if (!numeric || tcp || component != 1 || result.addr.family != AF_INET)
    return 1;
  memcpy(result.foundation, tokens[0], strlen(tokens[0]) + 1);
  strcpy(result.transport, "UDP");
  result.component = 1;
  addr_set_port(&result.addr, (uint16_t)port);
  *c = result;
  return 0;
}
