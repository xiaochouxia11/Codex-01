import { describe, expect, it } from 'vitest';
import {
  getForensicsSchema,
  getMetricLoopForensicsWarehouse,
  summarizeActivationByCohort,
} from './metricLoopForensicsData';

describe('MetricLoop forensics warehouse', () => {
  it('contains enough deterministic raw data for multi-step cohort analysis', () => {
    const warehouse = getMetricLoopForensicsWarehouse();

    expect(warehouse.sessions.length).toBeGreaterThanOrEqual(600);
    expect(warehouse.events.length).toBeGreaterThanOrEqual(2500);
    expect(warehouse.products.length).toBeGreaterThanOrEqual(4);
    expect(warehouse.releases.some((release) => release.release_id === 'rel-pdp-size-validation')).toBe(true);
  });

  it('seeds the largest activation loss in Mobile Safari Europe first-time footwear voice search', () => {
    const warehouse = getMetricLoopForensicsWarehouse();

    const rows = summarizeActivationByCohort(warehouse, [
      'browser',
      'region',
      'shopper_type',
      'product_category',
      'interaction',
    ]);

    const [topLoss] = rows.sort((a, b) => b.lost_activations - a.lost_activations);

    expect(topLoss).toMatchObject({
      browser: 'mobile_safari',
      region: 'europe',
      shopper_type: 'first_time_shoppers',
      product_category: 'footwear',
      interaction: 'voice_search',
    });
    expect(topLoss.prior_activation_rate - topLoss.current_activation_rate).toBeGreaterThan(0.18);
    expect(topLoss.lost_activations).toBeGreaterThan(25);
  });

  it('keeps Chrome and typed-search controls near baseline', () => {
    const warehouse = getMetricLoopForensicsWarehouse();
    const rows = summarizeActivationByCohort(warehouse, [
      'browser',
      'region',
      'shopper_type',
      'product_category',
      'interaction',
    ]);

    const chromeControl = rows.find((row) =>
      row.browser === 'chrome' &&
      row.region === 'europe' &&
      row.shopper_type === 'first_time_shoppers' &&
      row.product_category === 'footwear' &&
      row.interaction === 'voice_search'
    );
    const typedSearchControl = rows.find((row) =>
      row.browser === 'mobile_safari' &&
      row.region === 'europe' &&
      row.shopper_type === 'first_time_shoppers' &&
      row.product_category === 'footwear' &&
      row.interaction === 'typed_search'
    );

    expect(chromeControl).toBeDefined();
    expect(Math.abs((chromeControl?.prior_activation_rate ?? 0) - (chromeControl?.current_activation_rate ?? 0))).toBeLessThan(0.04);
    expect(typedSearchControl).toBeDefined();
    expect(Math.abs((typedSearchControl?.prior_activation_rate ?? 0) - (typedSearchControl?.current_activation_rate ?? 0))).toBeLessThan(0.05);
  });

  it('makes paid traffic a confounder but not the primary explanation', () => {
    const warehouse = getMetricLoopForensicsWarehouse();
    const rows = summarizeActivationByCohort(warehouse, ['traffic_source', 'browser'], {
      region: 'europe',
      shopper_type: 'first_time_shoppers',
      product_category: 'footwear',
      interaction: 'voice_search',
    });

    const organicMobileSafari = rows.find((row) => row.traffic_source === 'organic' && row.browser === 'mobile_safari');
    const paidMobileSafari = rows.find((row) => row.traffic_source === 'paid_ads' && row.browser === 'mobile_safari');

    expect(organicMobileSafari?.lost_activations).toBeGreaterThan(15);
    expect(paidMobileSafari?.lost_activations).toBeGreaterThan(5);
    expect(organicMobileSafari?.lost_activations ?? 0).toBeGreaterThan(paidMobileSafari?.lost_activations ?? 0);
  });

  it('keeps size-selection instrumentation alive while validation behavior changes', () => {
    const warehouse = getMetricLoopForensicsWarehouse();

    const affectedSizeEvents = warehouse.events.filter((event) =>
      event.period === 'current' &&
      event.event_name === 'shoe_size_selected' &&
      event.browser === 'mobile_safari' &&
      event.region === 'europe' &&
      event.shopper_type === 'first_time_shoppers' &&
      event.product_category === 'footwear' &&
      event.interaction === 'voice_search'
    );
    const blockedSizeEvents = affectedSizeEvents.filter((event) => event.validation_state === 'blocked_size_validation');

    expect(affectedSizeEvents.length).toBeGreaterThan(100);
    expect(blockedSizeEvents.length / affectedSizeEvents.length).toBeGreaterThan(0.45);
  });

  it('publishes a schema that matches the visible query tools', () => {
    const schema = getForensicsSchema();

    expect(schema.tables.map((table) => table.name)).toEqual(expect.arrayContaining([
      'events',
      'sessions',
      'products',
      'releases',
      'support_tickets',
      'instrumentation_checks',
    ]));
    expect(schema.dimensions).toEqual(expect.arrayContaining(['browser', 'region', 'shopper_type', 'product_category', 'interaction']));
    expect(schema.measures).toEqual(expect.arrayContaining(['activation_rate', 'lost_activations']));
  });
});
