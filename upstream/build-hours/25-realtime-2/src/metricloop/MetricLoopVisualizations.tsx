import type { ReactElement } from 'react';
import type {
  MetricLoopEngineeringBrief,
  MetricLoopInvestigationBoard,
} from './metricLoopEngine';

function formatPercent(value: number) {
  return value.toFixed(1) + '%';
}

function formatDelta(value: number) {
  return (value > 0 ? '+' : '') + value.toFixed(1) + ' pts';
}

function formatCurrency(value: number) {
  if (value >= 1000) return '$' + (value / 1000).toFixed(1) + 'k';
  return '$' + value.toLocaleString();
}

function formatDateLabel(value: string) {
  const [, month, day] = value.split('-');
  return month + '-' + day;
}

function formatEventLabel(value: string) {
  const labels: Record<string, string> = {
    voice_search_started: 'Voice search',
    search_results_viewed: 'Results viewed',
    product_card_opened: 'Product opened',
    shoe_size_selected: 'Size selected',
    add_to_cart_clicked: 'Add to cart',
    checkout_started: 'Checkout',
    validation_state_updated: 'Validation state',
  };

  return labels[value] ?? value.replaceAll('_', ' ');
}

export function ActivationFunnelDelta({
  board,
  highlighted,
}: {
  board: MetricLoopInvestigationBoard;
  highlighted: boolean;
}): ReactElement {
  return (
    <section className={highlighted ? 'metricloop-panel highlighted' : 'metricloop-panel'} data-agent-target="metricloop-funnel">
      <div className="metricloop-panel-heading">
        <div>
          <span>Funnels</span>
          <h2>Activation funnel before/after</h2>
        </div>
        <strong>{board.segmentLabel}</strong>
      </div>
      <div className="metricloop-funnel-list">
        {board.funnel.map((step) => (
          <div className="metricloop-funnel-row" key={step.step}>
            <div>
              <strong>{step.label}</strong>
              <span>{step.currentUsers} current / {step.previousUsers} prior</span>
            </div>
            <div
              aria-label={step.label + ' current ' + formatPercent(step.currentRate) + ', prior ' + formatPercent(step.previousRate)}
              className="metricloop-bars"
            >
              <i style={{ width: formatPercent(step.previousRate) }} />
              <b style={{ width: formatPercent(step.currentRate) }} />
            </div>
            <em className={step.delta < -10 ? 'bad' : ''}>{formatDelta(step.delta)}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ReleaseCorrelationTimeline({
  board,
}: {
  board: MetricLoopInvestigationBoard;
}): ReactElement {
  const maxTickets = Math.max(...board.releaseTimeline.map((point) => point.supportTickets));
  const isEarlySignal = board.confidence === 'Low';

  return (
    <section className="metricloop-panel" data-agent-target="release-correlation">
      <div className="metricloop-panel-heading">
        <div>
          <span>{isEarlySignal ? 'Release activity' : 'Release correlation'}</span>
          <h2>{isEarlySignal ? 'Recent releases' : 'Activation and ticket spike'}</h2>
          <p>
            {isEarlySignal
              ? 'Recent product changes are available for correlation once MetricLoop narrows the affected cohort.'
              : 'The May 4 size-selector release lines up with activation dropping while related support tickets climb.'}
          </p>
        </div>
        <strong>{isEarlySignal ? 'No correlation yet' : 'May 4 release'}</strong>
      </div>
      <div className="metricloop-correlation-legend" aria-hidden="true">
        <span><i />Activation rate</span>
        <span><b />Support tickets</span>
      </div>
      <div className="metricloop-timeline-chart">
        {board.releaseTimeline.map((point) => (
          <div className={!isEarlySignal && point.release ? 'release-marker' : ''} key={point.date}>
            <time dateTime={point.date}>{formatDateLabel(point.date)}</time>
            <div className="metricloop-correlation-bars">
              <label>
                <span>Activation</span>
                <i style={{ width: Math.max(point.activationRate, 3) + '%' }} />
                <strong>{formatPercent(point.activationRate)}</strong>
              </label>
              <label>
                <span>Tickets</span>
                <b style={{ width: Math.max((point.supportTickets / maxTickets) * 100, 4) + '%' }} />
                <strong>{point.supportTickets}</strong>
              </label>
            </div>
            {!isEarlySignal && point.release && <em>Release shipped</em>}
          </div>
        ))}
      </div>
    </section>
  );
}

export function BrowserBreakdownBars({
  board,
  highlighted,
}: {
  board: MetricLoopInvestigationBoard;
  highlighted: boolean;
}): ReactElement {
  return (
    <section className={highlighted ? 'metricloop-panel highlighted' : 'metricloop-panel'} data-agent-target="browser-breakdown">
      <div className="metricloop-panel-heading">
        <div>
          <span>Breakdown</span>
          <h2>Browser comparison</h2>
        </div>
        <strong>{board.filters.browserComparison ?? 'All browsers'}</strong>
      </div>
      <div className="metricloop-browser-list">
        {board.browserBreakdown.map((row) => (
          <div key={row.browser}>
            <span>{row.browser}</span>
            <div><i style={{ width: formatPercent(row.activationRate) }} /></div>
            <strong>{formatPercent(row.activationRate)}</strong>
            <em className={row.delta < -10 ? 'bad' : ''}>{formatDelta(row.delta)}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SearchIntentTable({
  board,
}: {
  board: MetricLoopInvestigationBoard;
}): ReactElement {
  return (
    <section className="metricloop-panel compact">
      <div className="metricloop-panel-heading">
        <div>
          <span>Search intent</span>
          <h2>Voice search conversion</h2>
        </div>
      </div>
      <table className="metricloop-table">
        <tbody>
          {board.searchIntents.map((intent) => (
            <tr key={intent.term}>
              <td>
                <strong>{intent.term}</strong>
                <span>{intent.topProduct}</span>
              </td>
              <td>{intent.volume.toLocaleString()} searches</td>
              <td className={intent.delta < -10 ? 'bad' : 'good'}>{formatPercent(intent.conversionRate)} / {formatDelta(intent.delta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function SessionReplayEvidenceStrip({
  board,
  selectedReplayId,
}: {
  board: MetricLoopInvestigationBoard;
  selectedReplayId: string | null;
}): ReactElement {
  return (
    <section className="metricloop-panel" data-agent-target="session-replays">
      <div className="metricloop-panel-heading">
        <div>
          <span>Session replay</span>
          <h2>Representative evidence</h2>
        </div>
      </div>
      <div className="metricloop-replay-list">
        <div className="metricloop-event-legend" aria-hidden="true">
          <span><i className="ok" />Completed</span>
          <span><i className="warning" />Warning</span>
          <span><i className="failed" />Failed</span>
        </div>
        {board.representativeSessions.map((session) => {
          const events = board.sessionEvents.find((eventTrace) => eventTrace.sessionId === session.id)?.events ?? [];

          return (
            <article className={selectedReplayId === session.id ? 'selected' : ''} key={session.id}>
              <div>
                <strong>{session.id}</strong>
                <span>{session.browser} / {session.channel}</span>
              </div>
              <p>{session.finding}</p>
              <small>{session.productTitle}</small>
              {events.length > 0 && (
                <div className="metricloop-event-timeline" aria-label={'Event timeline for ' + session.id}>
                  {events.map((event) => (
                    <span className={event.status} key={event.label} title={event.label}>
                      {formatEventLabel(event.label)}
                    </span>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function SupportThemeCards({
  board,
}: {
  board: MetricLoopInvestigationBoard;
}): ReactElement {
  return (
    <section className="metricloop-panel" data-agent-target="support-themes">
      <div className="metricloop-panel-heading">
        <div>
          <span>Support</span>
          <h2>Ticket themes</h2>
        </div>
      </div>
      <div className="metricloop-theme-list">
        {board.supportThemes.map((theme) => (
          <article key={theme.theme}>
            <strong>{theme.count} <span>tickets</span></strong>
            <div>
              <span>{theme.theme}</span>
              <small>{theme.sample}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function EngineeringRoiChart({
  brief,
}: {
  brief: MetricLoopEngineeringBrief;
}): ReactElement {
  const maxValue = Math.max(...brief.roiChart.data.map((point) => point.value), 1);

  return (
    <article className="metricloop-roi-chart" aria-label={brief.roiChart.title}>
      <header>
        <div>
          <span>ROI chart</span>
          <h4>{brief.roiChart.title}</h4>
          <p>{brief.roiChart.subtitle}</p>
        </div>
        <strong>{formatCurrency(brief.impact.estimatedWeeklyRevenueRecovery)}</strong>
      </header>
      <div className="metricloop-roi-bars">
        {brief.roiChart.data.map((point) => (
          <div className={'metricloop-roi-row ' + point.tone} key={point.label}>
            <div>
              <span>{point.label}</span>
              <strong>{formatCurrency(point.value)}</strong>
            </div>
            <div className="metricloop-roi-track" aria-hidden="true">
              <i style={{ width: Math.max((point.value / maxValue) * 100, 4) + '%' }} />
            </div>
            <small>{point.detail}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

export function formatMetricLoopDelta(value: number) {
  return formatDelta(value);
}

export function formatMetricLoopPercent(value: number) {
  return formatPercent(value);
}

export function formatMetricLoopCurrency(value: number) {
  return formatCurrency(value);
}
