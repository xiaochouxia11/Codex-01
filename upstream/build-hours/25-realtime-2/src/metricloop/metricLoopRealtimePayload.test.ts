import { describe, expect, it } from 'vitest';
import type { MetricLoopDashboardSnapshot } from './metricLoopContracts';
import {
  createMetricLoopCompactResponseContext,
  createMetricLoopContextItem,
  createMetricLoopResponsePayload,
  getInitialMetricLoopVoiceMode,
} from './metricLoopRealtimePayload';

const snapshot = {
  activeView: 'funnels',
  dashboardFilters: {
    interaction: 'voice_search',
    dateRange: 'last_7_days',
    comparison: 'prior_7_days',
    segment: 'first_time_shoppers',
    region: 'europe',
    teamAge: 'first_time',
    trafficSource: 'all',
    excludePaidAds: true,
    browser: 'mobile_safari',
    device: 'mobile',
    productCategory: 'footwear',
    event: 'activation',
    breakdown: 'browser',
    chartType: 'funnel',
  },
  selectedReplayId: 'RPL-4821',
  capturedAtIso: '2026-05-13T20:00:00.000Z',
  board: {
    scopedReport: {
      title: 'Current view report',
      summary: 'Mobile Safari first-time shoppers in Europe show the sharpest activation drop.',
      hypotheses: [
        {
          label: 'Size selection persistence',
          status: 'primary',
          confidence: 'High',
          evidence: 'Replay shows selected size not persisted before add to cart.',
          nextStep: 'Patch PDP state persistence.',
        },
        {
          label: 'Paid ads quality',
          status: 'ruled_out',
          confidence: 'Medium',
          evidence: 'Drop remains after paid ads are excluded.',
          nextStep: 'Keep excluded while validating fix.',
        },
        {
          label: 'Search intent drift',
          status: 'watch',
          confidence: 'Low',
          evidence: 'No matching shift in search terms.',
          nextStep: 'Monitor next weekly cohort.',
        },
      ],
    },
    dropOffStep: {
      step: 'shoe_size_selected',
      label: 'Size selected',
      delta: -12.4,
      currentRate: 42.1,
      previousRate: 54.5,
    },
  },
} as MetricLoopDashboardSnapshot;

describe('createMetricLoopResponsePayload', () => {
  it('requests text-only responses for action turns', () => {
    expect(createMetricLoopResponsePayload({ mode: 'action', shouldSpeak: false })).toMatchObject({
      type: 'response.create',
      response: { output_modalities: ['text'] },
    });
  });

  it('requests audio responses for wake-word explanation turns', () => {
    expect(createMetricLoopResponsePayload({ mode: 'explain', shouldSpeak: true })).toMatchObject({
      type: 'response.create',
      response: { output_modalities: ['audio'] },
    });
  });

  it('keeps response payload state out of instructions', () => {
    const context = createMetricLoopCompactResponseContext(snapshot);
    const payload = createMetricLoopResponsePayload(
      { mode: 'action', shouldSpeak: false },
      context,
    );

    expect(payload.response).not.toHaveProperty('instructions');
  });

  it('creates compact current-view context as a system conversation item', () => {
    const context = createMetricLoopCompactResponseContext(snapshot);
    const item = createMetricLoopContextItem(context);
    const serializedItem = JSON.stringify(item);

    expect(item).toMatchObject({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'system',
      },
    });
    expect(serializedItem).toContain('Current MetricLoop dashboard context');
    expect(serializedItem).toContain('first_time_shoppers');
    expect(serializedItem).toContain('Mobile Safari first-time shoppers');
    expect(serializedItem).toContain('Size selection persistence');
    expect(serializedItem).not.toContain('Replay shows selected size not persisted');
    expect(serializedItem).not.toContain('safeTargets');
    expect(serializedItem.length).toBeLessThan(2200);
  });
});

describe('getInitialMetricLoopVoiceMode', () => {
  it('uses wake-word mode by default', () => {
    expect(getInitialMetricLoopVoiceMode('')).toBe('wake_word');
  });

  it('uses action-only mode from the fallback query param', () => {
    expect(getInitialMetricLoopVoiceMode('?voice=action-only')).toBe('action_only');
  });
});
