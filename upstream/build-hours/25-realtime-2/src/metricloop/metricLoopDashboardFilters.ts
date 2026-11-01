import type { MetricLoopDashboardFilters } from './metricLoopContracts';
import {
  runMetricLoopInvestigation,
  type MetricLoopInvestigationBoard,
  type MetricLoopInvestigationOptions,
} from './metricLoopEngine';

const labelMaps = {
  interaction: {
    all: 'All interactions',
    voice_search: 'Voice search',
    typed_search: 'Typed search',
    manual_click: 'Manual click',
  },
  region: {
    all: 'All regions',
    europe: 'Europe',
    north_america: 'North America',
    apac: 'APAC',
  },
  dateRange: {
    last_7_days: 'Last 7 days',
    last_14_days: 'Last 14 days',
    last_30_days: 'Last 30 days',
  },
  comparison: {
    none: 'No comparison',
    prior_7_days: 'vs prior 7 days',
  },
  segment: {
    all_shoppers: 'All shoppers',
    first_time_shoppers: 'First-time shoppers',
    returning_shoppers: 'Returning shoppers',
  },
  productCategory: {
    all: 'All categories',
    footwear: 'Footwear',
    outerwear: 'Outerwear',
    camping: 'Camping',
  },
} as const;

export function createDefaultMetricLoopDashboardFilters(): MetricLoopDashboardFilters {
  return {
    interaction: 'all',
    dateRange: 'last_30_days',
    comparison: 'none',
    segment: 'all_shoppers',
    region: 'all',
    teamAge: 'all',
    trafficSource: 'all',
    excludePaidAds: false,
    browser: 'all',
    device: 'all',
    productCategory: 'all',
    event: 'activation',
    breakdown: 'none',
    chartType: 'funnel',
  };
}

export function createInvestigationMetricLoopDashboardFilters(
  board: MetricLoopInvestigationBoard,
): MetricLoopDashboardFilters {
  return {
    ...createDefaultMetricLoopDashboardFilters(),
    interaction: 'voice_search',
    dateRange: 'last_7_days',
    comparison: 'prior_7_days',
    segment: 'first_time_shoppers',
    region: 'europe',
    teamAge: 'first_time',
    trafficSource: board.filters.excludePaidAds ? 'organic' : 'all',
    excludePaidAds: board.filters.excludePaidAds,
    browser: board.filters.browserComparison ? 'mobile_safari' : 'all',
    productCategory: 'footwear',
    breakdown: board.filters.browserComparison ? 'browser' : 'none',
  };
}

export function applyMetricLoopFilterPatch(
  current: MetricLoopDashboardFilters,
  patch: Partial<MetricLoopDashboardFilters>,
): MetricLoopDashboardFilters {
  return {
    ...current,
    ...patch,
    trafficSource: patch.excludePaidAds
      ? 'organic'
      : (patch.trafficSource ?? current.trafficSource),
    breakdown:
      patch.browser === 'mobile_safari'
        ? 'browser'
        : (patch.breakdown ?? current.breakdown),
  };
}

export function getMetricLoopFilterChips(
  filters: MetricLoopDashboardFilters,
): string[] {
  const chips: string[] = [
    labelMaps.interaction[filters.interaction],
    labelMaps.region[filters.region],
    labelMaps.dateRange[filters.dateRange],
    labelMaps.comparison[filters.comparison],
    labelMaps.segment[filters.segment],
    labelMaps.productCategory[filters.productCategory],
  ];

  if (filters.excludePaidAds) chips.push('Paid ads excluded');
  if (filters.browser !== 'all')
    chips.push(
      filters.browser === 'mobile_safari'
        ? 'Mobile Safari'
        : labelFromKey(filters.browser),
    );
  if (filters.device !== 'all') chips.push(labelFromKey(filters.device));

  return chips;
}

export function getMetricLoopInvestigationOptionsForFilters(
  filters: MetricLoopDashboardFilters,
): MetricLoopInvestigationOptions {
  return {
    mode:
      filters.breakdown === 'browser' || filters.browser === 'mobile_safari'
        ? 'browser_comparison'
        : 'initial',
    excludePaidAds: filters.excludePaidAds,
    interaction: filters.interaction,
    dateRange: filters.dateRange,
    comparison: filters.comparison,
    segment: filters.segment,
    region: filters.region,
    trafficSource: filters.trafficSource,
    browser: filters.browser,
    device: filters.device,
    productCategory: filters.productCategory,
  };
}

export function createMetricLoopInvestigationBoardForFilters(
  filters: MetricLoopDashboardFilters,
  options: {
    previousBoard?: MetricLoopInvestigationBoard;
    question?: string;
  } = {},
): MetricLoopInvestigationBoard {
  return runMetricLoopInvestigation({
    ...getMetricLoopInvestigationOptionsForFilters(filters),
    question: options.question ?? options.previousBoard?.question,
  });
}

function labelFromKey(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
