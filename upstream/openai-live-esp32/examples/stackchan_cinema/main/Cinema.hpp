#pragma once
#include "esp_err.h"
#include <cstddef>
namespace cinema {
// The separate cinema app requires a matching generated pack.
void before_display();
void init();
void tick();
bool command(const char *line);
bool available();
// True for a visible idle-dream clip, not merely a queued mode change.
bool wandering();
bool pause_for_photo();
void resume_after_photo();
// Called from the existing tool worker. Enqueues a bounded cue; never does I/O.
esp_err_t cue(const char *arguments, char *result, size_t capacity);
esp_err_t library(const char *name, const char *arguments, char *result,
                  size_t capacity, bool (*cancelled)(void *), void *context);
} // namespace cinema
