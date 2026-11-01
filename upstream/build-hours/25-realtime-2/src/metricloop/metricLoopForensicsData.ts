export type MetricLoopForensicsPeriod = 'prior' | 'current';

export type MetricLoopForensicsDimension =
  | 'browser'
  | 'device'
  | 'region'
  | 'traffic_source'
  | 'interaction'
  | 'shopper_type'
  | 'product_category'
  | 'release_version';

export type MetricLoopForensicsEventName =
  | 'session_started'
  | 'voice_search_started'
  | 'typed_search_started'
  | 'manual_click_started'
  | 'search_results_viewed'
  | 'product_card_opened'
  | 'shoe_size_selected'
  | 'add_to_cart_clicked'
  | 'checkout_started';

export type MetricLoopForensicsValue = string | number | boolean | null;

export interface MetricLoopForensicsSession {
  session_id: string;
  person_id: string;
  started_at: string;
  period: MetricLoopForensicsPeriod;
  browser: string;
  device: string;
  region: string;
  traffic_source: string;
  interaction: string;
  shopper_type: string;
  entry_query: string;
  product_category: string;
  product_id: string;
  release_version: string;
  add_to_cart_clicked: boolean;
  converted: boolean;
}

export interface MetricLoopForensicsEvent {
  event_id: string;
  session_id: string;
  person_id: string;
  timestamp: string;
  date: string;
  period: MetricLoopForensicsPeriod;
  event_name: MetricLoopForensicsEventName;
  browser: string;
  device: string;
  region: string;
  traffic_source: string;
  interaction: string;
  shopper_type: string;
  product_category: string;
  product_id: string;
  release_version: string;
  size_selected: string | null;
  add_to_cart_enabled: boolean | null;
  validation_state: string | null;
}

export interface MetricLoopForensicsProduct {
  product_id: string;
  title: string;
  category: string;
  has_size_selector: boolean;
  default_variant_type: string;
}

export interface MetricLoopForensicsRelease {
  release_id: string;
  shipped_at: string;
  owner: string;
  area: string;
  summary: string;
  touched_events: MetricLoopForensicsEventName[];
}

export interface MetricLoopForensicsSupportTicket {
  ticket_id: string;
  created_at: string;
  theme: string;
  browser: string;
  region: string;
  product_category: string;
  sample: string;
}

export interface MetricLoopForensicsInstrumentationCheck {
  event_name: MetricLoopForensicsEventName;
  date: string;
  browser: string;
  event_count: number;
  missing_property_rate: number;
  schema_version: string;
}

export interface MetricLoopForensicsWarehouse {
  events: MetricLoopForensicsEvent[];
  sessions: MetricLoopForensicsSession[];
  products: MetricLoopForensicsProduct[];
  releases: MetricLoopForensicsRelease[];
  support_tickets: MetricLoopForensicsSupportTicket[];
  instrumentation_checks: MetricLoopForensicsInstrumentationCheck[];
}

export interface MetricLoopForensicsSchema {
  tables: Array<{
    name: keyof MetricLoopForensicsWarehouse;
    fields: string[];
  }>;
  dimensions: MetricLoopForensicsDimension[];
  measures: string[];
}

export type MetricLoopCohortSummaryRow = Partial<Record<MetricLoopForensicsDimension, string>> & {
  current_sessions: number;
  prior_sessions: number;
  current_activations: number;
  prior_activations: number;
  current_activation_rate: number;
  prior_activation_rate: number;
  drop_pp: number;
  lost_activations: number;
};

type CohortSpec = {
  browser: string;
  device: string;
  region: string;
  interaction: string;
  shopper_type: string;
  product_category: string;
  entry_query: string;
  product_id: string;
  priorSessions: number;
  currentSessions: number;
  priorRate: number;
  currentRate: number;
  trafficMix?: Array<[string, number]>;
};

export const METRIC_LOOP_FORENSICS_DIMENSIONS: MetricLoopForensicsDimension[] = [
  'browser',
  'device',
  'region',
  'traffic_source',
  'interaction',
  'shopper_type',
  'product_category',
  'release_version',
];

const products: MetricLoopForensicsProduct[] = [
  {
    product_id: 'shoe-hike-01',
    title: 'Summit Trail Boot',
    category: 'footwear',
    has_size_selector: true,
    default_variant_type: 'shoe_size',
  },
  {
    product_id: 'shoe-run-02',
    title: 'City Pace Sneaker',
    category: 'footwear',
    has_size_selector: true,
    default_variant_type: 'shoe_size',
  },
  {
    product_id: 'coat-rain-01',
    title: 'Rain Shell Jacket',
    category: 'outerwear',
    has_size_selector: true,
    default_variant_type: 'apparel_size',
  },
  {
    product_id: 'tent-2p-01',
    title: 'Ridge Two-Person Tent',
    category: 'camping',
    has_size_selector: false,
    default_variant_type: 'one_size',
  },
];

const releases: MetricLoopForensicsRelease[] = [
  {
    release_id: 'rel-search-ranking',
    shipped_at: '2026-04-29T18:00:00.000Z',
    owner: 'search-platform',
    area: 'Search ranking',
    summary: 'Updated voice search ranking weights for seasonal footwear queries.',
    touched_events: ['voice_search_started', 'search_results_viewed'],
  },
  {
    release_id: 'rel-pdp-size-validation',
    shipped_at: '2026-05-04T16:30:00.000Z',
    owner: 'pdp-checkout',
    area: 'PDP size selector',
    summary: 'Added stricter size-selection validation before add to cart on mobile PDPs.',
    touched_events: ['shoe_size_selected', 'add_to_cart_clicked'],
  },
  {
    release_id: 'rel-cart-copy',
    shipped_at: '2026-05-06T20:00:00.000Z',
    owner: 'growth',
    area: 'Cart copy',
    summary: 'Changed cart microcopy for referral traffic experiment.',
    touched_events: ['add_to_cart_clicked'],
  },
];

const supportTickets: MetricLoopForensicsSupportTicket[] = [
  {
    ticket_id: 'sup-1042',
    created_at: '2026-05-08T11:20:00.000Z',
    theme: 'size_validation_blocked',
    browser: 'mobile_safari',
    region: 'europe',
    product_category: 'footwear',
    sample: 'I picked EU 39 on the boot page but the add-to-cart button stayed disabled.',
  },
  {
    ticket_id: 'sup-1061',
    created_at: '2026-05-10T14:05:00.000Z',
    theme: 'mobile_pdp_size_state',
    browser: 'mobile_safari',
    region: 'europe',
    product_category: 'footwear',
    sample: 'The size looks selected, then the page says choose a size again.',
  },
  {
    ticket_id: 'sup-1084',
    created_at: '2026-05-12T17:40:00.000Z',
    theme: 'paid_ad_quality',
    browser: 'chrome',
    region: 'north_america',
    product_category: 'outerwear',
    sample: 'Ad landed me on the wrong jacket color.',
  },
];

const defaultTrafficMix: Array<[string, number]> = [
  ['organic', 0.62],
  ['paid_ads', 0.24],
  ['referral', 0.14],
];

const cohortSpecs: CohortSpec[] = [
  {
    browser: 'mobile_safari',
    device: 'mobile',
    region: 'europe',
    interaction: 'voice_search',
    shopper_type: 'first_time_shoppers',
    product_category: 'footwear',
    entry_query: 'hiking boots',
    product_id: 'shoe-hike-01',
    priorSessions: 190,
    currentSessions: 205,
    priorRate: 0.42,
    currentRate: 0.18,
    trafficMix: [
      ['organic', 0.7],
      ['paid_ads', 0.22],
      ['referral', 0.08],
    ],
  },
  {
    browser: 'chrome',
    device: 'desktop',
    region: 'europe',
    interaction: 'voice_search',
    shopper_type: 'first_time_shoppers',
    product_category: 'footwear',
    entry_query: 'hiking boots',
    product_id: 'shoe-hike-01',
    priorSessions: 130,
    currentSessions: 138,
    priorRate: 0.39,
    currentRate: 0.38,
  },
  {
    browser: 'mobile_safari',
    device: 'mobile',
    region: 'europe',
    interaction: 'typed_search',
    shopper_type: 'first_time_shoppers',
    product_category: 'footwear',
    entry_query: 'trail shoes',
    product_id: 'shoe-run-02',
    priorSessions: 118,
    currentSessions: 122,
    priorRate: 0.39,
    currentRate: 0.38,
  },
  {
    browser: 'mobile_safari',
    device: 'mobile',
    region: 'europe',
    interaction: 'voice_search',
    shopper_type: 'returning_shoppers',
    product_category: 'footwear',
    entry_query: 'running shoes',
    product_id: 'shoe-run-02',
    priorSessions: 104,
    currentSessions: 110,
    priorRate: 0.45,
    currentRate: 0.42,
  },
  {
    browser: 'mobile_safari',
    device: 'mobile',
    region: 'north_america',
    interaction: 'voice_search',
    shopper_type: 'first_time_shoppers',
    product_category: 'footwear',
    entry_query: 'hiking boots',
    product_id: 'shoe-hike-01',
    priorSessions: 122,
    currentSessions: 128,
    priorRate: 0.41,
    currentRate: 0.39,
  },
  {
    browser: 'mobile_safari',
    device: 'mobile',
    region: 'europe',
    interaction: 'voice_search',
    shopper_type: 'first_time_shoppers',
    product_category: 'outerwear',
    entry_query: 'rain jacket',
    product_id: 'coat-rain-01',
    priorSessions: 96,
    currentSessions: 102,
    priorRate: 0.4,
    currentRate: 0.38,
  },
  {
    browser: 'mobile_safari',
    device: 'mobile',
    region: 'europe',
    interaction: 'voice_search',
    shopper_type: 'first_time_shoppers',
    product_category: 'camping',
    entry_query: 'two person tent',
    product_id: 'tent-2p-01',
    priorSessions: 82,
    currentSessions: 88,
    priorRate: 0.36,
    currentRate: 0.35,
  },
  {
    browser: 'firefox',
    device: 'desktop',
    region: 'europe',
    interaction: 'voice_search',
    shopper_type: 'first_time_shoppers',
    product_category: 'footwear',
    entry_query: 'hiking boots',
    product_id: 'shoe-hike-01',
    priorSessions: 76,
    currentSessions: 80,
    priorRate: 0.37,
    currentRate: 0.36,
  },
  {
    browser: 'edge',
    device: 'desktop',
    region: 'north_america',
    interaction: 'typed_search',
    shopper_type: 'returning_shoppers',
    product_category: 'outerwear',
    entry_query: 'rain shell',
    product_id: 'coat-rain-01',
    priorSessions: 88,
    currentSessions: 92,
    priorRate: 0.44,
    currentRate: 0.43,
  },
  {
    browser: 'chrome',
    device: 'desktop',
    region: 'apac',
    interaction: 'manual_click',
    shopper_type: 'returning_shoppers',
    product_category: 'camping',
    entry_query: 'homepage nav',
    product_id: 'tent-2p-01',
    priorSessions: 94,
    currentSessions: 98,
    priorRate: 0.4,
    currentRate: 0.4,
  },
  {
    browser: 'chrome',
    device: 'mobile',
    region: 'europe',
    interaction: 'voice_search',
    shopper_type: 'first_time_shoppers',
    product_category: 'outerwear',
    entry_query: 'waterproof jacket',
    product_id: 'coat-rain-01',
    priorSessions: 92,
    currentSessions: 100,
    priorRate: 0.41,
    currentRate: 0.4,
  },
];

let cachedWarehouse: MetricLoopForensicsWarehouse | null = null;

export function getMetricLoopForensicsWarehouse(): MetricLoopForensicsWarehouse {
  if (!cachedWarehouse) cachedWarehouse = buildWarehouse();
  return cachedWarehouse;
}

export function getForensicsSchema(): MetricLoopForensicsSchema {
  return {
    tables: [
      {
        name: 'events',
        fields: [
          'event_id',
          'session_id',
          'person_id',
          'timestamp',
          'event_name',
          'browser',
          'device',
          'region',
          'traffic_source',
          'interaction',
          'shopper_type',
          'product_category',
          'product_id',
          'release_version',
          'size_selected',
          'add_to_cart_enabled',
          'validation_state',
        ],
      },
      {
        name: 'sessions',
        fields: [
          'session_id',
          'person_id',
          'started_at',
          'browser',
          'device',
          'region',
          'traffic_source',
          'interaction',
          'shopper_type',
          'entry_query',
          'product_category',
          'converted',
        ],
      },
      { name: 'products', fields: ['product_id', 'title', 'category', 'has_size_selector', 'default_variant_type'] },
      { name: 'releases', fields: ['release_id', 'shipped_at', 'owner', 'area', 'summary', 'touched_events'] },
      { name: 'support_tickets', fields: ['ticket_id', 'created_at', 'theme', 'browser', 'region', 'product_category', 'sample'] },
      { name: 'instrumentation_checks', fields: ['event_name', 'date', 'browser', 'event_count', 'missing_property_rate', 'schema_version'] },
    ],
    dimensions: METRIC_LOOP_FORENSICS_DIMENSIONS,
    measures: ['sessions', 'activations', 'activation_rate', 'drop_pp', 'lost_activations'],
  };
}

export function summarizeActivationByCohort(
  warehouse: MetricLoopForensicsWarehouse,
  dimensions: MetricLoopForensicsDimension[],
  filters: Partial<Record<MetricLoopForensicsDimension, string>> = {},
): MetricLoopCohortSummaryRow[] {
  const groups = new Map<string, MetricLoopCohortSummaryRow>();

  for (const session of warehouse.sessions) {
    if (!matchesDimensionFilters(session, filters)) continue;
    const key = dimensions.map((dimension) => String(session[dimension])).join('|');
    const existing = groups.get(key) ?? createEmptySummaryRow(session, dimensions);

    if (session.period === 'current') {
      existing.current_sessions += 1;
      if (session.add_to_cart_clicked) existing.current_activations += 1;
    } else {
      existing.prior_sessions += 1;
      if (session.add_to_cart_clicked) existing.prior_activations += 1;
    }

    groups.set(key, existing);
  }

  return Array.from(groups.values())
    .filter((row) => row.current_sessions > 0 && row.prior_sessions > 0)
    .map((row) => {
      const currentRate = row.current_activations / row.current_sessions;
      const priorRate = row.prior_activations / row.prior_sessions;
      const drop = priorRate - currentRate;
      return {
        ...row,
        current_activation_rate: roundRate(currentRate),
        prior_activation_rate: roundRate(priorRate),
        drop_pp: roundNumber(drop * 100, 1),
        lost_activations: roundNumber(Math.max(0, drop) * row.current_sessions, 1),
      };
    });
}

function buildWarehouse(): MetricLoopForensicsWarehouse {
  const sessions: MetricLoopForensicsSession[] = [];
  const events: MetricLoopForensicsEvent[] = [];

  cohortSpecs.forEach((spec, specIndex) => {
    addSessionsForPeriod({ spec, specIndex, period: 'prior', count: spec.priorSessions, rate: spec.priorRate, sessions, events });
    addSessionsForPeriod({ spec, specIndex, period: 'current', count: spec.currentSessions, rate: spec.currentRate, sessions, events });
  });

  return {
    events,
    sessions,
    products,
    releases,
    support_tickets: supportTickets,
    instrumentation_checks: buildInstrumentationChecks(events),
  };
}

function addSessionsForPeriod({
  spec,
  specIndex,
  period,
  count,
  rate,
  sessions,
  events,
}: {
  spec: CohortSpec;
  specIndex: number;
  period: MetricLoopForensicsPeriod;
  count: number;
  rate: number;
  sessions: MetricLoopForensicsSession[];
  events: MetricLoopForensicsEvent[];
}) {
  for (let index = 0; index < count; index += 1) {
    const traffic_source = pickTrafficSource(index, spec.trafficMix ?? defaultTrafficMix);
    const rateAdjustment = traffic_source === 'paid_ads' ? -0.025 : traffic_source === 'referral' ? 0.01 : 0;
    const adjustedRate = clampRate(rate + rateAdjustment);
    const sessionNumber = sessions.length + 1;
    const session_id = 'sess-' + sessionNumber.toString().padStart(5, '0');
    const person_id = 'person-' + ((sessionNumber % 420) + 1).toString().padStart(4, '0');
    const timestamp = timestampFor(period, index, specIndex, 0);
    const isAffectedCurrent = isAffectedCohort(spec) && period === 'current';
    const successRank = (index * 37 + specIndex * 13 + (period === 'current' ? 5 : 0)) % count;
    const addToCartClicked = successRank < Math.round(count * adjustedRate);
    const release_version = period === 'current' ? '2026.05.04-size-validation' : '2026.04.30-baseline';
    const session: MetricLoopForensicsSession = {
      session_id,
      person_id,
      started_at: timestamp,
      period,
      browser: spec.browser,
      device: spec.device,
      region: spec.region,
      traffic_source,
      interaction: spec.interaction,
      shopper_type: spec.shopper_type,
      entry_query: spec.entry_query,
      product_category: spec.product_category,
      product_id: spec.product_id,
      release_version,
      add_to_cart_clicked: addToCartClicked,
      converted: addToCartClicked && deterministicRatio(index, specIndex + 39) < 0.58,
    };
    sessions.push(session);

    const product = products.find((candidate) => candidate.product_id === spec.product_id);
    const hasSizeSelector = Boolean(product?.has_size_selector);
    const blockedValidation = isAffectedCurrent && !addToCartClicked && deterministicRatio(index, specIndex + 131) < 0.78;
    const sizeSelected = hasSizeSelector ? pickSize(index, spec.product_category) : null;

    addEvent(events, session, specIndex, index, 0, 'session_started', {
      size_selected: null,
      add_to_cart_enabled: null,
      validation_state: null,
    });
    addEvent(events, session, specIndex, index, 1, getInteractionEventName(spec.interaction), {
      size_selected: null,
      add_to_cart_enabled: null,
      validation_state: null,
    });
    addEvent(events, session, specIndex, index, 2, 'search_results_viewed', {
      size_selected: null,
      add_to_cart_enabled: null,
      validation_state: null,
    });
    addEvent(events, session, specIndex, index, 3, 'product_card_opened', {
      size_selected: null,
      add_to_cart_enabled: null,
      validation_state: null,
    });

    if (hasSizeSelector) {
      addEvent(events, session, specIndex, index, 4, 'shoe_size_selected', {
        size_selected: sizeSelected,
        add_to_cart_enabled: !blockedValidation,
        validation_state: blockedValidation ? 'blocked_size_validation' : 'ready',
      });
    }

    if (addToCartClicked) {
      addEvent(events, session, specIndex, index, 5, 'add_to_cart_clicked', {
        size_selected: sizeSelected,
        add_to_cart_enabled: true,
        validation_state: 'ready',
      });
      if (session.converted) {
        addEvent(events, session, specIndex, index, 6, 'checkout_started', {
          size_selected: sizeSelected,
          add_to_cart_enabled: true,
          validation_state: 'ready',
        });
      }
    }
  }
}

function addEvent(
  events: MetricLoopForensicsEvent[],
  session: MetricLoopForensicsSession,
  specIndex: number,
  sessionIndex: number,
  step: number,
  event_name: MetricLoopForensicsEventName,
  overrides: Pick<MetricLoopForensicsEvent, 'size_selected' | 'add_to_cart_enabled' | 'validation_state'>,
) {
  const timestamp = timestampFor(session.period, sessionIndex, specIndex, step);
  events.push({
    event_id: 'evt-' + (events.length + 1).toString().padStart(6, '0'),
    session_id: session.session_id,
    person_id: session.person_id,
    timestamp,
    date: timestamp.slice(0, 10),
    period: session.period,
    event_name,
    browser: session.browser,
    device: session.device,
    region: session.region,
    traffic_source: session.traffic_source,
    interaction: session.interaction,
    shopper_type: session.shopper_type,
    product_category: session.product_category,
    product_id: session.product_id,
    release_version: session.release_version,
    ...overrides,
  });
}

function buildInstrumentationChecks(events: MetricLoopForensicsEvent[]): MetricLoopForensicsInstrumentationCheck[] {
  const groups = new Map<string, MetricLoopForensicsInstrumentationCheck>();

  for (const event of events) {
    const key = [event.event_name, event.date, event.browser].join('|');
    const existing = groups.get(key) ?? {
      event_name: event.event_name,
      date: event.date,
      browser: event.browser,
      event_count: 0,
      missing_property_rate: 0,
      schema_version: event.period === 'current' ? 'size-validation-v2' : 'baseline-v1',
    };
    existing.event_count += 1;
    groups.set(key, existing);
  }

  return Array.from(groups.values()).map((row) => ({
    ...row,
    missing_property_rate: row.event_name === 'shoe_size_selected' ? 0 : 0.01,
  }));
}

function createEmptySummaryRow(
  session: MetricLoopForensicsSession,
  dimensions: MetricLoopForensicsDimension[],
): MetricLoopCohortSummaryRow {
  const row: MetricLoopCohortSummaryRow = {
    current_sessions: 0,
    prior_sessions: 0,
    current_activations: 0,
    prior_activations: 0,
    current_activation_rate: 0,
    prior_activation_rate: 0,
    drop_pp: 0,
    lost_activations: 0,
  };

  for (const dimension of dimensions) {
    row[dimension] = String(session[dimension]);
  }

  return row;
}

function matchesDimensionFilters(
  session: MetricLoopForensicsSession,
  filters: Partial<Record<MetricLoopForensicsDimension, string>>,
) {
  return Object.entries(filters).every(([key, value]) => {
    if (!value || value === 'all') return true;
    return String(session[key as MetricLoopForensicsDimension]) === value;
  });
}

function pickTrafficSource(index: number, mix: Array<[string, number]>) {
  const ratio = deterministicRatio(index, 7);
  let cumulative = 0;
  for (const [source, share] of mix) {
    cumulative += share;
    if (ratio <= cumulative) return source;
  }
  return mix[mix.length - 1]?.[0] ?? 'organic';
}

function getInteractionEventName(interaction: string): MetricLoopForensicsEventName {
  if (interaction === 'voice_search') return 'voice_search_started';
  if (interaction === 'typed_search') return 'typed_search_started';
  return 'manual_click_started';
}

function timestampFor(period: MetricLoopForensicsPeriod, sessionIndex: number, specIndex: number, step: number) {
  const currentDates = ['2026-05-07', '2026-05-08', '2026-05-09', '2026-05-10', '2026-05-11', '2026-05-12', '2026-05-13'];
  const priorDates = ['2026-04-30', '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06'];
  const date = (period === 'current' ? currentDates : priorDates)[(sessionIndex + specIndex) % 7];
  const hour = (8 + ((sessionIndex + specIndex) % 11)).toString().padStart(2, '0');
  const minute = ((sessionIndex * 7 + step * 3) % 60).toString().padStart(2, '0');
  const second = ((sessionIndex * 13 + step * 11) % 60).toString().padStart(2, '0');
  return date + 'T' + hour + ':' + minute + ':' + second + '.000Z';
}

function pickSize(index: number, category: string) {
  if (category === 'footwear') {
    const sizes = ['EU 38', 'EU 39', 'EU 40', 'EU 41', 'EU 42', 'EU 43'];
    return sizes[index % sizes.length];
  }
  return ['XS', 'S', 'M', 'L', 'XL'][index % 5];
}

function deterministicRatio(index: number, salt: number) {
  const raw = Math.sin((index + 1) * 12.9898 + (salt + 1) * 78.233) * 43758.5453;
  return raw - Math.floor(raw);
}

function isAffectedCohort(spec: CohortSpec) {
  return (
    spec.browser === 'mobile_safari' &&
    spec.region === 'europe' &&
    spec.shopper_type === 'first_time_shoppers' &&
    spec.product_category === 'footwear' &&
    spec.interaction === 'voice_search'
  );
}

function clampRate(value: number) {
  return Math.max(0.02, Math.min(0.85, value));
}

function roundRate(value: number) {
  return roundNumber(value, 4);
}

function roundNumber(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
