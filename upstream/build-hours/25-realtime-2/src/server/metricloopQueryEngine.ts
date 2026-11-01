import {
  METRIC_LOOP_FORENSICS_DIMENSIONS,
  summarizeActivationByCohort,
  type MetricLoopCohortSummaryRow,
  type MetricLoopForensicsDimension,
  type MetricLoopForensicsWarehouse,
} from '../metricloop/metricLoopForensicsData';

export interface MetricLoopCohortQueryPlan {
  dimensions: string[];
  filters?: Record<string, string | boolean | undefined>;
  metric?: 'activation_rate';
  orderBy?: 'lost_activations' | 'drop_pp' | 'absolute_drop' | 'current_activation_rate' | 'prior_activation_rate';
  limit?: number;
}

export interface MetricLoopCohortQueryResult {
  rows: MetricLoopCohortSummaryRow[];
  rowCount: number;
}

const dimensionSet = new Set<string>(METRIC_LOOP_FORENSICS_DIMENSIONS);

export function executeCohortQuery(
  warehouse: MetricLoopForensicsWarehouse,
  plan: MetricLoopCohortQueryPlan,
): MetricLoopCohortQueryResult {
  const dimensions = normalizeDimensions(plan.dimensions);
  const filters = normalizeFilters(plan.filters ?? {});
  const limit = Math.max(1, Math.min(50, Number(plan.limit ?? 20)));

  const rows = summarizeActivationByCohort(warehouse, dimensions, filters);
  const sortedRows = sortRows(rows, plan.orderBy ?? 'lost_activations').slice(0, limit);

  return {
    rows: sortedRows,
    rowCount: rows.length,
  };
}

function normalizeDimensions(dimensions: string[]): MetricLoopForensicsDimension[] {
  if (!Array.isArray(dimensions) || dimensions.length === 0) {
    throw new Error('A cohort query needs at least one dimension.');
  }

  const normalized: MetricLoopForensicsDimension[] = [];
  for (const dimension of dimensions) {
    if (!dimensionSet.has(dimension)) {
      throw new Error('Unsupported dimension: ' + dimension);
    }
    if (!normalized.includes(dimension as MetricLoopForensicsDimension)) {
      normalized.push(dimension as MetricLoopForensicsDimension);
    }
  }
  return normalized;
}

function normalizeFilters(filters: Record<string, string | boolean | undefined>) {
  const normalized: Partial<Record<MetricLoopForensicsDimension, string>> = {};

  for (const [key, value] of Object.entries(filters)) {
    if (key === 'excludePaidAds') continue;
    if (!dimensionSet.has(key)) {
      throw new Error('Unsupported filter dimension: ' + key);
    }
    if (typeof value === 'string' && value !== 'all') {
      normalized[key as MetricLoopForensicsDimension] = value;
    }
  }

  if (filters.excludePaidAds === true) {
    normalized.traffic_source = 'organic';
  }

  return normalized;
}

function sortRows(rows: MetricLoopCohortSummaryRow[], orderBy: NonNullable<MetricLoopCohortQueryPlan['orderBy']>) {
  return [...rows].sort((a, b) => {
    if (orderBy === 'current_activation_rate') return b.current_activation_rate - a.current_activation_rate;
    if (orderBy === 'prior_activation_rate') return b.prior_activation_rate - a.prior_activation_rate;
    if (orderBy === 'drop_pp' || orderBy === 'absolute_drop') return b.drop_pp - a.drop_pp;
    return b.lost_activations - a.lost_activations;
  });
}
