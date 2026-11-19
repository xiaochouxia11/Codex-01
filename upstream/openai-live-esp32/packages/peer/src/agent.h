#ifndef AGENT_H_
#define AGENT_H_

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "ice.h"
#include "socket.h"
#include "stun.h"
#include "utils.h"

#ifndef AGENT_MAX_DESCRIPTION
#define AGENT_MAX_DESCRIPTION 40960
#endif

#ifndef AGENT_MAX_CANDIDATES
#define AGENT_MAX_CANDIDATES 10
#endif

#ifndef AGENT_MAX_CANDIDATE_PAIRS
#define AGENT_MAX_CANDIDATE_PAIRS 100
#endif

typedef enum AgentMode {

  AGENT_MODE_CONTROLLED = 0,
  AGENT_MODE_CONTROLLING

} AgentMode;

typedef struct Agent Agent;

struct Agent {
  char remote_ufrag[ICE_UFRAG_LENGTH + 1];
  char remote_upwd[ICE_UPWD_LENGTH + 1];

  char local_ufrag[ICE_UFRAG_LENGTH + 1];
  char local_upwd[ICE_UPWD_LENGTH + 1];

  IceCandidate local_candidates[AGENT_MAX_CANDIDATES];
  IceCandidate remote_candidates[AGENT_MAX_CANDIDATES];
  IceCandidate learned_local;

  int local_candidates_count;
  int remote_candidates_count;

  UdpSocket udp_sockets[2];

  Address host_addr;
  int b_host_addr;
  uint32_t binding_request_sent_time;
  uint32_t check_started;
  uint32_t last_consent;
  uint32_t consent_interval;
  int consent_revoked;
  uint8_t early_hello[2][STUN_ATTR_BUF_SIZE];
  size_t early_hello_size[2];
  unsigned early_hello_head, early_hello_count;
  uint8_t binding_request_transaction_id[12];
  int binding_request_pending;
  uint8_t tie_breaker[8], binding_packet[STUN_ATTR_BUF_SIZE];
  size_t binding_packet_size;

  AgentMode mode;

  IceCandidatePair candidate_pairs[AGENT_MAX_CANDIDATE_PAIRS];
  IceCandidatePair *selected_pair;
  IceCandidatePair *nominated_pair;

  int candidate_pairs_num;
  int use_candidate;
  uint32_t transaction_id[3];
};

void agent_gather_candidate(Agent *agent, const char *urls,
                            const char *username, const char *credential);

/* The supported IPv4 UDP STUN URI subset; defaults to port 3478. */
int agent_parse_stun_url(const char *url, char hostname[128], uint16_t *port);

void agent_create_ice_credential(Agent *agent);

void agent_get_local_description(Agent *agent, char *description, int length);

int agent_send(Agent *agent, const uint8_t *buf, int len);
int agent_has_consent(Agent *agent);

int agent_recv(Agent *agent, uint8_t *buf, int len);

int agent_select_candidate_pair(Agent *agent);

int agent_connectivity_check(Agent *agent);

int agent_send_binding_request(Agent *agent);

void agent_clear_candidates(Agent *agent);

int agent_create(Agent *agent);

void agent_destroy(Agent *agent);

void agent_update_candidate_pairs(Agent *agent);

#endif // AGENT_H_
