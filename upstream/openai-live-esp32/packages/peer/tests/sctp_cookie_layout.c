/* Keep upstream-private layout in its own TU: public usrsctp.h and private
 * headers define overlapping types. Build with the dependency's definitions. */
#include <netinet/sctp_os.h>

#include <netinet/sctp_header.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>
int peer_test_cookie_addresses_zero(const uint8_t *p, size_t n) {
  struct sctp_state_cookie cookie;
  if (n < sizeof(cookie))
    return 0;
  memcpy(&cookie, p, sizeof(cookie));
  if (cookie.addr_type != SCTP_CONN_ADDRESS ||
      cookie.laddr_type != SCTP_CONN_ADDRESS)
    return 0;
  uint8_t zero[sizeof(cookie.address)] = {0};
  return !memcmp(cookie.address, zero, sizeof(zero)) &&
         !memcmp(cookie.laddress, zero, sizeof(zero));
}
