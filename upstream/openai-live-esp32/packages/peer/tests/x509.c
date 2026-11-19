/* CI's DTLS fuzzer reached comparison of empty X.509 Names. Exercise that
 * boundary deterministically through verification of an initialized empty
 * certificate chain, with no trust anchors. This must fail without UB. */
#include "dtls_srtp.h"
#include "x509_serial.h"
#include <mbedtls/x509_crt.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#define CHECK(x)                                                               \
  do {                                                                         \
    if (!(x)) {                                                                \
      fprintf(stderr, "%s:%d: %s\n", __FILE__, __LINE__, #x);                  \
      abort();                                                                 \
    }                                                                          \
  } while (0)

static void serial_encoding(void) {
  DtlsSrtp d;
  CHECK(!dtls_srtp_init(&d, DTLS_SRTP_ROLE_CLIENT, NULL));
  mbedtls_x509write_cert writer;
  mbedtls_x509write_crt_init(&writer);
  mbedtls_x509write_crt_set_subject_key(&writer, &d.pkey);
  mbedtls_x509write_crt_set_issuer_key(&writer, &d.pkey);
  mbedtls_x509write_crt_set_md_alg(&writer, MBEDTLS_MD_SHA256);
  CHECK(!mbedtls_x509write_crt_set_subject_name(&writer, "CN=serial-test"));
  CHECK(!mbedtls_x509write_crt_set_issuer_name(&writer, "CN=serial-test"));
  CHECK(!mbedtls_x509write_crt_set_validity(&writer, "20200101000000",
                                            "20500101000000"));
  unsigned char raw[16], der[2048];
  /* Every leading-zero length, both sign-bit cases, and the all-zero value.
   * Inspect the actual signed DER, not just the helper's input buffer. */
  for (size_t zeros = 0; zeros <= sizeof(raw); ++zeros) {
    for (unsigned high = 0; high < 2; ++high) {
      memset(raw, 0, sizeof(raw));
      if (zeros < sizeof(raw)) {
        memset(raw + zeros, 0x35, sizeof(raw) - zeros);
        raw[zeros] = high ? 0x80 : 0x01;
      }
      unsigned char original[sizeof(raw)];
      memcpy(original, raw, sizeof(raw));
      CHECK(!peer_x509write_serial(&writer, raw, sizeof(raw)));
      CHECK(!memcmp(original, raw, sizeof(raw)));
#if MBEDTLS_VERSION_MAJOR >= 4
      int n = mbedtls_x509write_crt_der(&writer, der, sizeof(der));
#else
      int n = mbedtls_x509write_crt_der(&writer, der, sizeof(der),
                                        mbedtls_ctr_drbg_random, &d.ctr_drbg);
#endif
      CHECK(n > 0);
      mbedtls_x509_crt parsed;
      mbedtls_x509_crt_init(&parsed);
      CHECK(!mbedtls_x509_crt_parse_der(&parsed, der + sizeof(der) - n, n));
      if (zeros == sizeof(raw)) {
        CHECK(parsed.serial.len == 1 && parsed.serial.p[0] == 1);
      } else {
        CHECK(parsed.serial.len == sizeof(raw) - zeros + high);
        CHECK(!high || parsed.serial.p[0] == 0);
        CHECK(
            !memcmp(parsed.serial.p + high, raw + zeros, sizeof(raw) - zeros));
      }
      /* A leading zero is legal only as the positive-sign octet. */
      CHECK(!(parsed.serial.p[0] & 0x80));
      CHECK(parsed.serial.p[0] ||
            (parsed.serial.len > 1 && (parsed.serial.p[1] & 0x80)));
      mbedtls_x509_crt_free(&parsed);
    }
  }
  CHECK(peer_x509write_serial(&writer, NULL, 1) != 0);
  CHECK(peer_x509write_serial(&writer, raw, 0) != 0);
  CHECK(peer_x509write_serial(&writer, raw,
                              MBEDTLS_X509_RFC5280_MAX_SERIAL_LEN + 1) != 0);
  mbedtls_x509write_crt_free(&writer);
  dtls_srtp_deinit(&d);
}

int main(void) {
  serial_encoding();
  mbedtls_x509_crt crt;
  mbedtls_x509_crt_init(&crt);
  uint32_t flags = 0;
  int result =
      mbedtls_x509_crt_verify(&crt, NULL, NULL, NULL, &flags, NULL, NULL);
  mbedtls_x509_crt_free(&crt);
  if (!result || !(flags & MBEDTLS_X509_BADCERT_NOT_TRUSTED))
    return 1;
  puts("X.509 serial encoding and empty-name regressions passed");
  return 0;
}
