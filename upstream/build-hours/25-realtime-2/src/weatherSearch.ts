export type StormRisk = 'low' | 'moderate' | 'high' | 'unknown';

export type WeatherSearchRequest = {
  location?: string;
  dateText?: string;
  concern?: string;
  today?: Date;
};

export type ForecastWindow = {
  label: string;
  startIso: string;
  endIso: string;
};

export type WeatherDay = {
  dateIso: string;
  precipitationMm: number;
  precipitationProbability: number;
  windSpeedKph: number;
  windGustKph: number;
  weatherCode: number;
};

export type WeatherSearchResponse = {
  status: 'done' | 'fallback';
  location: string;
  query: string;
  forecastWindow: ForecastWindow;
  source: {
    label: string;
    url: string;
  };
  stormRisk: StormRisk;
  summary: string;
  recommendation: string;
  daily: WeatherDay[];
};

type OpenMeteoDaily = {
  time?: string[];
  precipitation_sum?: number[];
  precipitation_probability_max?: number[];
  wind_speed_10m_max?: number[];
  wind_gusts_10m_max?: number[];
  weather_code?: number[];
};

type OpenMeteoResponse = {
  daily?: OpenMeteoDaily;
};

const SEATTLE = {
  label: 'Seattle, WA',
  latitude: 47.6062,
  longitude: -122.3321,
  timezone: 'America/Los_Angeles',
};

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getWeekendAfterNextRange(today = new Date()): ForecastWindow {
  const dayOfWeek = today.getDay();
  const daysUntilNextSaturday = ((6 - dayOfWeek + 7) % 7) || 7;
  const start = addDays(today, daysUntilNextSaturday + 7);
  const end = addDays(start, 1);

  return {
    label: 'weekend after next',
    startIso: isoDate(start),
    endIso: isoDate(end),
  };
}

function buildOpenMeteoUrl() {
  const params = new URLSearchParams({
    latitude: String(SEATTLE.latitude),
    longitude: String(SEATTLE.longitude),
    daily: [
      'weather_code',
      'precipitation_sum',
      'precipitation_probability_max',
      'wind_speed_10m_max',
      'wind_gusts_10m_max',
    ].join(','),
    timezone: SEATTLE.timezone,
    forecast_days: '16',
  });

  return 'https://api.open-meteo.com/v1/forecast?' + params.toString();
}

function getDailyNumber(values: number[] | undefined, index: number) {
  const value = values?.[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function parseDailyForecast(data: OpenMeteoResponse, window: ForecastWindow): WeatherDay[] {
  const daily = data.daily;
  if (!daily?.time) return [];

  return daily.time
    .map((dateIso, index): WeatherDay | null => {
      if (dateIso < window.startIso || dateIso > window.endIso) return null;
      return {
        dateIso,
        precipitationMm: getDailyNumber(daily.precipitation_sum, index),
        precipitationProbability: getDailyNumber(daily.precipitation_probability_max, index),
        windSpeedKph: getDailyNumber(daily.wind_speed_10m_max, index),
        windGustKph: getDailyNumber(daily.wind_gusts_10m_max, index),
        weatherCode: getDailyNumber(daily.weather_code, index),
      };
    })
    .filter((day): day is WeatherDay => Boolean(day));
}

export function summarizeStormRisk(daily: WeatherDay[]) {
  if (!daily.length) {
    return {
      stormRisk: 'unknown' as const,
      summary: 'I could not find enough forecast detail for that weekend.',
      recommendation: 'Use the tent reviews as the fallback signal and avoid relying on a light-duty tent for severe weather.',
    };
  }

  const maxPrecipitation = Math.max(...daily.map((day) => day.precipitationMm));
  const maxProbability = Math.max(...daily.map((day) => day.precipitationProbability));
  const maxWind = Math.max(...daily.map((day) => day.windSpeedKph));
  const maxGust = Math.max(...daily.map((day) => day.windGustKph));
  const hasHeavyWeatherCode = daily.some((day) => [63, 65, 67, 80, 81, 82, 95, 96, 99].includes(day.weatherCode));

  if (maxPrecipitation >= 15 || maxProbability >= 80 || maxWind >= 38 || maxGust >= 55 || hasHeavyWeatherCode) {
    return {
      stormRisk: 'high' as const,
      summary: 'The forecast looks stormy: up to ' + Math.round(maxPrecipitation) + ' mm of precipitation, ' + Math.round(maxProbability) + '% precipitation odds, and gusts near ' + Math.round(maxGust) + ' kph.',
      recommendation: 'Given the low-star tent reviews around heavy storms, I would switch to a heavier rain-rated tent or plan a backup shelter.',
    };
  }

  if (maxPrecipitation >= 7 || maxProbability >= 65 || maxWind >= 25 || maxGust >= 38) {
    return {
      stormRisk: 'moderate' as const,
      summary: 'The forecast points to wet weather, but not a clear storm: up to ' + Math.round(maxPrecipitation) + ' mm of precipitation and gusts near ' + Math.round(maxGust) + ' kph.',
      recommendation: 'The tent is probably fine for a normal rainy weekend, but I would add a footprint and stake kit.',
    };
  }

  return {
    stormRisk: 'low' as const,
    summary: 'The forecast shows light rain potential, not a storm signal: up to ' + Math.round(maxPrecipitation) + ' mm of precipitation and gusts near ' + Math.round(maxGust) + ' kph.',
    recommendation: 'The current tent choice still makes sense for the trip, assuming the forecast holds.',
  };
}

function fallbackForecast(window: ForecastWindow): WeatherDay[] {
  return [
    {
      dateIso: window.startIso,
      precipitationMm: 11,
      precipitationProbability: 72,
      windSpeedKph: 24,
      windGustKph: 36,
      weatherCode: 61,
    },
    {
      dateIso: window.endIso,
      precipitationMm: 6,
      precipitationProbability: 58,
      windSpeedKph: 18,
      windGustKph: 29,
      weatherCode: 51,
    },
  ];
}

export async function searchWeatherWeb({
  location = SEATTLE.label,
  dateText = 'weekend after next',
  today = new Date(),
}: WeatherSearchRequest): Promise<WeatherSearchResponse> {
  const forecastWindow = getWeekendAfterNextRange(today);
  const query = location + ' weather forecast ' + dateText;
  const url = buildOpenMeteoUrl();

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Weather lookup failed with ' + response.status);
    const data = (await response.json()) as OpenMeteoResponse;
    const daily = parseDailyForecast(data, forecastWindow);
    const summary = summarizeStormRisk(daily);

    return {
      status: 'done',
      location,
      query,
      forecastWindow,
      source: {
        label: 'Open-Meteo forecast',
        url,
      },
      ...summary,
      daily,
    };
  } catch {
    const daily = fallbackForecast(forecastWindow);
    const summary = summarizeStormRisk(daily);

    return {
      status: 'fallback',
      location,
      query,
      forecastWindow,
      source: {
        label: 'Demo fallback forecast',
        url,
      },
      ...summary,
      daily,
    };
  }
}
