#ifndef LIVE_PEER_X509_SERIAL_H
#define LIVE_PEER_X509_SERIAL_H
#include <mbedtls/x509_crt.h>
#include <stddef.h>

/* The raw writer adds a sign octet when necessary but does not remove
 * redundant leading zeroes. Supply a minimal, nonzero unsigned magnitude;
 * otherwise a random zero prefix can produce DER rejected by OpenSSL. */
static inline int peer_x509write_serial(mbedtls_x509write_cert *cert,
                                        unsigned char *serial, size_t size) {
  if (!serial || !size || size > MBEDTLS_X509_RFC5280_MAX_SERIAL_LEN)
    return MBEDTLS_ERR_X509_BAD_INPUT_DATA;
  while (size > 1 && !*serial) {
    ++serial;
    --size;
  }
  /* RFC 5280 serials must be positive, including the all-zero RNG edge case.
   * The writer copies the bytes, so the temporary value need not outlive us. */
  unsigned char one = 1;
  if (size == 1 && !*serial)
    serial = &one;
  return mbedtls_x509write_crt_set_serial_raw(cert, serial, size);
}
#endif
