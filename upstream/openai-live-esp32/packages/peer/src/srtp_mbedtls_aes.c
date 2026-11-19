/* The upstream adapter defines all AES-CM widths, but cipher_types.h only
 * declares AES-192 when GCM is enabled. Supply the forward declaration without
 * enabling/registering any new SRTP profiles. All crypto code stays upstream.
 */
#include "cipher.h"
extern const srtp_cipher_type_t srtp_aes_icm_192;
#include "crypto/cipher/aes_icm_mbedtls.c"
