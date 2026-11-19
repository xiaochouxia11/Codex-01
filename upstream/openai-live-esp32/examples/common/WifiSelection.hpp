#pragma once
#include <cstddef>
#include <cstdint>

namespace live_wifi {
constexpr size_t MAX_PROFILES = 8;
constexpr uint32_t DHCP_GRACE_MS = 20000;
// Association can complete near the end of a reconnect/scan deadline. Give
// DHCP its own window, including across the 32-bit millisecond wraparound.
inline bool waiting_for_dhcp(uint32_t now, uint32_t associated_at) {
  return associated_at && uint32_t(now - associated_at) < DHCP_GRACE_MS;
}
// Missing APs use -127. Prefer the strongest eligible saved network, with
// configuration order breaking ties. A failed network cannot starve another.
inline int select(const int *rssi, const int64_t *retry_after, size_t count,
                  int64_t now) {
  int best = -1;
  for (size_t i = 0; i < count && i < MAX_PROFILES; ++i)
    if (rssi[i] > -127 && retry_after[i] <= now &&
        (best < 0 || rssi[i] > rssi[best]))
      best = static_cast<int>(i);
  return best;
}
} // namespace live_wifi
