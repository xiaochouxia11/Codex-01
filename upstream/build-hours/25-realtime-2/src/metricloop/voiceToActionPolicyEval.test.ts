import { describe, expect, it } from 'vitest';
import {
  METRIC_LOOP_WAKE_WORD_EVAL_CASES,
  scoreMetricLoopWakeWordPolicy,
} from './voiceToActionPolicyEval';
import { classifyMetricLoopTurn } from './voiceToActionPolicy';

describe('MetricLoop wake-word policy eval', () => {
  it('scores the deterministic client policy against the shared wake-word eval cases', () => {
    const score = scoreMetricLoopWakeWordPolicy(
      METRIC_LOOP_WAKE_WORD_EVAL_CASES,
      (transcript) => classifyMetricLoopTurn(transcript),
    );

    expect(score.total).toBeGreaterThan(8);
    expect(score.correct).toBe(score.total);
    expect(score.falseAudio).toEqual([]);
    expect(score.falseSilent).toEqual([]);
  });
});
