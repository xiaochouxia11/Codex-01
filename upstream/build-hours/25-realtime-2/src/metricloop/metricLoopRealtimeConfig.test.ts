import { describe, expect, it } from 'vitest';
import {
  METRIC_LOOP_REALTIME_TURN_DETECTION,
  createMetricLoopRealtimeSessionConfig,
} from './metricLoopRealtimeConfig';

describe('MetricLoop realtime config', () => {
  it('disables automatic VAD response creation before the data channel opens', () => {
    const session = createMetricLoopRealtimeSessionConfig();

    expect(METRIC_LOOP_REALTIME_TURN_DETECTION).toMatchObject({
      type: 'semantic_vad',
      create_response: false,
    });
    expect(session.audio.input.turn_detection).toMatchObject({
      type: 'semantic_vad',
      create_response: false,
    });
  });

  it('exposes the cohort forensics tools to the Realtime analyst', () => {
    const session = createMetricLoopRealtimeSessionConfig();
    const tools = session.tools as Array<{ name: string }>;
    const toolNames = tools.map((tool) => tool.name);

    expect(toolNames).toEqual(expect.arrayContaining([
      'get_analytics_schema',
      'run_cohort_query',
      'run_instrumentation_check',
      'run_analysis_code',
      'render_forensics_chart',
      'apply_forensics_result',
    ]));
  });

  it('tells Lighthouse to use cohort forensics before assigning hard causes', () => {
    const session = createMetricLoopRealtimeSessionConfig();

    expect(session.instructions).toContain('For hard proof-oriented questions');
    expect(session.instructions).toContain('run_cohort_query');
    expect(session.instructions).toContain('run_analysis_code');
  });

  it('tells spoken Lighthouse replies to start with the answer instead of a speaker label', () => {
    const session = createMetricLoopRealtimeSessionConfig();

    expect(session.instructions).toContain(
      'For this spoken reply, begin with the answer itself. Do not say "Lighthouse" or any speaker label.',
    );
  });
});
