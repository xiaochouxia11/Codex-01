option(LIVE_PEER_MBEDTLS_SRTP "Use upstream libSRTP's Mbed TLS AES/HMAC backend" OFF)
function(live_peer_configure_srtp target source_root crypto_target)
  if(NOT LIVE_PEER_MBEDTLS_SRTP)
    return()
  endif()
  # Keep the same AES-CM/HMAC profiles and upstream SRTP/replay implementation.
  # The stock CMake ENABLE_MBEDTLS option also enables GCM; selecting just these
  # sources avoids adding profiles or changing the negotiated protection suite.
  get_target_property(srtp_sources ${target} SOURCES)
  set(selected_sources "")
  foreach(source IN LISTS srtp_sources)
    if(source MATCHES "crypto/(cipher/(aes|aes_icm)|hash/(hmac|sha1))\\.c$")
      continue()
    endif()
    if(NOT IS_ABSOLUTE "${source}")
      set(source "${source_root}/${source}")
    endif()
    list(APPEND selected_sources "${source}")
  endforeach()
  list(APPEND selected_sources
    "${CMAKE_CURRENT_FUNCTION_LIST_DIR}/../src/srtp_mbedtls_aes.c"
    "${source_root}/crypto/hash/hmac_mbedtls.c")
  set_property(TARGET ${target} PROPERTY SOURCES "${selected_sources}")
  target_compile_definitions(${target} PRIVATE MBEDTLS=1)
  target_include_directories(${target} PRIVATE "${source_root}")
  # This project consumes libSRTP in-tree. Its separate upstream install export
  # must not try to export the source-built Mbed TLS targets as libSRTP targets.
  target_link_libraries(${target} PRIVATE $<BUILD_INTERFACE:${crypto_target}>)
endfunction()
