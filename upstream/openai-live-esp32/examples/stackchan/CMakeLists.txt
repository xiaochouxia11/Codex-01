cmake_minimum_required(VERSION 3.20)
set(EXTRA_COMPONENT_DIRS
    "../../components/live" "../../components/live_esp32" "../../components/live_peer"
    "$ENV{LIVE_PEER_DEPS_DIR}/mbedtls")
include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(live_stackchan)
