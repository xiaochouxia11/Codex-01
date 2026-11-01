import type {
  MetricLoopForensicsEvidence,
  MetricLoopForensicsEvidenceVerdict,
  MetricLoopForensicsPreviewRow,
  MetricLoopForensicsTrace,
  MetricLoopToolActivity,
} from './metricLoopContracts';

const forensicsToolNames = new Set([
  'get_analytics_schema',
  'run_cohort_query',
  'run_instrumentation_check',
  'run_analysis_code',
  'render_forensics_chart',
  'apply_forensics_result',
]);

const workbenchTriggerToolNames = new Set([
  ...forensicsToolNames,
  'generate_investigation_board',
  'start_root_cause_investigation',
  'update_investigation_notebook',
]);

const forensicsPlanSteps = [
  {
    label: 'Discover cohort concentration',
    names: ['get_analytics_schema', 'run_cohort_query'],
    detail: 'Read schema and build a cohort matrix across browser, region, shopper type, category, and interaction.',
  },
  {
    label: 'Test paid-ads confounder',
    names: ['run_cohort_query'],
    detail: 'Rerun the cohort matrix with acquisition-quality filters to see whether the loss persists.',
  },
  {
    label: 'Validate instrumentation',
    names: ['run_instrumentation_check'],
    detail: 'Compare current vs prior event volume, missing properties, and validation-state behavior.',
  },
  {
    label: 'Rank loss with generated code',
    names: ['run_analysis_code'],
    detail: 'Execute constrained reducer code over the query result to produce a ranked cohort table.',
  },
  {
    label: 'Render chart and apply filters',
    names: ['render_forensics_chart', 'apply_forensics_result'],
    detail: 'Create an inspectable chart artifact and scope the dashboard to the highest-signal cohort.',
  },
];

function formatTraceCell(value: MetricLoopForensicsPreviewRow[string]): string {
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null) return '-';
  return value;
}

function ForensicsPreviewTable({ rows }: { rows?: MetricLoopForensicsPreviewRow[] }) {
  if (!rows?.length) return null;
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 6);

  return (
    <div className="metricloop-forensics-table" role="table" aria-label="Forensics result preview">
      <div role="row">
        {columns.map((column) => <strong key={column} role="columnheader">{column}</strong>)}
      </div>
      {rows.slice(0, 5).map((row, index) => (
        <div key={index} role="row">
          {columns.map((column) => <span key={column} role="cell">{formatTraceCell(row[column])}</span>)}
        </div>
      ))}
    </div>
  );
}

function TraceList({
  title,
  items,
}: {
  title: string;
  items?: string[];
}) {
  if (!items?.length) return null;

  return (
    <div className="metricloop-forensics-operation">
      <span>{title}</span>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function EvidenceList({ evidence }: { evidence?: MetricLoopForensicsEvidence[] }) {
  if (!evidence?.length) return null;

  return (
    <div className="metricloop-evidence-ledger compact">
      <span>Evidence ledger</span>
      {evidence.map((item) => (
        <div className={item.verdict} key={item.label + item.detail}>
          <strong>{item.label}</strong>
          <em>{formatVerdict(item.verdict)}</em>
          <p>{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

function ForensicsTraceCard({ trace }: { trace: MetricLoopForensicsTrace }) {
  return (
    <div className={'metricloop-forensics-trace ' + trace.kind}>
      <div className="metricloop-forensics-heading">
        <small>{trace.kind.replace('_', ' ')}</small>
        {trace.resultId && <code>{trace.resultId}</code>}
      </div>
      <strong>{trace.title}</strong>
      {trace.purpose && <p>{trace.purpose}</p>}
      {trace.summary && <p>{trace.summary}</p>}
      {trace.operation?.question && (
        <p className="metricloop-forensics-question">
          <b>Question tested</b>
          {trace.operation.question}
        </p>
      )}
      {(trace.validationError || trace.repairSource || trace.fallbackExplanation) && (
        <div className="metricloop-code-repair-summary">
          {trace.validationError && (
            <p>
              <b>Validation issue</b>
              {trace.validationError}
            </p>
          )}
          {trace.repairSource && (
            <p>
              <b>Repair path</b>
              {trace.repairSource.replace(/_/g, ' ')}
            </p>
          )}
          {trace.fallbackExplanation && (
            <p>
              <b>Fallback</b>
              {trace.fallbackExplanation}
            </p>
          )}
        </div>
      )}
      <TraceList title="Server validation" items={trace.operation?.validation} />
      <TraceList title="Execution scope" items={trace.operation?.execution} />
      <TraceList title="Allowed reducer contract" items={trace.allowedContract} />
      <EvidenceList evidence={trace.evidence} />
      {trace.query && (
        <details open>
          <summary>Query</summary>
          <pre className="metricloop-forensics-query">{trace.query}</pre>
        </details>
      )}
      {trace.code && (
        <details open>
          <summary>{trace.repairSource === 'external_model' ? 'Repaired code' : 'Generated code'}</summary>
          <pre className="metricloop-forensics-code">{trace.code}</pre>
        </details>
      )}
      {trace.originalCode && trace.originalCode !== trace.code && (
        <details>
          <summary>Original failed code</summary>
          <pre className="metricloop-forensics-code">{trace.originalCode}</pre>
        </details>
      )}
      {trace.sampleRows && <ForensicsPreviewTable rows={trace.sampleRows} />}
      {trace.schema && (
        <div className="metricloop-forensics-schema">
          {trace.schema.tables.slice(0, 4).map((table) => (
            <span key={table.name}>{table.name}: {table.fields.slice(0, 4).join(', ')}</span>
          ))}
        </div>
      )}
      {trace.chart && (
        <div className="metricloop-forensics-chart">
          <span>{trace.chart.type} / {trace.chart.valueField ?? 'value'}</span>
          {trace.chart.rows.slice(0, 6).map((row, index) => {
            const rawValue = Number(row[trace.chart?.valueField ?? 'lost_activations'] ?? row.lost_activations ?? 1);
            const width = Math.max(8, Math.min(100, rawValue * 2));
            return (
              <div key={index}>
                <em>{String(row[trace.chart?.xDimension ?? 'browser'] ?? row.browser ?? 'row ' + (index + 1))}</em>
                <i style={{ width: width + '%' }} />
              </div>
            );
          })}
        </div>
      )}
      <ForensicsPreviewTable rows={trace.previewRows} />
    </div>
  );
}

function getLatestTrace(
  activities: MetricLoopToolActivity[],
  kind: MetricLoopForensicsTrace['kind'],
) {
  return [...activities]
    .reverse()
    .map((activity) => activity.forensics)
    .find((trace): trace is MetricLoopForensicsTrace => trace?.kind === kind);
}

function snippet(value?: string, lineCount = 3) {
  if (!value) return '';
  return value
    .trim()
    .split('\n')
    .slice(0, lineCount)
    .join('\n');
}

function ForensicsArtifactHighlights({ activities }: { activities: MetricLoopToolActivity[] }) {
  const latestQuery = getLatestTrace(activities, 'query');
  const latestCode = getLatestTrace(activities, 'code');
  const latestChart = getLatestTrace(activities, 'chart');

  if (!latestQuery && !latestCode && !latestChart) return null;

  return (
    <div className="metricloop-forensics-highlights">
      {latestQuery && (
        <article className="query">
          <span>Latest query</span>
          <strong>{latestQuery.title}</strong>
          {latestQuery.resultId && <code>{latestQuery.resultId}</code>}
          <pre>{snippet(latestQuery.query, 3)}</pre>
        </article>
      )}
      {latestCode && (
        <article className="code">
          <span>Generated code</span>
          <strong>{latestCode.title}</strong>
          {latestCode.inputResultId && <code>{latestCode.inputResultId}</code>}
          <pre>{snippet(latestCode.code, 4)}</pre>
        </article>
      )}
      {latestChart && latestChart.chart && (
        <article className="chart">
          <span>Rendered chart</span>
          <strong>{latestChart.chart.title}</strong>
          <small>{latestChart.chart.type} / {latestChart.chart.valueField ?? 'value'}</small>
          <div>
            {latestChart.chart.rows.slice(0, 4).map((row, index) => {
              const rawValue = Number(row[latestChart.chart?.valueField ?? 'lost_activations'] ?? row.lost_activations ?? 1);
              const width = Math.max(10, Math.min(100, rawValue * 2));
              return (
                <i key={index}>
                  <em>{String(row[latestChart.chart?.xDimension ?? 'browser'] ?? row.browser ?? 'row ' + (index + 1))}</em>
                  <b style={{ width: width + '%' }} />
                </i>
              );
            })}
          </div>
        </article>
      )}
    </div>
  );
}

function isForensicsActivity(activity: MetricLoopToolActivity) {
  return forensicsToolNames.has(activity.name) || Boolean(activity.forensics);
}

export function hasMetricLoopWorkbenchActivities(activities: MetricLoopToolActivity[] = []) {
  return activities.some((activity) => workbenchTriggerToolNames.has(activity.name) || Boolean(activity.forensics));
}

function getStepStatus(
  activities: MetricLoopToolActivity[],
  step: { names: string[] },
  stepIndex: number,
) {
  const matching = activities.filter((activity) => step.names.includes(activity.name));
  const isComplete = (activity: MetricLoopToolActivity) =>
    activity.status === 'done' ||
    activity.status === 'repaired' ||
    activity.status === 'fallback_used' ||
    activity.status === 'needs_rewrite';
  if (stepIndex === 1) {
    const queryActivities = activities.filter((activity) => activity.name === 'run_cohort_query');
    if (queryActivities.length >= 2 && queryActivities.some(isComplete)) return 'done';
    if (queryActivities.length >= 2) return 'running';
    return 'pending';
  }
  if (matching.some(isComplete)) return 'done';
  if (matching.some((activity) => activity.status === 'running')) return 'running';
  return 'pending';
}

function getEvidenceItems(activities: MetricLoopToolActivity[]): MetricLoopForensicsEvidence[] {
  const evidence = activities.flatMap((activity) => activity.forensics?.evidence ?? []);
  return [
    findEvidence(evidence, 'Cohort concentration') ?? {
      label: 'Cohort concentration',
      verdict: 'pending',
      detail: 'Waiting for the first cohort matrix query.',
    },
    findEvidence(evidence, 'Paid-ads explanation') ?? {
      label: 'Paid-ads explanation',
      verdict: 'pending',
      detail: 'Waiting for a confounder query that controls acquisition traffic.',
    },
    findEvidence(evidence, 'Missing instrumentation') ?? {
      label: 'Missing instrumentation',
      verdict: 'pending',
      detail: 'Waiting for event-health checks.',
    },
    findEvidence(evidence, 'Validation-state regression') ?? {
      label: 'Validation-state regression',
      verdict: 'pending',
      detail: 'Waiting for validation-state comparison.',
    },
    findEvidence(evidence, 'Generated cohort ranking') ?? {
      label: 'Generated cohort ranking',
      verdict: 'pending',
      detail: 'Waiting for generated analysis code.',
    },
    findEvidence(evidence, 'Dashboard scoped') ?? {
      label: 'Dashboard scoped',
      verdict: 'pending',
      detail: 'Waiting to apply the selected cohort filters.',
    },
  ];
}

function findEvidence(evidence: MetricLoopForensicsEvidence[], label: string) {
  return [...evidence].reverse().find((item) => item.label === label);
}

function formatVerdict(verdict: MetricLoopForensicsEvidenceVerdict) {
  if (verdict === 'not_supported') return 'not supported';
  return verdict;
}

function formatArgsList(value: unknown, key: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  const nested = record[key];
  if (Array.isArray(nested)) return nested.join(', ');
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return Object.entries(nested)
      .filter(([, itemValue]) => itemValue !== undefined && itemValue !== 'all' && itemValue !== false)
      .map(([itemKey, itemValue]) => itemKey + '=' + String(itemValue))
      .join(', ');
  }
  return '';
}

function getToolProgress(activity: MetricLoopToolActivity): string[] {
  if (activity.name === 'get_analytics_schema') {
    return ['Reading server-owned schema', 'Listing allowed tables, dimensions, and measures'];
  }
  if (activity.name === 'run_cohort_query') {
    const queryPlan = activity.args && typeof activity.args === 'object'
      ? (activity.args as Record<string, unknown>).queryPlan
      : undefined;
    const dimensions = formatArgsList(queryPlan, 'dimensions');
    const filters = formatArgsList(queryPlan, 'filters');
    return [
      'Writing visible cohort query',
      'Validating structured queryPlan',
      'Scanning sessions and events',
      dimensions ? 'Grouping by ' + dimensions : 'Grouping cohort dimensions',
      filters ? 'Applying filters: ' + filters : 'Applying all active cohorts',
    ];
  }
  if (activity.name === 'run_instrumentation_check') {
    return ['Validating event names', 'Comparing current vs prior event volume', 'Checking validation-state and missing-property rates'];
  }
  if (activity.name === 'run_analysis_code') {
    return ['Loading prior result rows', 'Checking generated code constraints', 'Executing bounded reducer', 'Normalizing output table'];
  }
  if (activity.name === 'render_forensics_chart') {
    return ['Reading result reference', 'Mapping dimensions and value field', 'Rendering chart artifact'];
  }
  if (activity.name === 'apply_forensics_result') {
    return ['Selecting highest-signal row', 'Mapping cohort to dashboard filters', 'Updating visible MetricLoop state'];
  }
  return [];
}

function ForensicsWorkSummaryPanel({ activities }: { activities: MetricLoopToolActivity[] }) {
  const forensicsActivities = activities.filter(isForensicsActivity);
  if (forensicsActivities.length === 0) return null;
  const evidenceItems = getEvidenceItems(forensicsActivities);

  return (
    <div className="metricloop-forensics-work-summary">
      <div className="metricloop-forensics-plan">
        <span>Investigation plan</span>
        <ol>
          {forensicsPlanSteps.map((step, index) => {
            const status = getStepStatus(forensicsActivities, step, index);
            return (
              <li className={status} key={step.label}>
                <strong>{step.label}</strong>
                <em>{status}</em>
                <p>{step.detail}</p>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="metricloop-evidence-ledger">
        <span>Evidence ledger</span>
        {evidenceItems.map((item) => (
          <div className={item.verdict} key={item.label}>
            <strong>{item.label}</strong>
            <em>{formatVerdict(item.verdict)}</em>
            <p>{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolTraceItem({ activity }: { activity: MetricLoopToolActivity }) {
  const progress = getToolProgress(activity);

  return (
    <article className={'metricloop-tool-item ' + activity.status}>
      <div>
        <strong>{activity.label}</strong>
        <span>{activity.status}{activity.durationMs !== undefined ? ' / ' + activity.durationMs + ' ms' : ''}</span>
      </div>
      {progress.length > 0 && (
        <ol className="metricloop-tool-progress">
          {progress.map((item) => <li key={item}>{item}</li>)}
        </ol>
      )}
      {activity.details && activity.details.length > 0 && (
        <div className="metricloop-tool-details">
          {activity.details.map((detail) => <small key={detail}>{detail}</small>)}
        </div>
      )}
      {activity.forensics && <ForensicsTraceCard trace={activity.forensics} />}
    </article>
  );
}

export function MetricLoopForensicsWorkbench({
  activities,
}: {
  activities: MetricLoopToolActivity[];
}) {
  const forensicsActivities = activities.filter(isForensicsActivity);
  if (activities.length === 0) return null;

  return (
    <div className="metricloop-forensics-workbench">
      <ForensicsArtifactHighlights activities={forensicsActivities} />
      <div className="metricloop-tool-trace">
        {activities.map((activity) => <ToolTraceItem activity={activity} key={activity.id} />)}
      </div>
      <ForensicsWorkSummaryPanel activities={forensicsActivities} />
    </div>
  );
}
