import type { MetricLoopTurnPolicy } from './metricLoopContracts';

export const METRIC_LOOP_WAKE_WORD = 'Lighthouse';

const metricLoopWakeWord = /\blight[\s-]*house\b/i;

export function classifyMetricLoopTurn(
  text: string,
  options: { actionOnly?: boolean } = {},
): MetricLoopTurnPolicy {
  const shouldSpeak = !options.actionOnly && metricLoopWakeWord.test(text);

  return {
    mode: shouldSpeak ? 'explain' : 'action',
    shouldSpeak,
  };
}
