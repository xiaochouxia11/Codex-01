import { describe, expect, it } from 'vitest';
import { classifyMetricLoopTurn } from './voiceToActionPolicy';

describe('classifyMetricLoopTurn', () => {
  it('keeps investigation requests in action mode by default', () => {
    expect(
      classifyMetricLoopTurn('Why did activation drop for first-time shoppers in Europe last week?'),
    ).toEqual({
      mode: 'action',
      shouldSpeak: false,
    });
  });

  it('switches to spoken explanation mode when Lighthouse is invoked', () => {
    expect(classifyMetricLoopTurn('Lighthouse explain the likely cause out loud')).toEqual({
      mode: 'explain',
      shouldSpeak: true,
    });

    expect(classifyMetricLoopTurn('Can you, Lighthouse, walk me through what changed?')).toEqual({
      mode: 'explain',
      shouldSpeak: true,
    });
  });

  it('allows a likely split transcription of Lighthouse mid-sentence', () => {
    expect(classifyMetricLoopTurn('Before we move on light house summarize the likely cause')).toEqual({
      mode: 'explain',
      shouldSpeak: true,
    });
  });

  it('does not use the product name as the wake phrase', () => {
    expect(classifyMetricLoopTurn('MetricLoop explain what happened')).toEqual({
      mode: 'action',
      shouldSpeak: false,
    });
  });

  it('keeps every turn silent when action-only fallback is enabled', () => {
    expect(classifyMetricLoopTurn('Lighthouse explain what happened', { actionOnly: true })).toEqual({
      mode: 'action',
      shouldSpeak: false,
    });
  });
});
