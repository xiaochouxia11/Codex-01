#pragma once
#include "photo_tool.hpp"
#include <string>

namespace live_tools {
constexpr size_t MAX_ARGUMENTS = 512, MAX_RESULT = 1024;
constexpr unsigned MAX_CALLS_PER_SESSION = 64;

// Configuration is trusted application data, but fail closed on mistakes.
// The portable core performs its own strict validation before signaling.
inline bool configure(const char *extra, bool photo, std::string &wire) {
  wire.clear();
  if (extra && strlen(extra) > 4096)
    return false;
  cJSON *all = cJSON_Parse(photo ? live_photo::TOOL_JSON : "[]");
  const char *end = nullptr;
  cJSON *list = extra ? cJSON_ParseWithOpts(extra, &end, true) : nullptr;
  bool ok =
      all && (!extra || (cJSON_IsArray(list) && cJSON_GetArraySize(list)));
  for (auto *item = list ? list->child : nullptr; ok && item;
       item = item->next) {
    auto *type = cJSON_GetObjectItemCaseSensitive(item, "type");
    auto *name = cJSON_GetObjectItemCaseSensitive(item, "name");
    auto *params = cJSON_GetObjectItemCaseSensitive(item, "parameters");
    ok = cJSON_IsString(type) && !strcmp(type->valuestring, "function") &&
         cJSON_IsString(name) && *name->valuestring &&
         strlen(name->valuestring) <= 64 && cJSON_IsObject(params) &&
         strcmp(name->valuestring, "capture_photo");
    if (!ok)
      break;
    for (auto *existing = all->child; existing; existing = existing->next) {
      auto *n = cJSON_GetObjectItemCaseSensitive(existing, "name");
      if (!strcmp(n->valuestring, name->valuestring))
        ok = false;
    }
    cJSON *copy = ok ? cJSON_Duplicate(item, true) : nullptr;
    if (!copy || !cJSON_AddItemToArray(all, copy)) {
      cJSON_Delete(copy);
      ok = false;
    }
  }
  if (ok && cJSON_GetArraySize(all) > 8)
    ok = false;
  if (ok && cJSON_GetArraySize(all)) {
    char *json = cJSON_PrintUnformatted(all);
    ok = json && strlen(json) <= 4096;
    if (ok)
      wire = json;
    cJSON_free(json);
  }
  cJSON_Delete(list);
  cJSON_Delete(all);
  return ok;
}

inline bool declared(const std::string &wire, const char *name) {
  if (!name || !*name)
    return false;
  cJSON *list = cJSON_Parse(wire.c_str());
  bool found = false;
  for (auto *item = list ? list->child : nullptr; item; item = item->next) {
    const auto *n = cJSON_GetObjectItemCaseSensitive(item, "name");
    found |= cJSON_IsString(n) && !strcmp(n->valuestring, name);
  }
  cJSON_Delete(list);
  return found;
}
} // namespace live_tools
