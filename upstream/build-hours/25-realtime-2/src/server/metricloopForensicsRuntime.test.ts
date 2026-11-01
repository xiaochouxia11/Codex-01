import { describe, expect, it } from 'vitest';
import { getMetricLoopForensicsWarehouse } from '../metricloop/metricLoopForensicsData';
import { createMetricLoopForensicsRuntime } from './metricloopForensicsRuntime';
import { executeCohortQuery } from './metricloopQueryEngine';
import { runSafeMetricLoopAnalysisCode } from './metricloopSafeCodeRunner';

describe('MetricLoop forensics runtime', () => {
  it('executes a validated cohort query plan and returns a compact result reference', async () => {
    const runtime = createMetricLoopForensicsRuntime();

    const action = await runtime.runTool('forensics-session', 'run_cohort_query', {
      purpose: 'Find the cohort contributing the most lost activation.',
      query: 'SELECT browser, region, shopper_type, product_category, interaction FROM metricloop.sessions GROUP BY 1,2,3,4,5',
      queryPlan: {
        dimensions: ['browser', 'region', 'shopper_type', 'product_category', 'interaction'],
        filters: {},
        metric: 'activation_rate',
        orderBy: 'lost_activations',
        limit: 10,
      },
    });

    expect(action).toMatchObject({
      status: 'done',
      forensics: {
        kind: 'query',
        resultId: expect.stringMatching(/^cohort-/),
        rowCount: expect.any(Number),
      },
    });
    expect(action.forensics?.previewRows?.[0]).toMatchObject({
      browser: 'mobile_safari',
      region: 'europe',
      shopper_type: 'first_time_shoppers',
      product_category: 'footwear',
      interaction: 'voice_search',
    });
    expect(action.forensics?.operation).toMatchObject({
      question: 'Find the cohort contributing the most lost activation.',
      validation: expect.arrayContaining([
        expect.stringContaining('queryPlan validated'),
        expect.stringContaining('dimensions'),
      ]),
      execution: expect.arrayContaining([
        expect.stringContaining('sessions'),
        expect.stringContaining('events'),
        expect.stringContaining('cohorts'),
      ]),
    });
    expect(action.forensics?.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Cohort concentration',
        verdict: 'confirmed',
      }),
    ]));
  });

  it('runs instrumentation checks that separate event health from validation behavior', async () => {
    const runtime = createMetricLoopForensicsRuntime();

    const action = await runtime.runTool('forensics-session', 'run_instrumentation_check', {
      eventNames: ['shoe_size_selected', 'add_to_cart_clicked'],
      filters: {
        browser: 'mobile_safari',
        region: 'europe',
        shopper_type: 'first_time_shoppers',
        product_category: 'footwear',
        interaction: 'voice_search',
      },
    });

    expect(action.status).toBe('done');
    expect(action.forensics?.kind).toBe('instrumentation');
    expect(action.forensics?.summary).toContain('validation');
    expect(action.forensics?.previewRows?.[0]).toMatchObject({
      event_name: 'shoe_size_selected',
      current_count: expect.any(Number),
      prior_count: expect.any(Number),
    });
    expect(action.forensics?.operation?.validation).toEqual(expect.arrayContaining([
      expect.stringContaining('event names validated'),
    ]));
    expect(action.forensics?.operation?.execution).toEqual(expect.arrayContaining([
      expect.stringContaining('validation-state'),
    ]));
    expect(action.forensics?.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Validation-state regression',
        verdict: 'supported',
      }),
      expect.objectContaining({
        label: 'Missing instrumentation',
        verdict: 'not_supported',
      }),
    ]));
  });

  it('runs constrained analysis code over a prior query result', async () => {
    const runtime = createMetricLoopForensicsRuntime();
    const queryAction = await runtime.runTool('code-session', 'run_cohort_query', {
      query: 'SELECT cohort dimensions, activation_rate FROM metricloop.sessions',
      queryPlan: {
        dimensions: ['browser', 'region', 'shopper_type', 'product_category', 'interaction'],
        metric: 'activation_rate',
        orderBy: 'lost_activations',
        limit: 20,
      },
    });

    const resultId = queryAction.forensics?.resultId;
    const action = await runtime.runTool('code-session', 'run_analysis_code', {
      inputResultId: resultId,
      purpose: 'Rank cohorts by contribution to lost activations.',
      code: `return rows
  .map((row) => ({
    cohort: [row.browser, row.region, row.shopper_type, row.product_category, row.interaction].join(' / '),
    lost_activations: row.lost_activations,
    drop_pp: Math.round((row.prior_activation_rate - row.current_activation_rate) * 1000) / 10,
  }))
  .sort((a, b) => b.lost_activations - a.lost_activations)
  .slice(0, 5);`,
    });

    expect(action.status).toBe('done');
    expect(action.forensics).toMatchObject({
      kind: 'code',
      resultId: expect.stringMatching(/^analysis-/),
      inputResultId: resultId,
    });
    expect(action.forensics?.previewRows?.[0]).toMatchObject({
      cohort: expect.stringContaining('mobile_safari / europe / first_time_shoppers / footwear / voice_search'),
    });
    expect(action.forensics?.operation?.validation).toEqual(expect.arrayContaining([
      expect.stringContaining('unsafe globals blocked'),
    ]));
    expect(action.forensics?.operation?.execution).toEqual(expect.arrayContaining([
      expect.stringContaining('input rows'),
      expect.stringContaining('output rows'),
    ]));
  });

  it('returns needs_rewrite instead of throwing for the first invalid generated reducer', async () => {
    const runtime = createMetricLoopForensicsRuntime();
    const queryAction = await runtime.runTool('rewrite-session', 'run_cohort_query', {
      query: 'SELECT cohort dimensions, activation_rate FROM metricloop.sessions',
      queryPlan: {
        dimensions: ['browser', 'region', 'shopper_type', 'product_category', 'interaction'],
        metric: 'activation_rate',
        orderBy: 'lost_activations',
        limit: 5,
      },
    });

    const action = await runtime.runTool('rewrite-session', 'run_analysis_code', {
      inputResultId: queryAction.forensics?.resultId,
      purpose: 'Rank cohorts by lost activations.',
      code: 'const out = rows.map((row) => row);',
    });

    expect(action).toMatchObject({
      status: 'needs_rewrite',
      message: 'Generated analysis code needs a safe rewrite.',
      forensics: {
        kind: 'code_validation',
        validationError: expect.stringContaining('return'),
        rewriteInstructions: expect.stringContaining('Rewrite'),
        code: 'const out = rows.map((row) => row);',
      },
    });
    expect(action.forensics?.allowedContract).toEqual(expect.arrayContaining([
      expect.stringContaining('Return an array'),
    ]));
    expect(action.forensics?.sampleRows?.[0]).toMatchObject({
      browser: 'mobile_safari',
    });
  });

  it('uses an external model repair after the realtime rewrite also fails', async () => {
    const repairCalls: string[] = [];
    const runtime = createMetricLoopForensicsRuntime(undefined, {
      repairGeneratedCode: async (request) => {
        repairCalls.push(request.validationError);
        return `return rows
  .map((row) => ({
    cohort: [row.browser, row.region, row.shopper_type, row.product_category, row.interaction].join(' / '),
    lost_activations: Number(row.lost_activations ?? 0),
    drop_pp: Number(row.drop_pp ?? Math.round((Number(row.prior_activation_rate ?? 0) - Number(row.current_activation_rate ?? 0)) * 1000) / 10),
  }))
  .sort((a, b) => b.lost_activations - a.lost_activations)
  .slice(0, 5);`;
      },
    });
    const sessionId = 'external-repair-session';
    const queryAction = await runtime.runTool(sessionId, 'run_cohort_query', {
      query: 'SELECT cohort dimensions, activation_rate FROM metricloop.sessions',
      queryPlan: {
        dimensions: ['browser', 'region', 'shopper_type', 'product_category', 'interaction'],
        metric: 'activation_rate',
        orderBy: 'lost_activations',
        limit: 5,
      },
    });

    await runtime.runTool(sessionId, 'run_analysis_code', {
      inputResultId: queryAction.forensics?.resultId,
      purpose: 'Rank cohorts by lost activations.',
      code: 'const out = rows.map((row) => row);',
    });
    const repaired = await runtime.runTool(sessionId, 'run_analysis_code', {
      inputResultId: queryAction.forensics?.resultId,
      purpose: 'Rank cohorts by lost activations.',
      code: 'for (let i = 0; i < rows.length; i++) {} return [];',
    });

    expect(repairCalls).toHaveLength(1);
    expect(repaired).toMatchObject({
      status: 'done',
      forensics: {
        kind: 'code',
        repairSource: 'external_model',
        originalCode: 'for (let i = 0; i < rows.length; i++) {} return [];',
        repairedCode: expect.stringContaining('return rows'),
        validationError: expect.stringContaining('for-of'),
        resultId: expect.stringMatching(/^analysis-/),
      },
    });
    expect(repaired.forensics?.previewRows?.[0]).toMatchObject({
      cohort: expect.stringContaining('mobile_safari'),
    });
  });

  it('validates external repair output and falls back when the repaired code is unsafe', async () => {
    const runtime = createMetricLoopForensicsRuntime(undefined, {
      repairGeneratedCode: async () => 'return process.env;',
    });
    const sessionId = 'fallback-session';
    const queryAction = await runtime.runTool(sessionId, 'run_cohort_query', {
      query: 'SELECT cohort dimensions, activation_rate FROM metricloop.sessions',
      queryPlan: {
        dimensions: ['browser', 'region', 'shopper_type', 'product_category', 'interaction'],
        metric: 'activation_rate',
        orderBy: 'lost_activations',
        limit: 5,
      },
    });

    await runtime.runTool(sessionId, 'run_analysis_code', {
      inputResultId: queryAction.forensics?.resultId,
      purpose: 'Rank cohorts by lost activations.',
      code: 'const out = rows.map((row) => row);',
    });
    const fallback = await runtime.runTool(sessionId, 'run_analysis_code', {
      inputResultId: queryAction.forensics?.resultId,
      purpose: 'Rank cohorts by lost activations.',
      code: 'return fetch("https://example.com");',
    });

    expect(fallback).toMatchObject({
      status: 'done',
      forensics: {
        kind: 'code',
        repairSource: 'deterministic_fallback',
        fallbackExplanation: expect.stringContaining('app-owned cohort ranking fallback'),
        originalCode: 'return fetch("https://example.com");',
      },
    });
    expect(fallback.forensics?.previewRows?.[0]).toMatchObject({
      cohort: expect.stringContaining('mobile_safari'),
      lost_activations: expect.any(Number),
    });
  });

  it('blocks unsafe generated analysis code', () => {
    expect(() => runSafeMetricLoopAnalysisCode('return process.env;', [])).toThrow(/blocked/i);
    expect(() => runSafeMetricLoopAnalysisCode('return fetch("https://example.com");', [])).toThrow(/blocked/i);
  });

  it('allows local reducer setup before the generated code returns rows', () => {
    const rows = runSafeMetricLoopAnalysisCode(
      `const ranked = rows.map((row) => ({
  cohort: row.browser + ' / ' + row.region,
  lost_activations: row.lost_activations,
}));
return ranked.sort((a, b) => b.lost_activations - a.lost_activations);`,
      [
        { browser: 'chrome', region: 'europe', lost_activations: 2 },
        { browser: 'mobile_safari', region: 'europe', lost_activations: 49.3 },
      ],
    );

    expect(rows[0]).toMatchObject({
      cohort: 'mobile_safari / europe',
      lost_activations: 49.3,
    });
  });

  it('allows bounded for-of reducer code over rows or input.rows', () => {
    const firstRows = runSafeMetricLoopAnalysisCode(
      `const out = [];
for (const row of rows) {
  out.push({ cohort: row.browser + ' / ' + row.region, lost_activations: Number(row.lost_activations) });
}
return out.sort((a, b) => b.lost_activations - a.lost_activations);`,
      [
        { browser: 'chrome', region: 'europe', lost_activations: 2 },
        { browser: 'mobile_safari', region: 'europe', lost_activations: 49.3 },
      ],
    );
    const secondRows = runSafeMetricLoopAnalysisCode(
      `const out = [];
for (const row of input.rows || input) {
  out.push({ cohort: row.browser + ' / ' + row.region, lost_activations: Number(row.lost_activations) });
}
return out.sort((a, b) => b.lost_activations - a.lost_activations);`,
      [
        { browser: 'chrome', region: 'europe', lost_activations: 2 },
        { browser: 'mobile_safari', region: 'europe', lost_activations: 49.3 },
      ],
    );

    expect(firstRows[0].cohort).toBe('mobile_safari / europe');
    expect(secondRows[0].cohort).toBe('mobile_safari / europe');
  });

  it('allows generated code to create its own rows alias from input rows', () => {
    const rows = runSafeMetricLoopAnalysisCode(
      `const rows = (input && input.rows) ? input.rows : [];
if (!Array.isArray(rows)) return [];
const mapped = rows.map((row) => ({
  cohort_label: row.interaction + ' | ' + row.region + ' | ' + row.browser,
  lost_activations: Number(row.lost_activations ?? 0),
}));
return mapped.sort((a, b) => b.lost_activations - a.lost_activations).slice(0, 10);`,
      [
        { interaction: 'voice_search', browser: 'chrome', region: 'europe', lost_activations: 2 },
        { interaction: 'voice_search', browser: 'mobile_safari', region: 'europe', lost_activations: 49.3 },
      ],
    );

    expect(rows[0]).toMatchObject({
      cohort_label: 'voice_search | europe | mobile_safari',
      lost_activations: 49.3,
    });
  });

  it('renders a chart artifact from a result reference', async () => {
    const runtime = createMetricLoopForensicsRuntime();
    const queryAction = await runtime.runTool('chart-session', 'run_cohort_query', {
      query: 'SELECT browser, traffic_source, activation_rate FROM metricloop.sessions',
      queryPlan: {
        dimensions: ['browser', 'traffic_source'],
        filters: {
          region: 'europe',
          shopper_type: 'first_time_shoppers',
          product_category: 'footwear',
          interaction: 'voice_search',
        },
        metric: 'activation_rate',
        orderBy: 'lost_activations',
        limit: 8,
      },
    });

    const action = await runtime.runTool('chart-session', 'render_forensics_chart', {
      inputResultId: queryAction.forensics?.resultId,
      chartType: 'heatmap',
      title: 'Lost activations by browser and source',
      xDimension: 'browser',
      yDimension: 'traffic_source',
      valueField: 'lost_activations',
    });

    expect(action).toMatchObject({
      status: 'done',
      forensics: {
        kind: 'chart',
        chart: {
          type: 'heatmap',
          title: 'Lost activations by browser and source',
        },
      },
    });
  });

  it('applies the highest-signal forensics result to dashboard filters', async () => {
    const runtime = createMetricLoopForensicsRuntime();
    const queryAction = await runtime.runTool('apply-session', 'run_cohort_query', {
      query: 'SELECT cohort dimensions FROM metricloop.sessions ORDER BY lost_activations DESC',
      queryPlan: {
        dimensions: ['browser', 'region', 'shopper_type', 'product_category', 'interaction'],
        metric: 'activation_rate',
        orderBy: 'lost_activations',
        limit: 10,
      },
    });

    const action = await runtime.runTool('apply-session', 'apply_forensics_result', {
      inputResultId: queryAction.forensics?.resultId,
      rowIndex: 0,
    });

    expect(action).toMatchObject({
      status: 'done',
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
      forensics: {
        kind: 'dashboard_action',
      },
    });
  });
});

describe('executeCohortQuery', () => {
  it('rejects unsupported dimensions before execution', () => {
    expect(() =>
      executeCohortQuery(getMetricLoopForensicsWarehouse(), {
        dimensions: ['browser', 'not_a_dimension'],
        metric: 'activation_rate',
      }),
    ).toThrow(/unsupported dimension/i);
  });
});
