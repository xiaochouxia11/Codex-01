#ifndef LIVE_ESP32_H
#define LIVE_ESP32_H
#include "esp_err.h"
#include "live_transcript.h"
#include "live_usage.h"
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
/* Application-owned configuration must outlive this process-lifetime
 * controller. The controller owns peer lifecycle, events, and core calls;
 * the controller also sends queued microphone packets on that same thread.
 * Audio callbacks run on separate tasks and must return within one second,
 * including during shutdown. read/write exchange 24 kHz, signed 16-bit mono
 * PCM. */
typedef struct {
  const char *api_key;
  const char *model;
  const char *responses_model;
  void *context;
  esp_err_t (*audio_open)(void *context);
  void (*audio_close)(void *context);
  esp_err_t (*read)(void *context, int16_t *pcm, size_t samples);
  esp_err_t (*write)(void *context, const int16_t *pcm, size_t samples);
  const char *responses_service_tier;
  const char *responses_instructions;
  bool responses_web_search;
  /* Optional, nonblocking monotonic hardware-output starvation counter. The
   * adapter must keep it valid until audio_close; uint32_t wrap is supported.
   */
  uint32_t (*output_starvations)(void *context);
  /* Optional frontend prompt. NULL preserves the voice-only default. */
  const char *instructions;
  /* Optional on-demand capture_photo tool. Runs on a separate low-priority
   * task, never on audio/peer tasks. Must return within three seconds, write
   * a complete JPEG within capacity, and release camera resources on failure.
   * Context has process lifetime; a result finishing after Stop is discarded.
   */
  esp_err_t (*capture_photo)(void *context, uint8_t *jpeg, size_t capacity,
                             size_t *length);
  /* Optional board function tools (JSON array, combined with capture_photo).
   * Only declared names are dispatched. Arguments are limited to 512 bytes;
   * the callback must validate their schema and write a NUL-terminated text
   * result within capacity. Runs serially with photos on the low-priority
   * worker, must finish within five seconds, and must poll cancelled before
   * hardware effects and at least every 50 ms during movement. Stop, failed
   * sessions, and superseded delegations cancel outstanding work. Returning
   * ESP_OK reports success; other codes produce an explicit tool failure.
   * No API calls are allowed from the callback. NULL preserves old behavior.
   */
  const char *tools_json;
  esp_err_t (*execute_tool)(void *context, const char *name,
                            const char *arguments, char *result,
                            size_t capacity, bool (*cancelled)(void *),
                            void *cancel_context);
  /* Optional short welcome (1..256 bytes). Submitted as frontend spoken
   * context once after session.started, never during shutdown. The model may
   * paraphrase; NULL preserves existing startup behavior. No backend call is
   * needed. */
  const char *greeting;
  /* Optional PCM priming reserve in milliseconds, 20..300. Zero keeps the
   * 120 ms default. Larger reserves trade startup latency for burst tolerance.
   */
  uint32_t playout_buffer_ms;
} live_esp32_config_t;
typedef enum {
  LIVE_STARTUP_CONTROL,
  LIVE_STARTUP_PEER_CREATED,
  LIVE_STARTUP_OFFER_READY,
  LIVE_STARTUP_HTTPS_CONNECTED,
  LIVE_STARTUP_REQUEST_SENT,
  LIVE_STARTUP_RESPONSE_HEADERS,
  LIVE_STARTUP_RESPONSE_BODY,
  LIVE_STARTUP_AUDIO_READY,
  LIVE_STARTUP_ICE_PAIRED,
  LIVE_STARTUP_DTLS_CONNECTED,
  LIVE_STARTUP_SCTP_CONNECTED,
  LIVE_STARTUP_DATA_CHANNEL_OPEN,
  LIVE_STARTUP_SESSION_STARTED,
  LIVE_STARTUP_FIRST_AUDIO_RX,
  LIVE_STARTUP_FIRST_PLAYBACK,
  LIVE_STARTUP_STAGE_COUNT
} live_startup_stage_t;
typedef struct {
  bool busy, active, muted, finalized;
  bool preconnect_ready, preconnect_pending, https_preconnected;
  uint32_t sent_packets, received_packets, played_samples, dropped_packets;
  uint32_t tx_queue_drops, rx_queue_drops, send_errors;
  uint32_t peer_poll_max_us, peer_poll_over_20ms;
  uint32_t control_cycle_max_us, control_cycle_over_20ms;
  uint32_t peer_send_max_us, peer_send_over_20ms;
  uint32_t encode_max_us, decode_max_us, playback_wait_timeouts;
  uint32_t rx_queue_age_max_us, speaker_write_max_us;
  uint32_t speaker_dma_empty_events, playout_rebuffers, playout_target_ms;
  uint32_t decoded_peak, decoded_near_full_scale_samples;
  uint32_t mic_peak;
  char status[128];
  char session_id[128];
  uint32_t transcript_revision;
  live_usage_t usage;
  bool startup_available;
  /* Milliseconds since Start was accepted; UINT32_MAX means not reached.
   * Retained after Stop, until the next session or audio diagnostic. */
  uint32_t startup_ms[LIVE_STARTUP_STAGE_COUNT];
  /* True only while attempting/running a network session. Local diagnostics
   * also report busy, but must remain usable without Wi-Fi. */
  bool network_required;
  bool photo_busy;
  uint32_t photos_captured, photo_errors, photo_capture_max_us,
      photo_send_max_us;
  bool tool_busy;
  uint32_t tool_calls, tool_errors, tool_max_us;
  /* Most recent nonempty transcript delta, independent of caption block
   * order. Observe transcript_revision for changes; transcript_has_text is
   * false after a transcript reset. */
  bool transcript_has_text;
  live_speaker_t transcript_speaker;
} live_esp32_status_t;
/* Initialize once. start/stop/mute are nonblocking and safe on the GUI task. */
esp_err_t live_esp32_init(const live_esp32_config_t *config);
esp_err_t live_esp32_start(void);
/* Three-second local microphone/speaker diagnostic; creates no API session. */
esp_err_t live_esp32_audio_test(void);
/* Local Opus/playback test with deterministic receive jitter; no API session.
 */
esp_err_t live_esp32_jitter_test(void);
/* Severe local jitter: 480 ms arrival holds followed by 25-packet bursts.
 * Uses temporary PSRAM for encoded test audio; creates no API session. */
esp_err_t live_esp32_burst_test(void);
/* Apply to the next session/diagnostic. Enabled by default (120 ms maximum
 * priming wait). Disabling is useful for controlled latency/underrun tests. */
void live_esp32_playout_buffer(bool enabled);
/* Five local peer init/offer/destroy/shutdown cycles; no signaling or audio. */
esp_err_t live_esp32_peer_test(void);
/* Exercise capture/JPEG while idle or during audio, without an API request.
 * Idle tests emit the JPEG as base64 over USB for visual verification. Active
 * tests log timing only. Never emits image bytes during voice playback. */
esp_err_t live_esp32_photo_test(void);
void live_esp32_stop(void);
void live_esp32_mute(bool muted);
/* Opt-in idle TLS warmup. Enable while the voice UI is open; disable when it
 * closes. Creates no API session and sends no HTTP request or credentials.
 * Call network_changed on each IP acquisition/change and loss, even if a rapid
 * reconnect returns to the same IP. Both calls are nonblocking and may precede
 * init. Start remains usable while warmup is pending or unavailable. */
void live_esp32_preconnect(bool enabled);
void live_esp32_network_changed(bool available);
void live_esp32_status(live_esp32_status_t *status);
void live_esp32_transcripts(live_transcript_t *transcripts);
void live_esp32_log_startup(void);
/* USB diagnostics only: task sampling briefly suspends the scheduler. */
void live_esp32_log_diagnostics(void);
#ifdef __cplusplus
}
#endif
#endif
