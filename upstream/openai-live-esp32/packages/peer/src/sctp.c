/* usrsctp owns SCTP validation/reassembly; DCEP is parsed only after SCTP
 * delivery. */
#include "sctp.h"
#include "ports.h"
#include "utils.h"
#include "wire.h"
#include <errno.h>
#include <mbedtls/platform_util.h>
#include <stdlib.h>
#include <string.h>
#include <usrsctp.h>

static uint32_t last_tick;
static int output(void *ctx, void *data, size_t n, uint8_t tos, uint8_t df) {
  (void)tos;
  (void)df;
  Sctp *s = ctx;
  if (!s || s->closing || s->failed)
    return EPIPE;
  LOGD("SCTP output bytes=%zu chunk=%u", n,
       n >= 16 ? ((uint8_t *)data)[12] : 255);
  int ret = dtls_srtp_write(s->dtls_srtp, data, n);
  return ret == (int)n ? 0 : EPIPE;
}
void sctp_usrsctp_init(void) {
  usrsctp_init_nothreads(0, output, NULL);
  usrsctp_sysctl_set_sctp_ecn_enable(0);
  last_tick = ports_get_epoch_time();
}
void sctp_tick(void) {
  uint32_t now = ports_get_epoch_time(), elapsed = now - last_tick;
  if (elapsed) {
    last_tick = now;
    usrsctp_handle_timers(elapsed);
  }
}
int sctp_usrsctp_deinit(void) { return usrsctp_finish() ? -1 : 0; }

static SctpStreamEntry *stream(Sctp *s, uint16_t sid) {
  for (int i = 0; i < s->stream_count; ++i)
    if (s->stream_table[i].sid == sid)
      return &s->stream_table[i];
  return NULL;
}
static int send_message(Sctp *s, const void *data, size_t size, uint32_t ppid,
                        uint16_t sid) {
  if (!s || !s->sock || !s->connected || s->failed || !s->dtls_srtp ||
      s->dtls_srtp->state != DTLS_SRTP_STATE_CONNECTED ||
      sid >= SCTP_STREAM_LIMIT || !data || !size || size > PEER_MESSAGE_LIMIT ||
      size > s->remote_max_message)
    return -1;
  struct sctp_sendv_spa spa = {0};
  spa.sendv_flags = SCTP_SEND_SNDINFO_VALID;
  spa.sendv_sndinfo.snd_sid = sid;
  spa.sendv_sndinfo.snd_flags = SCTP_EOR;
  spa.sendv_sndinfo.snd_ppid = htonl(ppid);
  ssize_t n = usrsctp_sendv(s->sock, data, size, NULL, 0, &spa, sizeof(spa),
                            SCTP_SENDV_SPA, 0);
  return n == (ssize_t)size && s->dtls_srtp->state == DTLS_SRTP_STATE_CONNECTED
             ? 0
             : -1;
}
int sctp_outgoing_data(Sctp *s, char *data, size_t size, SctpDataPpid ppid,
                       uint16_t sid) {
  if (!s || (!data && size) || size > s->remote_max_message ||
      size > PEER_MESSAGE_LIMIT || (ppid != PPID_STRING && ppid != PPID_BINARY))
    return -1;
  SctpStreamEntry *entry = stream(s, sid);
  if (!entry || entry->state != 2 ||
      (ppid == PPID_STRING && !wire_utf8((const uint8_t *)data, size)))
    return -1;
  uint8_t empty = 0;
  return send_message(s, size ? (void *)data : &empty, size ? size : 1,
                      size                  ? (uint32_t)ppid
                      : ppid == PPID_STRING ? PPID_STRING_EMPTY
                                            : PPID_BINARY_EMPTY,
                      sid);
}
int sctp_open_channel(Sctp *s, const char *label, const char *protocol,
                      uint16_t sid) {
  if (!s || !s->dtls_srtp || !label || !protocol || !s->connected ||
      sid >= SCTP_STREAM_LIMIT ||
      (sid & 1) != (s->dtls_srtp->role == DTLS_SRTP_ROLE_CLIENT ? 0 : 1) ||
      stream(s, sid) || s->stream_count == SCTP_MAX_STREAMS)
    return -1;
  size_t ln = strnlen(label, SCTP_LABEL_LIMIT + 1),
         pn = strnlen(protocol, SCTP_LABEL_LIMIT + 1);
  if (ln > SCTP_LABEL_LIMIT || pn > SCTP_LABEL_LIMIT ||
      !wire_utf8((const uint8_t *)label, ln) ||
      !wire_utf8((const uint8_t *)protocol, pn))
    return -1;
  for (int i = 0; i < s->stream_count; ++i)
    if (!strcmp(s->stream_table[i].label, label))
      return -1;
  uint8_t msg[12 + 2 * SCTP_LABEL_LIMIT] = {3, 0};
  wire_put16(msg + 8, (uint16_t)ln);
  wire_put16(msg + 10, (uint16_t)pn);
  memcpy(msg + 12, label, ln);
  memcpy(msg + 12 + ln, protocol, pn);
  if (send_message(s, msg, 12 + ln + pn, PPID_CONTROL, sid))
    return -1;
  SctpStreamEntry *e = &s->stream_table[s->stream_count++];
  memset(e, 0, sizeof(*e));
  e->sid = sid;
  e->state = 1;
  memcpy(e->label, label, ln);
  return 0;
}
int sctp_handle_message(Sctp *s, const uint8_t *data, size_t size,
                        uint32_t ppid, uint16_t sid) {
  if (!s || !s->dtls_srtp || !s->connected || s->failed || !data ||
      size > PEER_MESSAGE_LIMIT || sid >= SCTP_STREAM_LIMIT)
    return -1;
  SctpStreamEntry *e = stream(s, sid);
  if (ppid == PPID_CONTROL) {
    // RFC 8832 ACK is one byte. Pion emits a four-byte ACK with three zero
    // padding bytes; accept only that exact compatibility form as well.
    if ((size == 1 || (size == 4 && !data[1] && !data[2] && !data[3])) &&
        data[0] == DATA_CHANNEL_ACK) {
      if (!e || e->state != 1)
        return -1;
      e->state = 2;
      return 0;
    }
    if (size < 12 || data[0] != DATA_CHANNEL_OPEN || data[1] != 0 ||
        wire_u32(data + 4) != 0 ||
        (sid & 1) != (s->dtls_srtp->role == DTLS_SRTP_ROLE_CLIENT ? 1 : 0) ||
        e || s->stream_count == SCTP_MAX_STREAMS)
      return -1;
    size_t ln = wire_u16(data + 8), pn = wire_u16(data + 10);
    if (ln > SCTP_LABEL_LIMIT || pn > SCTP_LABEL_LIMIT ||
        12 + ln + pn != size || memchr(data + 12, 0, ln + pn) ||
        !wire_utf8(data + 12, ln) || !wire_utf8(data + 12 + ln, pn))
      return -1;
    char label[SCTP_LABEL_LIMIT + 1] = {0};
    memcpy(label, data + 12, ln);
    for (int i = 0; i < s->stream_count; ++i)
      if (!strcmp(s->stream_table[i].label, label))
        return -1;
    uint8_t ack = DATA_CHANNEL_ACK;
    if (send_message(s, &ack, 1, PPID_CONTROL, sid))
      return -1;
    e = &s->stream_table[s->stream_count++];
    memset(e, 0, sizeof(*e));
    e->sid = sid;
    e->state = 2;
    memcpy(e->label, label, ln + 1);
    return 0;
  }
  if (!e || e->state != 2)
    return -1;
  if (ppid == PPID_STRING_EMPTY || ppid == PPID_BINARY_EMPTY) {
    if (size != 1)
      return -1;
    size = 0;
  } else if (ppid != PPID_STRING && ppid != PPID_BINARY)
    return -1;
  if (ppid == PPID_STRING && !wire_utf8(data, size))
    return -1;
  if (s->onmessage)
    s->onmessage((char *)data, size, s->userdata, sid);
  return 0;
}
/* Reassemble only within a bounded, accepted channel. An invalid message is
   discarded through EOR; its tail must never become a new application message.
 */
static void clear_partial(SctpStreamEntry *e) {
  if (e->partial) {
    mbedtls_platform_zeroize(e->partial, e->partial_size);
    free(e->partial);
  }
  e->partial = NULL;
  e->partial_size = 0;
}
void sctp_receive_chunk(Sctp *s, const uint8_t *data, size_t size,
                        uint32_t ppid, uint16_t sid, int eor) {
  if (!s || s->failed || sid >= SCTP_STREAM_LIMIT || !data)
    return;
  if (ppid == PPID_CONTROL) {
    uint16_t bit = (uint16_t)(1u << sid);
    if (!eor)
      s->partial_control |= bit;
    else {
      if (!(s->partial_control & bit))
        sctp_handle_message(s, data, size, ppid, sid);
      s->partial_control &= (uint16_t)~bit;
    }
    return;
  }
  SctpStreamEntry *e = stream(s, sid);
  if (!e || e->state != 2)
    return;
  if (e->discarding || size > PEER_MESSAGE_LIMIT - e->partial_size ||
      (e->partial_size && e->partial_ppid != ppid)) {
    clear_partial(e);
    e->discarding = !eor;
  } else if (!e->partial_size && eor) {
    sctp_handle_message(s, data, size, ppid, sid);
  } else {
    if (!e->partial)
      e->partial = malloc(PEER_MESSAGE_LIMIT);
    if (!e->partial) {
      e->discarding = !eor;
    } else {
      e->partial_ppid = ppid;
      memcpy(e->partial + e->partial_size, data, size);
      e->partial_size += size;
      if (eor) {
        sctp_handle_message(s, e->partial, e->partial_size, ppid, sid);
        clear_partial(e);
      }
    }
  }
}
void sctp_handle_association_state(Sctp *s, unsigned state) {
  LOGD("SCTP association state=%u", state);
  if (!s || s->closing || s->failed)
    return;
  if (state == SCTP_COMM_UP && !s->connected) {
    s->connected = 1;
    if (s->onopen)
      s->onopen(s->userdata);
  } else if (state == SCTP_COMM_LOST || state == SCTP_SHUTDOWN_COMP ||
             state == SCTP_CANT_STR_ASSOC || state == SCTP_RESTART) {
    /* Restart/reset requires fresh DCEP state, which this API does not support.
       Mark terminal now; the owner releases the association after callbacks. */
    s->connected = 0;
    s->failed = 1;
    if (s->onclose)
      s->onclose(s->userdata);
  }
}
static int receive_cb(struct socket *sock, union sctp_sockstore address,
                      void *data, size_t size, struct sctp_rcvinfo info,
                      int flags, void *ctx) {
  (void)sock;
  (void)address;
  Sctp *s = ctx;
  if (!s || s->closing || s->failed) {
    if (data)
      mbedtls_platform_zeroize(data, size);
    free(data);
    return 1;
  }
  if (!data) {
    sctp_handle_association_state(s, SCTP_SHUTDOWN_COMP);
    return 1;
  }
  if (flags & MSG_NOTIFICATION) {
    union sctp_notification *n = data;
    if (size >= sizeof(n->sn_header) && n->sn_header.sn_length == size &&
        n->sn_header.sn_type == SCTP_ASSOC_CHANGE &&
        size >= sizeof(n->sn_assoc_change)) {
      sctp_handle_association_state(s, n->sn_assoc_change.sac_state);
    } else if (size >= sizeof(n->sn_pdapi_event) &&
               n->sn_header.sn_length == size &&
               n->sn_header.sn_type == SCTP_PARTIAL_DELIVERY_EVENT &&
               n->sn_pdapi_event.pdapi_indication ==
                   SCTP_PARTIAL_DELIVERY_ABORTED) {
      sctp_handle_association_state(s, SCTP_COMM_LOST);
    }
  } else {
    LOGD("SCTP message sid=%u ppid=%u bytes=%zu flags=%x first=%u",
         info.rcv_sid, ntohl(info.rcv_ppid), size, flags,
         size ? ((uint8_t *)data)[0] : 255);
    sctp_receive_chunk(s, data, size, ntohl(info.rcv_ppid), info.rcv_sid,
                       !!(flags & MSG_EOR));
  }
  mbedtls_platform_zeroize(data, size);
  free(data);
  return 1;
}
int sctp_create_association(Sctp *s, DtlsSrtp *d) {
  if (!s || !d || d->state != DTLS_SRTP_STATE_CONNECTED || s->sock ||
      !s->remote_port)
    return -1;
  s->dtls_srtp = d;
  s->local_port = 5000;
  usrsctp_register_address(s);
  s->registered = 1;
  s->sock = usrsctp_socket(AF_CONN, SOCK_STREAM, IPPROTO_SCTP, receive_cb, NULL,
                           0, s);
  if (!s->sock || usrsctp_set_non_blocking(s->sock, 1))
    goto fail;
  struct linger linger = {1, 0};
  int buffer = 2 * PEER_MESSAGE_LIMIT;
  uint32_t enabled = 1;
  struct sctp_initmsg init = {.sinit_num_ostreams = SCTP_STREAM_LIMIT,
                              .sinit_max_instreams = SCTP_STREAM_LIMIT};
  struct sctp_event event = {
      .se_assoc_id = SCTP_ALL_ASSOC, .se_type = SCTP_ASSOC_CHANGE, .se_on = 1};
  struct sctp_event partial = {.se_assoc_id = SCTP_ALL_ASSOC,
                               .se_type = SCTP_PARTIAL_DELIVERY_EVENT,
                               .se_on = 1};
  struct sctp_paddrparams path = {0};
  path.spp_flags = SPP_PMTUD_DISABLE;
  path.spp_pathmtu = 1100;
  ((struct sockaddr_conn *)&path.spp_address)->sconn_family = AF_CONN;
  if (usrsctp_setsockopt(s->sock, SOL_SOCKET, SO_LINGER, &linger,
                         sizeof(linger)) ||
      usrsctp_setsockopt(s->sock, SOL_SOCKET, SO_RCVBUF, &buffer,
                         sizeof(buffer)) ||
      usrsctp_setsockopt(s->sock, SOL_SOCKET, SO_SNDBUF, &buffer,
                         sizeof(buffer)) ||
      usrsctp_setsockopt(s->sock, IPPROTO_SCTP, SCTP_NODELAY, &enabled,
                         sizeof(enabled)) ||
      usrsctp_setsockopt(s->sock, IPPROTO_SCTP, SCTP_INITMSG, &init,
                         sizeof(init)) ||
      usrsctp_setsockopt(s->sock, IPPROTO_SCTP, SCTP_EVENT, &event,
                         sizeof(event)) ||
      usrsctp_setsockopt(s->sock, IPPROTO_SCTP, SCTP_EVENT, &partial,
                         sizeof(partial)) ||
      usrsctp_setsockopt(s->sock, IPPROTO_SCTP, SCTP_PEER_ADDR_PARAMS, &path,
                         sizeof(path)))
    goto fail;
  struct sockaddr_conn addr = {0};
  addr.sconn_family = AF_CONN;
  addr.sconn_port = htons(s->local_port);
  addr.sconn_addr = s;
#if defined(__APPLE__) || defined(ESP_PLATFORM)
  addr.sconn_len = sizeof(addr);
#endif
  if (usrsctp_bind(s->sock, (struct sockaddr *)&addr, sizeof(addr)))
    goto fail;
  addr.sconn_port = htons(s->remote_port);
  if (usrsctp_connect(s->sock, (struct sockaddr *)&addr, sizeof(addr)) &&
      errno != EINPROGRESS)
    goto fail;
  return 0;
fail:
  sctp_destroy_association(s);
  return -1;
}
void sctp_destroy_association(Sctp *s) {
  if (!s)
    return;
  s->closing = 1;
  s->connected = 0;
  if (s->sock) {
    usrsctp_close(s->sock);
    s->sock = NULL;
  }
  if (s->registered) {
    usrsctp_deregister_address(s);
    s->registered = 0;
  }
  for (int i = 0; i < s->stream_count; ++i) {
    clear_partial(&s->stream_table[i]);
  }
  s->stream_count = 0;
}
void sctp_incoming_data(Sctp *s, char *data, size_t size) {
  LOGD("SCTP input bytes=%zu chunk=%u", size,
       size >= 16 ? (uint8_t)data[12] : 255);
  if (s && s->sock && !s->closing && !s->failed && data && size >= 12 &&
      size <= 1536)
    usrsctp_conninput(s, data, size, 0);
}
int sctp_is_connected(Sctp *s) { return s && s->connected; }
void sctp_onmessage(Sctp *s, void (*cb)(char *, size_t, void *, uint16_t)) {
  s->onmessage = cb;
}
void sctp_onopen(Sctp *s, void (*cb)(void *)) { s->onopen = cb; }
void sctp_onclose(Sctp *s, void (*cb)(void *)) { s->onclose = cb; }
