#pragma once
#include "cJSON.h"
#include <cstring>
namespace cinema {
inline bool parse_cue(const char *arguments, char (&output)[257]) {
  output[0] = 0;
  if (!arguments || strlen(arguments) > 512 || strstr(arguments, "\\u0000"))
    return false;
  auto *root = cJSON_ParseWithOpts(arguments, nullptr, true);
  auto *query = cJSON_GetObjectItemCaseSensitive(root, "description");
  const bool valid = cJSON_IsObject(root) && root->child == query && query &&
                     !query->next && cJSON_IsString(query) &&
                     strlen(query->valuestring) >= 3 &&
                     strlen(query->valuestring) <= 256;
  if (valid)
    strcpy(output, query->valuestring);
  cJSON_Delete(root);
  return valid;
}
} // namespace cinema

namespace cinema {
inline constexpr char SCENE_TOOL[] =
    R"({"type":"function","name":"set_visual_scene","description":"Queue a silent archival association from a concrete visual description. For camera requests capture a fresh photo first. This is an illustration, not a live camera view or evidence. Queued does not mean displayed.","parameters":{"type":"object","properties":{"description":{"type":"string","description":"Brief concrete English subjects and actions to show, using positive wording.","minLength":3,"maxLength":256}},"required":["description"],"additionalProperties":false},"strict":true})";
}
