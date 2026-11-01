import {
  createRealtimeSessionConfig,
  type RealtimeReasoningEffort,
  type RealtimeTurnDetectionConfig,
} from '../realtimeSessionConfig';
import {
  METRIC_LOOP_REALTIME_INSTRUCTIONS,
  METRIC_LOOP_REALTIME_TOOLS,
} from './metricLoopPrompt';

export const METRIC_LOOP_REALTIME_MODEL = 'gpt-realtime-2';
export const METRIC_LOOP_REALTIME_REASONING: {
  effort: RealtimeReasoningEffort;
} = {
  effort: 'low',
};
export const METRIC_LOOP_REALTIME_TURN_DETECTION: RealtimeTurnDetectionConfig = {
  type: 'semantic_vad',
  eagerness: 'high',
  interrupt_response: false,
  create_response: false,
};

export function createMetricLoopRealtimeSessionConfig() {
  return createRealtimeSessionConfig({
    model: METRIC_LOOP_REALTIME_MODEL,
    reasoning: METRIC_LOOP_REALTIME_REASONING,
    instructions: METRIC_LOOP_REALTIME_INSTRUCTIONS,
    tools: METRIC_LOOP_REALTIME_TOOLS,
    turnDetection: METRIC_LOOP_REALTIME_TURN_DETECTION,
  });
}
