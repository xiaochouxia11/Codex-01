set(peer_root "${CMAKE_CURRENT_LIST_DIR}/../../packages/peer")
set(deps "$ENV{LIVE_PEER_DEPS_DIR}")
if(NOT deps AND DEFINED ENV{LIVE_VOICE_PRIVATE_DIR})
    get_filename_component(deps "$ENV{LIVE_VOICE_PRIVATE_DIR}/../vendor/peer" ABSOLUTE)
endif()
if(NOT EXISTS "${deps}/usrsctp/usrsctplib/usrsctp.h")
    message(FATAL_ERROR "Run tools/prepare_peer.py and set LIVE_PEER_DEPS_DIR")
endif()
set(peer_sources address agent dtls_srtp ice peer peer_connection ports rtcp rtp sctp sdp socket stun utils)
set(srcs "")
foreach(src IN LISTS peer_sources)
    list(APPEND srcs "${peer_root}/src/${src}.c")
endforeach()
idf_component_register(SRCS ${srcs} INCLUDE_DIRS "${peer_root}/include"
    PRIV_INCLUDE_DIRS "${peer_root}/src" "${deps}/usrsctp/usrsctplib"
    REQUIRES mbedtls lwip esp_netif esp_timer pthread)
target_compile_definitions(${COMPONENT_LIB} PRIVATE CONFIG_USE_LWIP=1 HAVE_SCONN_LEN
    LIVE_PEER_TRACE_ICE=$<BOOL:${CONFIG_LIVE_PEER_TRACE_ICE}>)

if(CMAKE_BUILD_EARLY_EXPANSION)
    return()
endif()

# Build the same reviewed upstream SCTP sources, restricted to AF_CONN and
# explicit no-thread timers. No parallel SCTP/IP receive tasks are started.
file(GLOB sctp_src "${deps}/usrsctp/usrsctplib/netinet/*.c")
list(APPEND sctp_src "${deps}/usrsctp/usrsctplib/user_environment.c"
    "${deps}/usrsctp/usrsctplib/user_mbuf.c"
    "${deps}/usrsctp/usrsctplib/user_recv_thread.c"
    "${deps}/usrsctp/usrsctplib/user_socket.c")
add_library(live_usrsctp STATIC ${sctp_src} "idf_time.c")
include("${peer_root}/cmake/sctp_profile.cmake")
live_peer_configure_sctp(live_usrsctp)
target_include_directories(live_usrsctp PRIVATE "${deps}/usrsctp/usrsctplib")
target_compile_definitions(live_usrsctp PRIVATE __Userspace__ SCTP_SIMPLE_ALLOCATOR
    SCTP_PROCESS_LEVEL_LOCKS HAVE_STDATOMIC_H HAVE_SA_LEN HAVE_SCONN_LEN
    nanosleep=live_peer_idf_nanosleep)
target_compile_options(live_usrsctp PRIVATE -Wno-error=format -Wno-address-of-packed-member
    -include "${CMAKE_CURRENT_LIST_DIR}/usrsctp_port.h")
target_link_libraries(live_usrsctp PRIVATE idf::lwip idf::pthread idf::esp_hw_support idf::esp_timer)

set(srtp_src srtp/srtp.c crypto/cipher/cipher.c crypto/cipher/cipher_test_cases.c
    crypto/cipher/null_cipher.c crypto/cipher/aes.c crypto/cipher/aes_icm.c
    crypto/hash/auth.c crypto/hash/auth_test_cases.c crypto/hash/null_auth.c
    crypto/hash/hmac.c crypto/hash/sha1.c crypto/kernel/alloc.c
    crypto/kernel/crypto_kernel.c crypto/kernel/err.c crypto/kernel/key.c
    crypto/math/datatypes.c crypto/replay/rdb.c crypto/replay/rdbx.c)
list(TRANSFORM srtp_src PREPEND "${deps}/srtp/")
add_library(live_srtp STATIC ${srtp_src})
target_include_directories(live_srtp PRIVATE "${deps}/srtp/include"
    "${deps}/srtp/crypto/include" "srtp-config")
target_compile_definitions(live_srtp PRIVATE HAVE_CONFIG_H)
target_compile_options(live_srtp PRIVATE -Wno-error=format)
target_link_libraries(live_srtp PRIVATE idf::lwip)
include("${peer_root}/cmake/srtp_backend.cmake")
live_peer_configure_srtp(live_srtp "${deps}/srtp" idf::mbedtls)
target_link_libraries(${COMPONENT_LIB} PRIVATE live_usrsctp live_srtp)
configure_file("${deps}/srtp/include/srtp.h" "${CMAKE_CURRENT_BINARY_DIR}/include/srtp2/srtp.h" COPYONLY)
target_include_directories(${COMPONENT_LIB} PRIVATE "${CMAKE_CURRENT_BINARY_DIR}/include")
