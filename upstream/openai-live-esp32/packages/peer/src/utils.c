#include "utils.h"
#include <mbedtls/version.h>
#if MBEDTLS_VERSION_MAJOR >= 4
#include <psa/crypto.h>
#else
#include <mbedtls/entropy.h>
#endif
#include <mbedtls/md.h>
#include <mbedtls/platform_util.h>
#include <string.h>

int utils_random_bytes(void *out, size_t size) {
#if MBEDTLS_VERSION_MAJOR >= 4
  int ret = psa_crypto_init();
  if (ret == PSA_SUCCESS)
    ret = psa_generate_random(out, size);
#else
  mbedtls_entropy_context entropy;
  mbedtls_entropy_init(&entropy);
  size_t offset = 0;
  int ret = 0;
  while (offset < size) {
    size_t n = size - offset;
    if (n > MBEDTLS_ENTROPY_BLOCK_SIZE)
      n = MBEDTLS_ENTROPY_BLOCK_SIZE;
    ret = mbedtls_entropy_func(&entropy, (uint8_t *)out + offset, n);
    if (ret)
      break;
    offset += n;
  }
  mbedtls_entropy_free(&entropy);
#endif
  if (ret)
    mbedtls_platform_zeroize(out, size);
  return ret;
}

int utils_random_string(char *s, int len) {
  static const char alphabet[] =
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/";
  if (!s || len < 0 || len > 256)
    return -1;
  uint8_t random[256];
  if (utils_random_bytes(random, (size_t)len)) {
    s[0] = 0;
    return -1;
  }
  for (int i = 0; i < len; ++i)
    s[i] = alphabet[random[i] & 63];
  s[len] = 0;
  mbedtls_platform_zeroize(random, sizeof(random));
  return 0;
}

int utils_get_hmac_sha1(const char *input, size_t input_len, const char *key,
                        size_t key_len, unsigned char *output) {
#if MBEDTLS_VERSION_MAJOR >= 4
  if (!key || !key_len || !output || (!input && input_len))
    return -1;
  psa_status_t ret = psa_crypto_init();
  psa_key_attributes_t attributes = PSA_KEY_ATTRIBUTES_INIT;
  mbedtls_svc_key_id_t handle = MBEDTLS_SVC_KEY_ID_INIT;
  psa_set_key_type(&attributes, PSA_KEY_TYPE_HMAC);
  psa_set_key_usage_flags(&attributes, PSA_KEY_USAGE_SIGN_MESSAGE);
  psa_set_key_algorithm(&attributes, PSA_ALG_HMAC(PSA_ALG_SHA_1));
  if (ret == PSA_SUCCESS)
    ret = psa_import_key(&attributes, (const uint8_t *)key, key_len, &handle);
  psa_reset_key_attributes(&attributes);
  size_t length = 0;
  if (ret == PSA_SUCCESS)
    ret =
        psa_mac_compute(handle, PSA_ALG_HMAC(PSA_ALG_SHA_1),
                        (const uint8_t *)input, input_len, output, 20, &length);
  psa_destroy_key(handle);
  if (ret != PSA_SUCCESS || length != 20) {
    mbedtls_platform_zeroize(output, 20);
    return -1;
  }
  return 0;
#else
  const mbedtls_md_info_t *md = mbedtls_md_info_from_type(MBEDTLS_MD_SHA1);
  if (!md || !key || !key_len)
    return -1;
  return mbedtls_md_hmac(md, (const uint8_t *)key, key_len,
                         (const uint8_t *)input, input_len, output);
#endif
}
