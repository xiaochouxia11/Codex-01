#pragma once

#include "cJSON.h"
#include "live.h"
#include <array>
#include <cctype>
#include <cstdint>
#include <cstdio>
#include <cstring>

// No ESP-IDF dependencies: the wire format and continuation state are tested
// on the host. A photo stays below the existing 16 KiB control-message limit.
namespace live_photo {
constexpr size_t MAX_JPEG_BYTES = 10 * 1024;
constexpr size_t MAX_CALLS = 8;
constexpr unsigned MAX_CAPTURES_PER_SESSION = 32;
constexpr char TOOL_JSON[] =
    R"([{"type":"function","name":"capture_photo","description":"Capture a fresh photo from the device's front-facing camera. Use for questions about what the user is showing, objects, or visible text. This is a single snapshot, not a continuous view.","parameters":{"type":"object","properties":{},"required":[],"additionalProperties":false},"strict":true}])";

inline bool empty_arguments(const char *s) {
  if (!s || strlen(s) > 128)
    return false;
  auto space = [&] {
    while (*s && std::isspace(static_cast<unsigned char>(*s)))
      ++s;
  };
  space();
  if (*s++ != '{')
    return false;
  space();
  if (*s++ != '}')
    return false;
  space();
  return !*s;
}

struct Call {
  char id[65]{};
  char name[65]{}, arguments[513]{};
  const char *error = nullptr;
  bool started = false, submitted = false;
};

enum class Added { accepted, duplicate, invalid, full };
struct Batch {
  std::array<Call, MAX_CALLS> calls{};
  char response[129]{};
  char delegation[129]{};
  size_t count = 0;
  uint64_t generation = 0;
  bool sealed = false, continued = false, cancelled = false;

  void clear_response() {
    ++generation;
    calls = {};
    response[0] = 0;
    count = 0;
    sealed = continued = cancelled = false;
  }
  void clear() {
    clear_response();
    delegation[0] = 0;
  }
  bool set_delegation(const char *id) {
    if (!id || !*id || strlen(id) >= sizeof(delegation))
      return false;
    if (!strcmp(delegation, id))
      return true;
    clear();
    snprintf(delegation, sizeof(delegation), "%s", id);
    return true;
  }
  bool matches(const char *id) const {
    return id && *id && !strcmp(delegation, id);
  }
  void cancel() {
    ++generation;
    calls = {};
    count = 0;
    sealed = continued = cancelled = true;
    // Retain IDs so trailing events from this cancelled stream stay ignored.
  }
  bool begin(const char *id) {
    if (!id || !*id || strlen(id) >= sizeof(response))
      return false;
    if (!strcmp(response, id))
      return true; // Duplicate creation is harmless.
    clear_response();
    snprintf(response, sizeof(response), "%s", id);
    return true;
  }
  Added add(const char *id, const char *reason,
            const char *name = "capture_photo", const char *arguments = "{}") {
    if (!response[0] || !id || !*id || strlen(id) >= sizeof(Call::id) ||
        !name || !*name || strlen(name) >= sizeof(Call::name) || !arguments ||
        strlen(arguments) >= sizeof(Call::arguments))
      return Added::invalid;
    for (size_t i = 0; i < count; ++i)
      if (!strcmp(calls[i].id, id))
        return Added::duplicate;
    if (sealed || continued)
      return Added::invalid;
    if (count == calls.size())
      return Added::full;
    auto &call = calls[count++];
    snprintf(call.id, sizeof(call.id), "%s", id);
    call.error = reason;
    snprintf(call.name, sizeof(call.name), "%s", name);
    snprintf(call.arguments, sizeof(call.arguments), "%s", arguments);
    return Added::accepted;
  }
  bool complete(const char *id) {
    if (!id || !response[0] || strcmp(response, id))
      return false;
    sealed = true;
    return true;
  }
  Call *next() {
    for (size_t i = 0; i < count; ++i)
      if (!calls[i].started && !calls[i].submitted)
        return &calls[i];
    return nullptr;
  }
  bool submitted(const char *id) {
    for (size_t i = 0; i < count; ++i)
      if (!strcmp(calls[i].id, id)) {
        calls[i].submitted = true;
        return true;
      }
    return false;
  }
  bool ready() const {
    if (!sealed || !count || continued)
      return false;
    for (size_t i = 0; i < count; ++i)
      if (!calls[i].submitted)
        return false;
    return true;
  }
};

inline size_t output(const char *call_id, const uint8_t *jpeg, size_t length,
                     uint64_t captured_ms, const char *error, char *out,
                     size_t capacity) {
  if (!out || !capacity)
    return 0;
  out[0] = 0;
  if (!call_id || !*call_id || strlen(call_id) > 64)
    return 0;
  if (!error &&
      (!jpeg || length < 4 || length > MAX_JPEG_BYTES || jpeg[0] != 0xff ||
       jpeg[1] != 0xd8 || jpeg[length - 2] != 0xff || jpeg[length - 1] != 0xd9))
    return 0;
  cJSON *id = cJSON_CreateString(call_id);
  char *quoted = id ? cJSON_PrintUnformatted(id) : nullptr;
  cJSON_Delete(id);
  if (!quoted)
    return 0;
  int n;
  if (error) {
    cJSON *reason = cJSON_CreateString(error);
    char *escaped = reason ? cJSON_PrintUnformatted(reason) : nullptr;
    cJSON_Delete(reason);
    n = escaped ? snprintf(out, capacity,
                           "{\"type\":\"function_call_output\",\"call_id\":%s,"
                           "\"output\":%s}",
                           quoted, escaped)
                : -1;
    cJSON_free(escaped);
    cJSON_free(quoted);
    if (n < 0 || size_t(n) >= capacity) {
      out[0] = 0;
      return 0;
    }
    return size_t(n);
  }
  n = snprintf(
      out, capacity,
      "{\"type\":\"function_call_output\",\"call_id\":%s,\"output\":["
      "{\"type\":\"input_text\",\"text\":\"Fresh camera snapshot, captured at "
      "Unix time %llu ms. "
      "This is a single image; request another photo if the scene changes.\"},"
      "{\"type\":\"input_image\",\"image_url\":\"data:image/jpeg;base64,",
      quoted, static_cast<unsigned long long>(captured_ms));
  cJSON_free(quoted);
  constexpr char tail[] = "\",\"detail\":\"low\"}]}";
  size_t encoded = ((length + 2) / 3) * 4;
  if (n < 0 || size_t(n) + encoded + sizeof(tail) > capacity ||
      size_t(n) + encoded + sizeof(tail) + 128 > LIVE_MAX_JSON_BYTES) {
    out[0] = 0;
    return 0;
  }
  static constexpr char alphabet[] =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  size_t at = size_t(n);
  for (size_t i = 0; i < length; i += 3) {
    uint32_t value = uint32_t(jpeg[i]) << 16;
    if (i + 1 < length)
      value |= uint32_t(jpeg[i + 1]) << 8;
    if (i + 2 < length)
      value |= jpeg[i + 2];
    out[at++] = alphabet[(value >> 18) & 63];
    out[at++] = alphabet[(value >> 12) & 63];
    out[at++] = i + 1 < length ? alphabet[(value >> 6) & 63] : '=';
    out[at++] = i + 2 < length ? alphabet[value & 63] : '=';
  }
  memcpy(out + at, tail, sizeof(tail));
  return at + sizeof(tail) - 1;
}
} // namespace live_photo
