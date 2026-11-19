#ifndef PEER_H_
#define PEER_H_

#ifdef __cplusplus
extern "C" {
#endif

#include "peer_connection.h"

/* Call before creating peers. All API calls use one owner thread. */
int peer_init(void);

/* Returns -1 if live peer objects remain; destroy them before shutdown. */
int peer_deinit(void);

#ifdef __cplusplus
}
#endif

#endif // PEER_H_
