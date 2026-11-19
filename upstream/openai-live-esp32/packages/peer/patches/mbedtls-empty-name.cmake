# Mbed TLS 3.6.8/4.1.2 empty X.509 Names may contain NULL, zero-length buffers.
# Do not pass them to memcmp: C's nonnull contract still applies at length zero.
# Preserve comparison semantics; apply to both pinned host and ESP sources.
set(path "${PEER_MBEDTLS_SOURCE_DIR}/library/x509_crt.c")
file(READ "${path}" source)
set(original "${source}")
function(live_peer_guard_x509 before after)
    string(FIND "${source}" "${after}" applied)
    if(applied EQUAL -1)
        string(FIND "${source}" "${before}" found)
        if(found EQUAL -1)
            message(FATAL_ERROR "Mbed TLS empty-name patch does not match pinned source")
        endif()
        string(REPLACE "${before}" "${after}" source "${source}")
        set(source "${source}" PARENT_SCOPE)
    endif()
endfunction()
live_peer_guard_x509(
    "memcmp(a->p, b->p, b->len) == 0"
    "(b->len == 0 || memcmp(a->p, b->p, b->len) == 0)")
live_peer_guard_x509(
    "memcmp(a->oid.p, b->oid.p, b->oid.len) != 0"
    "(b->oid.len != 0 && memcmp(a->oid.p, b->oid.p, b->oid.len) != 0)")
set(notice "/* Modified for live_peer: guard zero-length X.509 Name comparisons. */\n")
string(FIND "${source}" "${notice}" noticed)
if(noticed EQUAL -1)
    string(PREPEND source "${notice}")
endif()
if(NOT source STREQUAL original)
    file(WRITE "${path}" "${source}")
endif()
