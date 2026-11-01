import { describe, expect, it } from 'vitest';
import { runMetricLoopInvestigation } from './metricLoopEngine';

describe('runMetricLoopInvestigation', () => {
  it('finds the Europe first-time shopper activation drop and ties it to the storefront shoe-size path', () => {
    const board = runMetricLoopInvestigation({
      interaction: 'voice_search',
      dateRange: 'last_7_days',
      comparison: 'prior_7_days',
      segment: 'first_time_shoppers',
      region: 'europe',
      productCategory: 'footwear',
    });

    expect(board.segmentLabel).toBe(
      'Voice search / Europe / first-time shoppers / last 7 days',
    );
    expect(board.filters.excludePaidAds).toBe(false);
    expect(board.filters.segment).toBe('first-time shoppers');
    expect(
      board.funnel.find((step) => step.step === 'shoe_size_selected')?.delta,
    ).toBeLessThan(-10);
    expect(board.correlatedRelease.title).toContain('size selector');
    expect(board.supportThemes[0]).toMatchObject({
      theme: 'Could not add hiking boots after choosing size',
      count: 28,
    });
    expect(board.representativeSessions[0]?.productTitle).toBe(
      'Waterproof Trail Hiking Boots',
    );
    expect(board.confidence).toBe('High');
  });

  it('starts with a broad dashboard view before filters expose the cohort problem', () => {
    const board = runMetricLoopInvestigation();

    expect(board.segmentLabel).toBe(
      'All interactions / All regions / last 30 days',
    );
    expect(board.filters.segment).toBe('All shoppers');
    expect(
      board.funnel.find((step) => step.step === 'add_to_cart_clicked')?.delta,
    ).toBeGreaterThan(-6);
    expect(board.supportThemes[0].count).toBeLessThan(10);
    expect(board.confidence).toBe('Low');
  });

  it('reframes an existing report when the date filter changes to the last 7 days', () => {
    const question = 'Why did activation drop?';
    const broadBoard = runMetricLoopInvestigation({ question });
    const lastSevenBoard = runMetricLoopInvestigation({
      question,
      dateRange: 'last_7_days',
    });

    const broadWindowSignal = broadBoard.driverSignals.find(
      (signal) => signal.label === 'Time window',
    );
    const lastSevenWindowSignal = lastSevenBoard.driverSignals.find(
      (signal) => signal.label === 'Time window',
    );

    expect(lastSevenBoard.question).toBe(question);
    expect(lastSevenBoard.analysisUpdate.scope).toContain('Last 7 days');
    expect(lastSevenBoard.analysisUpdate.summary).not.toBe(
      broadBoard.analysisUpdate.summary,
    );
    expect(lastSevenWindowSignal?.score).toBeGreaterThan(
      broadWindowSignal?.score ?? 0,
    );
    expect(lastSevenBoard.driverSignals.map((signal) => signal.label)).toEqual([
      'Time window',
      'Cohort focus',
      'Funnel break',
      'Browser split',
      'Support and replay',
    ]);
  });

  it('surfaces different scoped hypotheses when filters point at different possible problems', () => {
    const question = 'Why did activation drop?';
    const broadBoard = runMetricLoopInvestigation({ question });
    const paidAdsBoard = runMetricLoopInvestigation({
      question,
      dateRange: 'last_7_days',
      segment: 'first_time_shoppers',
      trafficSource: 'paid_ads',
    });
    const safariBoard = runMetricLoopInvestigation({
      question,
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

    expect(broadBoard.scopedReport.summary).toContain('kept as baseline');
    expect(broadBoard.scopedReport.hypotheses[0]).toMatchObject({
      label: 'No isolated root cause yet',
      status: 'watch',
    });
    expect(paidAdsBoard.analysisUpdate.primaryDriver).toBe(
      'Paid landing-page mismatch',
    );
    expect(paidAdsBoard.scopedReport.hypotheses[0]).toMatchObject({
      label: 'Paid landing-page mismatch',
      status: 'primary',
    });
    expect(paidAdsBoard.scopedReport.hypotheses[1].label).not.toBe(
      safariBoard.scopedReport.hypotheses[1].label,
    );
    expect(safariBoard.scopedReport.hypotheses[0]).toMatchObject({
      label: 'Mobile Safari size selector regression',
      status: 'primary',
    });
    expect(safariBoard.scopedReport.summary).toContain(
      'same investigation question',
    );
  });

  it('includes deterministic mock analytics data for the notebook visualizations', () => {
    const broadBoard = runMetricLoopInvestigation();
    const board = runMetricLoopInvestigation({
      interaction: 'voice_search',
      dateRange: 'last_7_days',
      comparison: 'prior_7_days',
      segment: 'first_time_shoppers',
      region: 'europe',
      productCategory: 'footwear',
    });

    expect(
      board.searchIntents.some((intent) => intent.term === 'hiking boots'),
    ).toBe(true);
    expect(
      board.searchIntents.find((intent) => intent.term === 'hiking boots'),
    ).toMatchObject({
      topProduct: 'Waterproof Trail Hiking Boots',
    });
    expect(
      board.releaseTimeline.some((point) =>
        point.release?.includes('size selector'),
      ),
    ).toBe(true);
    expect(
      board.sessionEvents
        .flatMap((session) => session.events)
        .some(
          (event) =>
            event.label === 'shoe_size_selected' && event.status === 'warning',
        ),
    ).toBe(true);
    expect(board.evidenceSteps.map((step) => step.label)).toEqual([
      'Segment selected',
      'Funnel compared',
      'Release correlated',
      'Tickets clustered',
      'Sessions sampled',
    ]);
    expect(board.alternativeCauses.map((cause) => cause.label)).toContain(
      'Paid ads quality',
    );
    expect(board.hypothesisScores[0].hypothesis).toBe(
      'Mobile Safari size selector regression',
    );
    expect(board.hypothesisScores[0].score).toBeGreaterThan(
      broadBoard.hypothesisScores[0].score,
    );
    expect(board.recommendedExperiment.title).toContain('size selector');
  });

  it('updates the conclusion when paid ads are excluded and mobile Safari is compared against Chrome', () => {
    const initialBoard = runMetricLoopInvestigation();
    const board = runMetricLoopInvestigation({
      mode: 'browser_comparison',
      excludePaidAds: true,
    });

    expect(board.filters.excludePaidAds).toBe(true);
    expect(board.filters.browserComparison).toBe('Mobile Safari vs Chrome');
    expect(board.conclusion).not.toBe(initialBoard.conclusion);
    expect(board.conclusion).toContain('Mobile Safari');
    expect(board.conclusion).toContain('size selector');
    expect(board.recommendation).toContain('Safari');
    expect(
      board.representativeSessions.every(
        (session) => session.channel !== 'Paid ads',
      ),
    ).toBe(true);
  });

  it('does not overstate confidence when browser comparison is applied before cohort filters', () => {
    const board = runMetricLoopInvestigation({
      dateRange: 'last_7_days',
      mode: 'browser_comparison',
      browser: 'mobile_safari',
    });

    expect(board.confidence).toBe('Medium');
    expect(board.analysisUpdate.summary).toContain(
      'checked against release timing',
    );
    expect(
      board.driverSignals.find((signal) => signal.label === 'Cohort focus')
        ?.score,
    ).toBeLessThan(50);
    expect(board.conclusion).not.toContain('After excluding paid ads');
    expect(board.engineeringBrief.summary).not.toContain(
      'paid ads are excluded',
    );
    expect(board.engineeringBrief.ticket.priority).toBe('P2');
  });

  it('updates hypotheses and experiments when the report is rerun for browser comparison', () => {
    const filteredBoard = runMetricLoopInvestigation({
      interaction: 'voice_search',
      dateRange: 'last_7_days',
      comparison: 'prior_7_days',
      segment: 'first_time_shoppers',
      region: 'europe',
      productCategory: 'footwear',
    });
    const browserBoard = runMetricLoopInvestigation({
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

    const filteredBrowserSignal = filteredBoard.driverSignals.find(
      (signal) => signal.label === 'Browser split',
    );
    const browserSignal = browserBoard.driverSignals.find(
      (signal) => signal.label === 'Browser split',
    );

    expect(browserBoard.analysisUpdate.primaryDriver).toContain(
      'Mobile Safari',
    );
    expect(browserSignal?.score).toBeGreaterThan(
      filteredBrowserSignal?.score ?? 0,
    );
    expect(
      browserBoard.alternativeCauses.find(
        (cause) => cause.label === 'Paid ads quality',
      )?.reason,
    ).toContain('after excluding paid ads');
    expect(browserBoard.recommendedExperiment.title).toContain('Safari');
    expect(browserBoard.engineeringBrief.summary).not.toBe(
      filteredBoard.engineeringBrief.summary,
    );
  });

  it('generates a ticket-ready engineering brief with one ROI chart', () => {
    const board = runMetricLoopInvestigation({
      interaction: 'voice_search',
      dateRange: 'last_7_days',
      comparison: 'prior_7_days',
      segment: 'first_time_shoppers',
      region: 'europe',
      productCategory: 'footwear',
    });

    expect(board.engineeringBrief.title).toBe('Engineering ticket brief');
    expect(board.engineeringBrief.summary).toContain(
      'Mobile Safari size selector',
    );
    expect(board.engineeringBrief.roiChart.title).toBe(
      'Weekly recovery opportunity',
    );
    expect(
      board.engineeringBrief.roiChart.data.map((point) => point.label),
    ).toEqual([
      'Current captured revenue',
      'Regression gap',
      'Recoverable with fix',
      'Residual risk',
    ]);
    expect(
      board.engineeringBrief.roiChart.data.find(
        (point) => point.label === 'Recoverable with fix',
      )?.value,
    ).toBeGreaterThan(10000);
    expect(board.engineeringBrief.ticket.title).toContain('PDP size selector');
    expect(board.engineeringBrief.ticket.acceptanceCriteria).toContain(
      'Mobile Safari first-time shoppers can select a boot size and add to cart without a disabled-state loop.',
    );
  });
});
