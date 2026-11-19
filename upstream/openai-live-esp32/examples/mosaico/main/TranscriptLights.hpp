#pragma once
#include "../../common/TranscriptLights.hpp"

// Preserve the existing six-LED Mosaico interface and animation.
namespace mosaico {
using LightRgb = live_example::LightRgb;
using LightMode = live_example::LightMode;
using LightFrame = live_example::LightFrame<6>;
using TranscriptLights = live_example::TranscriptLights<6>;
} // namespace mosaico
