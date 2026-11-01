import {
  activationFunnelBrowserComparison,
  activationFunnelInitial,
  alternativeCauses,
  browserBreakdownComparison,
  browserBreakdownInitial,
  correlatedRelease,
  evidenceSteps,
  hypothesisScores,
  recommendedExperiment,
  releaseTimeline,
  representativeSessions,
  searchIntents,
  sessionEvents,
  supportThemes,
} from './metricLoopScenarioData';

export type MetricLoopInvestigationMode = 'initial' | 'browser_comparison';

export interface MetricLoopInvestigationOptions {
  mode?: MetricLoopInvestigationMode;
  excludePaidAds?: boolean;
  question?: string;
  interaction?: 'all' | 'voice_search' | 'typed_search' | 'manual_click';
  dateRange?: 'last_7_days' | 'last_14_days' | 'last_30_days';
  comparison?: 'none' | 'prior_7_days';
  segment?: 'all_shoppers' | 'first_time_shoppers' | 'returning_shoppers';
  region?: 'all' | 'europe' | 'north_america' | 'apac';
  trafficSource?: 'all' | 'organic' | 'paid_ads' | 'referral';
  browser?: 'all' | 'mobile_safari' | 'chrome' | 'firefox' | 'edge';
  device?: 'all' | 'mobile' | 'desktop';
  productCategory?: 'all' | 'footwear' | 'outerwear' | 'camping';
}

export interface MetricLoopEngineeringBrief {
  title: string;
  summary: string;
  impact: {
    affectedSessions: number;
    lostCheckouts: number;
    recoverableOrders: number;
    averageOrderValue: number;
    estimatedWeeklyRevenueRecovery: number;
  };
  roiChart: {
    title: string;
    subtitle: string;
    unit: 'usd';
    data: Array<{
      label: string;
      value: number;
      tone: 'current' | 'loss' | 'gain' | 'risk';
      detail: string;
    }>;
    assumptions: string[];
  };
  ticket: {
    title: string;
    priority: 'P1' | 'P2' | 'P3';
    owner: string;
    labels: string[];
    reproductionSteps: string[];
    acceptanceCriteria: string[];
  };
}

export interface MetricLoopInvestigationBoard {
  id: string;
  title: string;
  question: string;
  segmentLabel: string;
  conclusion: string;
  confidence: 'Low' | 'Medium' | 'High';
  analysisUpdate: {
    badge: string;
    scope: string;
    primaryDriver: string;
    summary: string;
  };
  driverSignals: Array<{
    label: string;
    score: number;
    detail: string;
  }>;
  scopedReport: {
    title: string;
    lineage: string;
    summary: string;
    hypotheses: Array<{
      label: string;
      status: 'primary' | 'secondary' | 'watch' | 'ruled_out';
      confidence: 'Low' | 'Medium' | 'High';
      evidence: string;
      nextStep: string;
    }>;
  };
  filters: {
    dateRange: string;
    region: string;
    segment: string;
    teamAge: string;
    window: string;
    trafficSource: string;
    excludePaidAds: boolean;
    browserComparison: string | null;
    device: string;
    productCategory: string;
  };
  funnel: Array<{
    step: string;
    label: string;
    currentRate: number;
    previousRate: number;
    delta: number;
    currentUsers: number;
    previousUsers: number;
  }>;
  dropOffStep: {
    step: string;
    label: string;
    delta: number;
    currentRate: number;
    previousRate: number;
  };
  correlatedRelease: {
    title: string;
    shippedAt: string;
    owner: string;
    summary: string;
  };
  supportThemes: Array<{
    theme: string;
    count: number;
    sample: string;
  }>;
  representativeSessions: Array<{
    id: string;
    shopper: string;
    browser: string;
    device: string;
    channel: string;
    region: string;
    productTitle: string;
    finding: string;
  }>;
  browserBreakdown: Array<{
    browser: string;
    activationRate: number;
    delta: number;
    sessions: number;
  }>;
  searchIntents: Array<{
    term: string;
    volume: number;
    conversionRate: number;
    delta: number;
    topProduct: string;
  }>;
  releaseTimeline: Array<{
    date: string;
    activationRate: number;
    supportTickets: number;
    release?: string;
  }>;
  sessionEvents: Array<{
    sessionId: string;
    events: Array<{ label: string; status: 'ok' | 'warning' | 'failed' }>;
  }>;
  evidenceSteps: Array<{
    label: string;
    finding: string;
    source: 'funnel' | 'release' | 'support' | 'replay' | 'browser';
  }>;
  alternativeCauses: Array<{
    label: string;
    confidence: 'low' | 'medium' | 'high';
    reason: string;
  }>;
  hypothesisScores: Array<{
    hypothesis: string;
    score: number;
    evidence: string;
  }>;
  recommendedExperiment: {
    title: string;
    owner: string;
    expectedImpact: string;
    guardrailMetric: string;
  };
  engineeringBrief: MetricLoopEngineeringBrief;
  recommendation: string;
  followUpQuestions: string[];
}

function findDropOffStep(funnel: MetricLoopInvestigationBoard['funnel']) {
  const steepest = funnel.reduce(
    (current, next) => (next.delta < current.delta ? next : current),
    funnel[0],
  );
  return {
    step: steepest.step,
    label: steepest.label,
    delta: steepest.delta,
    currentRate: steepest.currentRate,
    previousRate: steepest.previousRate,
  };
}

const broadActivationFunnel: MetricLoopInvestigationBoard['funnel'] = [
  {
    step: 'voice_search_started',
    label: 'Session started',
    currentRate: 100,
    previousRate: 100,
    delta: 0,
    currentUsers: 6420,
    previousUsers: 6258,
  },
  {
    step: 'search_results_viewed',
    label: 'Search results viewed',
    currentRate: 84.1,
    previousRate: 84.8,
    delta: -0.7,
    currentUsers: 5400,
    previousUsers: 5308,
  },
  {
    step: 'product_card_opened',
    label: 'Product card opened',
    currentRate: 63.8,
    previousRate: 64.7,
    delta: -0.9,
    currentUsers: 4096,
    previousUsers: 4050,
  },
  {
    step: 'shoe_size_selected',
    label: 'Size or variant selected',
    currentRate: 51.2,
    previousRate: 52.8,
    delta: -1.6,
    currentUsers: 3287,
    previousUsers: 3305,
  },
  {
    step: 'add_to_cart_clicked',
    label: 'Add to cart clicked',
    currentRate: 43.1,
    previousRate: 45.2,
    delta: -2.1,
    currentUsers: 2767,
    previousUsers: 2829,
  },
  {
    step: 'checkout_started',
    label: 'Checkout started',
    currentRate: 38.4,
    previousRate: 40.1,
    delta: -1.7,
    currentUsers: 2465,
    previousUsers: 2510,
  },
];

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
    last_7_days: 'last 7 days',
    last_14_days: 'last 14 days',
    last_30_days: 'last 30 days',
  },
  dateRangeTitle: {
    last_7_days: 'Last 7 days',
    last_14_days: 'Last 14 days',
    last_30_days: 'Last 30 days',
  },
  segment: {
    all_shoppers: 'All shoppers',
    first_time_shoppers: 'first-time shoppers',
    returning_shoppers: 'returning shoppers',
  },
  segmentTitle: {
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
  trafficSource: {
    all: 'All traffic',
    organic: 'Organic search',
    paid_ads: 'Paid ads',
    referral: 'Referral',
  },
  browser: {
    all: 'All browsers',
    mobile_safari: 'Mobile Safari',
    chrome: 'Chrome',
    firefox: 'Firefox',
    edge: 'Edge',
  },
  device: {
    all: 'All devices',
    mobile: 'Mobile',
    desktop: 'Desktop',
  },
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function computeSeverity(options: MetricLoopInvestigationOptions) {
  let severity = 0.08;
  if (options.mode === 'browser_comparison') severity += 0.24;
  if (options.interaction === 'voice_search') severity += 0.2;
  if (options.region === 'europe') severity += 0.18;
  if (options.dateRange === 'last_7_days') severity += 0.14;
  if (options.comparison === 'prior_7_days') severity += 0.1;
  if (options.segment === 'first_time_shoppers') severity += 0.2;
  if (options.productCategory === 'footwear') severity += 0.12;
  if (options.trafficSource === 'paid_ads') severity += 0.16;
  if (options.browser === 'mobile_safari') severity += 0.14;
  if (options.excludePaidAds) severity += 0.03;

  return clamp(severity, 0.08, 1);
}

function isPaidAdsFocused(options: MetricLoopInvestigationOptions) {
  return options.trafficSource === 'paid_ads' && !options.excludePaidAds;
}

function isStableSlice(options: MetricLoopInvestigationOptions) {
  return (
    options.segment === 'returning_shoppers' ||
    options.productCategory === 'camping' ||
    options.device === 'desktop'
  );
}

function interpolateNumber(broad: number, focused: number, severity: number) {
  return broad + (focused - broad) * severity;
}

function buildFunnel(
  severity: number,
  focusedFunnel: MetricLoopInvestigationBoard['funnel'],
) {
  return broadActivationFunnel.map((broadStep, index) => {
    const focusedStep = focusedFunnel[index];
    const currentRate = round1(
      interpolateNumber(
        broadStep.currentRate,
        focusedStep.currentRate,
        severity,
      ),
    );
    const previousRate = round1(
      interpolateNumber(
        broadStep.previousRate,
        focusedStep.previousRate,
        severity,
      ),
    );
    const currentUsers = Math.round(
      interpolateNumber(
        broadStep.currentUsers,
        focusedStep.currentUsers,
        severity,
      ),
    );
    const previousUsers = Math.round(
      interpolateNumber(
        broadStep.previousUsers,
        focusedStep.previousUsers,
        severity,
      ),
    );

    return {
      ...focusedStep,
      label: severity < 0.35 ? broadStep.label : focusedStep.label,
      currentRate,
      previousRate,
      delta: round1(currentRate - previousRate),
      currentUsers,
      previousUsers,
    };
  });
}

function buildSegmentLabel(options: MetricLoopInvestigationOptions) {
  const interaction = labelMaps.interaction[options.interaction ?? 'all'];
  const region = labelMaps.region[options.region ?? 'all'];
  const segment = labelMaps.segment[options.segment ?? 'all_shoppers'];
  const dateRange = labelMaps.dateRange[options.dateRange ?? 'last_30_days'];

  if ((options.segment ?? 'all_shoppers') === 'all_shoppers') {
    return `${interaction} / ${region} / ${dateRange}`;
  }

  return `${interaction} / ${region} / ${segment} / ${dateRange}`;
}

function getSessions(options: MetricLoopInvestigationOptions) {
  let sessions = [...representativeSessions];

  if (options.excludePaidAds)
    sessions = sessions.filter((session) => session.channel !== 'Paid ads');
  if (options.region === 'europe')
    sessions = sessions.filter((session) => session.region === 'Europe');
  if (options.segment === 'first_time_shoppers') {
    sessions = sessions.filter(
      (session) => session.shopper === 'First-time shopper',
    );
  }
  if (options.segment === 'returning_shoppers') {
    sessions = sessions.filter(
      (session) => session.shopper === 'Returning shopper',
    );
  }
  if (options.browser === 'mobile_safari') {
    sessions = sessions.filter(
      (session) => session.browser === 'Mobile Safari',
    );
  }
  if (options.browser === 'chrome') {
    sessions = sessions.filter((session) => session.browser === 'Chrome');
  }
  if (options.productCategory === 'footwear') {
    sessions = sessions.filter((session) =>
      /boot|shoe/i.test(session.productTitle),
    );
  }

  return sessions.length > 0 ? sessions : representativeSessions.slice(0, 2);
}

function scaleSupportThemes(severity: number) {
  return supportThemes.map((theme) => ({
    ...theme,
    count: Math.max(1, Math.round(theme.count * (0.18 + severity * 0.82))),
  }));
}

function scaleSearchIntents(
  severity: number,
  productCategory: MetricLoopInvestigationOptions['productCategory'],
) {
  const categoryWeight =
    productCategory === 'footwear'
      ? 1.08
      : productCategory === 'all' || !productCategory
        ? 0.92
        : 0.72;

  return searchIntents.map((intent) => {
    const isFootwearIntent = /boot|shoe/i.test(intent.term);
    const intentSeverity = isFootwearIntent ? severity : severity * 0.32;

    return {
      ...intent,
      volume: Math.round(
        intent.volume * categoryWeight * (0.82 + severity * 0.22),
      ),
      conversionRate: round1(
        intent.conversionRate +
          (1 - intentSeverity) * (isFootwearIntent ? 11 : 2),
      ),
      delta: round1(intent.delta * (0.18 + intentSeverity * 0.82)),
    };
  });
}

function scaleBrowserBreakdown(
  severity: number,
  isBrowserComparison: boolean,
): MetricLoopInvestigationBoard['browserBreakdown'] {
  const breakdown = isBrowserComparison
    ? browserBreakdownComparison
    : browserBreakdownInitial;

  return breakdown.map((browser) => {
    const browserSeverity =
      browser.browser === 'Mobile Safari' ? severity : severity * 0.35;
    return {
      ...browser,
      activationRate: round1(
        browser.activationRate +
          (1 - browserSeverity) *
            (browser.browser === 'Mobile Safari' ? 12 : 3),
      ),
      delta: round1(browser.delta * (0.16 + browserSeverity * 0.84)),
      sessions: Math.round(browser.sessions * (0.72 + severity * 0.35)),
    };
  });
}

function scaleReleaseTimeline(severity: number) {
  return releaseTimeline.map((point) => ({
    ...point,
    activationRate: round1(39.6 + (point.activationRate - 39.6) * severity),
    supportTickets: Math.max(
      1,
      Math.round(point.supportTickets * (0.2 + severity * 0.8)),
    ),
  }));
}

function getConclusion(
  severity: number,
  isBrowserComparison: boolean,
  excludePaidAds: boolean,
  options: MetricLoopInvestigationOptions,
) {
  if (isPaidAdsFocused(options)) {
    return 'The current paid-ads slice points to a landing-page and product-match problem. Activation loss starts before the Safari-specific size selector evidence becomes decisive, so acquisition quality should stay as a separate hypothesis.';
  }

  if (isBrowserComparison) {
    if (severity < 0.75) {
      return 'Mobile Safari is the clearest browser outlier in the current view. Add cohort filters and exclude paid ads before assigning the size selector release as the final cause.';
    }

    return excludePaidAds
      ? 'After excluding paid ads, the activation drop still concentrates on Mobile Safari at the size selector. Chrome is close to baseline, so the likely cause remains the PDP size selector validation release rather than acquisition quality.'
      : 'The activation drop concentrates on Mobile Safari at the size selector. Chrome is close to baseline, but paid ads should be excluded before closing the attribution loop.';
  }

  if (severity < 0.35) {
    return 'The broad dashboard is mostly stable. The issue only becomes obvious after narrowing to voice search, Europe, first-time shoppers, and footwear.';
  }

  if (severity < 0.75) {
    return 'The filtered cohort shows an emerging activation drop around size selection and add-to-cart. The pattern is strongest in Europe footwear traffic and is worth investigating against recent releases.';
  }

  return 'Activation dropped because first-time shoppers in Europe on Mobile Safari are getting stuck after choosing a hiking boot size. The timing matches the PDP size selector validation release, and support tickets mention the same add-to-cart failure.';
}

function getRecommendation(
  severity: number,
  isBrowserComparison: boolean,
  options: MetricLoopInvestigationOptions,
) {
  if (isBrowserComparison) {
    return 'Ship or roll back the Safari size selector path, then rerun Mobile Safari vs Chrome activation for first-time Europe shoppers.';
  }

  if (isPaidAdsFocused(options)) {
    return 'Compare paid ads against organic search, inspect the ad-to-product landing path, and hold the Safari fix as a separate browser-specific hypothesis.';
  }

  if (severity < 0.35) {
    return 'Use voice to narrow the dashboard before opening the root-cause notebook; the broad view should stay calm until the risky cohort is selected.';
  }

  return 'Restore the previous Mobile Safari size selector, add a size-to-cart synthetic check, and run a 24-hour holdout.';
}

function getConfidence(
  severity: number,
): MetricLoopInvestigationBoard['confidence'] {
  if (severity > 0.74) return 'High';
  if (severity > 0.4) return 'Medium';
  return 'Low';
}

function buildAnalysisScope(
  options: MetricLoopInvestigationOptions,
  isBrowserComparison: boolean,
  excludePaidAds: boolean,
) {
  const scope: string[] = [
    labelMaps.dateRangeTitle[options.dateRange ?? 'last_30_days'],
    labelMaps.interaction[options.interaction ?? 'all'],
    labelMaps.region[options.region ?? 'all'],
    labelMaps.segmentTitle[options.segment ?? 'all_shoppers'],
    labelMaps.productCategory[options.productCategory ?? 'all'],
  ];

  if (excludePaidAds) scope.push('Paid ads excluded');
  if (isBrowserComparison) scope.push('Mobile Safari vs Chrome');

  return scope.join(' / ');
}

function getPrimaryDriver(
  severity: number,
  isBrowserComparison: boolean,
  options: MetricLoopInvestigationOptions,
) {
  if (isBrowserComparison) return 'Mobile Safari size selector regression';
  if (isPaidAdsFocused(options)) return 'Paid landing-page mismatch';
  if (isStableSlice(options)) return 'No material regression in this slice';
  if (severity > 0.74) return 'Mobile Safari size selector validation';
  if (severity > 0.4) return 'Footwear size-selection drop';
  if (options.dateRange === 'last_7_days') return 'Recent activation softening';
  return 'No isolated driver yet';
}

function buildAnalysisUpdate({
  confidence,
  excludePaidAds,
  isBrowserComparison,
  options,
  primaryDriver,
  scope,
  severity,
}: {
  confidence: MetricLoopInvestigationBoard['confidence'];
  excludePaidAds: boolean;
  isBrowserComparison: boolean;
  options: MetricLoopInvestigationOptions;
  primaryDriver: string;
  scope: string;
  severity: number;
}): MetricLoopInvestigationBoard['analysisUpdate'] {
  let summary =
    'The broad dashboard remains mostly stable; MetricLoop needs narrower cohort filters before assigning a root cause.';

  if (isBrowserComparison) {
    summary = excludePaidAds
      ? 'Recomputed after excluding paid ads: Mobile Safari remains the outlier while Chrome stays close to baseline.'
      : 'Recomputed by browser: Mobile Safari is the clearest outlier and should be checked against release timing.';
  } else if (isPaidAdsFocused(options)) {
    summary =
      'The current paid-ads view shifts the investigation toward landing-page match and acquisition quality while keeping the storefront regression as a separate hypothesis.';
  } else if (isStableSlice(options)) {
    summary =
      'The current filters look mostly stable, so MetricLoop is keeping this slice as a contrast against the affected cohort.';
  } else if (severity > 0.74) {
    summary =
      'The current filters isolate a high-confidence activation drop around size selection and add-to-cart.';
  } else if (severity > 0.4) {
    summary =
      'The report now shows an emerging cohort-specific drop, but browser and replay evidence would raise confidence.';
  } else if (options.dateRange === 'last_7_days') {
    summary =
      'The last 7 days add recency signal, but the report has not isolated the segment or browser driver yet.';
  }

  return {
    badge: confidence + ' confidence',
    scope,
    primaryDriver,
    summary,
  };
}

function buildDriverSignals({
  dropOffStep,
  isBrowserComparison,
  options,
  supportThemeMetrics,
}: {
  dropOffStep: MetricLoopInvestigationBoard['dropOffStep'];
  isBrowserComparison: boolean;
  options: MetricLoopInvestigationOptions;
  supportThemeMetrics: MetricLoopInvestigationBoard['supportThemes'];
}): MetricLoopInvestigationBoard['driverSignals'] {
  const focusSignals = [
    options.interaction && options.interaction !== 'all',
    options.region && options.region !== 'all',
    options.segment && options.segment !== 'all_shoppers',
    options.productCategory && options.productCategory !== 'all',
    options.comparison === 'prior_7_days',
    options.trafficSource && options.trafficSource !== 'all',
  ].filter(Boolean).length;
  const topSupportCount = supportThemeMetrics[0]?.count ?? 0;

  return [
    {
      label: 'Time window',
      score:
        options.dateRange === 'last_7_days'
          ? 84
          : options.dateRange === 'last_14_days'
            ? 56
            : 24,
      detail:
        labelMaps.dateRangeTitle[options.dateRange ?? 'last_30_days'] +
        ' compared against the active baseline.',
    },
    {
      label: 'Cohort focus',
      score: clamp(20 + focusSignals * 15, 20, 92),
      detail:
        focusSignals > 0
          ? focusSignals + ' narrowing filters are active in the report.'
          : 'No cohort filters are active yet.',
    },
    {
      label: 'Funnel break',
      score: clamp(Math.round(Math.abs(dropOffStep.delta) * 4.2), 12, 96),
      detail:
        dropOffStep.label +
        ' is the steepest current delta at ' +
        dropOffStep.delta.toFixed(1) +
        ' pts.',
    },
    {
      label: 'Browser split',
      score: isBrowserComparison
        ? 94
        : options.browser === 'mobile_safari'
          ? 78
          : 22,
      detail: isBrowserComparison
        ? 'Mobile Safari is being compared directly against Chrome.'
        : 'Browser evidence is not isolated in the current view.',
    },
    {
      label: 'Support and replay',
      score: clamp(topSupportCount * 3, 12, 92),
      detail:
        topSupportCount +
        ' related support tickets are linked to representative sessions.',
    },
  ];
}

function buildScopedReport({
  confidence,
  excludePaidAds,
  isBrowserComparison,
  options,
  scope,
  severity,
}: {
  confidence: MetricLoopInvestigationBoard['confidence'];
  excludePaidAds: boolean;
  isBrowserComparison: boolean;
  options: MetricLoopInvestigationOptions;
  scope: string;
  severity: number;
}): MetricLoopInvestigationBoard['scopedReport'] {
  const lineage =
    'Original report stays attached; this view recomputes the hypotheses for the active filters.';

  if (isBrowserComparison) {
    return {
      title: 'Current view report',
      lineage,
      summary:
        'Recomputed for the same investigation question; the current filters isolate browser-specific PDP size validation while keeping acquisition quality as context.',
      hypotheses: [
        {
          label: 'Mobile Safari size selector regression',
          status: 'primary',
          confidence,
          evidence:
            excludePaidAds
              ? 'Mobile Safari remains down after paid ads are removed, while Chrome stays close to baseline.'
              : 'Mobile Safari is down more sharply than Chrome, but paid traffic is still in scope.',
          nextStep:
            'Inspect Safari replay traces and verify the size selector release path before rollout.',
        },
        {
          label: 'PDP validation release interaction',
          status: 'secondary',
          confidence: severity > 0.74 ? 'High' : 'Medium',
          evidence:
            'The drop begins after the May 4 size selector validation release and is strongest in add-to-cart.',
          nextStep:
            'Compare sessions before and after the release for the same browser and product category.',
        },
        {
          label: 'Paid acquisition quality drop',
          status: excludePaidAds ? 'ruled_out' : 'watch',
          confidence: excludePaidAds ? 'Low' : 'Medium',
          evidence: excludePaidAds
            ? 'Paid ads are excluded and the activation gap remains.'
            : 'Paid ads remain in scope, so acquisition quality has not been closed out.',
          nextStep:
            'Toggle paid ads out of scope before assigning only engineering ownership.',
        },
      ],
    };
  }

  if (isPaidAdsFocused(options)) {
    return {
      title: 'Current view report',
      lineage,
      summary:
        'The report is now scoped to paid traffic. The likely problem shifts from a browser-only bug toward ad-to-landing-page match for first-time shoppers.',
      hypotheses: [
        {
          label: 'Paid landing-page mismatch',
          status: 'primary',
          confidence: severity > 0.55 ? 'Medium' : 'Low',
          evidence:
            'Paid traffic is isolated in the current view and the activation loss appears before browser evidence is decisive.',
          nextStep:
            'Compare paid ads against organic search for the same product category and first-session cohort.',
        },
        {
          label: 'Search intent to product mismatch',
          status: 'secondary',
          confidence: 'Medium',
          evidence:
            'First-time shoppers are reaching product pages from paid queries, but fewer continue through product selection.',
          nextStep:
            'Review top paid queries, destination URLs, and product-card opens before changing PDP code.',
        },
        {
          label: 'Mobile Safari size selector regression',
          status: 'watch',
          confidence: 'Low',
          evidence:
            'The Safari regression may still exist, but this paid-ads slice does not isolate browser behavior yet.',
          nextStep:
            'Add browser breakdown if the paid-traffic mismatch does not explain the loss.',
        },
      ],
    };
  }

  if (isStableSlice(options)) {
    return {
      title: 'Current view report',
      lineage,
      summary:
        scope +
        ' is acting as a contrast slice; MetricLoop does not see enough movement here to assign root cause.',
      hypotheses: [
        {
          label: 'No material regression in this slice',
          status: 'primary',
          confidence: 'Medium',
          evidence:
            'The selected cohort is comparatively stable and does not match the affected activation pattern.',
          nextStep:
            'Keep this as a control group while narrowing the affected cohort.',
        },
        {
          label: 'Cohort-specific storefront regression',
          status: 'watch',
          confidence: 'Low',
          evidence:
            'The size-selector issue is not ruled out globally, but this slice is not where it is concentrated.',
          nextStep:
            'Switch back to first-time shoppers, Mobile Safari, or footwear to inspect the stronger signal.',
        },
        {
          label: 'Search relevance drift',
          status: 'ruled_out',
          confidence: 'Low',
          evidence:
            'Search result views and product-card opens remain close to baseline in this slice.',
          nextStep:
            'Do not prioritize search ranking changes from this scoped report.',
        },
      ],
    };
  }

  if (severity < 0.35) {
    return {
      title: 'Current view report',
      lineage,
      summary:
        'The broad report is kept as baseline context; the current filters are too wide to isolate a root cause.',
      hypotheses: [
        {
          label: 'No isolated root cause yet',
          status: 'watch',
          confidence: 'Low',
          evidence:
            'The broad dashboard is mostly stable and the largest deltas are not concentrated enough yet.',
          nextStep:
            'Use date range, cohort, browser, traffic, or category filters to narrow the report.',
        },
        {
          label: 'Recent activation softening',
          status: 'secondary',
          confidence: options.dateRange === 'last_7_days' ? 'Medium' : 'Low',
          evidence:
            'The time-window signal rises when the report is scoped to the most recent week.',
          nextStep:
            'Compare the last 7 days against the prior 7 days before assigning ownership.',
        },
        {
          label: 'Browser-specific release regression',
          status: 'watch',
          confidence: 'Low',
          evidence:
            'Release timing is visible, but browser and cohort filters are not narrow enough yet.',
          nextStep:
            'Add Mobile Safari or browser breakdown if the audience wants engineering evidence.',
        },
      ],
    };
  }

  return {
    title: 'Current view report',
    lineage,
    summary:
      'The report now has enough cohort signal to rank storefront friction first while keeping acquisition and search hypotheses visible.',
    hypotheses: [
      {
        label:
          severity > 0.74
            ? 'Mobile Safari size selector validation'
            : 'Footwear size-selection drop',
        status: 'primary',
        confidence,
        evidence:
          'The steepest movement is now concentrated around size selection and add-to-cart in the active cohort.',
        nextStep:
          'Add browser comparison or replay sampling to decide whether this should become a P1 engineering ticket.',
      },
      {
        label: 'Paid acquisition quality drop',
        status: excludePaidAds ? 'ruled_out' : 'secondary',
        confidence: excludePaidAds ? 'Low' : 'Medium',
        evidence: excludePaidAds
          ? 'Paid ads are excluded and the cohort-level activation drop remains.'
          : 'Paid ads are still present, so acquisition quality should remain visible until excluded.',
        nextStep:
          'Toggle paid ads out of the report before closing attribution.',
      },
      {
        label: 'Search ranking regression',
        status: 'watch',
        confidence: 'Low',
        evidence:
          'Search and product-card opens are closer to baseline than the downstream add-to-cart step.',
        nextStep:
          'Keep search as a guardrail rather than the primary fix path.',
      },
    ],
  };
}

function buildEvidenceSteps({
  dropOffStep,
  isBrowserComparison,
  segmentLabel,
  severity,
}: {
  dropOffStep: MetricLoopInvestigationBoard['dropOffStep'];
  isBrowserComparison: boolean;
  segmentLabel: string;
  severity: number;
}): MetricLoopInvestigationBoard['evidenceSteps'] {
  return evidenceSteps.map((step) => {
    if (step.label === 'Segment selected') {
      return {
        ...step,
        finding:
          severity < 0.35
            ? 'Current scope is ' +
              segmentLabel +
              '; no root-cause segment is isolated yet.'
            : segmentLabel + ' is now the active report scope.',
      };
    }

    if (step.label === 'Funnel compared') {
      return {
        ...step,
        finding:
          'The steepest current delta is ' +
          dropOffStep.label +
          ' at ' +
          dropOffStep.delta.toFixed(1) +
          ' pts.',
      };
    }

    if (step.label === 'Release correlated') {
      return {
        ...step,
        finding:
          severity < 0.35
            ? 'Release timing is visible but not yet strong enough to assign cause.'
            : 'The drop starts after the PDP size selector validation release on May 4.',
      };
    }

    if (step.label === 'Sessions sampled' && isBrowserComparison) {
      return {
        ...step,
        finding:
          'Representative Mobile Safari sessions reproduce the size validation failure while Chrome is near baseline.',
      };
    }

    return { ...step };
  });
}

function buildAlternativeCauses({
  excludePaidAds,
  isBrowserComparison,
  options,
  severity,
}: {
  excludePaidAds: boolean;
  isBrowserComparison: boolean;
  options: MetricLoopInvestigationOptions;
  severity: number;
}): MetricLoopInvestigationBoard['alternativeCauses'] {
  return alternativeCauses.map((cause) => {
    if (cause.label === 'Paid ads quality') {
      return {
        ...cause,
        confidence: isPaidAdsFocused(options)
          ? 'high'
          : excludePaidAds
            ? 'low'
            : severity < 0.35
              ? 'medium'
              : 'low',
        reason: excludePaidAds
          ? 'The drop remains after excluding paid ads traffic.'
          : isPaidAdsFocused(options)
            ? 'Paid ads are isolated in this report, so acquisition quality and landing-page match are now primary hypotheses.'
          : 'Paid ads are still included, so acquisition quality remains an open alternative until excluded.',
      };
    }

    if (cause.label === 'Browser-specific release regression') {
      return {
        ...cause,
        confidence:
          isBrowserComparison || severity > 0.74
            ? 'high'
            : severity > 0.4
              ? 'medium'
              : 'low',
        reason: isBrowserComparison
          ? 'Mobile Safari is down sharply while Chrome remains close to baseline after the release.'
          : 'Browser evidence gets stronger after the report is filtered to Mobile Safari or compared against Chrome.',
      };
    }

    if (cause.label === 'Inventory shortage') {
      return {
        ...cause,
        confidence: severity > 0.74 ? 'medium' : 'low',
        reason:
          severity > 0.74
            ? 'Footwear inventory is lower than tents, but affected sessions still show available sizes.'
            : 'Inventory does not explain the broad activation pattern in the current view.',
      };
    }

    return { ...cause };
  });
}

function buildHypothesisScores({
  excludePaidAds,
  isBrowserComparison,
  severity,
}: {
  excludePaidAds: boolean;
  isBrowserComparison: boolean;
  severity: number;
}): MetricLoopInvestigationBoard['hypothesisScores'] {
  return hypothesisScores.map((score) => {
    if (score.hypothesis === 'Mobile Safari size selector regression') {
      const nextScore = clamp(
        Math.round(28 + severity * 58 + (isBrowserComparison ? 10 : 0)),
        28,
        96,
      );
      return {
        ...score,
        score: nextScore,
        evidence: isBrowserComparison
          ? 'Browser split, release timing, replay traces, and support themes all point to Safari size validation.'
          : 'The score rises as filters narrow toward Europe, first-time shoppers, footwear, and the recent window.',
      };
    }

    if (score.hypothesis === 'Paid acquisition quality drop') {
      return {
        ...score,
        score: excludePaidAds
          ? 12
          : clamp(Math.round(48 - severity * 28), 16, 48),
        evidence: excludePaidAds
          ? 'Paid ads are excluded and the activation gap remains.'
          : 'Paid traffic is still in the current scope, so acquisition quality remains plausible.',
      };
    }

    return {
      ...score,
      score: clamp(Math.round(36 - severity * 12), 18, 36),
      evidence:
        severity > 0.4
          ? 'Search and product-open rates are near baseline; the largest loss occurs later.'
          : 'The current view is too broad to rule out search-ranking effects completely.',
    };
  });
}

function buildRecommendedExperiment(
  severity: number,
  isBrowserComparison: boolean,
  options: MetricLoopInvestigationOptions,
): MetricLoopInvestigationBoard['recommendedExperiment'] {
  if (isBrowserComparison) return { ...recommendedExperiment };

  if (isPaidAdsFocused(options)) {
    return {
      title: 'Test paid landing-page alignment before a code rollback',
      owner: 'Growth marketing and storefront analytics',
      expectedImpact:
        'Separate campaign-quality loss from the storefront regression before assigning engineering remediation.',
      guardrailMetric:
        'Activation rate for paid ads versus organic search by first-session cohort',
    };
  }

  if (severity < 0.35) {
    return {
      title: 'Narrow the activation drop before launching an experiment',
      owner: 'Product analytics',
      expectedImpact:
        'Use cohort and browser filters before estimating recovery or assigning engineering owner.',
      guardrailMetric:
        'Activation rate by browser, shopper type, and product category',
    };
  }

  if (severity < 0.75) {
    return {
      title: 'Validate the footwear size-selector hypothesis',
      owner: 'Storefront checkout team',
      expectedImpact:
        'Confirm whether size selection explains the emerging add-to-cart drop before rollback.',
      guardrailMetric:
        'Add-to-cart rate for footwear and non-footwear product pages',
    };
  }

  return {
    title: 'Test a size selector rollback for the affected cohort',
    owner: 'Storefront checkout team',
    expectedImpact:
      'Recover 12-16 points of add-to-cart conversion for first-time Europe footwear shoppers.',
    guardrailMetric:
      'Checkout completion rate for returning shoppers on all browsers',
  };
}

function buildEngineeringBrief({
  excludePaidAds,
  funnel,
  isBrowserComparison,
  options,
  primaryDriver,
  segmentLabel,
  severity,
}: {
  excludePaidAds: boolean;
  funnel: MetricLoopInvestigationBoard['funnel'];
  isBrowserComparison: boolean;
  options: MetricLoopInvestigationOptions;
  primaryDriver: string;
  segmentLabel: string;
  severity: number;
}): MetricLoopEngineeringBrief {
  const averageOrderValue = 142;
  const checkoutStep =
    funnel.find((step) => step.step === 'checkout_started') ??
    funnel.at(-1) ??
    funnel[0];
  const sessionStep = funnel[0];
  const lostCheckouts = Math.max(
    0,
    checkoutStep.previousUsers - checkoutStep.currentUsers,
  );
  const recoverableRate = isBrowserComparison
    ? 0.8
    : severity > 0.74
      ? 0.76
      : 0.62;
  const recoverableOrders = Math.round(lostCheckouts * recoverableRate);
  const currentCapturedRevenue = checkoutStep.currentUsers * averageOrderValue;
  const regressionGap = lostCheckouts * averageOrderValue;
  const estimatedWeeklyRevenueRecovery = recoverableOrders * averageOrderValue;
  const residualRisk = Math.max(
    0,
    regressionGap - estimatedWeeklyRevenueRecovery,
  );
  const priority =
    severity > 0.74 ||
    (isBrowserComparison && excludePaidAds && severity > 0.65)
      ? 'P1'
      : severity > 0.4
        ? 'P2'
        : 'P3';
  const paidAdsFocused = isPaidAdsFocused(options);
  const summary = paidAdsFocused
    ? 'Paid traffic is now the primary scoped hypothesis, so the handoff should validate campaign-to-product match before assigning a browser-only engineering fix.'
    : isBrowserComparison
    ? excludePaidAds
      ? 'Mobile Safari remains the primary activation outlier after paid ads are excluded, pointing the engineering handoff at the PDP size selector path.'
      : 'Mobile Safari is the clearest browser outlier in the current view; exclude paid ads and narrow the cohort before assigning a P1 fix.'
    : severity > 0.74
      ? primaryDriver +
        ' is blocking first-time Europe footwear shoppers after size selection, creating a measurable checkout recovery opportunity.'
      : severity > 0.4
        ? primaryDriver +
          ' is emerging in the filtered cohort; validate browser and replay evidence before rollback.'
        : 'Current filters show an early activation signal, but the report needs a narrower cohort before assigning a high-confidence engineering fix.';

  return {
    title: 'Engineering ticket brief',
    summary,
    impact: {
      affectedSessions: sessionStep.currentUsers,
      lostCheckouts,
      recoverableOrders,
      averageOrderValue,
      estimatedWeeklyRevenueRecovery,
    },
    roiChart: {
      title: 'Weekly recovery opportunity',
      subtitle: segmentLabel + ' / checkout-started impact',
      unit: 'usd',
      data: [
        {
          label: 'Current captured revenue',
          value: currentCapturedRevenue,
          tone: 'current',
          detail:
            checkoutStep.currentUsers.toLocaleString() +
            ' checkout starts still captured',
        },
        {
          label: 'Regression gap',
          value: regressionGap,
          tone: 'loss',
          detail:
            lostCheckouts.toLocaleString() +
            ' missed checkout starts vs prior period',
        },
        {
          label: 'Recoverable with fix',
          value: estimatedWeeklyRevenueRecovery,
          tone: 'gain',
          detail:
            recoverableOrders.toLocaleString() +
            (paidAdsFocused
              ? ' orders recoverable after paid landing-page fix'
              : ' orders recoverable after Safari fix'),
        },
        {
          label: 'Residual risk',
          value: residualRisk,
          tone: 'risk',
          detail: 'Remaining gap held for attribution and guardrail risk',
        },
      ],
      assumptions: [
        'Average order value is modeled at $142 for the footwear cohort.',
        'Recoverable value assumes the fix restores most, not all, of the prior-period checkout gap.',
        'Use a 24-hour holdout and add-to-cart guardrail before rolling out globally.',
      ],
    },
    ticket: {
      title: paidAdsFocused
        ? 'Review paid landing-page match for first-time shoppers'
        : 'Fix PDP size selector validation loop on Mobile Safari',
      priority,
      owner: paidAdsFocused
        ? 'Growth marketing and storefront analytics'
        : 'Storefront checkout team',
      labels: paidAdsFocused
        ? ['paid-ads', 'landing-page', 'activation', 'first-session']
        : ['pdp', 'mobile-safari', 'voice-search', 'activation'],
      reproductionSteps: paidAdsFocused
        ? [
            'Open the paid campaign landing path for first-time shoppers.',
            'Compare paid-ad query terms against the destination product category.',
            'Review product-card opens and add-to-cart continuation for the same audience.',
            'Compare the result against organic search before assigning storefront remediation.',
          ]
        : [
            'Open Supply Co. on Mobile Safari as a first-time shopper in Europe.',
            'Search for hiking boots by voice and open Waterproof Trail Hiking Boots.',
            'Select a boot size, then tap Add to cart.',
            'Observe that the selected size is not persisted and the add-to-cart path remains blocked.',
          ],
      acceptanceCriteria: paidAdsFocused
        ? [
            'Paid landing pages send first-time shoppers to products matching the top campaign query intent.',
            'Paid traffic activation is compared against organic search for the same product category.',
            'Campaign-quality findings are separated from the Mobile Safari size-selector investigation.',
            'Activation for paid first-session shoppers improves without reducing organic conversion.',
          ]
        : [
            'Mobile Safari first-time shoppers can select a boot size and add to cart without a disabled-state loop.',
            'The selected size stays applied from both the size grid and size guide on iOS Safari.',
            'Add automated coverage for the hiking boot size-to-cart path before release.',
            'Activation for Europe first-time footwear shoppers returns within 3 pts of Chrome for 24 hours.',
          ],
    },
  };
}

export function runMetricLoopInvestigation(
  options: MetricLoopInvestigationOptions = {},
): MetricLoopInvestigationBoard {
  const isBrowserComparison = options.mode === 'browser_comparison';
  const excludePaidAds = Boolean(options.excludePaidAds);
  const severity = computeSeverity(options);
  const focusedFunnel = isBrowserComparison
    ? activationFunnelBrowserComparison
    : activationFunnelInitial;
  const funnel = buildFunnel(severity, focusedFunnel);
  const browserComparison = isBrowserComparison
    ? 'Mobile Safari vs Chrome'
    : null;
  const segmentLabel = buildSegmentLabel(options);
  const supportThemeMetrics = scaleSupportThemes(severity);
  const dropOffStep = findDropOffStep(funnel);
  const confidence = getConfidence(severity);
  const primaryDriver = getPrimaryDriver(
    severity,
    isBrowserComparison,
    options,
  );
  const analysisScope = buildAnalysisScope(
    options,
    isBrowserComparison,
    excludePaidAds,
  );
  const engineeringBrief = buildEngineeringBrief({
    excludePaidAds,
    funnel,
    isBrowserComparison,
    options,
    primaryDriver,
    segmentLabel,
    severity,
  });

  return {
    id: isBrowserComparison
      ? 'board-eu-first-time-browser-comparison'
      : `board-filtered-${Math.round(severity * 100)}`,
    title: 'Root-Cause Investigation Notebook',
    question:
      options.question ??
      (isBrowserComparison
        ? 'Exclude paid ads traffic and compare Mobile Safari versus Chrome.'
        : `Analyze activation for ${segmentLabel}.`),
    segmentLabel,
    conclusion: getConclusion(
      severity,
      isBrowserComparison,
      excludePaidAds,
      options,
    ),
    confidence,
    analysisUpdate: buildAnalysisUpdate({
      confidence,
      excludePaidAds,
      isBrowserComparison,
      options,
      primaryDriver,
      scope: analysisScope,
      severity,
    }),
    driverSignals: buildDriverSignals({
      dropOffStep,
      isBrowserComparison,
      options,
      supportThemeMetrics,
    }),
    scopedReport: buildScopedReport({
      confidence,
      excludePaidAds,
      isBrowserComparison,
      options,
      scope: analysisScope,
      severity,
    }),
    filters: {
      dateRange: labelMaps.dateRangeTitle[options.dateRange ?? 'last_30_days'],
      region: labelMaps.region[options.region ?? 'all'],
      segment: labelMaps.segment[options.segment ?? 'all_shoppers'],
      teamAge: labelMaps.segmentTitle[options.segment ?? 'all_shoppers'],
      window: labelMaps.dateRangeTitle[options.dateRange ?? 'last_30_days'],
      trafficSource: excludePaidAds
        ? 'Paid ads excluded'
        : labelMaps.trafficSource[options.trafficSource ?? 'all'],
      excludePaidAds,
      browserComparison,
      device: labelMaps.device[options.device ?? 'all'],
      productCategory:
        labelMaps.productCategory[options.productCategory ?? 'all'],
    },
    funnel,
    dropOffStep,
    correlatedRelease,
    supportThemes: supportThemeMetrics,
    representativeSessions: getSessions(options),
    browserBreakdown: scaleBrowserBreakdown(severity, isBrowserComparison),
    searchIntents: scaleSearchIntents(severity, options.productCategory),
    releaseTimeline: scaleReleaseTimeline(severity),
    sessionEvents: sessionEvents.map((session) => ({
      sessionId: session.sessionId,
      events: session.events.map((event) => ({ ...event })),
    })),
    evidenceSteps: buildEvidenceSteps({
      dropOffStep,
      isBrowserComparison,
      segmentLabel,
      severity,
    }),
    alternativeCauses: buildAlternativeCauses({
      excludePaidAds,
      isBrowserComparison,
      options,
      severity,
    }),
    hypothesisScores: buildHypothesisScores({
      excludePaidAds,
      isBrowserComparison,
      severity,
    }),
    recommendedExperiment: buildRecommendedExperiment(
      severity,
      isBrowserComparison,
      options,
    ),
    engineeringBrief,
    recommendation: getRecommendation(severity, isBrowserComparison, options),
    followUpQuestions: [
      'Did the validation release include a Safari-only event handling change?',
      'Do affected sessions recover if users open the size guide first?',
      'Should the assistant route blocked add-to-cart attempts to a fallback size picker?',
    ],
  };
}
