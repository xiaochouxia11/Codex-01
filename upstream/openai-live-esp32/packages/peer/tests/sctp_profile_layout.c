/* Test-only access to upstream hash layout, compiled with its exact flags. */
#include <netinet/sctp_os.h>
#include <netinet/sctp_pcb.h>
size_t peer_test_sctp_index_bytes(void) {
  return sizeof(void *) *
         (SCTP_BASE_INFO(hashasocmark) + 1 + SCTP_BASE_INFO(hashmark) + 1 +
          SCTP_BASE_INFO(hashtcpmark) + 1);
}
unsigned peer_test_sctp_max_chain(void) {
  unsigned max = 0;
  SCTP_INP_INFO_RLOCK();
  for (int table = 0; table < 2; ++table) {
    struct sctppcbhead *heads =
        table ? SCTP_BASE_INFO(sctp_tcpephash) : SCTP_BASE_INFO(sctp_ephash);
    unsigned long mask =
        table ? SCTP_BASE_INFO(hashtcpmark) : SCTP_BASE_INFO(hashmark);
    for (unsigned long i = 0; i <= mask; ++i) {
      unsigned count = 0;
      struct sctp_inpcb *inp;
      LIST_FOREACH(inp, &heads[i], sctp_hash)++ count;
      if (count > max)
        max = count;
    }
  }
  SCTP_INP_INFO_RUNLOCK();
  return max;
}
