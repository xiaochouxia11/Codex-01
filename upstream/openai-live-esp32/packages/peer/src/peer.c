#include "peer.h"
#include "peer_runtime.h"
#include "sctp.h"
#include <limits.h>
#include <srtp2/srtp.h>

/* All APIs, including process initialization, belong to one application thread.
 */
static unsigned references, peers;
int peer_runtime_ready(void) { return references != 0; }
void peer_runtime_add(void) { ++peers; }
void peer_runtime_remove(void) {
  if (peers)
    --peers;
}
int peer_init(void) {
  if (references == UINT_MAX)
    return -1;
  if (!references) {
    if (srtp_init() != srtp_err_status_ok)
      return -1;
    sctp_usrsctp_init();
  }
  ++references;
  return 0;
}
int peer_deinit(void) {
  if (peers || !references)
    return -1;
  if (references > 1) {
    --references;
    return 0;
  }
  if (sctp_usrsctp_deinit())
    return -1;
  if (srtp_shutdown() != srtp_err_status_ok)
    return -1;
  references = 0;
  return 0;
}
