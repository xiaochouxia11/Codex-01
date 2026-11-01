import { describe, expect, it } from 'vitest';
import { getToolDelayMs } from '../demoExperience';
import { SUPPLY_REALTIME_INSTRUCTIONS, SUPPLY_REALTIME_TOOLS } from './supplyPrompt';

describe('Supply realtime prompt contract', () => {
  it('exposes saved profile lookup for the personalized shoe step', () => {
    expect(SUPPLY_REALTIME_TOOLS.map((tool) => tool.name)).toContain('get_saved_profile');
    expect(SUPPLY_REALTIME_INSTRUCTIONS).toContain('US 10');
    expect(SUPPLY_REALTIME_INSTRUCTIONS).toContain('get_saved_profile');
  });

  it('only delays realistic happy-path tool calls', () => {
    expect(getToolDelayMs('search_products')).toBeGreaterThan(0);
    expect(getToolDelayMs('apply_filters')).toBeGreaterThan(0);
    expect(getToolDelayMs('get_saved_profile')).toBeGreaterThan(0);
    expect(getToolDelayMs('add_to_cart')).toBeGreaterThan(0);
    expect(getToolDelayMs('get_hiking_needs')).toBe(0);
    expect(getToolDelayMs('go_to_cart')).toBe(0);
    expect(getToolDelayMs('select_shoe_size')).toBe(0);
    expect(getToolDelayMs('search_weather_web')).toBeGreaterThan(0);
  });

  it('exposes product review summarization for realistic shopping questions', () => {
    expect(SUPPLY_REALTIME_TOOLS.map((tool) => tool.name)).toContain('summarize_product_reviews');
    expect(SUPPLY_REALTIME_INSTRUCTIONS).toContain('summarize_product_reviews');
    expect(SUPPLY_REALTIME_INSTRUCTIONS).toContain('bad reviews');
    expect(getToolDelayMs('summarize_product_reviews')).toBeGreaterThan(0);
  });

  it('keeps follow-up product references casual after naming the product once', () => {
    expect(SUPPLY_REALTIME_INSTRUCTIONS).toContain('After naming a product once');
    expect(SUPPLY_REALTIME_INSTRUCTIONS).toContain('avoid repeating the full product title');
  });

  it('requires direct requirement language instead of hedged shopping guidance', () => {
    expect(SUPPLY_REALTIME_INSTRUCTIONS).toContain('Use direct shopping guidance for requirements');
    expect(SUPPLY_REALTIME_INSTRUCTIONS).toContain('Say "You need a tent"');
    expect(SUPPLY_REALTIME_INSTRUCTIONS.toLowerCase()).not.toMatch(/\busually\b|\btypically\b|\bgenerally\b|\bnormally\b|\bin most cases\b/);
  });

  it('exposes weather web search for trip-risk follow-ups', () => {
    expect(SUPPLY_REALTIME_TOOLS.map((tool) => tool.name)).toContain('search_weather_web');
    expect(SUPPLY_REALTIME_INSTRUCTIONS).toContain('search_weather_web');
    expect(SUPPLY_REALTIME_INSTRUCTIONS).toContain('storm');
  });

  it('includes Realtime 2 prompt-guide guardrails', () => {
    expect(SUPPLY_REALTIME_INSTRUCTIONS).toContain('# Reasoning');
    expect(SUPPLY_REALTIME_INSTRUCTIONS).toContain('# Message Channels');
    expect(SUPPLY_REALTIME_INSTRUCTIONS).toContain('# Unclear Audio');
    expect(SUPPLY_REALTIME_INSTRUCTIONS).toContain('# Entity Capture');
    expect(SUPPLY_REALTIME_INSTRUCTIONS).toContain('Do not expose hidden reasoning');
    expect(SUPPLY_REALTIME_INSTRUCTIONS).toContain('Do not provide a preamble or call tools when audio is unclear.');
    expect(SUPPLY_REALTIME_INSTRUCTIONS).toContain('Use only the tools explicitly provided');
    expect(SUPPLY_REALTIME_INSTRUCTIONS).toMatch(/confirm item, size, quantity, and consequence before write actions/i);
  });
});
