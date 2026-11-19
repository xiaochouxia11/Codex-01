#pragma once
#include "driver/i2c_master.h"
namespace stackchan {
// Uses the detected base's existing handle; never changes motor power or NVS.
void lights_init(i2c_master_dev_handle_t base);
// Main/housekeeping task only, never the audio callback. Cinema supplies the
// visible playback mode; the basic voice app keeps its existing default.
void lights_poll(bool wandering = false);
bool lights_command(const char *line);
} // namespace stackchan
