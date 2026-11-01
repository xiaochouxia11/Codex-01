import { describe, expect, it } from 'vitest';
import {
  applyMetricLoopFilterPatch,
  createMetricLoopInvestigationBoardForFilters,
  createDefaultMetricLoopDashboardFilters,
  getMetricLoopFilterChips,
  getMetricLoopInvestigationOptionsForFilters,
} from './metricLoopDashboardFilters';
import { runMetricLoopInvestigation } from './metricLoopEngine';

describe('MetricLoop dashboard filters', () => {
  it('starts broad so voice can demonstrate simple filter actions', () => {
    const filters = createDefaultMetricLoopDashboardFilters();

    expect(filters).toMatchObject({
      interaction: 'all',
      region: 'all',
      dateRange: 'last_30_days',
      comparison: 'none',
      segment: 'all_shoppers',
      productCategory: 'all',
    });
    expect(getMetricLoopFilterChips(filters)).toEqual([
      'All interactions',
      'All regions',
      'Last 30 days',
      'No comparison',
      'All shoppers',
      'All categories',
    ]);
  });

  it('applies the simple voice filter sequence before investigation', () => {
    const filters = createDefaultMetricLoopDashboardFilters();
    const nextFilters = applyMetricLoopFilterPatch(filters, {
      interaction: 'voice_search',
      region: 'europe',
      dateRange: 'last_7_days',
      comparison: 'prior_7_days',
      segment: 'first_time_shoppers',
      productCategory: 'footwear',
    });

    expect(nextFilters).toMatchObject({
      interaction: 'voice_search',
      region: 'europe',
      dateRange: 'last_7_days',
      comparison: 'prior_7_days',
      segment: 'first_time_shoppers',
      productCategory: 'footwear',
    });
    expect(getMetricLoopFilterChips(nextFilters)).toEqual([
      'Voice search',
      'Europe',
      'Last 7 days',
      'vs prior 7 days',
      'First-time shoppers',
      'Footwear',
    ]);
  });

  it('recomputes analytics as voice filters narrow the cohort', () => {
    const broadFilters = createDefaultMetricLoopDashboardFilters();
    const broadBoard = runMetricLoopInvestigation(
      getMetricLoopInvestigationOptionsForFilters(broadFilters),
    );

    const focusedFilters = applyMetricLoopFilterPatch(broadFilters, {
      interaction: 'voice_search',
      region: 'europe',
      dateRange: 'last_7_days',
      comparison: 'prior_7_days',
      segment: 'first_time_shoppers',
      productCategory: 'footwear',
    });
    const focusedBoard = runMetricLoopInvestigation(
      getMetricLoopInvestigationOptionsForFilters(focusedFilters),
    );

    const broadCartStep = broadBoard.funnel.find(
      (step) => step.step === 'add_to_cart_clicked',
    );
    const focusedCartStep = focusedBoard.funnel.find(
      (step) => step.step === 'add_to_cart_clicked',
    );
    const broadHikingBoots = broadBoard.searchIntents.find(
      (intent) => intent.term === 'hiking boots',
    );
    const focusedHikingBoots = focusedBoard.searchIntents.find(
      (intent) => intent.term === 'hiking boots',
    );

    expect(broadBoard.segmentLabel).toBe(
      'All interactions / All regions / last 30 days',
    );
    expect(focusedBoard.segmentLabel).toBe(
      'Voice search / Europe / first-time shoppers / last 7 days',
    );
    expect(broadCartStep?.delta).toBeGreaterThan(-6);
    expect(focusedCartStep?.delta).toBeLessThan(-14);
    expect(focusedBoard.supportThemes[0].count).toBeGreaterThan(
      broadBoard.supportThemes[0].count,
    );
    expect(focusedHikingBoots?.delta).toBeLessThan(
      broadHikingBoots?.delta ?? 0,
    );
  });

  it('preserves an existing report question when filters update the notebook', () => {
    const question = 'Why did activation drop?';
    const filters = createDefaultMetricLoopDashboardFilters();
    const existingBoard = createMetricLoopInvestigationBoardForFilters(
      filters,
      { question },
    );
    const nextFilters = applyMetricLoopFilterPatch(filters, {
      dateRange: 'last_7_days',
    });

    const updatedBoard = createMetricLoopInvestigationBoardForFilters(
      nextFilters,
      {
        previousBoard: existingBoard,
      },
    );

    expect(updatedBoard.question).toBe(question);
    expect(updatedBoard.analysisUpdate.scope).toContain('Last 7 days');
    expect(updatedBoard.analysisUpdate.summary).not.toBe(
      existingBoard.analysisUpdate.summary,
    );
  });
});
