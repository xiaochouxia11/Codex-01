#ifndef LIVE_PEER_DTLS_SRTP_H
#define LIVE_PEER_DTLS_SRTP_H
#include "address.h"
#include <mbedtls/version.h>
#if MBEDTLS_VERSION_MAJOR >= 4
#include <psa/crypto.h>
#else
#include <mbedtls/ctr_drbg.h>
#include <mbedtls/entropy.h>
#endif
#include <mbedtls/pk.h>
#include <mbedtls/ssl.h>
#include <mbedtls/ssl_cookie.h>
#include <mbedtls/x509_crt.h>
#include <srtp2/srtp.h>
#include <stddef.h>
#include <stdint.h>
#define DTLS_SRTP_FINGERPRINT_LENGTH 96
#define SRTP_MASTER_KEY_LENGTH 16
#define SRTP_MASTER_SALT_LENGTH 14
#define DTLS_SRTP_KEY_MATERIAL_LENGTH 60

typedef enum { DTLS_SRTP_ROLE_CLIENT, DTLS_SRTP_ROLE_SERVER } DtlsSrtpRole;
typedef enum {
  DTLS_SRTP_STATE_INIT,
  DTLS_SRTP_STATE_HANDSHAKE,
  DTLS_SRTP_STATE_CONNECTED,
  DTLS_SRTP_STATE_FAILED
} DtlsSrtpState;
typedef struct DtlsSrtp {
  mbedtls_ssl_context ssl;
  mbedtls_ssl_config conf;
  mbedtls_ssl_cookie_ctx cookie_ctx;
  mbedtls_x509_crt cert;
  mbedtls_pk_context pkey;
#if MBEDTLS_VERSION_MAJOR >= 4
  mbedtls_svc_key_id_t signing_key;
#else
  mbedtls_entropy_context entropy;
  mbedtls_ctr_drbg_context ctr_drbg;
#endif
  struct {
    uint32_t start, intermediate, final;
  } timer;
  srtp_t srtp_in, srtp_out;
  uint8_t exported[DTLS_SRTP_KEY_MATERIAL_LENGTH];
  int have_exported;
  int (*udp_send)(void *, const unsigned char *, size_t);
  int (*udp_recv)(void *, unsigned char *, size_t);
  DtlsSrtpRole role;
  DtlsSrtpState state;
  int initialized;
  char local_fingerprint[DTLS_SRTP_FINGERPRINT_LENGTH];
  void *user_data;
} DtlsSrtp;
int dtls_srtp_init(DtlsSrtp *, DtlsSrtpRole, void *);
int dtls_srtp_set_role(DtlsSrtp *, DtlsSrtpRole);
void dtls_srtp_deinit(DtlsSrtp *);
int dtls_srtp_handshake(DtlsSrtp *, Address *, const char *);
int dtls_srtp_write(DtlsSrtp *, const uint8_t *, size_t);
int dtls_srtp_read(DtlsSrtp *, uint8_t *, size_t);
int dtls_srtp_probe(uint8_t *);
int dtls_srtp_decrypt_rtp_packet(DtlsSrtp *, uint8_t *, int *);
int dtls_srtp_decrypt_rtcp_packet(DtlsSrtp *, uint8_t *, int *);
int dtls_srtp_encrypt_rtp_packet(DtlsSrtp *, uint8_t *, int *);
int dtls_srtp_encrypt_rctp_packet(DtlsSrtp *, uint8_t *, int *);
#endif
