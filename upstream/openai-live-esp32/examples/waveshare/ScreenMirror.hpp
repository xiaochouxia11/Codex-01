#pragma once

namespace live_mirror {
// Initialize before starting the console reader; keeps native USB Serial/JTAG.
bool init();
// A viewer renews its five-second lease once per second.
void enable(bool on);
void keyframe();
void status();
} // namespace live_mirror
