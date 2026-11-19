#ifndef LIVE_PEER_WIRE_H
#define LIVE_PEER_WIRE_H
#include <mbedtls/constant_time.h>
#include <stddef.h>
#include <stdint.h>
static inline uint16_t wire_u16(const void *p) {
  const uint8_t *b = p;
  return (uint16_t)((uint16_t)b[0] << 8 | b[1]);
}
static inline uint32_t wire_u32(const void *p) {
  const uint8_t *b = p;
  return (uint32_t)b[0] << 24 | (uint32_t)b[1] << 16 | (uint32_t)b[2] << 8 |
         b[3];
}
static inline void wire_put16(void *p, uint16_t v) {
  uint8_t *b = p;
  b[0] = (uint8_t)(v >> 8);
  b[1] = (uint8_t)v;
}
static inline void wire_put32(void *p, uint32_t v) {
  uint8_t *b = p;
  b[0] = (uint8_t)(v >> 24);
  b[1] = (uint8_t)(v >> 16);
  b[2] = (uint8_t)(v >> 8);
  b[3] = (uint8_t)v;
}
static inline int wire_equal(const void *a, const void *b, size_t n) {
  return mbedtls_ct_memcmp(a, b, n) == 0;
}
static inline int wire_utf8(const uint8_t *s, size_t n) {
  for (size_t i = 0; i < n;) {
    uint32_t cp = s[i++], minimum;
    unsigned more;
    if (cp < 128)
      continue;
    if (cp >= 0xc2 && cp <= 0xdf) {
      more = 1;
      minimum = 0x80;
      cp &= 31;
    } else if (cp >= 0xe0 && cp <= 0xef) {
      more = 2;
      minimum = 0x800;
      cp &= 15;
    } else if (cp >= 0xf0 && cp <= 0xf4) {
      more = 3;
      minimum = 0x10000;
      cp &= 7;
    } else
      return 0;
    if (more > n - i)
      return 0;
    while (more--) {
      if ((s[i] & 0xc0) != 0x80)
        return 0;
      cp = (cp << 6) | (s[i++] & 63);
    }
    if (cp < minimum || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff))
      return 0;
  }
  return 1;
}
#endif
