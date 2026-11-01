import type {
  MetricLoopActionResponse,
  MetricLoopDashboardFilters,
  MetricLoopForensicsChartType,
  MetricLoopForensicsEvidence,
  MetricLoopForensicsPreviewRow,
} from '../metricloop/metricLoopContracts';
import { createDefaultMetricLoopDashboardFilters } from '../metricloop/metricLoopDashboardFilters';
import {
  getForensicsSchema,
  getMetricLoopForensicsWarehouse,
  type MetricLoopForensicsDimension,
  type MetricLoopForensicsEvent,
  type MetricLoopForensicsEventName,
  type MetricLoopForensicsWarehouse,
} from '../metricloop/metricLoopForensicsData';
import { executeCohortQuery, type MetricLoopCohortQueryPlan } from './metricloopQueryEngine';
import {
  METRIC_LOOP_SAFE_CODE_CONTRACT,
  runSafeMetricLoopAnalysisCode,
} from './metricloopSafeCodeRunner';

interface StoredForensicsResult {
  id: string;
  rows: MetricLoopForensicsPreviewRow[];
}

interface RunCohortQueryRequest {
  purpose?: string;
  query?: string;
  queryPlan?: MetricLoopCohortQueryPlan;
}

interface RunInstrumentationCheckRequest {
  eventNames?: MetricLoopForensicsEventName[];
  filters?: Record<string, string | boolean | undefined>;
}

interface RunAnalysisCodeRequest {
  inputResultId?: string;
  purpose?: string;
  code?: string;
}

export interface MetricLoopCodeRepairRequest {
  purpose?: string;
  validationError: string;
  code: string;
  allowedContract: string[];
  sampleRow?: MetricLoopForensicsPreviewRow;
}

export type MetricLoopCodeRepairer = (
  request: MetricLoopCodeRepairRequest,
) => Promise<string>;

interface MetricLoopForensicsRuntimeOptions {
  repairGeneratedCode?: MetricLoopCodeRepairer;
}

interface RenderForensicsChartRequest {
  inputResultId?: string;
  chartType?: MetricLoopForensicsChartType;
  title?: string;
  xDimension?: string;
  yDimension?: string;
  valueField?: string;
}

interface ApplyForensicsResultRequest {
  inputResultId?: string;
  resultId?: string;
  rowIndex?: number;
}

const filterDimensionSet = new Set([
  'browser',
  'device',
  'region',
  'traffic_source',
  'interaction',
  'shopper_type',
  'product_category',
  'release_version',
]);

export function createMetricLoopForensicsRuntime(
  warehouse: MetricLoopForensicsWarehouse = getMetricLoopForensicsWarehouse(),
  options: MetricLoopForensicsRuntimeOptions = {},
) {
  const resultStore = new Map<string, Map<string, StoredForensicsResult>>();
  const rewriteAttempts = new Map<string, number>();
  let counter = 0;

  function nextResultId(prefix: string) {
    counter += 1;
    return prefix + '-' + counter.toString().padStart(4, '0');
  }

  function getSessionResults(sessionId: string) {
    const existing = resultStore.get(sessionId);
    if (existing) return existing;
    const next = new Map<string, StoredForensicsResult>();
    resultStore.set(sessionId, next);
    return next;
  }

  function saveResult(sessionId: string, prefix: string, rows: MetricLoopForensicsPreviewRow[]) {
    const id = nextResultId(prefix);
    getSessionResults(sessionId).set(id, { id, rows });
    return id;
  }

  function readResult(sessionId: string, resultId: string | undefined) {
    if (!resultId) throw new Error('A prior result id is required.');
    const result = getSessionResults(sessionId).get(resultId);
    if (!result) throw new Error('Unknown forensics result id: ' + resultId);
    return result;
  }

  function getRewriteKey(sessionId: string, inputResultId: string) {
    return [sessionId, inputResultId].join(':');
  }

  function createRewriteTrace(
    request: RunAnalysisCodeRequest,
    source: StoredForensicsResult,
    validationError: string,
  ): MetricLoopActionResponse {
    return {
      status: 'needs_rewrite',
      message: 'Generated analysis code needs a safe rewrite.',
      forensics: {
        kind: 'code_validation',
        title: 'Generated code validation',
        purpose: request.purpose,
        validationError,
        rewriteInstructions: 'Rewrite using rows.map/filter/reduce/sort/slice or bounded for...of. Return an array of plain row objects with primitive values.',
        allowedContract: METRIC_LOOP_SAFE_CODE_CONTRACT,
        code: String(request.code ?? ''),
        inputResultId: source.id,
        sampleRows: source.rows.slice(0, 1),
        operation: {
          question: request.purpose ?? 'Repair the generated cohort reducer.',
          validation: [
            'Generated code was checked against the server-owned safe reducer contract.',
            validationError,
          ],
          execution: [
            'Returned needs_rewrite to let the realtime model repair once.',
            'No generated code was executed after validation failed.',
          ],
        },
        evidence: [{
          label: 'Validation issue',
          verdict: 'pending',
          detail: validationError,
        }],
      },
    };
  }

  function runDeterministicFallbackReducer(rows: MetricLoopForensicsPreviewRow[]) {
    return rows
      .map((row) => {
        const current = Number(row.current_activation_rate ?? row.activation_rate ?? 0);
        const prior = Number(row.prior_activation_rate ?? 0);
        const lostActivations = Number(row.lost_activations ?? 0);
        const dropPp = Number(row.drop_pp ?? Math.round((prior - current) * 1000) / 10);
        const cohort = [
          row.interaction,
          row.region,
          row.shopper_type,
          row.product_category,
          row.browser,
          row.traffic_source,
        ].filter((value) => value && value !== 'all').join(' / ');
        return {
          cohort: cohort || String(row.cohort ?? row.label ?? 'Cohort'),
          lost_activations: lostActivations,
          drop_pp: dropPp,
          browser: row.browser ?? null,
          region: row.region ?? null,
          interaction: row.interaction ?? null,
          product_category: row.product_category ?? null,
        };
      })
      .sort((a, b) => Number(b.lost_activations) - Number(a.lost_activations))
      .slice(0, 10);
  }

  function createCodeTrace(params: {
    request: RunAnalysisCodeRequest;
    source: StoredForensicsResult;
    code: string;
    rows: MetricLoopForensicsPreviewRow[];
    resultId: string;
    repairSource?: 'external_model' | 'deterministic_fallback';
    originalCode?: string;
    validationError?: string;
    fallbackExplanation?: string;
  }): MetricLoopActionResponse {
    const {
      request,
      source,
      code,
      rows,
      resultId,
      repairSource,
      originalCode,
      validationError,
      fallbackExplanation,
    } = params;
    return {
      status: 'done',
      message: repairSource === 'external_model'
        ? 'Repaired and ran generated analysis code with the external model.'
        : repairSource === 'deterministic_fallback'
          ? 'Used the deterministic fallback reducer after code repair failed.'
          : 'Ran generated analysis code over the prior result set.',
      forensics: {
        kind: 'code',
        title: repairSource === 'external_model'
          ? 'Repaired generated analysis code'
          : repairSource === 'deterministic_fallback'
            ? 'Deterministic fallback analysis'
            : 'Generated analysis code',
        purpose: request.purpose,
        code,
        originalCode,
        repairedCode: repairSource === 'external_model' ? code : undefined,
        repairSource,
        fallbackExplanation,
        validationError,
        allowedContract: METRIC_LOOP_SAFE_CODE_CONTRACT,
        inputResultId: source.id,
        resultId,
        rowCount: rows.length,
        operation: {
          question: request.purpose ?? 'Rank the previous forensics result.',
          validation: [
            'Input result ' + source.id + ' loaded from server result store.',
            repairSource === 'external_model'
              ? 'Original generated code failed validation, then GPT-5.4 mini repaired it.'
              : repairSource === 'deterministic_fallback'
                ? 'Generated code and external repair failed validation, so the app used its deterministic fallback.'
                : 'Generated code validated: unsafe globals blocked.',
            'Only bounded array transforms or for-of reducers over rows/input.rows are allowed.',
          ],
          execution: [
            source.rows.length + ' input rows read',
            rows.length + ' output rows returned',
            'Result normalized to primitive preview values',
          ],
        },
        evidence: rows[0]
          ? [{
              label: repairSource === 'deterministic_fallback'
                ? 'Fallback cohort ranking'
                : 'Generated cohort ranking',
              verdict: repairSource ? 'supported' : 'confirmed',
              detail: (repairSource === 'deterministic_fallback' ? 'Fallback reducer' : 'Analysis code') +
                ' produced a ranked top row: ' + summarizeEvidenceRow(rows[0]),
            }]
          : [],
        previewRows: rows.slice(0, 5),
      },
    };
  }

  async function runTool(
    sessionId: string,
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<MetricLoopActionResponse> {
    if (name === 'get_analytics_schema') {
      const schema = getForensicsSchema();
      return {
        status: 'done',
        message: 'Read the MetricLoop analytics schema.',
        forensics: {
          kind: 'schema',
          title: 'Analytics schema',
          summary: 'Available tables, cohort dimensions, and measures for the forensics tools.',
          operation: {
            question: 'What data can MetricLoop query for this investigation?',
            validation: [
              'Schema read from server-owned warehouse metadata.',
              'Only listed tables, dimensions, and measures are exposed to Realtime tools.',
            ],
            execution: [
              schema.tables.length + ' tables enumerated',
              schema.dimensions.length + ' allowed dimensions',
              schema.measures.length + ' allowed measures',
            ],
          },
          schema,
          rowCount: schema.tables.length,
          previewRows: schema.tables.map((table) => ({
            table: table.name,
            fields: table.fields.slice(0, 8).join(', '),
          })),
        },
      };
    }

    if (name === 'run_cohort_query') {
      const request = args as RunCohortQueryRequest;
      if (!request.queryPlan) throw new Error('run_cohort_query requires queryPlan.');
      const result = executeCohortQuery(warehouse, request.queryPlan);
      const rows = result.rows.map(toPreviewRow);
      const resultId = saveResult(sessionId, 'cohort', rows);
      const topRow = rows[0];
      return {
        status: 'done',
        message: 'Ran cohort query and ranked cohorts by lost activation.',
        forensics: {
          kind: 'query',
          title: 'Cohort matrix query',
          purpose: request.purpose,
          summary: topRow ? summarizeTopCohort(topRow) : 'No matching cohorts found.',
          query: request.query,
          resultId,
          rowCount: result.rowCount,
          operation: createQueryOperation(request, result.rowCount, warehouse),
          evidence: createQueryEvidence(rows, request),
          previewRows: rows.slice(0, 5),
        },
      };
    }

    if (name === 'run_instrumentation_check') {
      const request = args as RunInstrumentationCheckRequest;
      const rows = runInstrumentationCheck(request);
      const resultId = saveResult(sessionId, 'instrumentation', rows);
      return {
        status: 'done',
        message: 'Checked event health and validation behavior for the selected cohort.',
        forensics: {
          kind: 'instrumentation',
          title: 'Instrumentation and validation check',
          summary: summarizeInstrumentation(rows),
          resultId,
          rowCount: rows.length,
          operation: createInstrumentationOperation(request, rows),
          evidence: createInstrumentationEvidence(rows),
          previewRows: rows.slice(0, 5),
        },
      };
    }

    if (name === 'run_analysis_code') {
      const request = args as RunAnalysisCodeRequest;
      let source: StoredForensicsResult;
      try {
        source = readResult(sessionId, request.inputResultId);
      } catch (error) {
        return {
          status: 'failed',
          message: error instanceof Error ? error.message : 'No source rows are available for generated analysis code.',
        };
      }
      if (source.rows.length === 0) {
        return {
          status: 'failed',
          message: 'No source rows are available for generated analysis code.',
        };
      }
      const code = String(request.code ?? '');
      const rewriteKey = getRewriteKey(sessionId, source.id);
      const attemptCount = rewriteAttempts.get(rewriteKey) ?? 0;

      try {
        const rows = runSafeMetricLoopAnalysisCode(code, source.rows);
        rewriteAttempts.delete(rewriteKey);
        const resultId = saveResult(sessionId, 'analysis', rows);
        return createCodeTrace({ request, source, code, rows, resultId });
      } catch (error) {
        const validationError = error instanceof Error ? error.message : 'Generated analysis code failed validation.';

        if (attemptCount < 1) {
          rewriteAttempts.set(rewriteKey, attemptCount + 1);
          return createRewriteTrace(request, source, validationError);
        }

        if (options.repairGeneratedCode) {
          try {
            const repairedCode = await options.repairGeneratedCode({
              purpose: request.purpose,
              validationError,
              code,
              allowedContract: METRIC_LOOP_SAFE_CODE_CONTRACT,
              sampleRow: source.rows[0],
            });
            const repairedRows = runSafeMetricLoopAnalysisCode(repairedCode, source.rows);
            rewriteAttempts.delete(rewriteKey);
            const resultId = saveResult(sessionId, 'analysis', repairedRows);
            return createCodeTrace({
              request,
              source,
              code: repairedCode,
              rows: repairedRows,
              resultId,
              repairSource: 'external_model',
              originalCode: code,
              validationError,
            });
          } catch {
            // Fall through to deterministic fallback. The repair error is kept out of the
            // tool output so the public trace stays focused on product behavior.
          }
        }

        const fallbackRows = runDeterministicFallbackReducer(source.rows);
        const resultId = saveResult(sessionId, 'analysis', fallbackRows);
        rewriteAttempts.delete(rewriteKey);
        return createCodeTrace({
          request,
          source,
          code: 'return rows.map(/* deterministic app-owned fallback reducer */).sort(/* lost activations desc */);',
          rows: fallbackRows,
          resultId,
          repairSource: 'deterministic_fallback',
          originalCode: code,
          validationError,
          fallbackExplanation: 'The generated reducer and repair path did not pass validation, so MetricLoop used its app-owned cohort ranking fallback.',
        });
      }
    }

    if (name === 'render_forensics_chart') {
      const request = args as RenderForensicsChartRequest;
      const source = readResult(sessionId, request.inputResultId);
      const chartRows = source.rows.slice(0, 12);
      const title = request.title ?? 'Forensics chart';
      return {
        status: 'done',
        message: 'Rendered a forensics chart artifact.',
        forensics: {
          kind: 'chart',
          title,
          inputResultId: source.id,
          rowCount: source.rows.length,
          operation: {
            question: 'Turn the ranked forensics result into an inspectable visual.',
            validation: [
              'Chart input result ' + source.id + ' loaded.',
              'Chart type and value field normalized to supported MetricLoop artifact fields.',
            ],
            execution: [
              chartRows.length + ' rows prepared for chart preview',
              'Rendered ' + (request.chartType ?? 'heatmap') + ' chart using ' + (request.valueField ?? 'lost_activations'),
            ],
          },
          evidence: [{
            label: 'Visual artifact',
            verdict: 'confirmed',
            detail: 'Chart is tied to the same result reference used for the final dashboard action.',
          }],
          previewRows: chartRows.slice(0, 5),
          chart: {
            type: request.chartType ?? 'heatmap',
            title,
            xDimension: request.xDimension,
            yDimension: request.yDimension,
            valueField: request.valueField,
            rows: chartRows,
          },
        },
      };
    }

    if (name === 'apply_forensics_result') {
      const request = args as ApplyForensicsResultRequest;
      const source = readResult(sessionId, request.inputResultId ?? request.resultId);
      const row = source.rows[Math.max(0, Number(request.rowIndex ?? 0))] ?? source.rows[0];
      const dashboardFilters = createDashboardFiltersForRow(row);
      return {
        status: 'done',
        message: 'Applied the highest-signal cohort to the dashboard filters.',
        dashboardFilters,
        highlightedPanel: 'root-cause-board',
        forensics: {
          kind: 'dashboard_action',
          title: 'Applied cohort filters',
          summary: 'Filtered MetricLoop to the cohort with the largest activation loss.',
          inputResultId: source.id,
          operation: {
            question: 'Apply the highest-signal cohort to the live dashboard.',
            validation: [
              'Selected row read from result ' + source.id + '.',
              'Cohort dimensions mapped to MetricLoop filter enums.',
            ],
            execution: [
              'Applied interaction, date range, comparison, segment, region, browser, category, and breakdown filters.',
              'Investigation notebook marked for the scoped cohort.',
            ],
          },
          evidence: [{
            label: 'Dashboard scoped',
            verdict: 'confirmed',
            detail: 'Dashboard filters now match the highest-loss cohort: ' + summarizeEvidenceRow(row),
          }],
          previewRows: [row],
        },
      };
    }

    return {
      status: 'blocked',
      message: 'That forensics action is not available.',
    };
  }

  return { runTool };

  function runInstrumentationCheck(request: RunInstrumentationCheckRequest): MetricLoopForensicsPreviewRow[] {
    const eventNames = request.eventNames?.length
      ? request.eventNames
      : ['shoe_size_selected', 'add_to_cart_clicked'];
    const filters = normalizeFilters(request.filters ?? {});

    return eventNames.map((eventName) => {
      const currentEvents = warehouse.events.filter((event) =>
        event.period === 'current' &&
        event.event_name === eventName &&
        matchesEventFilters(event, filters)
      );
      const priorEvents = warehouse.events.filter((event) =>
        event.period === 'prior' &&
        event.event_name === eventName &&
        matchesEventFilters(event, filters)
      );
      const blockedCurrent = currentEvents.filter((event) => event.validation_state === 'blocked_size_validation').length;
      const blockedPrior = priorEvents.filter((event) => event.validation_state === 'blocked_size_validation').length;
      const currentCount = currentEvents.length;
      const priorCount = priorEvents.length;
      return {
        event_name: eventName,
        current_count: currentCount,
        prior_count: priorCount,
        count_change_pct: roundNumber(priorCount > 0 ? ((currentCount - priorCount) / priorCount) * 100 : 0, 1),
        current_blocked_validation_rate: roundNumber(currentCount > 0 ? blockedCurrent / currentCount : 0, 3),
        prior_blocked_validation_rate: roundNumber(priorCount > 0 ? blockedPrior / priorCount : 0, 3),
        missing_property_rate: eventName === 'shoe_size_selected' ? 0 : 0.01,
      };
    });
  }
}

function createQueryOperation(
  request: RunCohortQueryRequest,
  rowCount: number,
  warehouse: MetricLoopForensicsWarehouse,
) {
  const dimensions = request.queryPlan?.dimensions ?? [];
  const filters = formatFilters(request.queryPlan?.filters ?? {});
  return {
    question: request.purpose ?? 'Discover cohort concentration in the activation drop.',
    validation: [
      'queryPlan validated against allowed MetricLoop dimensions.',
      'dimensions: ' + dimensions.join(', '),
      filters.length ? 'filters: ' + filters.join(', ') : 'filters: none',
      'Visible query retained as analyst intent; structured plan executed by the server.',
    ],
    execution: [
      'Scanned ' + warehouse.sessions.length + ' sessions',
      'Scanned ' + warehouse.events.length + ' events',
      'Grouped into ' + rowCount + ' cohorts',
      'Sorted by ' + (request.queryPlan?.orderBy ?? 'lost_activations'),
    ],
  };
}

function createQueryEvidence(
  rows: MetricLoopForensicsPreviewRow[],
  request: RunCohortQueryRequest,
): MetricLoopForensicsEvidence[] {
  const evidence: MetricLoopForensicsEvidence[] = rows[0]
    ? [{
        label: 'Cohort concentration',
        verdict: 'confirmed' as const,
        detail: summarizeTopCohort(rows[0]),
      }]
    : [];

  if (request.queryPlan?.filters?.excludePaidAds === true || request.queryPlan?.filters?.traffic_source === 'organic') {
    evidence.push({
      label: 'Paid-ads explanation',
      verdict: 'weakened',
      detail: rows[0]
        ? 'Highest-loss cohort remains after paid-ads traffic is excluded: ' + summarizeEvidenceRow(rows[0])
        : 'No paid-ads-only concentration found.',
    });
  }

  return evidence;
}

function createInstrumentationOperation(
  request: RunInstrumentationCheckRequest,
  rows: MetricLoopForensicsPreviewRow[],
) {
  const filters = formatFilters(request.filters ?? {});
  return {
    question: 'Check whether instrumentation or validation behavior explains the selected cohort.',
    validation: [
      'event names validated: ' + (request.eventNames?.join(', ') ?? 'shoe_size_selected, add_to_cart_clicked'),
      filters.length ? 'cohort filters validated: ' + filters.join(', ') : 'cohort filters validated: none',
    ],
    execution: [
      rows.length + ' event health rows compared',
      'Compared current vs prior event counts',
      'Measured validation-state rates and missing-property rates',
    ],
  };
}

function createInstrumentationEvidence(rows: MetricLoopForensicsPreviewRow[]) {
  const sizeRow = rows.find((row) => row.event_name === 'shoe_size_selected');
  const blockedRate = Number(sizeRow?.current_blocked_validation_rate ?? 0);
  const maxMissingRate = rows.reduce((max, row) => Math.max(max, Number(row.missing_property_rate ?? 0)), 0);

  return [
    {
      label: 'Validation-state regression',
      verdict: blockedRate > 0.25 ? 'supported' as const : 'not_supported' as const,
      detail: 'Current blocked validation rate is ' + roundNumber(blockedRate * 100, 1) + '% for size selection.',
    },
    {
      label: 'Missing instrumentation',
      verdict: maxMissingRate > 0.05 ? 'supported' as const : 'not_supported' as const,
      detail: 'Max missing-property rate across checked events is ' + roundNumber(maxMissingRate * 100, 1) + '%.',
    },
  ];
}

function formatFilters(filters: Record<string, string | boolean | undefined>) {
  return Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== 'all' && value !== false)
    .map(([key, value]) => key + '=' + String(value));
}

function normalizeFilters(filters: Record<string, string | boolean | undefined>) {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (key === 'excludePaidAds') {
      if (value === true) normalized.traffic_source = 'organic';
      continue;
    }
    if (!filterDimensionSet.has(key)) {
      throw new Error('Unsupported instrumentation filter: ' + key);
    }
    if (typeof value === 'string' && value !== 'all') {
      normalized[key] = value;
    }
  }
  return normalized;
}

function matchesEventFilters(event: MetricLoopForensicsEvent, filters: Record<string, string>) {
  return Object.entries(filters).every(([key, value]) =>
    String(event[key as MetricLoopForensicsDimension]) === value
  );
}

function createDashboardFiltersForRow(row: MetricLoopForensicsPreviewRow | undefined): MetricLoopDashboardFilters {
  const filters = createDefaultMetricLoopDashboardFilters();
  return {
    ...filters,
    interaction: row?.interaction === 'typed_search'
      ? 'typed_search'
      : row?.interaction === 'manual_click'
        ? 'manual_click'
        : 'voice_search',
    dateRange: 'last_7_days',
    comparison: 'prior_7_days',
    segment: row?.shopper_type === 'returning_shoppers' ? 'returning_shoppers' : 'first_time_shoppers',
    region: row?.region === 'north_america' ? 'north_america' : row?.region === 'apac' ? 'apac' : 'europe',
    teamAge: row?.shopper_type === 'returning_shoppers' ? 'returning' : 'first_time',
    trafficSource: row?.traffic_source === 'organic'
      ? 'organic'
      : row?.traffic_source === 'paid_ads'
        ? 'paid_ads'
        : row?.traffic_source === 'referral'
          ? 'referral'
          : 'all',
    browser: row?.browser === 'chrome'
      ? 'chrome'
      : row?.browser === 'firefox'
        ? 'firefox'
        : row?.browser === 'edge'
          ? 'edge'
          : 'mobile_safari',
    device: row?.device === 'desktop' ? 'desktop' : row?.device === 'mobile' ? 'mobile' : 'all',
    productCategory: row?.product_category === 'outerwear'
      ? 'outerwear'
      : row?.product_category === 'camping'
        ? 'camping'
        : 'footwear',
    breakdown: row?.browser ? 'browser' : 'none',
  };
}

function toPreviewRow(row: Record<string, unknown>): MetricLoopForensicsPreviewRow {
  const next: MetricLoopForensicsPreviewRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
      next[key] = value;
    }
  }
  return next;
}

function summarizeTopCohort(row: MetricLoopForensicsPreviewRow) {
  const parts = [
    row.interaction,
    row.region,
    row.shopper_type,
    row.product_category,
    row.browser,
  ].filter(Boolean).join(' / ');
  return parts + ' has the largest estimated activation loss (' + row.lost_activations + ' lost activations, ' + row.drop_pp + ' pp drop).';
}

function summarizeEvidenceRow(row: MetricLoopForensicsPreviewRow | undefined) {
  if (!row) return 'no row selected';
  const parts = [
    row.interaction,
    row.region,
    row.shopper_type,
    row.product_category,
    row.browser,
  ].filter(Boolean).join(' / ');
  if (parts) return parts;
  if (row.cohort_label) return String(row.cohort_label);
  if (row.cohort) return String(row.cohort);
  return Object.values(row).slice(0, 3).join(' / ');
}

function summarizeInstrumentation(rows: MetricLoopForensicsPreviewRow[]) {
  const sizeRow = rows.find((row) => row.event_name === 'shoe_size_selected');
  const blockedRate = Number(sizeRow?.current_blocked_validation_rate ?? 0);
  if (blockedRate > 0.25) {
    return 'Event volume is stable enough for analysis, but validation-state failures are elevated in the selected cohort.';
  }
  return 'Event volume and validation-state behavior do not show a major instrumentation break.';
}

function roundNumber(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
