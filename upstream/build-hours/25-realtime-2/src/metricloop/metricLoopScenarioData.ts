import { products } from '../data';

function productTitle(productId: string) {
  return products.find((product) => product.id === productId)?.title ?? productId;
}

export const metricLoopProducts = {
  hikingBoots: productTitle('shoe-primary'),
  campingTent: productTitle('tent-primary'),
  trailBoots: productTitle('shoe-red-trail'),
  waterproofBoots: productTitle('shoe-waterproof-light'),
};

export const activationFunnelInitial = [
  {
    step: 'voice_search_started',
    label: 'Voice search started',
    currentRate: 100,
    previousRate: 100,
    delta: 0,
    currentUsers: 842,
    previousUsers: 811,
  },
  {
    step: 'search_results_viewed',
    label: 'Search results viewed',
    currentRate: 78.2,
    previousRate: 80.1,
    delta: -1.9,
    currentUsers: 658,
    previousUsers: 650,
  },
  {
    step: 'product_card_opened',
    label: 'Product card opened',
    currentRate: 55.4,
    previousRate: 58.8,
    delta: -3.4,
    currentUsers: 466,
    previousUsers: 477,
  },
  {
    step: 'shoe_size_selected',
    label: 'Shoe size selected',
    currentRate: 30.6,
    previousRate: 47.4,
    delta: -16.8,
    currentUsers: 258,
    previousUsers: 384,
  },
  {
    step: 'add_to_cart_clicked',
    label: 'Add to cart clicked',
    currentRate: 20.1,
    previousRate: 38.2,
    delta: -18.1,
    currentUsers: 169,
    previousUsers: 310,
  },
  {
    step: 'checkout_started',
    label: 'Checkout started',
    currentRate: 17.7,
    previousRate: 34.8,
    delta: -17.1,
    currentUsers: 149,
    previousUsers: 282,
  },
];

export const activationFunnelBrowserComparison = [
  {
    step: 'voice_search_started',
    label: 'Voice search started',
    currentRate: 100,
    previousRate: 100,
    delta: 0,
    currentUsers: 613,
    previousUsers: 604,
  },
  {
    step: 'search_results_viewed',
    label: 'Search results viewed',
    currentRate: 79.1,
    previousRate: 80.6,
    delta: -1.5,
    currentUsers: 485,
    previousUsers: 487,
  },
  {
    step: 'product_card_opened',
    label: 'Product card opened',
    currentRate: 56.8,
    previousRate: 58.1,
    delta: -1.3,
    currentUsers: 348,
    previousUsers: 351,
  },
  {
    step: 'shoe_size_selected',
    label: 'Shoe size selected',
    currentRate: 28.9,
    previousRate: 47.6,
    delta: -18.7,
    currentUsers: 177,
    previousUsers: 288,
  },
  {
    step: 'add_to_cart_clicked',
    label: 'Add to cart clicked',
    currentRate: 19.4,
    previousRate: 38.5,
    delta: -19.1,
    currentUsers: 119,
    previousUsers: 233,
  },
  {
    step: 'checkout_started',
    label: 'Checkout started',
    currentRate: 16.8,
    previousRate: 35.1,
    delta: -18.3,
    currentUsers: 103,
    previousUsers: 212,
  },
];

export const correlatedRelease = {
  title: 'PDP size selector validation release',
  shippedAt: '2026-05-04 09:42 UTC',
  owner: 'Storefront checkout team',
  summary:
    'Changed the hiking boot size control from a native select to a button grid and added stricter add-to-cart validation.',
};

export const supportThemes = [
  {
    theme: 'Could not add hiking boots after choosing size',
    count: 28,
    sample: 'I tapped US 10, but the page still says choose size to continue.',
  },
  {
    theme: 'Size guide opens but does not apply selection',
    count: 11,
    sample: 'The size guide says 27 is available but the cart button stays disabled.',
  },
  {
    theme: 'Cart review missing trail shoe after voice add',
    count: 7,
    sample: 'The assistant found the boots but they never made it to checkout.',
  },
];

export const representativeSessions = [
  {
    id: 'RPL-4821',
    shopper: 'First-time shopper',
    browser: 'Mobile Safari',
    device: 'iPhone 15',
    channel: 'Organic search',
    region: 'Europe',
    productTitle: metricLoopProducts.hikingBoots,
    finding: 'Searched for hiking boots, tapped US 10 twice, add-to-cart stayed disabled, then session ended.',
  },
  {
    id: 'RPL-4844',
    shopper: 'First-time shopper',
    browser: 'Mobile Safari',
    device: 'iPhone 14',
    channel: 'Paid ads',
    region: 'Europe',
    productTitle: metricLoopProducts.hikingBoots,
    finding: 'Voice search opened hiking boots, size selection event fired, validation state did not update.',
  },
  {
    id: 'RPL-4862',
    shopper: 'Returning shopper',
    browser: 'Chrome',
    device: 'MacBook Pro',
    channel: 'Organic search',
    region: 'Europe',
    productTitle: metricLoopProducts.campingTent,
    finding: 'Tent add-to-cart completed normally, narrowing the issue to footwear size selection.',
  },
  {
    id: 'RPL-4877',
    shopper: 'First-time shopper',
    browser: 'Mobile Safari',
    device: 'iPhone 13',
    channel: 'Referral',
    region: 'Europe',
    productTitle: metricLoopProducts.hikingBoots,
    finding: 'Size guide selection closed, but the product page still showed no selected size.',
  },
];

export const browserBreakdownInitial = [
  { browser: 'Mobile Safari', activationRate: 18.7, delta: -21.4, sessions: 312 },
  { browser: 'Chrome', activationRate: 37.9, delta: -2.2, sessions: 284 },
  { browser: 'Firefox', activationRate: 35.2, delta: -3.1, sessions: 74 },
  { browser: 'Edge', activationRate: 36.1, delta: -2.8, sessions: 53 },
];

export const browserBreakdownComparison = [
  { browser: 'Mobile Safari', activationRate: 17.9, delta: -22.1, sessions: 226 },
  { browser: 'Chrome', activationRate: 39.8, delta: -0.8, sessions: 247 },
];

export const searchIntents = [
  {
    term: 'hiking boots',
    volume: 1842,
    conversionRate: 19.4,
    delta: -18.8,
    topProduct: metricLoopProducts.hikingBoots,
  },
  {
    term: 'trail shoes',
    volume: 934,
    conversionRate: 22.1,
    delta: -12.6,
    topProduct: metricLoopProducts.trailBoots,
  },
  {
    term: 'rain jacket',
    volume: 706,
    conversionRate: 36.2,
    delta: -1.9,
    topProduct: 'Packable Rain Shell Jacket',
  },
  {
    term: 'camping tent',
    volume: 642,
    conversionRate: 34.8,
    delta: -2.4,
    topProduct: metricLoopProducts.campingTent,
  },
  {
    term: 'waterproof backpack',
    volume: 388,
    conversionRate: 31.6,
    delta: -3.1,
    topProduct: 'Waterproof Trail Backpack',
  },
];

export const releaseTimeline = [
  { date: '2026-04-29', activationRate: 38.2, supportTickets: 4 },
  { date: '2026-05-01', activationRate: 37.8, supportTickets: 5 },
  { date: '2026-05-04', activationRate: 31.2, supportTickets: 18, release: correlatedRelease.title },
  { date: '2026-05-06', activationRate: 24.7, supportTickets: 31 },
  { date: '2026-05-08', activationRate: 20.1, supportTickets: 46 },
  { date: '2026-05-10', activationRate: 19.4, supportTickets: 51 },
];

export const sessionEvents = [
  {
    sessionId: 'RPL-4821',
    events: [
      { label: 'voice_search_started', status: 'ok' },
      { label: 'search_results_viewed', status: 'ok' },
      { label: 'product_card_opened', status: 'ok' },
      { label: 'shoe_size_selected', status: 'warning' },
      { label: 'add_to_cart_clicked', status: 'failed' },
    ],
  },
  {
    sessionId: 'RPL-4844',
    events: [
      { label: 'voice_search_started', status: 'ok' },
      { label: 'product_card_opened', status: 'ok' },
      { label: 'shoe_size_selected', status: 'warning' },
      { label: 'validation_state_updated', status: 'failed' },
    ],
  },
  {
    sessionId: 'RPL-4862',
    events: [
      { label: 'voice_search_started', status: 'ok' },
      { label: 'product_card_opened', status: 'ok' },
      { label: 'add_to_cart_clicked', status: 'ok' },
      { label: 'checkout_started', status: 'ok' },
    ],
  },
] as const;

export const evidenceSteps = [
  {
    label: 'Segment selected',
    finding: 'First-time shoppers in Europe show a large activation drop in the last 7 days.',
    source: 'funnel',
  },
  {
    label: 'Funnel compared',
    finding: 'The steepest delta appears between shoe_size_selected and add_to_cart_clicked.',
    source: 'funnel',
  },
  {
    label: 'Release correlated',
    finding: 'The drop starts after the PDP size selector validation release on May 4.',
    source: 'release',
  },
  {
    label: 'Tickets clustered',
    finding: 'Support tickets mention size selection not enabling add-to-cart.',
    source: 'support',
  },
  {
    label: 'Sessions sampled',
    finding: 'Representative Mobile Safari sessions show size selection firing without validation state updates.',
    source: 'replay',
  },
] as const;

export const alternativeCauses = [
  {
    label: 'Paid ads quality',
    confidence: 'low',
    reason: 'The drop remains after excluding paid ads traffic.',
  },
  {
    label: 'Search relevance',
    confidence: 'low',
    reason: 'Search result views and product-card opens are close to baseline.',
  },
  {
    label: 'Inventory shortage',
    confidence: 'medium',
    reason: 'Footwear inventory is lower than tents, but affected sessions show available sizes.',
  },
  {
    label: 'Browser-specific release regression',
    confidence: 'high',
    reason: 'Mobile Safari is down sharply while Chrome remains close to baseline after the release.',
  },
] as const;

export const hypothesisScores = [
  {
    hypothesis: 'Mobile Safari size selector regression',
    score: 92,
    evidence: 'Release timing, replay traces, browser split, and support themes all point to size validation.',
  },
  {
    hypothesis: 'Paid acquisition quality drop',
    score: 18,
    evidence: 'Excluding paid ads does not materially change the conclusion.',
  },
  {
    hypothesis: 'Search ranking regression',
    score: 24,
    evidence: 'Search and product-open rates are near baseline; the largest loss occurs later.',
  },
] as const;

export const recommendedExperiment = {
  title: 'Test a Mobile Safari size selector fallback',
  owner: 'Storefront checkout team',
  expectedImpact: 'Recover 12-16 points of add-to-cart conversion for first-time Europe footwear shoppers.',
  guardrailMetric: 'Checkout completion rate for returning shoppers on all browsers',
};
