import type { ReactElement } from 'react';
import type { MetricLoopDashboardFilters } from './metricLoopContracts';

const selectOptions = {
  interaction: [
    ['all', 'All interactions'],
    ['voice_search', 'Voice search'],
    ['typed_search', 'Typed search'],
    ['manual_click', 'Manual click'],
  ],
  dateRange: [
    ['last_7_days', 'Last 7 days'],
    ['last_14_days', 'Last 14 days'],
    ['last_30_days', 'Last 30 days'],
  ],
  comparison: [
    ['none', 'No comparison'],
    ['prior_7_days', 'Prior 7 days'],
  ],
  segment: [
    ['all_shoppers', 'All shoppers'],
    ['first_time_shoppers', 'First-time shoppers'],
    ['returning_shoppers', 'Returning shoppers'],
  ],
  region: [
    ['all', 'All regions'],
    ['europe', 'Europe'],
    ['north_america', 'North America'],
    ['apac', 'APAC'],
  ],
  trafficSource: [
    ['all', 'All traffic'],
    ['organic', 'Organic search'],
    ['paid_ads', 'Paid ads'],
    ['referral', 'Referral'],
  ],
  browser: [
    ['all', 'All browsers'],
    ['mobile_safari', 'Mobile Safari'],
    ['chrome', 'Chrome'],
    ['firefox', 'Firefox'],
    ['edge', 'Edge'],
  ],
  device: [
    ['all', 'All devices'],
    ['mobile', 'Mobile'],
    ['desktop', 'Desktop'],
  ],
  productCategory: [
    ['all', 'All categories'],
    ['footwear', 'Footwear'],
    ['outerwear', 'Outerwear'],
    ['camping', 'Camping'],
  ],
  breakdown: [
    ['none', 'No breakdown'],
    ['browser', 'Browser'],
    ['device', 'Device'],
    ['traffic_source', 'Traffic source'],
    ['search_term', 'Search term'],
  ],
} as const;

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

export function MetricLoopFilters({
  filters,
  highlighted,
  onChange,
  onRunInvestigation,
}: {
  filters: MetricLoopDashboardFilters;
  highlighted: boolean;
  onChange: (patch: Partial<MetricLoopDashboardFilters>) => void;
  onRunInvestigation: () => void;
}): ReactElement {
  return (
    <section
      className={highlighted ? 'metricloop-filter-builder highlighted' : 'metricloop-filter-builder'}
      data-agent-target="segment-filters"
    >
      <div className="metricloop-filter-row">
        <FilterSelect label="Interaction" value={filters.interaction} options={selectOptions.interaction} onChange={(interaction) => onChange({ interaction: interaction as MetricLoopDashboardFilters['interaction'] })} />
        <FilterSelect label="Date range" value={filters.dateRange} options={selectOptions.dateRange} onChange={(dateRange) => onChange({ dateRange: dateRange as MetricLoopDashboardFilters['dateRange'] })} />
        <FilterSelect label="Compare to" value={filters.comparison} options={selectOptions.comparison} onChange={(comparison) => onChange({ comparison: comparison as MetricLoopDashboardFilters['comparison'] })} />
        <FilterSelect label="Segment" value={filters.segment} options={selectOptions.segment} onChange={(segment) => onChange({ segment: segment as MetricLoopDashboardFilters['segment'] })} />
        <FilterSelect label="Region" value={filters.region} options={selectOptions.region} onChange={(region) => onChange({ region: region as MetricLoopDashboardFilters['region'] })} />
        <FilterSelect label="Traffic" value={filters.trafficSource} options={selectOptions.trafficSource} onChange={(trafficSource) => onChange({ trafficSource: trafficSource as MetricLoopDashboardFilters['trafficSource'] })} />
        <FilterSelect label="Browser" value={filters.browser} options={selectOptions.browser} onChange={(browser) => onChange({ browser: browser as MetricLoopDashboardFilters['browser'] })} />
        <FilterSelect label="Device" value={filters.device} options={selectOptions.device} onChange={(device) => onChange({ device: device as MetricLoopDashboardFilters['device'] })} />
        <FilterSelect label="Category" value={filters.productCategory} options={selectOptions.productCategory} onChange={(productCategory) => onChange({ productCategory: productCategory as MetricLoopDashboardFilters['productCategory'] })} />
        <FilterSelect label="Breakdown" value={filters.breakdown} options={selectOptions.breakdown} onChange={(breakdown) => onChange({ breakdown: breakdown as MetricLoopDashboardFilters['breakdown'] })} />
      </div>
      <div className="metricloop-filter-actions">
        <button
          className={filters.excludePaidAds ? 'active' : ''}
          type="button"
          onClick={() => onChange({ excludePaidAds: !filters.excludePaidAds })}
        >
          {filters.excludePaidAds ? 'Paid ads excluded' : 'Exclude paid ads'}
        </button>
        <button type="button" onClick={onRunInvestigation}>Run investigation</button>
      </div>
    </section>
  );
}
