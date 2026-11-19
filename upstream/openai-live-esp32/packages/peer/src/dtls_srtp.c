/* Derived from libpeer's DTLS integration; crypto primitives remain in Mbed
 * TLS/libSRTP. */
#include "dtls_srtp.h"
#include "ports.h"
#include "utils.h"
#include "wire.h"
#include "x509_serial.h"
#include <mbedtls/md.h>
#include <mbedtls/platform_util.h>
#include <mbedtls/version.h>
#include <mbedtls/x509_csr.h>
#include <string.h>

#if !defined(MBEDTLS_SSL_KEEP_PEER_CERTIFICATE)
#error                                                                         \
    "WebRTC fingerprint verification requires MBEDTLS_SSL_KEEP_PEER_CERTIFICATE"
#endif
#if MBEDTLS_VERSION_NUMBER < 0x03060800 ||                                     \
    (MBEDTLS_VERSION_NUMBER >= 0x04000000 &&                                   \
     MBEDTLS_VERSION_NUMBER < 0x04010200) ||                                   \
    MBEDTLS_VERSION_NUMBER >= 0x04020000
#error "This backend requires Mbed TLS 3.6.8+ (3.x) or 4.1.2+ (4.1.x)."
#endif

static const int ciphersuites[] = {
    MBEDTLS_TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256, 0};
static void set_delay(void *ctx, uint32_t intermediate, uint32_t final) {
  DtlsSrtp *d = ctx;
  d->timer.start = ports_get_epoch_time();
  d->timer.intermediate = intermediate;
  d->timer.final = final;
}
static int get_delay(void *ctx) {
  DtlsSrtp *d = ctx;
  if (!d->timer.final)
    return -1;
  uint32_t elapsed = ports_get_epoch_time() - d->timer.start;
  return elapsed >= d->timer.final          ? 2
         : elapsed >= d->timer.intermediate ? 1
                                            : 0;
}
static const mbedtls_ssl_srtp_profile profiles[] = {
    MBEDTLS_TLS_SRTP_AES128_CM_HMAC_SHA1_80, MBEDTLS_TLS_SRTP_UNSET};
static int digest(const mbedtls_x509_crt *cert, char out[96]) {
  uint8_t hash[32];
  const mbedtls_md_info_t *md = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  if (!md || !cert || !cert->raw.p ||
      mbedtls_md(md, cert->raw.p, cert->raw.len, hash))
    return -1;
  for (size_t i = 0; i < 32; ++i)
    snprintf(out + 3 * i, 4, "%02X%s", hash[i], i == 31 ? "" : ":");
  out[95] = 0;
  return 0;
}
static int certificate(DtlsSrtp *d) {
  int ret = -1;
  mbedtls_x509write_cert cert;
  mbedtls_x509write_crt_init(&cert);
  uint8_t random[16], der[2048];
#if MBEDTLS_VERSION_MAJOR >= 4
  psa_key_attributes_t attributes = PSA_KEY_ATTRIBUTES_INIT;
  psa_set_key_type(&attributes,
                   PSA_KEY_TYPE_ECC_KEY_PAIR(PSA_ECC_FAMILY_SECP_R1));
  psa_set_key_bits(&attributes, 256);
  psa_set_key_usage_flags(&attributes, PSA_KEY_USAGE_SIGN_HASH);
  /* Match the library's deterministic/randomized ECDSA policy and let TLS
     negotiate its signature hash. The certificate itself uses SHA-256. */
  psa_set_key_algorithm(&attributes, MBEDTLS_PK_ALG_ECDSA(PSA_ALG_ANY_HASH));
  psa_status_t key_result = psa_generate_key(&attributes, &d->signing_key);
  psa_reset_key_attributes(&attributes);
  if (key_result != PSA_SUCCESS ||
      psa_generate_random(random, sizeof(random)) != PSA_SUCCESS ||
      mbedtls_pk_wrap_psa(&d->pkey, d->signing_key))
    goto done;
#else
  if (mbedtls_ctr_drbg_random(&d->ctr_drbg, random, sizeof(random)) ||
      mbedtls_pk_setup(&d->pkey, mbedtls_pk_info_from_type(MBEDTLS_PK_ECKEY)) ||
      mbedtls_ecp_gen_key(MBEDTLS_ECP_DP_SECP256R1, mbedtls_pk_ec(d->pkey),
                          mbedtls_ctr_drbg_random, &d->ctr_drbg))
    goto done;
#endif
  mbedtls_x509write_crt_set_subject_key(&cert, &d->pkey);
  mbedtls_x509write_crt_set_issuer_key(&cert, &d->pkey);
  mbedtls_x509write_crt_set_version(&cert, MBEDTLS_X509_CRT_VERSION_3);
  mbedtls_x509write_crt_set_md_alg(&cert, MBEDTLS_MD_SHA256);
  if (mbedtls_x509write_crt_set_subject_name(&cert, "CN=peer") ||
      mbedtls_x509write_crt_set_issuer_name(&cert, "CN=peer") ||
      peer_x509write_serial(&cert, random, sizeof(random)) ||
      mbedtls_x509write_crt_set_validity(&cert, "20200101000000",
                                         "20500101000000") ||
      mbedtls_x509write_crt_set_basic_constraints(&cert, 0, -1) ||
      mbedtls_x509write_crt_set_key_usage(&cert,
                                          MBEDTLS_X509_KU_DIGITAL_SIGNATURE))
    goto done;
#if MBEDTLS_VERSION_MAJOR >= 4
  int n = mbedtls_x509write_crt_der(&cert, der, sizeof(der));
#else
  int n = mbedtls_x509write_crt_der(&cert, der, sizeof(der),
                                    mbedtls_ctr_drbg_random, &d->ctr_drbg);
#endif
  if (n <= 0 || mbedtls_x509_crt_parse_der(
                    &d->cert, der + sizeof(der) - (size_t)n, (size_t)n))
    goto done;
  ret = digest(&d->cert, d->local_fingerprint);
done:
  mbedtls_platform_zeroize(random, sizeof(random));
  mbedtls_x509write_crt_free(&cert);
  return ret;
}
static void export_keys(void *ctx, mbedtls_ssl_key_export_type type,
                        const unsigned char *secret, size_t size,
                        const unsigned char client[32],
                        const unsigned char server[32],
                        mbedtls_tls_prf_types prf) {
  DtlsSrtp *d = ctx;
  d->have_exported = 0;
  if (type != MBEDTLS_SSL_KEY_EXPORT_TLS12_MASTER_SECRET || size != 48)
    return;
  uint8_t random[64];
  memcpy(random, client, 32);
  memcpy(random + 32, server, 32);
  d->have_exported = mbedtls_ssl_tls_prf(
                         prf, secret, size, "EXTRACTOR-dtls_srtp", random,
                         sizeof(random), d->exported, sizeof(d->exported)) == 0;
}
int dtls_srtp_set_role(DtlsSrtp *d, DtlsSrtpRole role) {
  if (!d || !d->initialized || d->state != DTLS_SRTP_STATE_INIT)
    return -1;
  mbedtls_ssl_free(&d->ssl);
  mbedtls_ssl_config_free(&d->conf);
  mbedtls_ssl_init(&d->ssl);
  mbedtls_ssl_config_init(&d->conf);
  d->role = role;
  if (mbedtls_ssl_config_defaults(
          &d->conf,
          role == DTLS_SRTP_ROLE_SERVER ? MBEDTLS_SSL_IS_SERVER
                                        : MBEDTLS_SSL_IS_CLIENT,
          MBEDTLS_SSL_TRANSPORT_DATAGRAM, MBEDTLS_SSL_PRESET_DEFAULT))
    return -1;
  mbedtls_ssl_conf_min_tls_version(&d->conf, MBEDTLS_SSL_VERSION_TLS1_2);
  mbedtls_ssl_conf_max_tls_version(&d->conf, MBEDTLS_SSL_VERSION_TLS1_2);
  mbedtls_ssl_conf_ciphersuites(&d->conf, ciphersuites);
#if MBEDTLS_VERSION_MAJOR < 4
  mbedtls_ssl_conf_rng(&d->conf, mbedtls_ctr_drbg_random, &d->ctr_drbg);
#endif
  /* WebRTC identity is the certificate fingerprint from authenticated
     signaling. Request the self-signed certificate; it MUST match before
     enabling media. */
  mbedtls_ssl_conf_authmode(&d->conf, MBEDTLS_SSL_VERIFY_OPTIONAL);
  mbedtls_ssl_conf_dtls_anti_replay(&d->conf, MBEDTLS_SSL_ANTI_REPLAY_ENABLED);
  mbedtls_ssl_conf_renegotiation(&d->conf, MBEDTLS_SSL_RENEGOTIATION_DISABLED);
  mbedtls_ssl_conf_handshake_timeout(&d->conf, 250, 2000);
  if (role == DTLS_SRTP_ROLE_SERVER)
    mbedtls_ssl_conf_dtls_cookies(&d->conf, mbedtls_ssl_cookie_write,
                                  mbedtls_ssl_cookie_check, &d->cookie_ctx);
  if (mbedtls_ssl_conf_own_cert(&d->conf, &d->cert, &d->pkey) ||
      mbedtls_ssl_conf_dtls_srtp_protection_profiles(&d->conf, profiles) ||
      mbedtls_ssl_setup(&d->ssl, &d->conf))
    return -1;
  mbedtls_ssl_conf_cert_req_ca_list(&d->conf,
                                    MBEDTLS_SSL_CERT_REQ_CA_LIST_DISABLED);
  mbedtls_ssl_set_mtu(&d->ssl, 1200);
  return 0;
}
int dtls_srtp_init(DtlsSrtp *d, DtlsSrtpRole role, void *ctx) {
  memset(d, 0, sizeof(*d));
  d->initialized = 1;
  d->user_data = ctx;
  mbedtls_ssl_init(&d->ssl);
  mbedtls_ssl_config_init(&d->conf);
  mbedtls_ssl_cookie_init(&d->cookie_ctx);
  mbedtls_x509_crt_init(&d->cert);
  mbedtls_pk_init(&d->pkey);
#if MBEDTLS_VERSION_MAJOR >= 4
  if (psa_crypto_init() != PSA_SUCCESS ||
      mbedtls_ssl_cookie_setup(&d->cookie_ctx) ||
#else
  mbedtls_entropy_init(&d->entropy);
  mbedtls_ctr_drbg_init(&d->ctr_drbg);
  static const uint8_t personal[] = "live-peer-dtls";
  if (mbedtls_ctr_drbg_seed(&d->ctr_drbg, mbedtls_entropy_func, &d->entropy,
                            personal, sizeof(personal)) ||
      mbedtls_ssl_cookie_setup(&d->cookie_ctx, mbedtls_ctr_drbg_random,
                               &d->ctr_drbg) ||
#endif
      certificate(d) || dtls_srtp_set_role(d, role)) {
    dtls_srtp_deinit(d);
    return -1;
  }
  return 0;
}
void dtls_srtp_deinit(DtlsSrtp *d) {
  if (!d || !d->initialized)
    return;
  if (d->srtp_in)
    srtp_dealloc(d->srtp_in);
  if (d->srtp_out)
    srtp_dealloc(d->srtp_out);
  mbedtls_ssl_free(&d->ssl);
  mbedtls_ssl_config_free(&d->conf);
  mbedtls_ssl_cookie_free(&d->cookie_ctx);
  mbedtls_x509_crt_free(&d->cert);
  mbedtls_pk_free(&d->pkey);
#if MBEDTLS_VERSION_MAJOR >= 4
  psa_destroy_key(d->signing_key);
#else
  mbedtls_ctr_drbg_free(&d->ctr_drbg);
  mbedtls_entropy_free(&d->entropy);
#endif
  mbedtls_platform_zeroize(d, sizeof(*d));
}
static int derive_srtp(DtlsSrtp *d) {
  if (!d->have_exported)
    return -1;
  uint8_t keys[2][30];
  for (size_t i = 0; i < 2; ++i) {
    memcpy(keys[i], d->exported + 16 * i, 16);
    memcpy(keys[i] + 16, d->exported + 32 + 14 * i, 14);
  }
  srtp_policy_t policy = {0};
  srtp_crypto_policy_set_rtp_default(&policy.rtp);
  srtp_crypto_policy_set_rtcp_default(&policy.rtcp);
  policy.window_size = 128;
  policy.allow_repeat_tx = 0;
  policy.ssrc.type = ssrc_any_inbound;
  policy.key = keys[d->role == DTLS_SRTP_ROLE_SERVER ? 0 : 1];
  int ret = (int)srtp_create(&d->srtp_in, &policy);
  if (!ret) {
    policy.ssrc.type = ssrc_any_outbound;
    policy.key = keys[d->role == DTLS_SRTP_ROLE_SERVER ? 1 : 0];
    ret = (int)srtp_create(&d->srtp_out, &policy);
  }
  mbedtls_platform_zeroize(keys, sizeof(keys));
  mbedtls_platform_zeroize(d->exported, sizeof(d->exported));
  d->have_exported = 0;
  return ret;
}
int dtls_srtp_handshake(DtlsSrtp *d, Address *address, const char *expected) {
  if (!d || !d->initialized || !address || !expected ||
      strlen(expected) != 95 || !d->udp_send || !d->udp_recv ||
      d->state == DTLS_SRTP_STATE_FAILED)
    return -1;
  if (d->state == DTLS_SRTP_STATE_CONNECTED)
    return 0;
  if (d->state == DTLS_SRTP_STATE_INIT) {
    if (d->role == DTLS_SRTP_ROLE_SERVER) {
      uint8_t id[6];
      memcpy(id, &address->sin.sin_addr, 4);
      wire_put16(id + 4, address->port);
      if (mbedtls_ssl_set_client_transport_id(&d->ssl, id, sizeof(id)))
        goto fail;
    }
    mbedtls_ssl_set_timer_cb(&d->ssl, d, set_delay, get_delay);
    mbedtls_ssl_set_export_keys_cb(&d->ssl, export_keys, d);
    mbedtls_ssl_set_bio(&d->ssl, d, d->udp_send, d->udp_recv, NULL);
    d->state = DTLS_SRTP_STATE_HANDSHAKE;
  }
  int ret = mbedtls_ssl_handshake(&d->ssl);
  if (ret == MBEDTLS_ERR_SSL_WANT_READ || ret == MBEDTLS_ERR_SSL_WANT_WRITE)
    return 0;
  if (ret == MBEDTLS_ERR_SSL_HELLO_VERIFY_REQUIRED) {
    if (mbedtls_ssl_session_reset(&d->ssl))
      goto fail;
    d->state = DTLS_SRTP_STATE_INIT;
    d->have_exported = 0;
    return 0;
  }
  if (ret) {
    LOGW("DTLS handshake failed: -0x%04x", (unsigned)-ret);
    goto fail;
  }
  char actual[96];
  if (digest(mbedtls_ssl_get_peer_cert(&d->ssl), actual) ||
      !wire_equal(expected, actual, 95)) {
    LOGW("DTLS peer certificate missing or fingerprint mismatched");
    goto fail;
  }
  mbedtls_dtls_srtp_info negotiated;
  mbedtls_ssl_get_dtls_srtp_negotiation_result(&d->ssl, &negotiated);
  if (negotiated.MBEDTLS_PRIVATE(chosen_dtls_srtp_profile) !=
          MBEDTLS_TLS_SRTP_AES128_CM_HMAC_SHA1_80 ||
      derive_srtp(d)) {
    LOGW("DTLS SRTP profile negotiation or key derivation failed");
    goto fail;
  }
  d->state = DTLS_SRTP_STATE_CONNECTED;
  return 0;
fail:
  if (d->srtp_in) {
    srtp_dealloc(d->srtp_in);
    d->srtp_in = NULL;
  }
  if (d->srtp_out) {
    srtp_dealloc(d->srtp_out);
    d->srtp_out = NULL;
  }
  mbedtls_platform_zeroize(d->exported, sizeof(d->exported));
  d->have_exported = 0;
  d->state = DTLS_SRTP_STATE_FAILED;
  return -1;
}
int dtls_srtp_write(DtlsSrtp *d, const uint8_t *buf, size_t n) {
  if (!d || d->state != DTLS_SRTP_STATE_CONNECTED || !buf || !n || n > 1200)
    return -1;
  int ret = mbedtls_ssl_write(&d->ssl, buf, n);
  /* This synchronous UDP adapter does not retain SCTP's temporary buffer for
     Mbed TLS's same-arguments retry contract. Never reuse a failed/pending
     context for a different SCTP record. Release it in the owner loop. */
  if (ret != (int)n) {
    d->state = DTLS_SRTP_STATE_FAILED;
    return -1;
  }
  return ret;
}
int dtls_srtp_read(DtlsSrtp *d, uint8_t *buf, size_t n) {
  if (!d || d->state != DTLS_SRTP_STATE_CONNECTED)
    return -1;
  return mbedtls_ssl_read(&d->ssl, buf, n);
}
int dtls_srtp_probe(uint8_t *buf) {
  return buf && buf[0] >= 20 && buf[0] <= 63;
}
int dtls_srtp_decrypt_rtp_packet(DtlsSrtp *d, uint8_t *packet, int *size) {
  if (!d || d->state != DTLS_SRTP_STATE_CONNECTED || !d->srtp_in || !packet ||
      !size || *size < 12)
    return -1;
  int ret = (int)srtp_unprotect(d->srtp_in, packet, size);
  if (ret)
    *size = 0;
  return ret;
}
int dtls_srtp_decrypt_rtcp_packet(DtlsSrtp *d, uint8_t *packet, int *size) {
  if (!d || d->state != DTLS_SRTP_STATE_CONNECTED || !d->srtp_in || !packet ||
      !size || *size < 8)
    return -1;
  int ret = (int)srtp_unprotect_rtcp(d->srtp_in, packet, size);
  if (ret)
    *size = 0;
  return ret;
}
int dtls_srtp_encrypt_rtp_packet(DtlsSrtp *d, uint8_t *packet, int *size) {
  if (!d || d->state != DTLS_SRTP_STATE_CONNECTED || !d->srtp_out || !packet ||
      !size || *size < 12)
    return -1;
  return (int)srtp_protect(d->srtp_out, packet, size);
}
int dtls_srtp_encrypt_rctp_packet(DtlsSrtp *d, uint8_t *packet, int *size) {
  if (!d || d->state != DTLS_SRTP_STATE_CONNECTED || !d->srtp_out || !packet ||
      !size || *size < 8)
    return -1;
  return (int)srtp_protect_rtcp(d->srtp_out, packet, size);
}
