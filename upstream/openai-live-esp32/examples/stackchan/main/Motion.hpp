#pragma once
#include "esp_err.h"
#include <cstddef>
namespace stackchan {
void init();
void cancel_motion();
void diagnostic(const char *command);
esp_err_t execute_tool(void *, const char *name, const char *arguments,
                       char *result, size_t capacity, bool (*cancelled)(void *),
                       void *cancel_context);
} // namespace stackchan
