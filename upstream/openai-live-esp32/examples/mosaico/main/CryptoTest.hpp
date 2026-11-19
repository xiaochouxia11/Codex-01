#pragma once
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "psa/crypto.h"
#include <cstdlib>

// A local diagnostic of the native PSA/hardware-AES path used by DTLS.
// Synthetic data only; no network or microphone. Each case has a unique nonce.
inline esp_err_t native_crypto_test() {
  constexpr size_t capacity = 16384 + 64;
  auto *plain =
      static_cast<uint8_t *>(heap_caps_malloc(capacity, MALLOC_CAP_SPIRAM));
  auto *encrypted =
      static_cast<uint8_t *>(heap_caps_malloc(capacity, MALLOC_CAP_SPIRAM));
  const uint8_t test_key[16]{};
  mbedtls_svc_key_id_t key = MBEDTLS_SVC_KEY_ID_INIT;
  psa_key_attributes_t attributes = PSA_KEY_ATTRIBUTES_INIT;
  psa_set_key_type(&attributes, PSA_KEY_TYPE_AES);
  psa_set_key_bits(&attributes, 128);
  psa_set_key_usage_flags(&attributes,
                          PSA_KEY_USAGE_ENCRYPT | PSA_KEY_USAGE_DECRYPT);
  psa_set_key_algorithm(&attributes, PSA_ALG_GCM);
  psa_status_t status = psa_crypto_init();
  if (status == PSA_SUCCESS)
    status = psa_import_key(&attributes, test_key, sizeof(test_key), &key);
  psa_reset_key_attributes(&attributes);
  const size_t sizes[]{0,    1,    15,   16,   17,   31,   32,   33,
                       127,  128,  129,  511,  512,  513,  1199, 1200,
                       1201, 1500, 4095, 4096, 4097, 8192, 16384};
  const size_t offsets[]{0, 1, 3, 15, 31};
  unsigned cases = 0;
  for (const auto offset : offsets) {
    for (const auto size : sizes) {
      if (!plain || !encrypted || status != PSA_SUCCESS)
        break;
      for (size_t i = 0; i < size; ++i)
        plain[offset + i] = uint8_t(i * 73 + 19);
      uint8_t nonce[12]{};
      nonce[0] = uint8_t(++cases);
      const uint8_t aad[13]{};
      size_t encoded = 0, decoded = 0;
      status =
          psa_aead_encrypt(key, PSA_ALG_GCM, nonce, sizeof(nonce), aad,
                           sizeof(aad), plain + offset, size,
                           encrypted + offset, capacity - offset, &encoded);
      if (status == PSA_SUCCESS)
        status = psa_aead_decrypt(key, PSA_ALG_GCM, nonce, sizeof(nonce), aad,
                                  sizeof(aad), encrypted + offset, encoded,
                                  plain + offset, capacity - offset, &decoded);
      if (status == PSA_SUCCESS && decoded != size)
        status = PSA_ERROR_CORRUPTION_DETECTED;
      for (size_t i = 0; status == PSA_SUCCESS && i < size; ++i)
        if (plain[offset + i] != uint8_t(i * 73 + 19))
          status = PSA_ERROR_CORRUPTION_DETECTED;
      if (status == PSA_SUCCESS && encoded) {
        encrypted[offset + encoded - 1] ^= 1;
        const auto rejected =
            psa_aead_decrypt(key, PSA_ALG_GCM, nonce, sizeof(nonce), aad,
                             sizeof(aad), encrypted + offset, encoded,
                             plain + offset, capacity - offset, &decoded);
        if (rejected != PSA_ERROR_INVALID_SIGNATURE)
          status = PSA_ERROR_CORRUPTION_DETECTED;
      }
      if (status != PSA_SUCCESS)
        ESP_LOGE("MosaicoCrypto", "GCM size=%u offset=%u status=%ld",
                 unsigned(size), unsigned(offset), (long)status);
    }
  }
  const bool ok = plain && encrypted && status == PSA_SUCCESS && cases == 115;
  psa_destroy_key(key);
  free(plain);
  free(encrypted);
  ESP_LOGI("MosaicoCrypto",
           "Native GCM boundary/alignment/tamper tests: %s (%u cases)",
           ok ? "PASS" : "FAIL", cases);
  return ok ? ESP_OK : ESP_FAIL;
}
