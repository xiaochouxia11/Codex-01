import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MetricLoopNotebook } from './MetricLoopNotebook';
import { runMetricLoopInvestigation } from './metricLoopEngine';
import type { MetricLoopToolActivity } from './metricLoopContracts';

describe('MetricLoopNotebook', () => {
  it('renders a concise hypothesis memo generated from the current report filters', () => {
    const board = runMetricLoopInvestigation({
      question: 'Why did activation drop?',
      dateRange: 'last_7_days',
    });

    const html = renderToStaticMarkup(
      <MetricLoopNotebook
        board={board}
        highlighted={false}
        isExpanded={false}
        onExpandedChange={() => {}}
      />,
    );

    expect(html).toContain('Working hypothesis');
    expect(html).toContain('Supporting evidence');
    expect(html).toContain('Last 7 days');
    expect(html).toContain('Time window');
    expect(html).toContain('Recent activation softening');
    expect(html).toContain('The last 7 days add recency signal');
  });

  it('updates the signal map copy for the Mobile Safari comparison report', () => {
    const board = runMetricLoopInvestigation({
      question: 'Why did activation drop?',
      interaction: 'voice_search',
      dateRange: 'last_7_days',
      comparison: 'prior_7_days',
      segment: 'first_time_shoppers',
      region: 'europe',
      productCategory: 'footwear',
      mode: 'browser_comparison',
      browser: 'mobile_safari',
      excludePaidAds: true,
    });

    const html = renderToStaticMarkup(
      <MetricLoopNotebook
        board={board}
        highlighted={false}
        isExpanded
        onExpandedChange={() => {}}
      />,
    );

    expect(html).toContain('Mobile Safari size selector regression');
    expect(html).toContain('Mobile Safari remains the outlier');
    expect(html).toContain('Paid ads excluded');
    expect(html).toContain('Mobile Safari vs Chrome');
  });

  it('renders a scoped hypothesis update with ranked supporting hypotheses', () => {
    const board = runMetricLoopInvestigation({
      question: 'Why did activation drop?',
      dateRange: 'last_7_days',
      segment: 'first_time_shoppers',
      trafficSource: 'paid_ads',
    });

    const html = renderToStaticMarkup(
      <MetricLoopNotebook
        board={board}
        highlighted={false}
        isExpanded
        onExpandedChange={() => {}}
      />,
    );

    expect(html).toContain('Working hypothesis');
    expect(html).toContain('Supporting evidence');
    expect(html).toContain('Paid landing-page mismatch');
    expect(html).toContain('Primary');
    expect(html).toContain('Original report stays attached');
  });

  it('frames the summary as a concise hypothesis with proof and handoff actions', () => {
    const board = runMetricLoopInvestigation({
      question: 'Why did activation drop?',
      interaction: 'voice_search',
      dateRange: 'last_7_days',
      comparison: 'prior_7_days',
      segment: 'first_time_shoppers',
      region: 'europe',
      productCategory: 'footwear',
      mode: 'browser_comparison',
      browser: 'mobile_safari',
    });
    const prompts: string[] = [];

    const html = renderToStaticMarkup(
      <MetricLoopNotebook
        board={board}
        highlighted={false}
        isExpanded
        onExpandedChange={() => {}}
        onSuggestedPrompt={(prompt) => prompts.push(prompt)}
      />,
    );

    expect(html).toContain('Working hypothesis');
    expect(html).toContain('Run deeper analysis');
    expect(html).toContain('Create Linear issue');
    expect(html).toContain('What could still be wrong');
    expect(html).toContain('Evidence so far');
    expect(html).toContain('Recommended next step');
    expect(html).toContain('Mobile Safari size selector');
  });

  it('keeps the model work trace behind a dedicated notebook tab', () => {
    const board = runMetricLoopInvestigation({
      question: 'Why did activation drop?',
      dateRange: 'last_7_days',
    });
    const activities: MetricLoopToolActivity[] = [
      {
        id: 'query-1',
        name: 'run_cohort_query',
        label: 'Running cohort query',
        status: 'done',
        startedAtMs: 1,
        completedAtMs: 151,
        durationMs: 150,
        details: ['4 cohort rows returned'],
        forensics: {
          kind: 'query',
          title: 'Cohort concentration query',
          purpose: 'Find the cohort with the largest activation loss.',
          query: 'SELECT browser, region, lost_activations FROM checkout_events GROUP BY browser, region',
          evidence: [
            {
              label: 'Cohort concentration',
              verdict: 'supported',
              detail: 'Mobile Safari in Europe accounts for the largest loss.',
            },
          ],
          previewRows: [
            {
              browser: 'Mobile Safari',
              region: 'Europe',
              lost_activations: 42,
            },
          ],
        },
      },
      {
        id: 'code-1',
        name: 'run_analysis_code',
        label: 'Running analysis code',
        status: 'done',
        startedAtMs: 152,
        completedAtMs: 286,
        durationMs: 134,
        forensics: {
          kind: 'code',
          title: 'Generated cohort ranking code',
          code: 'return rows.sort((a, b) => b.lost_activations - a.lost_activations).slice(0, 3);',
          evidence: [
            {
              label: 'Generated cohort ranking',
              verdict: 'confirmed',
              detail: 'Generated reducer ranked Mobile Safari first.',
            },
          ],
        },
      },
    ];

    const html = renderToStaticMarkup(
      <MetricLoopNotebook
        board={board}
        highlighted={false}
        isExpanded
        onExpandedChange={() => {}}
        workbenchActivities={activities}
      />,
    );

    expect(html).toContain('Summary');
    expect(html).toContain('Reasoning trace');
    expect(html).not.toContain('Investigation workbench');
    expect(html).not.toContain('Cohort concentration query');
    expect(html).not.toContain('SELECT browser, region, lost_activations');
    expect(html).not.toContain('Generated cohort ranking code');
  });

  it('shows a live progress card in the reasoning trace while analysis is running', () => {
    const board = runMetricLoopInvestigation({
      question: 'Why did activation drop?',
      dateRange: 'last_7_days',
    });

    const html = renderToStaticMarkup(
      <MetricLoopNotebook
        analysisRun={{
          isActive: true,
          label: 'Running deeper analysis',
          detail: 'Querying impacted cohorts...',
          phase: 'running',
          currentToolName: 'run_cohort_query',
        }}
        board={board}
        highlighted={false}
        isExpanded
        onExpandedChange={() => {}}
      />,
    );

    expect(html).toContain('Analysis run');
    expect(html).toContain('Running deeper analysis');
    expect(html).toContain('Querying impacted cohorts...');
    expect(html).toContain('Cohort query');
    expect(html).toContain('Instrumentation check');
    expect(html).toContain('Update conclusion');
  });

  it('keeps a standard root-cause investigation run on the summary tab', () => {
    const board = runMetricLoopInvestigation({
      question: 'Why did activation drop?',
      dateRange: 'last_7_days',
    });

    const html = renderToStaticMarkup(
      <MetricLoopNotebook
        analysisRun={{
          isActive: true,
          label: 'Running deeper analysis',
          detail: 'Opening root-cause investigation...',
          phase: 'running',
          currentToolName: 'start_root_cause_investigation',
        }}
        board={board}
        highlighted={false}
        isExpanded
        onExpandedChange={() => {}}
      />,
    );

    expect(html).toContain('Working hypothesis');
    expect(html).toContain('Engineering handoff');
    expect(html).not.toContain('Analysis run');
    expect(html).not.toContain('How Lighthouse built this investigation');
  });
});
