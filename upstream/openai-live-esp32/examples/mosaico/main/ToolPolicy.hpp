#pragma once
#include "cJSON.h"
#include <cmath>
#include <cstdint>
#include <cstring>

namespace mosaico {
class ButtonEdge {
  bool initialized_ = false, candidate_ = false, stable_ = false,
       armed_ = false;
  int64_t changed_ = 0;

public:
  bool update(bool down, int64_t now) {
    if (!initialized_ || down != candidate_) {
      initialized_ = true;
      candidate_ = down;
      changed_ = now;
      return false;
    }
    if (now - changed_ < 60000)
      return false;
    if (!down)
      armed_ = true;
    if (down == stable_)
      return false;
    stable_ = down;
    const bool pressed = down && armed_;
    if (down)
      armed_ = false;
    return pressed;
  }
};

// USB diagnostics may set lights while idle. Session effects must still be
// cancelled when their session stops, and must not revive on reconnect.
class LightOverride {
  int64_t expires_ = 0;
  bool session_scoped_ = false;

public:
  void start(int64_t expires, bool session_busy) {
    expires_ = expires;
    session_scoped_ = session_busy;
  }
  bool active(int64_t now, bool session_busy) {
    if (now >= expires_ || (session_scoped_ && !session_busy))
      expires_ = 0;
    return now < expires_;
  }
};

// These tools accept flat objects only. Reject nesting before cJSON recurses
// on the device's small worker stack, including malformed model arguments.
inline cJSON *parse_arguments(const char *text) {
  if (!text)
    return nullptr;
  unsigned depth = 0;
  bool quoted = false, escaped = false;
  size_t length = 0;
  for (; text[length]; ++length) {
    if (length == 512)
      return nullptr;
    const char c = text[length];
    if (quoted) {
      if (escaped)
        escaped = false;
      else if (c == '\\')
        escaped = true;
      else if (c == '"')
        quoted = false;
    } else if (c == '"') {
      quoted = true;
    } else if (c == '[' || (c == '{' && ++depth > 1)) {
      return nullptr;
    } else if (c == '}') {
      if (!depth)
        return nullptr;
      --depth;
    }
  }
  return cJSON_ParseWithOpts(text, nullptr, true);
}

inline bool integer(const cJSON *obj, const char *name, int lo, int hi,
                    int &value) {
  const auto *item = cJSON_GetObjectItemCaseSensitive(obj, name);
  if (!cJSON_IsNumber(item) || !std::isfinite(item->valuedouble) ||
      item->valuedouble < lo || item->valuedouble > hi ||
      std::floor(item->valuedouble) != item->valuedouble)
    return false;
  value = int(item->valuedouble);
  return true;
}
inline bool keys(const cJSON *obj, const char *const *names, unsigned count) {
  if (!cJSON_IsObject(obj) || cJSON_GetArraySize(obj) != int(count))
    return false;
  for (unsigned i = 0; i < count; ++i) {
    unsigned matches = 0;
    for (auto *item = obj->child; item; item = item->next)
      if (item->string && !strcmp(item->string, names[i]))
        ++matches;
    if (matches != 1)
      return false;
  }
  return true;
}
} // namespace mosaico
