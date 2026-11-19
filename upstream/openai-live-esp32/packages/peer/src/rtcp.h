#ifndef LIVE_PEER_RTCP_H
#define LIVE_PEER_RTCP_H
#include <stddef.h>
#include <stdint.h>
int rtcp_probe(uint8_t *, size_t);
int rtcp_validate(const uint8_t *, size_t);
#endif
