import { useEffect, useState, type ReactElement } from 'react';
import {
  MetricLoopForensicsWorkbench,
  hasMetricLoopWorkbenchActivities,
} from './MetricLoopForensicsWorkbench';
import type { MetricLoopInvestigationBoard } from './metricLoopEngine';
import type { MetricLoopAnalysisRunStatus, MetricLoopToolActivity } from './metricLoopContracts';
import {
  EngineeringRoiChart,
  formatMetricLoopCurrency,
  formatMetricLoopDelta,
  formatMetricLoopPercent,
} from './MetricLoopVisualizations';

function NotebookSection({
  title,
  children,
}: {
  title: string;
  children: ReactElement | ReactElement[] | string;
}) {
  return (
    <section className="metricloop-notebook-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function formatHypothesisStatus(
  status: MetricLoopInvestigationBoard['scopedReport']['hypotheses'][number]['status'],
) {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const DEEPER_ANALYSIS_PROMPT = 'Prove whether this activation drop is a Mobile Safari product bug, an acquisition-quality issue, or an instrumentation problem. Use cohort forensics, instrumentation checks, generated analysis code, and a chart before updating the conclusion.';

const targetedAnalysisPrompts = [
  {
    label: 'Rank impacted cohorts',
    prompt: 'Rank the cohorts driving the activation drop. Use a cohort query and generated analysis code to identify the largest contribution.',
  },
  {
    label: 'Test acquisition mix',
    prompt: 'Test whether acquisition mix or paid traffic explains this activation drop before assigning it to product behavior.',
  },
  {
    label: 'Check instrumentation',
    prompt: 'Check instrumentation health for size selection and add-to-cart events in the current cohort.',
  },
  {
    label: 'Build chart',
    prompt: 'Show me the top contributing cohorts as a chart. Use the latest result if available; otherwise run the minimum cohort query first.',
  },
];

const analysisRunSteps = [
  {
    label: 'Cohort query',
    names: ['get_analytics_schema', 'run_cohort_query'],
  },
  {
    label: 'Acquisition mix',
    names: ['run_cohort_query'],
  },
  {
    label: 'Instrumentation check',
    names: ['run_instrumentation_check'],
  },
  {
    label: 'Generated code',
    names: ['run_analysis_code'],
  },
  {
    label: 'Chart',
    names: ['render_forensics_chart'],
  },
  {
    label: 'Update conclusion',
    names: ['apply_forensics_result', 'update_investigation_notebook', 'generate_investigation_board'],
  },
];

const traceFirstAnalysisTools = new Set([
  'get_analytics_schema',
  'run_cohort_query',
  'run_instrumentation_check',
  'run_analysis_code',
  'render_forensics_chart',
  'apply_forensics_result',
]);

function shouldOpenReasoningTrace(analysisRun?: MetricLoopAnalysisRunStatus | null) {
  if (!analysisRun?.isActive || !analysisRun.currentToolName) return false;
  return traceFirstAnalysisTools.has(analysisRun.currentToolName);
}

function getPrimaryHypothesis(board: MetricLoopInvestigationBoard) {
  return board.scopedReport.hypotheses.find((hypothesis) => hypothesis.status === 'primary') ??
    board.scopedReport.hypotheses[0];
}

function formatConfidenceLabel(confidence: string) {
  return confidence + ' confidence';
}

function getAnalysisStepStatus(
  activities: MetricLoopToolActivity[],
  step: (typeof analysisRunSteps)[number],
  analysisRun?: MetricLoopAnalysisRunStatus | null,
) {
  if (analysisRun?.currentToolName && step.names.includes(analysisRun.currentToolName)) return 'running';
  const matching = activities.filter((activity) => step.names.includes(activity.name));
  if (matching.some((activity) => activity.status === 'running')) return 'running';
  if (matching.some((activity) =>
    activity.status === 'done' ||
    activity.status === 'repaired' ||
    activity.status === 'fallback_used' ||
    activity.status === 'needs_rewrite'
  )) return 'done';
  return 'pending';
}

function NotebookSummary({
  board,
  onSuggestedPrompt,
}: {
  board: MetricLoopInvestigationBoard;
  onSuggestedPrompt?: (prompt: string) => void;
}) {
  const primaryHypothesis = getPrimaryHypothesis(board);
  const evidenceBullets = [
    primaryHypothesis?.evidence ?? board.scopedReport.summary,
    board.analysisUpdate.summary,
    board.evidenceSteps[0]?.finding ?? board.dropOffStep.label + ' is the steepest visible funnel break.',
  ].filter(Boolean).slice(0, 3);
  const openQuestions = board.alternativeCauses.slice(0, 3);

  return (
    <>
      <section className="metricloop-hypothesis-memo">
        <div className="metricloop-hypothesis-primary">
          <span>Working hypothesis</span>
          <h3>{primaryHypothesis?.label ?? board.analysisUpdate.primaryDriver}</h3>
          <p>{board.conclusion}</p>
          <div>
            <strong>{formatConfidenceLabel(board.confidence)}</strong>
            <em>{board.analysisUpdate.scope}</em>
          </div>
        </div>

        <div className="metricloop-hypothesis-evidence">
          <strong>Evidence so far</strong>
          <ul>
            {evidenceBullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="metricloop-hypothesis-risks">
          <strong>What could still be wrong</strong>
          <div>
            {openQuestions.map((cause) => (
              <span key={cause.label}>{cause.label}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="metricloop-proof-card">
        <div>
          <span>Recommended next step</span>
          <strong>Run deeper analysis</strong>
          <p>
            Prove or weaken the hypothesis with cohort forensics, acquisition checks,
            instrumentation validation, generated analysis code, and a chart.
          </p>
        </div>
        <button type="button" onClick={() => onSuggestedPrompt?.(DEEPER_ANALYSIS_PROMPT)}>
          Run deeper analysis
        </button>
        <div className="metricloop-proof-actions">
          {targetedAnalysisPrompts.map((item) => (
            <button key={item.label} type="button" onClick={() => onSuggestedPrompt?.(item.prompt)}>
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <NotebookSection title="Engineering handoff">
        <div className="metricloop-engineering-brief">
          <EngineeringRoiChart brief={board.engineeringBrief} />
          <article className="metricloop-ticket-card">
            <div>
              <span>{board.engineeringBrief.ticket.priority}</span>
              <strong>{board.engineeringBrief.ticket.title}</strong>
              <p>{board.engineeringBrief.summary}</p>
            </div>
            <dl>
              <div>
                <dt>Owner</dt>
                <dd>{board.engineeringBrief.ticket.owner}</dd>
              </div>
              <div>
                <dt>Recoverable</dt>
                <dd>
                  {formatMetricLoopCurrency(
                    board.engineeringBrief.impact.estimatedWeeklyRevenueRecovery,
                  )}{' '}
                  / week
                </dd>
              </div>
              <div>
                <dt>Affected sessions</dt>
                <dd>{board.engineeringBrief.impact.affectedSessions.toLocaleString()}</dd>
              </div>
            </dl>
            <button type="button" onClick={() => onSuggestedPrompt?.('Create a draft Linear issue from the current MetricLoop hypothesis, including owner, priority, evidence, reproduction steps, acceptance criteria, and impact.')}>
              Create Linear issue
            </button>
          </article>
        </div>
      </NotebookSection>

      <NotebookSection title="Supporting evidence">
        <div className="metricloop-scoped-report">
          <p>{board.scopedReport.summary}</p>
          <small>{board.scopedReport.lineage}</small>
          <div className="metricloop-scoped-hypotheses compact">
            {board.scopedReport.hypotheses.map((hypothesis) => (
              <article
                key={hypothesis.label}
                className={'metricloop-scoped-hypothesis ' + hypothesis.status}
              >
                <div>
                  <span>{formatHypothesisStatus(hypothesis.status)}</span>
                  <strong>{hypothesis.label}</strong>
                  <em>{hypothesis.confidence} confidence</em>
                </div>
                <p>{hypothesis.evidence}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="metricloop-analysis-update compact">
          <div>
            <strong>{board.analysisUpdate.primaryDriver}</strong>
            <span>{board.analysisUpdate.scope}</span>
            <p>{board.analysisUpdate.summary}</p>
          </div>
          <em>{board.analysisUpdate.badge}</em>
        </div>
        <div className="metricloop-signal-map">
          {board.driverSignals.map((signal) => (
            <article key={signal.label}>
              <div>
                <strong>{signal.label}</strong>
                <span>{signal.score}/100</span>
              </div>
              <i style={{ width: signal.score + '%' }} />
              <p>{signal.detail}</p>
            </article>
          ))}
        </div>
      </NotebookSection>

      <NotebookSection title="Question">
        <p>{board.question}</p>
      </NotebookSection>

      <NotebookSection title="Applied filters">
        <div className="metricloop-notebook-chips">
          <span>{board.filters.dateRange}</span>
          <span>{board.filters.segment}</span>
          <span>{board.filters.region}</span>
          <span>{board.filters.productCategory}</span>
          {board.filters.excludePaidAds && <span>Paid ads excluded</span>}
          {board.filters.browserComparison && <span>{board.filters.browserComparison}</span>}
        </div>
      </NotebookSection>

      <NotebookSection title="Activation funnel delta">
        <div className="metricloop-notebook-list">
          {board.funnel.map((step) => (
            <article key={step.step}>
              <strong>{step.label}</strong>
              <span>
                {formatMetricLoopPercent(step.currentRate)} now /{' '}
                {formatMetricLoopPercent(step.previousRate)} prior
              </span>
              <em className={step.delta < -10 ? 'bad' : ''}>{formatMetricLoopDelta(step.delta)}</em>
            </article>
          ))}
        </div>
      </NotebookSection>

      <NotebookSection title="Evidence path">
        <ol className="metricloop-evidence-path">
          {board.evidenceSteps.map((step) => (
            <li key={step.label}>
              <strong>{step.label}</strong>
              <span>{step.finding}</span>
            </li>
          ))}
        </ol>
      </NotebookSection>

      <NotebookSection title="Search intent">
        <div className="metricloop-notebook-list">
          {board.searchIntents.slice(0, 3).map((intent) => (
            <article key={intent.term}>
              <strong>{intent.term}</strong>
              <span>
                {intent.volume.toLocaleString()} searches / {intent.topProduct}
              </span>
              <em className={intent.delta < -10 ? 'bad' : ''}>{formatMetricLoopDelta(intent.delta)}</em>
            </article>
          ))}
        </div>
      </NotebookSection>

      <NotebookSection title="Representative sessions">
        <div className="metricloop-notebook-list">
          {board.representativeSessions.slice(0, 3).map((session) => (
            <article key={session.id}>
              <strong>{session.id} / {session.browser}</strong>
              <span>{session.finding}</span>
            </article>
          ))}
        </div>
      </NotebookSection>

      <NotebookSection title="Likely cause">
        <p>{board.conclusion}</p>
      </NotebookSection>

      <NotebookSection title="Alternatives considered">
        <div className="metricloop-alt-list">
          {board.alternativeCauses.map((cause) => (
            <article key={cause.label}>
              <strong>{cause.label}</strong>
              <span>{cause.confidence} confidence</span>
              <p>{cause.reason}</p>
            </article>
          ))}
        </div>
      </NotebookSection>

      <NotebookSection title="Hypothesis scores">
        <div className="metricloop-hypothesis-list">
          {board.hypothesisScores.map((score) => (
            <article key={score.hypothesis}>
              <div>
                <strong>{score.hypothesis}</strong>
                <span>{score.score}/100</span>
              </div>
              <i style={{ width: score.score + '%' }} />
              <p>{score.evidence}</p>
            </article>
          ))}
        </div>
      </NotebookSection>

      <NotebookSection title="Recommended experiment">
        <article className="metricloop-experiment-card">
          <strong>{board.recommendedExperiment.title}</strong>
          <span>{board.recommendedExperiment.owner}</span>
          <p>{board.recommendedExperiment.expectedImpact}</p>
          <small>Guardrail: {board.recommendedExperiment.guardrailMetric}</small>
        </article>
      </NotebookSection>

      <NotebookSection title="Issue details">
        <div className="metricloop-ticket-handoff">
          <article>
            <strong>Reproduction steps</strong>
            <ol>
              {board.engineeringBrief.ticket.reproductionSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </article>
          <article>
            <strong>Acceptance criteria</strong>
            <ol>
              {board.engineeringBrief.ticket.acceptanceCriteria.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </article>
        </div>
      </NotebookSection>

      <NotebookSection title="Follow-up questions">
        <div className="metricloop-followups">
          {board.followUpQuestions.map((question) => (
            <span key={question}>{question}</span>
          ))}
        </div>
      </NotebookSection>
    </>
  );
}

function NotebookWork({
  activities,
  analysisRun,
  hasWorkbench,
  onSuggestedPrompt,
}: {
  activities: MetricLoopToolActivity[];
  analysisRun?: MetricLoopAnalysisRunStatus | null;
  hasWorkbench: boolean;
  onSuggestedPrompt?: (prompt: string) => void;
}) {
  const suggestedPrompts = targetedAnalysisPrompts;

  return (
    <>
      {analysisRun && (
        <MetricLoopAnalysisProgress analysisRun={analysisRun} activities={activities} />
      )}
      <section className="metricloop-notebook-intro">
        <span>Reasoning trace</span>
        <strong>How Lighthouse built this investigation</strong>
        <p>
          Tool calls, generated queries, analysis code, evidence checks, and rendered outputs are separated from the analyst summary so the reasoning stays inspectable.
        </p>
      </section>
      <section className="metricloop-work-suggestions">
        <span>Targeted follow-up</span>
        <div>
          {suggestedPrompts.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onSuggestedPrompt?.(item.prompt)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>
      <NotebookSection title="Reasoning trace">
        {hasWorkbench ? (
          <MetricLoopForensicsWorkbench activities={activities} />
        ) : (
          <div className="metricloop-workbench-empty">
            <strong>No trace yet</strong>
            <p>The model trace appears here after Lighthouse runs an investigation or writes analysis code.</p>
          </div>
        )}
      </NotebookSection>
    </>
  );
}

function MetricLoopAnalysisProgress({
  activities,
  analysisRun,
}: {
  activities: MetricLoopToolActivity[];
  analysisRun: MetricLoopAnalysisRunStatus;
}) {
  return (
    <section className={'metricloop-analysis-progress ' + analysisRun.phase} aria-live="polite">
      <div>
        <span>Analysis run</span>
        <strong>{analysisRun.label}</strong>
        <p>{analysisRun.detail}</p>
      </div>
      <ol>
        {analysisRunSteps.map((step) => {
          const status = getAnalysisStepStatus(activities, step, analysisRun);
          return (
            <li className={status} key={step.label}>
              <em>{status}</em>
              <span>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function MetricLoopNotebook({
  analysisRun = null,
  board,
  highlighted,
  isExpanded,
  onExpandedChange,
  onSuggestedPrompt,
  workbenchActivities = [],
}: {
  analysisRun?: MetricLoopAnalysisRunStatus | null;
  board: MetricLoopInvestigationBoard;
  highlighted: boolean;
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onSuggestedPrompt?: (prompt: string) => void;
  workbenchActivities?: MetricLoopToolActivity[];
}): ReactElement {
  const hasWorkbench = hasMetricLoopWorkbenchActivities(workbenchActivities);
  const [activeTab, setActiveTab] = useState<'summary' | 'work'>(() =>
    shouldOpenReasoningTrace(analysisRun) ? 'work' : 'summary',
  );

  useEffect(() => {
    if (shouldOpenReasoningTrace(analysisRun)) setActiveTab('work');
  }, [analysisRun?.isActive, analysisRun?.currentToolName]);

  return (
    <aside
      className={[
        'metricloop-notebook',
        highlighted ? 'highlighted' : '',
        isExpanded ? 'expanded' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="MetricLoop investigation notebook"
      data-agent-target="root-cause-board"
    >
      <header>
        <div>
          <span>Notebook</span>
          <h2>Root-cause investigation</h2>
          <strong>{board.analysisUpdate.badge}</strong>
        </div>
        <div className="metricloop-notebook-actions">
          <button
            type="button"
            aria-label={isExpanded ? 'Collapse root-cause investigation' : 'Expand root-cause investigation'}
            onClick={() => onExpandedChange(!isExpanded)}
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </header>

      <nav className="metricloop-notebook-tabs" aria-label="Investigation notebook sections">
        <button
          className={activeTab === 'summary' ? 'active' : ''}
          type="button"
          aria-selected={activeTab === 'summary'}
          onClick={() => setActiveTab('summary')}
        >
          Summary
        </button>
        <button
          className={activeTab === 'work' ? 'active' : ''}
          type="button"
          aria-selected={activeTab === 'work'}
          onClick={() => setActiveTab('work')}
        >
          Reasoning trace
          {workbenchActivities.length > 0 && <span>{workbenchActivities.length}</span>}
        </button>
      </nav>

      <div className="metricloop-notebook-scroll">
        {activeTab === 'summary' ? (
          <NotebookSummary board={board} onSuggestedPrompt={onSuggestedPrompt} />
        ) : (
          <NotebookWork
            activities={workbenchActivities}
            analysisRun={analysisRun}
            hasWorkbench={hasWorkbench}
            onSuggestedPrompt={onSuggestedPrompt}
          />
        )}
      </div>
    </aside>
  );
}
