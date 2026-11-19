#ifndef LIVE_PEER_CONFIG_H
#define LIVE_PEER_CONFIG_H
#define CONFIG_MTU 1300
#ifndef CONFIG_USE_ZEPHYR
#define CONFIG_USE_ZEPHYR 0
#endif
#ifndef CONFIG_USE_LWIP
#define CONFIG_USE_LWIP 0
#endif
#ifndef CONFIG_IFACE_PREFIX
#define CONFIG_IFACE_PREFIX ""
#endif
#ifndef LOG_REDIRECT
#define LOG_REDIRECT 0
#endif
#endif
