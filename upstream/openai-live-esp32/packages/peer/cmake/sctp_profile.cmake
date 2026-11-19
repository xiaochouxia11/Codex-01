# Lookup bucket counts are indexing choices, not association/channel limits.
# Use the same profile in host validation and the MCU build. Applications with
# many concurrent peers can increase these without changing the wire protocol.
set(LIVE_PEER_SCTP_HASH_BUCKETS 128 CACHE STRING "Global SCTP lookup buckets")
set(LIVE_PEER_SCTP_ENDPOINT_BUCKETS 32 CACHE STRING "Per-endpoint SCTP lookup buckets")
function(live_peer_configure_sctp target)
  foreach(profile_option LIVE_PEER_SCTP_HASH_BUCKETS LIVE_PEER_SCTP_ENDPOINT_BUCKETS)
    string(LENGTH "${${profile_option}}" bucket_digits)
    if(NOT "${${profile_option}}" MATCHES "^[1-9][0-9]*$" OR bucket_digits GREATER 5
        OR "${${profile_option}}" GREATER 65536)
      message(FATAL_ERROR "${profile_option} must be a power of two between 1 and 65536")
    endif()
    math(EXPR remainder "${${profile_option}} & (${${profile_option}} - 1)")
    if(remainder)
      message(FATAL_ERROR "${profile_option} must be a power of two")
    endif()
  endforeach()
  target_compile_definitions(${target} PRIVATE
    SCTP_TCBHASHSIZE=${LIVE_PEER_SCTP_HASH_BUCKETS}
    SCTP_PCBHASHSIZE=${LIVE_PEER_SCTP_ENDPOINT_BUCKETS})
endfunction()
