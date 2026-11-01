import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  EngineeringRoiChart,
  ReleaseCorrelationTimeline,
  SessionReplayEvidenceStrip,
} from './MetricLoopVisualizations';
import { runMetricLoopInvestigation } from './metricLoopEngine';

describe('MetricLoop visualizations', () => {
  it('does not pre-highlight a candidate release in the broad dashboard state', () => {
    const board = runMetricLoopInvestigation();

    const html = renderToStaticMarkup(<ReleaseCorrelationTimeline board={board} />);

    expect(html).toContain('Recent releases');
    expect(html).not.toContain('Candidate');
    expect(html).not.toContain('release-marker');
    expect(html).not.toContain('candidate release');
  });

  it('only highlights session replay evidence after a replay is selected', () => {
    const board = runMetricLoopInvestigation();

    const broadHtml = renderToStaticMarkup(
      <SessionReplayEvidenceStrip board={board} selectedReplayId={null} />,
    );
    const sampledHtml = renderToStaticMarkup(
      <SessionReplayEvidenceStrip board={board} selectedReplayId="RPL-4821" />,
    );

    expect(broadHtml).not.toContain('class="selected"');
    expect(sampledHtml).toContain('class="selected"');
  });

  it('renders the engineering brief ROI chart as a single report artifact', () => {
    const board = runMetricLoopInvestigation({
      interaction: 'voice_search',
      dateRange: 'last_7_days',
      comparison: 'prior_7_days',
      segment: 'first_time_shoppers',
      region: 'europe',
      productCategory: 'footwear',
    });

    const html = renderToStaticMarkup(<EngineeringRoiChart brief={board.engineeringBrief} />);

    expect(html).toContain('Weekly recovery opportunity');
    expect(html).toContain('Recoverable with fix');
    expect(html).toContain('$');
    expect(html).toContain('metricloop-roi-chart');
  });
});
