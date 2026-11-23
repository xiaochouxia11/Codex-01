#include "live.h"

#include <ctype.h>
#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "cJSON.h"

enum inference_state {
  INFERENCE_AWAKE,
  INFERENCE_WAITING_FOR_SPEECH,
  INFERENCE_PAUSED,
};

struct live_session {
  cJSON *config;
  live_send_fn send;
  live_event_fn on_event;
  void *context;
  live_state_t state;
  uint64_t sequence;
  bool busy;
  bool finalized;
  enum inference_state inference;
  char id[128];
};

static bool text_fits(const char *text, size_t maximum) {
  return text && text[0] && strlen(text) <= maximum;
}

/* Reject ambiguous discriminators and IDs instead of selecting the first. */
static const cJSON *field(const cJSON *object, const char *name) {
  if (!cJSON_IsObject(object))
    return NULL;
  const cJSON *found = NULL;
  const cJSON *child = NULL;
  cJSON_ArrayForEach(child, object) {
    if (strcmp(child->string, name) == 0) {
      if (found)
        return NULL;
      found = child;
    }
  }
  return found;
}

static const char *string_field(const cJSON *object, const char *name) {
  const cJSON *value = field(object, name);
  return cJSON_IsString(value) ? value->valuestring : NULL;
}

static live_result_t parse_value(const char *json, size_t length, cJSON **out) {
  *out = NULL;
  if (!json || !length)
    return LIVE_INVALID_ARGUMENT;
  if (length > LIVE_MAX_JSON_BYTES)
    return LIVE_LIMIT_EXCEEDED;
  /* Bound recursion before cJSON allocates a tree or descends into it. */
  unsigned depth = 0;
  bool quoted = false, escaped = false;
  for (size_t i = 0; i < length; ++i) {
    unsigned char c = (unsigned char)json[i];
    if (!c)
      return LIVE_INVALID_JSON;
    if (quoted) {
      if (c < 0x20)
        return LIVE_INVALID_JSON;
      if (escaped)
        escaped = false;
      else if (c == '\\') {
        /* cJSON strings are NUL-terminated: reject decoded NULs so
         * an event discriminator or session ID cannot be truncated. */
        if (length - i >= 6 && !memcmp(json + i, "\\u0000", 6))
          return LIVE_INVALID_JSON;
        escaped = true;
      } else if (c == '"')
        quoted = false;
    } else if (c == '"')
      quoted = true;
    else if (c == '{' || c == '[') {
      if (++depth > 32)
        return LIVE_LIMIT_EXCEEDED;
    } else if (c == '}' || c == ']') {
      if (!depth)
        return LIVE_INVALID_JSON;
      --depth;
    }
  }
  if (depth || quoted)
    return LIVE_INVALID_JSON;
  const char *end = NULL;
  cJSON *root = cJSON_ParseWithLengthOpts(json, length, &end, false);
  if (!root)
    return LIVE_INVALID_JSON;
  while (end < json + length && isspace((unsigned char)*end))
    ++end;
  if (end != json + length) {
    cJSON_Delete(root);
    return LIVE_INVALID_JSON;
  }
  *out = root;
  return LIVE_OK;
}

static live_result_t parse(const char *json, size_t length, cJSON **out) {
  live_result_t result = parse_value(json, length, out);
  if (result == LIVE_OK && !cJSON_IsObject(*out)) {
    cJSON_Delete(*out);
    *out = NULL;
    return LIVE_INVALID_JSON;
  }
  return result;
}

static bool function_tools_valid(const cJSON *tools) {
  if (!cJSON_IsArray(tools) || cJSON_GetArraySize(tools) < 1 ||
      cJSON_GetArraySize(tools) > 8)
    return false;
  const cJSON *tool;
  cJSON_ArrayForEach(tool, tools) {
    const char *type = string_field(tool, "type");
    const char *name = string_field(tool, "name");
    if (!type || strcmp(type, "function") || !text_fits(name, 64) ||
        !cJSON_IsObject(field(tool, "parameters")))
      return false;
    for (const cJSON *prior = tools->child; prior != tool; prior = prior->next)
      if (!strcmp(name, string_field(prior, "name")))
        return false;
  }
  return true;
}

/* Session input is shared with delegated Responses calls. Seed one stable
 * developer message before any conversational history. */
static bool add_developer_message(cJSON *session, const char *text) {
  cJSON *input = cJSON_AddArrayToObject(session, "input");
  cJSON *message = input ? cJSON_CreateObject() : NULL;
  if (!message || !cJSON_AddItemToArray(input, message)) {
    cJSON_Delete(message);
    return false;
  }
  cJSON *content = cJSON_AddArrayToObject(message, "content");
  cJSON *part = content ? cJSON_CreateObject() : NULL;
  if (!part || !cJSON_AddItemToArray(content, part)) {
    cJSON_Delete(part);
    return false;
  }
  return cJSON_AddStringToObject(message, "type", "message") &&
         cJSON_AddStringToObject(message, "role", "developer") &&
         cJSON_AddStringToObject(part, "type", "input_text") &&
         cJSON_AddStringToObject(part, "text", text);
}

static live_result_t copy_json(const cJSON *root, char *out, size_t capacity) {
  char *encoded = cJSON_PrintUnformatted(root);
  if (!encoded)
    return LIVE_OUT_OF_MEMORY;
  size_t size = strlen(encoded) + 1;
  live_result_t result = size > LIVE_MAX_JSON_BYTES ? LIVE_LIMIT_EXCEEDED
                         : size > capacity          ? LIVE_BUFFER_TOO_SMALL
                                                    : LIVE_OK;
  if (result == LIVE_OK)
    memcpy(out, encoded, size);
  cJSON_free(encoded);
  return result;
}

live_result_t live_session_create(const live_config_t *config,
                                  live_session_t **out) {
  if (!out)
    return LIVE_INVALID_ARGUMENT;
  *out = NULL;
  if (!config || !config->send || !text_fits(config->model, 127) ||
      (config->instructions && strlen(config->instructions) > 4096) ||
      (config->voice && !text_fits(config->voice, 63)) ||
      (config->responses_model && !text_fits(config->responses_model, 127)) ||
      (config->responses_service_tier &&
       !text_fits(config->responses_service_tier, 31)) ||
      (config->responses_instructions &&
       strlen(config->responses_instructions) > 4096) ||
      (config->responses_tools_json &&
       !text_fits(config->responses_tools_json, 4096)) ||
      (config->idle_timeout_s &&
       (!config->wake_on_speech ||
        config->idle_timeout_s < LIVE_MIN_IDLE_TIMEOUT_S ||
        config->idle_timeout_s > LIVE_MAX_IDLE_TIMEOUT_S)) ||
      (!config->responses_model &&
       (config->responses_service_tier || config->responses_instructions ||
        config->responses_web_search || config->responses_tools_json)))
    return LIVE_INVALID_ARGUMENT;
  if (config->responses_tools_json) {
    cJSON *tools = NULL;
    live_result_t result =
        parse_value(config->responses_tools_json,
                    strlen(config->responses_tools_json), &tools);
    bool valid = result == LIVE_OK && function_tools_valid(tools);
    cJSON_Delete(tools);
    if (!valid)
      return LIVE_INVALID_ARGUMENT;
  }
  live_session_t *s = calloc(1, sizeof(*s));
  if (!s)
    return LIVE_OUT_OF_MEMORY;
  s->send = config->send;
  s->on_event = config->on_event;
  s->context = config->context;
  s->inference = config->wake_on_speech ? INFERENCE_WAITING_FOR_SPEECH
                                        : INFERENCE_AWAKE;
  s->config = cJSON_CreateObject();
  if (!s->config || !cJSON_AddStringToObject(s->config, "model", config->model))
    goto oom;
  if (config->instructions &&
      !cJSON_AddStringToObject(s->config, "instructions", config->instructions))
    goto oom;
  if (config->voice) {
    cJSON *audio = cJSON_AddObjectToObject(s->config, "audio");
    cJSON *output = audio ? cJSON_AddObjectToObject(audio, "output") : NULL;
    if (!output || !cJSON_AddStringToObject(output, "voice", config->voice))
      goto oom;
  }
  if (config->wake_on_speech) {
    cJSON *wake = cJSON_AddObjectToObject(s->config, "wake_policy");
    if (!wake || !cJSON_AddStringToObject(wake, "type", "speech") ||
        (config->idle_timeout_s &&
         !cJSON_AddNumberToObject(s->config, "idle_timeout_s",
                                  config->idle_timeout_s)))
      goto oom;
  }
  cJSON *delegation = cJSON_AddObjectToObject(s->config, "delegation");
  if (!delegation ||
      !cJSON_AddStringToObject(
          delegation, "type", config->responses_model ? "responses" : "client"))
    goto oom;
  if (config->responses_model) {
    cJSON *responses = cJSON_AddObjectToObject(delegation, "responses");
    if (!responses ||
        !cJSON_AddStringToObject(responses, "model", config->responses_model))
      goto oom;
    if (config->responses_service_tier &&
        !cJSON_AddStringToObject(responses, "service_tier",
                                 config->responses_service_tier))
      goto oom;
    if (config->responses_instructions) {
      const char *instructions = config->responses_instructions;
      const char prefix[] = "gpt-6.2-"; // Includes dated snapshots.
      if (!strncmp(config->responses_model, prefix, sizeof(prefix) - 1)) {
        if (*instructions && !add_developer_message(s->config, instructions))
          goto oom;
      } else if (!cJSON_AddStringToObject(responses, "instructions",
                                          instructions)) {
        goto oom;
      }
    }
    if (config->responses_web_search || config->responses_tools_json) {
      cJSON *tools = NULL;
      if (config->responses_tools_json)
        parse_value(config->responses_tools_json,
                    strlen(config->responses_tools_json), &tools);
      else
        tools = cJSON_CreateArray();
      if (!tools || !cJSON_AddItemToObject(responses, "tools", tools)) {
        cJSON_Delete(tools);
        goto oom;
      }
      if (!cJSON_AddStringToObject(responses, "tool_choice", "auto") ||
          (config->responses_tools_json &&
           !cJSON_AddBoolToObject(responses, "parallel_tool_calls", false)))
        goto oom;
      if (config->responses_web_search) {
        cJSON *search = cJSON_CreateObject();
        if (!search)
          goto oom;
        if (!cJSON_AddItemToArray(tools, search)) {
          cJSON_Delete(search);
          goto oom;
        }
        if (!cJSON_AddStringToObject(search, "type", "web_search"))
          goto oom;
      }
    }
  }
  *out = s;
  return LIVE_OK;
oom:
  cJSON_Delete(s->config);
  free(s);
  return LIVE_OUT_OF_MEMORY;
}

live_result_t live_session_destroy(live_session_t *s) {
  if (!s)
    return LIVE_OK;
  if (s->busy)
    return LIVE_BUSY;
  cJSON_Delete(s->config);
  free(s);
  return LIVE_OK;
}

live_state_t live_session_state(const live_session_t *s) {
  return s ? s->state : LIVE_CLOSED;
}
const char *live_session_id(const live_session_t *s) { return s ? s->id : ""; }
bool live_session_finalized(const live_session_t *s) {
  return s && s->finalized;
}

live_result_t live_session_offer(live_session_t *s, const char *sdp, char *out,
                                 size_t capacity) {
  if (!s || !out || !capacity || !text_fits(sdp, LIVE_MAX_SDP_BYTES))
    return LIVE_INVALID_ARGUMENT;
  if (s->busy)
    return LIVE_BUSY;
  if (s->state != LIVE_NEW)
    return LIVE_INVALID_STATE;
  cJSON *root = cJSON_CreateObject();
  cJSON *config = cJSON_Duplicate(s->config, true);
  if (!root || !config) {
    cJSON_Delete(root);
    cJSON_Delete(config);
    return LIVE_OUT_OF_MEMORY;
  }
  if (!cJSON_AddItemToObject(root, "session", config)) {
    cJSON_Delete(config);
    cJSON_Delete(root);
    return LIVE_OUT_OF_MEMORY;
  }
  cJSON *transport = cJSON_AddObjectToObject(root, "transport");
  live_result_t result = LIVE_OUT_OF_MEMORY;
  if (transport && cJSON_AddStringToObject(transport, "type", "webrtc") &&
      cJSON_AddStringToObject(transport, "sdp", sdp))
    result = copy_json(root, out, capacity);
  cJSON_Delete(root);
  if (result == LIVE_OK)
    s->state = LIVE_SIGNALING;
  return result;
}

live_result_t live_session_answer(live_session_t *s, int status,
                                  const char *json, size_t length,
                                  char *sdp_out, size_t capacity) {
  if (!s || !sdp_out || !capacity)
    return LIVE_INVALID_ARGUMENT;
  if (s->busy)
    return LIVE_BUSY;
  if (s->state != LIVE_SIGNALING)
    return LIVE_INVALID_STATE;
  if (status != 201)
    return LIVE_HTTP_ERROR;
  cJSON *root = NULL;
  live_result_t result = parse(json, length, &root);
  if (result != LIVE_OK)
    return result;
  const char *id = string_field(field(root, "session"), "id");
  const cJSON *transport = field(root, "transport");
  const char *kind = string_field(transport, "type");
  const char *sdp = string_field(transport, "sdp");
  if (!text_fits(id, sizeof(s->id) - 1) || !kind || strcmp(kind, "webrtc") ||
      !text_fits(sdp, LIVE_MAX_SDP_BYTES))
    result = LIVE_INVALID_JSON;
  else if (strlen(sdp) + 1 > capacity)
    result = LIVE_BUFFER_TOO_SMALL;
  else {
    strcpy(sdp_out, sdp);
    strcpy(s->id, id);
    s->state = LIVE_WAITING;
  }
  cJSON_Delete(root);
  return result;
}

bool live_session_in_standby(const live_session_t *s) {
  return s && s->state == LIVE_ACTIVE && s->inference != INFERENCE_AWAKE;
}

live_result_t live_session_receive(live_session_t *s, const char *json,
                                   size_t length) {
  if (!s)
    return LIVE_INVALID_ARGUMENT;
  if (s->busy)
    return LIVE_BUSY;
  if (s->state != LIVE_WAITING && s->state != LIVE_ACTIVE &&
      s->state != LIVE_CLOSING)
    return LIVE_INVALID_STATE;
  cJSON *root = NULL;
  live_result_t result = parse(json, length, &root);
  if (result != LIVE_OK)
    return result;
  const char *type = string_field(root, "type");
  if (!text_fits(type, 127)) {
    result = LIVE_INVALID_JSON;
    goto done;
  }
  if (!strcmp(type, "session.started") || !strcmp(type, "session.closed")) {
    const char *id = string_field(field(root, "session"), "id");
    if (!id || strcmp(id, s->id)) {
      result = LIVE_INVALID_JSON;
      goto done;
    }
    if (!strcmp(type, "session.started")) {
      if (s->state == LIVE_CLOSING) {
        result = LIVE_INVALID_STATE;
        goto done;
      }
      s->state = LIVE_ACTIVE;
    } else {
      if (!text_fits(string_field(root, "reason"), 127)) {
        result = LIVE_INVALID_JSON;
        goto done;
      }
      s->state = LIVE_CLOSED;
      s->finalized = true;
    }
  }
  if (!strcmp(type, "session.paused") || !strcmp(type, "session.resumed")) {
    // Wake events belong to this session's authenticated data channel. They
    // carry an event ID, with no session resource.
    if (!text_fits(string_field(root, "event_id"), 127)) {
      result = LIVE_INVALID_JSON;
      goto done;
    }
    s->inference = !strcmp(type, "session.paused") ? INFERENCE_PAUSED
                                                   : INFERENCE_AWAKE;
  } else if (s->inference == INFERENCE_WAITING_FOR_SPEECH &&
             (!strcmp(type, "session.input_transcript.delta") ||
              !strcmp(type, "session.output_transcript.delta"))) {
    // An opening turn can occur before the server's first pause/resume cycle.
    const char *delta = string_field(root, "delta");
    if (delta && *delta)
      s->inference = INFERENCE_AWAKE;
  }
  if (s->on_event) {
    s->busy = true;
    s->on_event(s->context, type, json, length);
    s->busy = false;
  }
done:
  cJSON_Delete(root);
  return result;
}

static live_result_t send_command(live_session_t *s, const char *type) {
  if (!s)
    return LIVE_INVALID_ARGUMENT;
  if (s->busy)
    return LIVE_BUSY;
  if (s->state != LIVE_ACTIVE)
    return LIVE_INVALID_STATE;
  char json[192];
  int count = snprintf(json, sizeof(json),
                       "{\"type\":\"%s\",\"event_id\":\"sdk_%" PRIu64 "\"}",
                       type, ++s->sequence);
  if (count < 0 || (size_t)count >= sizeof(json))
    return LIVE_LIMIT_EXCEEDED;
  s->busy = true;
  int status = s->send(s->context, json, (size_t)count);
  s->busy = false;
  return status == 0 ? LIVE_OK : LIVE_SEND_ERROR;
}

live_result_t live_session_mute(live_session_t *s, bool muted) {
  return send_command(s, muted ? "session.input_audio.mute"
                               : "session.input_audio.unmute");
}

live_result_t live_session_commentary(live_session_t *s, const char *text) {
  if (!s || !text || !*text)
    return LIVE_INVALID_ARGUMENT;
  if (s->busy)
    return LIVE_BUSY;
  if (s->state != LIVE_ACTIVE || s->inference != INFERENCE_AWAKE)
    return LIVE_INVALID_STATE;
  if (strlen(text) > LIVE_MAX_COMMENTARY_BYTES)
    return LIVE_LIMIT_EXCEEDED;
  char id[32];
  snprintf(id, sizeof(id), "sdk_%" PRIu64, ++s->sequence);
  cJSON *root = cJSON_CreateObject();
  if (!root ||
      !cJSON_AddStringToObject(root, "type", "session.commentary.append") ||
      !cJSON_AddStringToObject(root, "event_id", id) ||
      !cJSON_AddNullToObject(root, "delegation_id") ||
      !cJSON_AddStringToObject(root, "content", text)) {
    cJSON_Delete(root);
    return LIVE_OUT_OF_MEMORY;
  }
  char *wire = cJSON_PrintUnformatted(root);
  cJSON_Delete(root);
  if (!wire)
    return LIVE_OUT_OF_MEMORY;
  s->busy = true;
  const int status = s->send(s->context, wire, strlen(wire));
  s->busy = false;
  cJSON_free(wire);
  return status == 0 ? LIVE_OK : LIVE_SEND_ERROR;
}

static bool responses_enabled(const live_session_t *s) {
  const char *type =
      s ? string_field(field(s->config, "delegation"), "type") : NULL;
  return type && !strcmp(type, "responses");
}

live_result_t live_session_response_item(live_session_t *s, const char *json,
                                         size_t length) {
  if (!s)
    return LIVE_INVALID_ARGUMENT;
  if (s->busy)
    return LIVE_BUSY;
  if (s->state != LIVE_ACTIVE || !responses_enabled(s))
    return LIVE_INVALID_STATE;
  cJSON *item = NULL;
  live_result_t result = parse(json, length, &item);
  if (result != LIVE_OK)
    return result;
  if (!text_fits(string_field(item, "type"), 127)) {
    cJSON_Delete(item);
    return LIVE_INVALID_JSON;
  }
  cJSON_Delete(item);
  // Preserve the validated item instead of creating another copy of a large
  // base64 image in cJSON's serializer. The incoming JSON bound is unchanged.
  char prefix[128];
  int n =
      snprintf(prefix, sizeof(prefix),
               "{\"type\":\"response.item.create\",\"event_id\":\"sdk_%" PRIu64
               "\",\"item\":",
               ++s->sequence);
  if (n < 0 || (size_t)n >= sizeof(prefix) ||
      length + (size_t)n + 2 > LIVE_MAX_JSON_BYTES)
    return LIVE_LIMIT_EXCEEDED;
  size_t bytes = (size_t)n + length + 1;
  char *wire = malloc(bytes + 1);
  if (!wire)
    return LIVE_OUT_OF_MEMORY;
  memcpy(wire, prefix, (size_t)n);
  memcpy(wire + n, json, length);
  wire[bytes - 1] = '}';
  wire[bytes] = 0;
  s->busy = true;
  result = s->send(s->context, wire, bytes) == 0 ? LIVE_OK : LIVE_SEND_ERROR;
  s->busy = false;
  free(wire);
  return result;
}

live_result_t live_session_response_create(live_session_t *s) {
  if (!s)
    return LIVE_INVALID_ARGUMENT;
  if (!responses_enabled(s))
    return LIVE_INVALID_STATE;
  return send_command(s, "response.create");
}

live_result_t live_session_close(live_session_t *s) {
  live_result_t result = send_command(s, "session.close");
  if (result == LIVE_OK)
    s->state = LIVE_CLOSING;
  return result;
}

live_result_t live_session_transport_closed(live_session_t *s) {
  if (!s)
    return LIVE_INVALID_ARGUMENT;
  if (s->busy)
    return LIVE_BUSY;
  s->state = LIVE_CLOSED;
  return LIVE_OK;
}
