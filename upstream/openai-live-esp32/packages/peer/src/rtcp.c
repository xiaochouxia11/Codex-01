#include "rtcp.h"
#include "wire.h"
int rtcp_probe(uint8_t *p, size_t n) {
  return p && n >= 4 && (p[0] >> 6) == 2 && p[1] >= 192 && p[1] <= 223;
}
int rtcp_validate(const uint8_t *p, size_t n) {
  if (!p || n < 4)
    return -1;
  for (size_t pos = 0; pos < n;) {
    if (n - pos < 4 || (p[pos] >> 6) != 2 || p[pos + 1] < 192 ||
        p[pos + 1] > 223)
      return -1;
    size_t size = 4 * ((size_t)wire_u16(p + pos + 2) + 1), used = size;
    if (size > n - pos)
      return -1;
    if (p[pos] & 32) {
      if (pos + size != n || !p[n - 1] || (p[n - 1] & 3) || p[n - 1] > size - 4)
        return -1;
      used -= p[n - 1];
    }
    size_t count = p[pos] & 31;
    switch (p[pos + 1]) {
    case 200:
      if (used < 28 + 24 * count)
        return -1;
      break;
    case 201:
      if (used < 8 + 24 * count)
        return -1;
      break;
    case 203:
      if (used < 4 + 4 * count)
        return -1;
      break;
    case 204:
    case 205:
    case 206:
      if (used < 12)
        return -1;
      break;
    case 207:
      if (used < 8)
        return -1;
      break;
    default:
      break; /* Unimplemented report types have no side effects. */
    }
    pos += size;
  }
  return 0;
}
