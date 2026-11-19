#ifndef OPENAI_LIVE_H
#define OPENAI_LIVE_H

#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Experimental WebRTC control-plane core. Audio travels on RTP media tracks.
 * One handle is one session; create a new handle to reconnect. All calls must
 * be serialized by the application. Callbacks may use getters, but must queue
 * mutations until they return. All callback pointers are borrowed for the call.
 */
#define LIVE_MAX_JSON_BYTES 16384
#define LIVE_MAX_SDP_BYTES 8192
#define LIVE_MAX_COMMENTARY_BYTES 256

typedef struct live_session live_session_t;
typedef enum {
  LIVE_OK = 0,
  LIVE_INVALID_ARGUMENT,
  LIVE_INVALID_STATE,
  LIVE_INVALID_JSON,
  LIVE_BUFFER_TOO_SMALL,
  LIVE_LIMIT_EXCEEDED,
  LIVE_OUT_OF_MEMORY,
  LIVE_HTTP_ERROR,
  LIVE_SEND_ERROR,
  LIVE_BUSY,
} live_result_t;

typedef enum {
  LIVE_NEW,
  LIVE_SIGNALING,
  LIVE_WAITING,
  LIVE_ACTIVE,
  LIVE_CLOSING,
  LIVE_CLOSED,
} live_state_t;

/* send must copy/consume the complete message before returning. Zero means
 * accepted by the transport; it does not mean acknowledged by the server. */
typedef int (*live_send_fn)(void *context, const char *json, size_t length);
typedef void (*live_event_fn)(void *context, const char *type, const char *json,
                              size_t length);

typedef struct {
  const char *model;           /* Required, at most 127 bytes. */
  const char *instructions;    /* Optional, at most 4096 bytes. */
  const char *voice;           /* Optional, at most 63 bytes. */
  const char *responses_model; /* Optional: selects Responses delegation. */
  live_send_fn send;
  live_event_fn on_event;
  void *context;
  /* Optional Responses settings; require responses_model. Strings are copied.
   */
  const char *responses_service_tier; /* Nonempty, at most 31 bytes. */
  const char *responses_instructions; /* At most 4096 bytes. */
  bool responses_web_search; /* Enable hosted web_search with auto tool choice.
                              */
  /* Optional JSON array of up to eight client function tools (4096 bytes).
   * Copied and validated. Client tools are requested serially. */
  const char *responses_tools_json;
} live_config_t;

/* Configuration strings are copied. context remains application-owned. */
live_result_t live_session_create(const live_config_t *config,
                                  live_session_t **out);
live_result_t live_session_destroy(live_session_t *session);
live_state_t live_session_state(const live_session_t *session);
const char *live_session_id(const live_session_t *session);
bool live_session_finalized(const live_session_t *session);

/* Builds POST /v1/live/sessions JSON. The application supplies a gathered SDP
 * offer and sends this body through an authenticated signaling transport.
 * No API key is stored by this core. Output buffers are NUL-terminated on
 * success only. Failed serialization leaves session state unchanged. */
live_result_t live_session_offer(live_session_t *session, const char *sdp,
                                 char *out, size_t capacity);
live_result_t live_session_answer(live_session_t *session, int http_status,
                                  const char *json, size_t length,
                                  char *sdp_out, size_t capacity);

/* Feed one complete data-channel JSON message. Unknown events are forwarded
 * unchanged. Commands require session.started; do not send session.start on
 * the WebRTC data channel. Incoming payloads have a 16 KiB / 32-level bound. */
live_result_t live_session_receive(live_session_t *session, const char *json,
                                   size_t length);
live_result_t live_session_mute(live_session_t *session, bool muted);
/* Append short speakable context to the frontend in an ACTIVE session.
 * Text must be nonempty and at most LIVE_MAX_COMMENTARY_BYTES. The model may
 * paraphrase or be interrupted; transport acceptance is not proof of speech.
 * No Responses delegation is needed. Call outside event callbacks. */
live_result_t live_session_commentary(live_session_t *session,
                                      const char *text);
/* Queue a Responses input item, including a multimodal function_call_output.
 * The complete wire envelope must fit LIVE_MAX_JSON_BYTES. Does not continue
 * generation; submit every pending tool result before response_create. */
live_result_t live_session_response_item(live_session_t *session,
                                         const char *item_json, size_t length);
live_result_t live_session_response_create(live_session_t *session);
live_result_t live_session_close(live_session_t *session);
/* A lost transport is CLOSED but is not successful server finalization. */
live_result_t live_session_transport_closed(live_session_t *session);

#ifdef __cplusplus
}
#endif
#endif
