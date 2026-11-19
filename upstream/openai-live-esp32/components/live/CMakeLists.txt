# The launcher already uses managed cJSON; avoid linking a second copy.
if(LIVE_USE_MANAGED_CJSON OR IDF_VERSION_MAJOR GREATER_EQUAL 6)
  set(LIVE_JSON_COMPONENT espressif__cjson)
else()
  set(LIVE_JSON_COMPONENT json)
endif()
idf_component_register(SRCS "live.c" INCLUDE_DIRS "include" REQUIRES ${LIVE_JSON_COMPONENT})
target_compile_options(${COMPONENT_LIB} PRIVATE -Wall -Wextra -Werror)
