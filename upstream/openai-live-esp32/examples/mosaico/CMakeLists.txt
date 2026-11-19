cmake_minimum_required(VERSION 3.24)
set(mosaico "$ENV{LIVE_MOSAICO_DEPS_DIR}")
if(NOT mosaico)
    set(mosaico "${CMAKE_CURRENT_LIST_DIR}/vendor")
endif()
set(LIVE_USE_MANAGED_CJSON ON CACHE BOOL "Use the IDF 6 managed cJSON component")
if(NOT EXISTS "${mosaico}/esp-mosaico-bsp/components/esp-mosaico-bsp/CMakeLists.txt")
    message(FATAL_ERROR "Run tools/prepare_mosaico.py first")
endif()
set(EXTRA_COMPONENT_DIRS
    "$ENV{LIVE_PEER_DEPS_DIR}/mbedtls"
    "../../components/live" "../../components/live_esp32" "../../components/live_peer"
    "${mosaico}/esp-mosaico-bsp/components/esp-mosaico-bsp"
    "${mosaico}/esp-mosaico-bsp/components/mosaico_module_mgr"
    "${mosaico}/esp-mosaico-bsp/components/mosaico_module_camera"
    "${mosaico}/esp-mosaico-bsp/components/mosaico_module_interact"
    "${mosaico}/usb_hs_console")
include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(live_mosaico)
