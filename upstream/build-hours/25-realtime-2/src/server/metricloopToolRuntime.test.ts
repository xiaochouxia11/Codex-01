import { describe, expect, it } from 'vitest';
import { createMetricLoopToolRuntime } from './metricloopToolRuntime';

describe('createMetricLoopToolRuntime', () => {
  it('runs MetricLoop analytics tools through a server-side session runtime', async () => {
    const runtime = createMetricLoopToolRuntime();
    const sessionId = 'metricloop-test-session';

    const output = await runtime.runTool(sessionId, 'apply_filter', {
      region: 'europe',
      segment: 'first_time_shoppers',
      dateRange: 'last_7_days',
      comparison: 'prior_7_days',
    });

    expect(output.source).toBe('server');
    expect(output.action).toMatchObject({
      status: 'done',
      message: 'Applied dashboard filters.',
      dashboardFilters: {
        region: 'europe',
        segment: 'first_time_shoppers',
        dateRange: 'last_7_days',
        comparison: 'prior_7_days',
      },
    });
  });

  it('returns a report artifact id and compact summary for report generation', async () => {
    const runtime = createMetricLoopToolRuntime();

    const output = await runtime.runTool('metricloop-report-session', 'start_root_cause_investigation', {
      question: 'Why did activation drop?',
      includeCohorts: true,
      includeReleases: true,
      includeSupportTickets: true,
      includeSessionReplays: true,
    });

    expect(output.source).toBe('server');
    expect(output.action).toMatchObject({
      status: 'done',
      artifact: {
        id: expect.stringMatching(/^ml-report-/),
        status: 'ready',
      },
    });
    expect(JSON.stringify(output.action).length).toBeLessThan(60000);
  });

  it('uses the current dashboard filters supplied by the browser before report generation', async () => {
    const runtime = createMetricLoopToolRuntime();

    const output = await runtime.runTool(
      'metricloop-visible-filter-session',
      'start_root_cause_investigation',
      { question: 'Investigate the current filtered view' },
      {
        dashboardFilters: {
          interaction: 'voice_search',
          dateRange: 'last_7_days',
          comparison: 'prior_7_days',
          segment: 'first_time_shoppers',
          region: 'europe',
          productCategory: 'footwear',
          browser: 'mobile_safari',
          breakdown: 'browser',
        },
      },
    );

    expect(output.action.dashboardFilters).toMatchObject({
      interaction: 'voice_search',
      dateRange: 'last_7_days',
      comparison: 'prior_7_days',
      segment: 'first_time_shoppers',
      region: 'europe',
      productCategory: 'footwear',
      browser: 'mobile_safari',
      breakdown: 'browser',
    });
    expect(output.action.board?.filters).toMatchObject({
      dateRange: 'Last 7 days',
      region: 'Europe',
      segment: 'first-time shoppers',
    });
  });

  it('dispatches cohort forensics tools through the server runtime', async () => {
    const runtime = createMetricLoopToolRuntime();

    const output = await runtime.runTool('metricloop-forensics-session', 'run_cohort_query', {
      query: 'SELECT browser, region, shopper_type, product_category, interaction FROM metricloop.sessions',
      queryPlan: {
        dimensions: ['browser', 'region', 'shopper_type', 'product_category', 'interaction'],
        metric: 'activation_rate',
        orderBy: 'lost_activations',
        limit: 5,
      },
    });

    expect(output.source).toBe('server');
    expect(output.action.forensics).toMatchObject({
      kind: 'query',
      resultId: expect.stringMatching(/^cohort-/),
    });
    expect(output.action.forensics?.previewRows?.[0]).toMatchObject({
      browser: 'mobile_safari',
      region: 'europe',
      product_category: 'footwear',
    });
  });

  it('applies a forensics result to the live dashboard session state', async () => {
    const runtime = createMetricLoopToolRuntime();
    const sessionId = 'metricloop-forensics-apply-session';
    const queryOutput = await runtime.runTool(sessionId, 'run_cohort_query', {
      query: 'SELECT cohort dimensions FROM metricloop.sessions ORDER BY lost_activations DESC',
      queryPlan: {
        dimensions: ['browser', 'region', 'shopper_type', 'product_category', 'interaction'],
        metric: 'activation_rate',
        orderBy: 'lost_activations',
        limit: 5,
      },
    });

    const applyOutput = await runtime.runTool(sessionId, 'apply_forensics_result', {
      inputResultId: queryOutput.action.forensics?.resultId,
      rowIndex: 0,
    });

    expect(applyOutput.action.dashboardFilters).toMatchObject({
      browser: 'mobile_safari',
      region: 'europe',
      segment: 'first_time_shoppers',
      productCategory: 'footwear',
      interaction: 'voice_search',
      comparison: 'prior_7_days',
    });
    expect(runtime.getSessionSnapshot(sessionId).dashboardFilters).toMatchObject({
      browser: 'mobile_safari',
      region: 'europe',
      productCategory: 'footwear',
    });
  });
});
