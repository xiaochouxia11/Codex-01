/* Bounded STUN framing and short-term credential validation (RFC 8489). */
#include "stun.h"
#include "utils.h"
#include "wire.h"

void stun_msg_create(StunMessage *msg, uint16_t type) {
  memset(msg, 0, sizeof(*msg));
  wire_put16(msg->buf, type);
  wire_put32(msg->buf + 4, MAGIC_COOKIE);
  if (utils_random_bytes(msg->buf + 8, 12)) {
    msg->error = 1;
    return;
  }
  msg->size = 20;
}

int stun_probe(uint8_t *buf, size_t size) {
  if (!buf || size < 20 || size > STUN_ATTR_BUF_SIZE || (buf[0] & 0xc0) ||
      wire_u32(buf + 4) != MAGIC_COOKIE || (wire_u16(buf + 2) & 3) ||
      (size_t)wire_u16(buf + 2) != size - 20)
    return -1;
  return 0;
}

void stun_calculate_fingerprint(char *buf, size_t len, uint32_t *fingerprint) {
  uint32_t crc = 0xffffffff;
  for (size_t i = 0; i < len; ++i) {
    crc ^= (uint8_t)buf[i];
    for (int j = 0; j < 8; ++j)
      crc = (crc >> 1) ^ (0xedb88320u & (0u - (crc & 1)));
  }
  *fingerprint = htonl((crc ^ 0xffffffff) ^ STUN_FINGERPRINT_XOR);
}

int stun_set_mapped_address(char *value, uint8_t *mask, Address *addr) {
  size_t n = addr->family == AF_INET6 ? 16 : 4;
  value[0] = 0;
  value[1] = n == 16 ? 2 : 1;
  wire_put16(value + 2, addr->port ^ wire_u16(mask));
  const uint8_t *ip = n == 16 ? (const uint8_t *)&addr->sin6.sin6_addr
                              : (const uint8_t *)&addr->sin.sin_addr;
  for (size_t i = 0; i < n; ++i)
    value[4 + i] = (char)(ip[i] ^ mask[i]);
  return (int)n + 4;
}

void stun_get_mapped_address(char *value, uint8_t *mask, Address *addr) {
  memset(addr, 0, sizeof(*addr));
  size_t n = value[1] == 2 ? 16 : 4;
  addr_set_family(addr, n == 16 ? AF_INET6 : AF_INET);
  addr_set_port(addr, wire_u16(value + 2) ^ wire_u16(mask));
  uint8_t *ip = n == 16 ? (uint8_t *)&addr->sin6.sin6_addr
                        : (uint8_t *)&addr->sin.sin_addr;
  for (size_t i = 0; i < n; ++i)
    ip[i] = (uint8_t)value[4 + i] ^ mask[i];
}

static int string_attr(char *dest, size_t capacity, const uint8_t *value,
                       size_t length) {
  if (!length || length >= capacity || memchr(value, 0, length) || dest[0])
    return -1;
  memcpy(dest, value, length);
  dest[length] = 0;
  return 0;
}

int stun_parse_msg_buf(StunMessage *msg) {
  if (stun_probe(msg->buf, msg->size))
    return -1;
  /* Parsing is repeatable; never preserve fields from a previous datagram. */
  memset(msg, 0, offsetof(StunMessage, buf));
  msg->integrity_offset = msg->fingerprint_offset = 0;
  msg->use_candidate = msg->controlling = msg->controlled = msg->error = 0;
  msg->priority = 0;
  uint16_t type = wire_u16(msg->buf);
  msg->stunclass = (StunClass)(type & 0x0110);
  msg->stunmethod = (StunMethod)(type & 0x3eef);
  unsigned address_attrs = 0;
  int priority_seen = 0;
  for (size_t pos = 20; pos < msg->size;) {
    if (msg->size - pos < 4)
      return -1;
    uint16_t attr = wire_u16(msg->buf + pos), n = wire_u16(msg->buf + pos + 2);
    size_t padded = ((size_t)n + 3) & ~(size_t)3;
    if (padded > msg->size - pos - 4)
      return -1;
    const uint8_t *v = msg->buf + pos + 4;
    /* Only a final FINGERPRINT may follow MESSAGE-INTEGRITY. */
    if (msg->fingerprint_offset ||
        (msg->integrity_offset && attr != STUN_ATTR_TYPE_FINGERPRINT))
      return -1;
    switch (attr) {
    case STUN_ATTR_TYPE_USERNAME:
      if (string_attr(msg->username, sizeof(msg->username), v, n))
        return -1;
      break;
    case STUN_ATTR_TYPE_REALM:
      if (string_attr(msg->realm, sizeof(msg->realm), v, n))
        return -1;
      break;
    case STUN_ATTR_TYPE_NONCE:
      if (string_attr(msg->nonce, sizeof(msg->nonce), v, n))
        return -1;
      break;
    case STUN_ATTR_TYPE_MESSAGE_INTEGRITY:
      if (n != 20 || msg->integrity_offset)
        return -1;
      msg->integrity_offset = pos;
      memcpy(msg->message_integrity, v, 20);
      break;
    case STUN_ATTR_TYPE_FINGERPRINT:
      if (n != 4 || pos + 8 != msg->size)
        return -1;
      msg->fingerprint_offset = pos;
      memcpy(&msg->fingerprint, v, 4);
      break;
    case STUN_ATTR_TYPE_MAPPED_ADDRESS:
    case STUN_ATTR_TYPE_XOR_MAPPED_ADDRESS:
    case STUN_ATTR_TYPE_XOR_RELAYED_ADDRESS: {
      unsigned bit = attr == STUN_ATTR_TYPE_MAPPED_ADDRESS       ? 1u
                     : attr == STUN_ATTR_TYPE_XOR_MAPPED_ADDRESS ? 2u
                                                                 : 4u;
      if (address_attrs & bit)
        return -1;
      address_attrs |= bit;
      if (n < 4 || v[0] || !((v[1] == 1 && n == 8) || (v[1] == 2 && n == 20)))
        return -1;
      uint8_t mask[16] = {0};
      if (attr != STUN_ATTR_TYPE_MAPPED_ADDRESS)
        memcpy(mask, msg->buf + 4, 16);
      /* Prefer XOR-MAPPED-ADDRESS regardless of attribute order. */
      if (attr != STUN_ATTR_TYPE_MAPPED_ADDRESS || !msg->xor_mapped)
        stun_get_mapped_address((char *)v, mask,
                                attr == STUN_ATTR_TYPE_XOR_RELAYED_ADDRESS
                                    ? &msg->relayed_addr
                                    : &msg->mapped_addr);
      if (attr == STUN_ATTR_TYPE_XOR_MAPPED_ADDRESS)
        msg->xor_mapped = 1;
      break;
    }
    case STUN_ATTR_TYPE_USE_CANDIDATE:
      if (n || msg->use_candidate)
        return -1;
      msg->use_candidate = 1;
      break;
    case STUN_ATTR_TYPE_PRIORITY:
      if (n != 4 || priority_seen++)
        return -1;
      msg->priority = wire_u32(v);
      break;
    case STUN_ATTR_TYPE_ICE_CONTROLLING:
    case STUN_ATTR_TYPE_ICE_CONTROLLED:
      if (n != 8 || msg->controlling || msg->controlled)
        return -1;
      msg->controlling = attr == STUN_ATTR_TYPE_ICE_CONTROLLING;
      msg->controlled = attr == STUN_ATTR_TYPE_ICE_CONTROLLED;
      break;
    case STUN_ATTR_TYPE_LIFETIME:
    case STUN_ATTR_TYPE_REQUESTED_TRANSPORT:
      if (n != 4)
        return -1;
      break;
    case 0x0009: /* ERROR-CODE */
      if (n < 4 || msg->error_code || v[0] || v[1] || v[2] < 3 || v[2] > 6 ||
          v[3] > 99)
        return -1;
      msg->error_code = 100u * v[2] + v[3];
      break;
    default:
      if (!(attr & 0x8000))
        return -1; /* Unknown comprehension-required attribute. */
      break;
    }
    pos += 4 + padded;
  }
  return 0;
}

int stun_msg_parse(StunMessage *msg, const uint8_t *buf, size_t len) {
  if (!msg || !buf || len > sizeof(msg->buf))
    return -1;
  memset(msg, 0, sizeof(*msg));
  memcpy(msg->buf, buf, len);
  msg->size = len;
  return stun_parse_msg_buf(msg);
}

int stun_msg_write_attr(StunMessage *msg, StunAttrType type, uint16_t length,
                        char *value) {
  size_t padded = ((size_t)length + 3) & ~(size_t)3;
  if (!msg || msg->error || msg->size < 20 || msg->size > sizeof(msg->buf) ||
      (length && !value) || padded + 4 > sizeof(msg->buf) - msg->size) {
    if (msg)
      msg->error = 1;
    return -1;
  }
  uint8_t *out = msg->buf + msg->size;
  wire_put16(out, (uint16_t)type);
  wire_put16(out + 2, length);
  memset(out + 4, 0, padded);
  if (length)
    memcpy(out + 4, value, length);
  msg->size += 4 + padded;
  wire_put16(msg->buf + 2, (uint16_t)(msg->size - 20));
  return 0;
}

int stun_msg_finish(StunMessage *msg, StunCredential credential,
                    const char *password, size_t password_len) {
  if (!msg || msg->error || credential != STUN_CREDENTIAL_SHORT_TERM ||
      !password || !password_len || msg->size < 20 ||
      msg->size > sizeof(msg->buf) - 32)
    return -1;
  uint8_t hash[20];
  wire_put16(msg->buf + 2, (uint16_t)(msg->size + 24 - 20));
  if (utils_get_hmac_sha1((char *)msg->buf, msg->size, password, password_len,
                          hash))
    return -1;
  if (stun_msg_write_attr(msg, STUN_ATTR_TYPE_MESSAGE_INTEGRITY, 20,
                          (char *)hash))
    return -1;
  uint32_t fp;
  wire_put16(msg->buf + 2, (uint16_t)(msg->size + 8 - 20));
  stun_calculate_fingerprint((char *)msg->buf, msg->size, &fp);
  return stun_msg_write_attr(msg, STUN_ATTR_TYPE_FINGERPRINT, 4, (char *)&fp);
}

int stun_msg_check_fingerprint(const StunMessage *msg) {
  if (!msg->fingerprint_offset)
    return 0;
  uint32_t fingerprint;
  stun_calculate_fingerprint((char *)msg->buf, msg->fingerprint_offset,
                             &fingerprint);
  return fingerprint == msg->fingerprint ? 0 : -1;
}

int stun_msg_is_valid(uint8_t *buf, size_t size, char *password) {
  StunMessage msg;
  if (!password || stun_msg_parse(&msg, buf, size) || !msg.integrity_offset)
    return -1;
  if (stun_msg_check_fingerprint(&msg))
    return -1;
  uint8_t hmac[20];
  wire_put16(msg.buf + 2, (uint16_t)(msg.integrity_offset + 24 - 20));
  if (utils_get_hmac_sha1((char *)msg.buf, msg.integrity_offset, password,
                          strlen(password), hmac))
    return -1;
  return wire_equal(hmac, msg.message_integrity, 20) ? 0 : -1;
}
