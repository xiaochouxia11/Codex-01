import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getWeekendAfterNextRange,
  searchWeatherWeb,
  summarizeStormRisk,
} from './weatherSearch';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('weather web search helper', () => {
  it('resolves weekend after next from the current demo date', () => {
    const range = getWeekendAfterNextRange(new Date('2026-05-11T12:00:00-07:00'));

    expect(range.startIso).toBe('2026-05-23');
    expect(range.endIso).toBe('2026-05-24');
    expect(range.label).toBe('weekend after next');
  });

  it('flags storm risk from Seattle forecast data', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      daily: {
        time: ['2026-05-23', '2026-05-24'],
        precipitation_sum: [22, 18],
        precipitation_probability_max: [92, 85],
        wind_speed_10m_max: [42, 31],
        wind_gusts_10m_max: [68, 52],
        weather_code: [63, 61],
      },
    }))) as typeof fetch;

    const result = await searchWeatherWeb({
      location: 'Seattle, WA',
      dateText: 'weekend after next',
      today: new Date('2026-05-11T12:00:00-07:00'),
    });

    expect(result.status).toBe('done');
    expect(result.location).toBe('Seattle, WA');
    expect(result.stormRisk).toBe('high');
    expect(result.summary).toContain('stormy');
    expect(result.recommendation).toContain('heavier rain-rated tent');
    expect(result.source.url).toContain('api.open-meteo.com');
  });

  it('keeps light rain distinct from a storm', () => {
    const risk = summarizeStormRisk([
      {
        dateIso: '2026-05-23',
        precipitationMm: 4,
        precipitationProbability: 55,
        windSpeedKph: 14,
        windGustKph: 22,
        weatherCode: 51,
      },
    ]);

    expect(risk.stormRisk).toBe('low');
    expect(risk.summary).toContain('not a storm signal');
  });
});
