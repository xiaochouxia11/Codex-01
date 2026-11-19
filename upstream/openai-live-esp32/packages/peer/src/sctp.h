#ifndef LIVE_PEER_SCTP_H
#define LIVE_PEER_SCTP_H
#include "dtls_srtp.h"
#include "sdp.h"
#define SCTP_MAX_STREAMS 5
#define SCTP_LABEL_LIMIT 31
#define SCTP_STREAM_LIMIT 16
#define DATA_CHANNEL_OPEN 3
#define DATA_CHANNEL_ACK 2

typedef enum {
  PPID_CONTROL = 50,
  PPID_STRING = 51,
  PPID_BINARY = 53,
  PPID_STRING_EMPTY = 56,
  PPID_BINARY_EMPTY = 57
} SctpDataPpid;
typedef struct SctpStreamEntry {
  char label[SCTP_LABEL_LIMIT + 1];
  uint16_t sid;
  int state;
  uint8_t *partial;
  size_t partial_size;
  uint32_t partial_ppid;
  int discarding;
} SctpStreamEntry;
typedef struct Sctp {
  struct socket *sock;
  DtlsSrtp *dtls_srtp;
  uint16_t local_port, remote_port;
  size_t remote_max_message;
  int connected, registered, closing, failed, stream_count;
  uint16_t partial_control;
  SctpStreamEntry stream_table[SCTP_MAX_STREAMS];
  void (*onmessage)(char *, size_t, void *, uint16_t);
  void (*onopen)(void *);
  void (*onclose)(void *);
  void *userdata;
} Sctp;
int sctp_create_association(Sctp *, DtlsSrtp *);
void sctp_destroy_association(Sctp *);
void sctp_usrsctp_init(void);
int sctp_usrsctp_deinit(void);
void sctp_tick(void);
int sctp_is_connected(Sctp *);
void sctp_incoming_data(Sctp *, char *, size_t);
int sctp_outgoing_data(Sctp *, char *, size_t, SctpDataPpid, uint16_t);
int sctp_open_channel(Sctp *, const char *, const char *, uint16_t);
void sctp_receive_chunk(Sctp *, const uint8_t *, size_t, uint32_t, uint16_t,
                        int);
int sctp_handle_message(Sctp *, const uint8_t *, size_t, uint32_t, uint16_t);
void sctp_handle_association_state(Sctp *, unsigned);
void sctp_onmessage(Sctp *, void (*)(char *, size_t, void *, uint16_t));
void sctp_onopen(Sctp *, void (*)(void *));
void sctp_onclose(Sctp *, void (*)(void *));
#endif
