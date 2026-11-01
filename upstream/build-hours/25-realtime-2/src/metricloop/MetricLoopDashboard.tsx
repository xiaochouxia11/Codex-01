import { useCallback, useMemo, useRef, useState } from 'react';
import { MetricLoopActionConsole } from './MetricLoopActionConsole';
import { MetricLoopAgentProvider } from './MetricLoopAgentContext';
import { MetricLoopFilters } from './MetricLoopFilters';
import { hasMetricLoopWorkbenchActivities } from './MetricLoopForensicsWorkbench';
import { MetricLoopNotebook } from './MetricLoopNotebook';
import {
  ActivationFunnelDelta,
  BrowserBreakdownBars,
  ReleaseCorrelationTimeline,
  SearchIntentTable,
  SessionReplayEvidenceStrip,
  SupportThemeCards,
  formatMetricLoopCurrency,
  formatMetricLoopDelta,
  formatMetricLoopPercent,
} from './MetricLoopVisualizations';
import {
  runMetricLoopInvestigation,
  type MetricLoopInvestigationBoard,
  type MetricLoopInvestigationOptions,
} from './metricLoopEngine';
import {
  applyMetricLoopFilterPatch,
  createDefaultMetricLoopDashboardFilters,
  createMetricLoopInvestigationBoardForFilters,
  getMetricLoopFilterChips,
  getMetricLoopInvestigationOptionsForFilters,
} from './metricLoopDashboardFilters';
import type {
  MetricLoopActionResponse,
  MetricLoopAnalysisRunStatus,
  MetricLoopAgentContextValue,
  MetricLoopApplyFilterRequest,
  MetricLoopConsolePromptRequest,
  MetricLoopComparePeriodsRequest,
  MetricLoopDashboardFilters,
  MetricLoopDashboardSnapshot,
  MetricLoopGenerateBoardRequest,
  MetricLoopNoOpRequest,
  MetricLoopOpenInsightRequest,
  MetricLoopRootCauseInvestigationRequest,
  MetricLoopSegmentFilterRequest,
  MetricLoopSetBreakdownRequest,
  MetricLoopSessionReplayRequest,
  MetricLoopSwitchVisualizationRequest,
  MetricLoopToolActivity,
  MetricLoopView,
} from './metricLoopContracts';

const navItems: Array<{
  id: MetricLoopView;
  label: string;
  group: 'main' | 'analytics' | 'operate' | 'system';
}> = [
  { id: 'home', label: 'Home', group: 'main' },
  { id: 'dashboards', label: 'Dashboards', group: 'main' },
  { id: 'product_analytics', label: 'Product analytics', group: 'analytics' },
  { id: 'people', label: 'People and groups', group: 'analytics' },
  { id: 'activity', label: 'Activity', group: 'analytics' },
  { id: 'replays', label: 'Session replay', group: 'analytics' },
  { id: 'flags', label: 'Feature flags', group: 'operate' },
  { id: 'experiments', label: 'Experiments', group: 'operate' },
  { id: 'surveys', label: 'Surveys', group: 'operate' },
  { id: 'sql', label: 'SQL editor', group: 'system' },
  { id: 'pipelines', label: 'Data pipelines', group: 'system' },
  { id: 'settings', label: 'Settings', group: 'system' },
];

const productAnalyticsTabs: Array<{ id: MetricLoopView; label: string }> = [
  { id: 'overview', label: 'Trends' },
  { id: 'funnels', label: 'Funnels' },
  { id: 'retention', label: 'Retention' },
  { id: 'paths', label: 'User Paths' },
  { id: 'stickiness', label: 'Stickiness' },
  { id: 'lifecycle', label: 'Lifecycle' },
  { id: 'sql', label: 'SQL' },
];

const cohortRows = [
  ['Europe / first-time shoppers', '842 shoppers', '20.1%', '-18.1 pts'],
  [
    'North America / first-time shoppers',
    '1,214 shoppers',
    '37.8%',
    '-1.7 pts',
  ],
  ['Europe / returning shoppers', '1,441 shoppers', '41.2%', '+0.8 pts'],
  ['APAC / first-time shoppers', '507 shoppers', '34.4%', '-2.3 pts'],
];

function response(
  message: string,
  patch: Partial<MetricLoopActionResponse> = {},
): MetricLoopActionResponse {
  return {
    status: 'done',
    message,
    ...patch,
  };
}

function getInvestigationMode(
  request?: Pick<
    MetricLoopRootCauseInvestigationRequest,
    'mode' | 'compareBrowsers' | 'excludePaidAds'
  >,
): MetricLoopInvestigationOptions['mode'] {
  if (request?.mode) return request.mode;
  if (
    request?.compareBrowsers?.includes('mobile_safari') ||
    request?.excludePaidAds
  )
    return 'browser_comparison';
  return 'initial';
}

interface MetricLoopActionSpotlight {
  target: string;
  title: string;
  detail: string;
}

function describeFilterAction(
  patch: Partial<MetricLoopDashboardFilters>,
  filters: MetricLoopDashboardFilters,
): string {
  const changed: string[] = [];
  if (patch.interaction === 'voice_search') changed.push('Voice search');
  if (patch.region === 'europe') changed.push('Europe');
  if (patch.dateRange === 'last_7_days') changed.push('Last 7 days');
  if (patch.comparison === 'prior_7_days')
    changed.push('Prior-period comparison');
  if (patch.segment === 'first_time_shoppers')
    changed.push('First-time shoppers');
  if (patch.productCategory === 'footwear') changed.push('Footwear');
  if (patch.excludePaidAds) changed.push('Paid ads excluded');
  if (patch.browser === 'mobile_safari') changed.push('Mobile Safari');
  if (patch.breakdown === 'browser') changed.push('Browser breakdown');

  const label = changed.length > 0 ? changed.join(' + ') : 'Dashboard filter';
  const activation = formatMetricLoopPercent(
    runMetricLoopInvestigation(
      getMetricLoopInvestigationOptionsForFilters(filters),
    ).funnel.at(-1)?.currentRate ?? 0,
  );
  return label + ' applied. Activation recalculated to ' + activation + '.';
}

export function MetricLoopDashboard() {
  const startsWithBrowserVariation = useMemo(
    () =>
      new URLSearchParams(window.location.search).get('variation') ===
      'browser',
    [],
  );
  const initialFilters = useMemo(() => {
    const defaultFilters = createDefaultMetricLoopDashboardFilters();

    if (!startsWithBrowserVariation) return defaultFilters;

    return applyMetricLoopFilterPatch(defaultFilters, {
      interaction: 'voice_search',
      dateRange: 'last_7_days',
      comparison: 'prior_7_days',
      segment: 'first_time_shoppers',
      region: 'europe',
      trafficSource: 'organic',
      excludePaidAds: true,
      browser: 'mobile_safari',
      productCategory: 'footwear',
      breakdown: 'browser',
    });
  }, [startsWithBrowserVariation]);
  const initialBoard = useMemo(
    () =>
      runMetricLoopInvestigation({
        ...getMetricLoopInvestigationOptionsForFilters(initialFilters),
        mode: startsWithBrowserVariation
          ? 'browser_comparison'
          : getMetricLoopInvestigationOptionsForFilters(initialFilters).mode,
        excludePaidAds: startsWithBrowserVariation
          ? true
          : initialFilters.excludePaidAds,
      }),
    [initialFilters, startsWithBrowserVariation],
  );
  const [activeView, setActiveView] = useState<MetricLoopView>('overview');
  const [board, setBoard] = useState<MetricLoopInvestigationBoard>(
    () => initialBoard,
  );
  const [filters, setFilters] = useState<MetricLoopDashboardFilters>(
    () => initialFilters,
  );
  const [hasInvestigation, setHasInvestigation] = useState(
    startsWithBrowserVariation,
  );
  const [highlightedPanel, setHighlightedPanel] = useState<string | null>(
    'metricloop-dashboard',
  );
  const [notebookExpanded, setNotebookExpanded] = useState(false);
  const [actionSpotlight, setActionSpotlight] =
    useState<MetricLoopActionSpotlight | null>(() =>
      startsWithBrowserVariation
        ? {
            target: 'Review Mobile Safari evidence',
            title: 'Activation drop isolated',
            detail:
              'MetricLoop has narrowed the activation drop to first-time Europe shoppers using Mobile Safari, with release, ticket, and replay evidence aligned.',
          }
        : {
            target: 'Ask MetricLoop to investigate the activation drop',
            title: 'Investigate activation drop',
            detail:
              'MetricLoop is ready to narrow the activation dip across segments, funnel steps, release activity, support tickets, and session replays.',
          },
    );
  const [selectedReplayId, setSelectedReplayId] = useState<string | null>(() =>
    startsWithBrowserVariation
      ? (initialBoard.representativeSessions[0]?.id ?? null)
      : null,
  );

  const createBoardForFilters = useCallback(
    (nextFilters: MetricLoopDashboardFilters, question?: string) =>
      createMetricLoopInvestigationBoardForFilters(nextFilters, {
        previousBoard: hasInvestigation ? board : undefined,
        question,
      }),
    [board, hasInvestigation],
  );

  const buildSnapshot = useCallback(
    (): MetricLoopDashboardSnapshot => ({
      activeView,
      board,
      filters: board.filters,
      dashboardFilters: filters,
      highlightedPanel,
      selectedReplayId,
      safeTargets: [
        {
          targetId: 'metricloop-nav-funnels',
          label: 'Funnels',
          kind: 'navigation',
          isVisible: true,
        },
        {
          targetId: 'metricloop-nav-releases',
          label: 'Release notes',
          kind: 'navigation',
          isVisible: true,
        },
        {
          targetId: 'metricloop-nav-support',
          label: 'Support themes',
          kind: 'navigation',
          isVisible: true,
        },
        {
          targetId: 'metricloop-nav-replays',
          label: 'Session replays',
          kind: 'navigation',
          isVisible: true,
        },
        {
          targetId: 'metricloop-board',
          label: 'Investigation notebook',
          kind: 'artifact',
          isVisible: hasInvestigation,
        },
        {
          targetId: 'metricloop-funnel',
          label: 'Activation funnel',
          kind: 'chart',
          isVisible: true,
        },
      ],
      capturedAtIso: new Date().toISOString(),
    }),
    [
      activeView,
      board,
      filters,
      hasInvestigation,
      highlightedPanel,
      selectedReplayId,
    ],
  );

  const applyBoard = useCallback(
    (nextBoard: MetricLoopInvestigationBoard, nextHighlight: string) => {
      setBoard(nextBoard);
      setHasInvestigation(true);
      setHighlightedPanel(nextHighlight);
      setActionSpotlight({
        target: 'Investigation Notebook',
        title: 'Root-cause artifact generated',
        detail:
          'MetricLoop pulled funnel deltas, release timing, support themes, replay evidence, and an ROI-backed engineering brief into one report.',
      });
      setSelectedReplayId(nextBoard.representativeSessions[0]?.id ?? null);
    },
    [],
  );

  const openActivationFunnel = useCallback((): MetricLoopActionResponse => {
    setActiveView('funnels');
    setHighlightedPanel('activation-funnel');
    setActionSpotlight({
      target: 'Activation funnel',
      title: 'Opened the funnel',
      detail:
        'Watch the before/after conversion steps; the largest drop-off will become the investigation target.',
    });
    return response('Opened the activation funnel.', {
      activeView: 'funnels',
      highlightedPanel: 'activation-funnel',
      board,
    });
  }, [board]);

  const applySegmentFilter = useCallback(
    (request: MetricLoopSegmentFilterRequest): MetricLoopActionResponse => {
      const browserComparison =
        Boolean(request.browserComparison) ||
        request.browser?.toLowerCase().includes('safari');
      const nextFilters = applyMetricLoopFilterPatch(filters, {
        region: request.region?.toLowerCase().includes('europe')
          ? 'europe'
          : filters.region,
        segment: request.segment?.toLowerCase().includes('first')
          ? 'first_time_shoppers'
          : filters.segment,
        excludePaidAds: request.excludePaidAds ?? filters.excludePaidAds,
        browser: browserComparison ? 'mobile_safari' : filters.browser,
        breakdown: browserComparison ? 'browser' : filters.breakdown,
      });
      const nextBoard = createBoardForFilters(nextFilters);
      const highlight = hasInvestigation
        ? 'root-cause-board'
        : browserComparison
          ? 'browser-breakdown'
          : 'segment-filters';

      setFilters(nextFilters);
      setBoard(nextBoard);
      setSelectedReplayId(null);
      setHighlightedPanel(highlight);
      setActionSpotlight({
        target: hasInvestigation
          ? 'Investigation Notebook'
          : browserComparison
            ? 'Browser breakdown'
            : 'Filter builder',
        title: hasInvestigation
          ? 'Investigation Notebook updated'
          : browserComparison
            ? 'Browser comparison applied'
            : 'Segment filters applied',
        detail: hasInvestigation
          ? nextBoard.analysisUpdate.summary
          : describeFilterAction(
              {
                region:
                  nextFilters.region !== filters.region
                    ? nextFilters.region
                    : undefined,
                segment:
                  nextFilters.segment !== filters.segment
                    ? nextFilters.segment
                    : undefined,
                excludePaidAds:
                  nextFilters.excludePaidAds !== filters.excludePaidAds
                    ? nextFilters.excludePaidAds
                    : undefined,
                browser:
                  nextFilters.browser !== filters.browser
                    ? nextFilters.browser
                    : undefined,
                breakdown:
                  nextFilters.breakdown !== filters.breakdown
                    ? nextFilters.breakdown
                    : undefined,
              },
              nextFilters,
            ),
      });
      return response(
        hasInvestigation
          ? 'Updated the Investigation Notebook for the current filters.'
          : 'Applied segment filters.',
        {
          filters: nextBoard.filters,
          board: nextBoard,
          highlightedPanel: highlight,
        },
      );
    },
    [createBoardForFilters, filters, hasInvestigation],
  );

  const applyFilter = useCallback(
    (request: MetricLoopApplyFilterRequest): MetricLoopActionResponse => {
      const nextFilters = applyMetricLoopFilterPatch(filters, request);
      const nextBoard = createBoardForFilters(nextFilters);
      const dashboardHighlight =
        nextFilters.breakdown === 'browser' ||
        nextFilters.browser === 'mobile_safari'
          ? 'browser-breakdown'
          : 'segment-filters';
      const highlight = hasInvestigation
        ? 'root-cause-board'
        : dashboardHighlight;

      setFilters(nextFilters);
      setBoard(nextBoard);
      setSelectedReplayId(null);
      setHighlightedPanel(highlight);
      setActionSpotlight({
        target: hasInvestigation
          ? 'Investigation Notebook'
          : dashboardHighlight === 'browser-breakdown'
            ? 'Browser breakdown'
            : 'Filter builder',
        title: hasInvestigation
          ? 'Investigation Notebook updated'
          : dashboardHighlight === 'browser-breakdown'
            ? 'Browser filter applied'
            : 'Dashboard filter applied',
        detail: hasInvestigation
          ? nextBoard.analysisUpdate.summary
          : describeFilterAction(request, nextFilters),
      });

      return response(
        hasInvestigation
          ? 'Updated the Investigation Notebook for the current filters.'
          : 'Applied dashboard filters.',
        {
          filters: nextBoard.filters,
          board: nextBoard,
          highlightedPanel: highlight,
        },
      );
    },
    [createBoardForFilters, filters, hasInvestigation],
  );

  const openInsight = useCallback(
    (request: MetricLoopOpenInsightRequest): MetricLoopActionResponse => {
      const insightMap: Record<
        MetricLoopOpenInsightRequest['insightId'],
        { view: MetricLoopView; highlight: string; message: string }
      > = {
        activation_funnel: {
          view: 'funnels',
          highlight: 'activation-funnel',
          message: 'Opened the activation funnel.',
        },
        release_correlation: {
          view: 'overview',
          highlight: 'release-correlation',
          message: 'Opened release correlation.',
        },
        browser_breakdown: {
          view: 'overview',
          highlight: 'browser-breakdown',
          message: 'Opened browser breakdown.',
        },
        search_intents: {
          view: 'overview',
          highlight: 'search-intents',
          message: 'Opened search intent analysis.',
        },
        session_replays: {
          view: 'replays',
          highlight: 'session-replays',
          message: 'Opened session replays.',
        },
        support_themes: {
          view: 'overview',
          highlight: 'support-themes',
          message: 'Opened support themes.',
        },
        investigation_notebook: {
          view: activeView,
          highlight: 'root-cause-board',
          message: 'Opened the Investigation Notebook.',
        },
      };
      const next = insightMap[request.insightId];

      if (request.insightId === 'investigation_notebook' && !hasInvestigation) {
        setHighlightedPanel('metricloop-dashboard');
        setActionSpotlight({
          target: 'Run investigation',
          title: 'Investigation not generated yet',
          detail:
            'MetricLoop can open the Investigation Notebook after it has generated a root-cause report for the current view.',
        });

        return response('Investigation Notebook is not available yet.', {
          activeView,
          board,
          highlightedPanel: 'metricloop-dashboard',
        });
      }

      setActiveView(next.view);
      setHighlightedPanel(next.highlight);
      setActionSpotlight({
        target: next.highlight,
        title: next.message,
        detail:
          'MetricLoop navigated the dashboard to the relevant evidence panel.',
      });
      if (request.insightId === 'investigation_notebook') {
        setNotebookExpanded(true);
      }

      return response(next.message, {
        activeView: next.view,
        board,
        highlightedPanel: next.highlight,
      });
    },
    [activeView, board, hasInvestigation],
  );

  const setBreakdown = useCallback(
    (request: MetricLoopSetBreakdownRequest): MetricLoopActionResponse => {
      const nextFilters = applyMetricLoopFilterPatch(filters, {
        breakdown: request.breakdown,
        browser:
          request.breakdown === 'browser' ? 'mobile_safari' : filters.browser,
      });
      const nextBoard = createBoardForFilters(nextFilters);
      const dashboardHighlight =
        request.breakdown === 'browser'
          ? 'browser-breakdown'
          : 'segment-filters';
      const highlight = hasInvestigation
        ? 'root-cause-board'
        : dashboardHighlight;

      setFilters(nextFilters);
      setBoard(nextBoard);
      setSelectedReplayId(null);
      setHighlightedPanel(highlight);
      setActionSpotlight({
        target: hasInvestigation
          ? 'Investigation Notebook'
          : dashboardHighlight === 'browser-breakdown'
            ? 'Browser breakdown'
            : 'Breakdown control',
        title: hasInvestigation
          ? 'Investigation Notebook updated'
          : 'Breakdown changed',
        detail: hasInvestigation
          ? nextBoard.analysisUpdate.summary
          : request.breakdown === 'browser'
            ? 'The dashboard is now comparing Mobile Safari against other browsers.'
            : 'The dashboard breakdown was updated.',
      });

      return response(
        hasInvestigation
          ? 'Updated the Investigation Notebook for the current breakdown.'
          : 'Set dashboard breakdown.',
        {
          board: nextBoard,
          filters: nextBoard.filters,
          highlightedPanel: highlight,
        },
      );
    },
    [createBoardForFilters, filters, hasInvestigation],
  );

  const switchVisualization = useCallback(
    (
      request: MetricLoopSwitchVisualizationRequest,
    ): MetricLoopActionResponse => {
      setFilters((current) => ({ ...current, chartType: request.chartType }));
      setHighlightedPanel(
        request.chartType === 'timeline'
          ? 'release-correlation'
          : 'activation-funnel',
      );
      setActionSpotlight({
        target:
          request.chartType === 'timeline'
            ? 'Release timeline'
            : 'Activation funnel',
        title: 'Visualization changed',
        detail:
          'MetricLoop switched the evidence view so the next step is easier to inspect.',
      });

      return response('Switched visualization.', {
        board,
        highlightedPanel:
          request.chartType === 'timeline'
            ? 'release-correlation'
            : 'activation-funnel',
      });
    },
    [board],
  );

  const comparePeriods = useCallback(
    (_request?: MetricLoopComparePeriodsRequest): MetricLoopActionResponse => {
      const nextFilters = applyMetricLoopFilterPatch(filters, {
        dateRange: 'last_7_days',
        comparison: 'prior_7_days',
      });
      const nextBoard = createBoardForFilters(nextFilters);

      setFilters(nextFilters);
      setBoard(nextBoard);
      setActiveView('funnels');
      setSelectedReplayId(null);
      setHighlightedPanel(
        hasInvestigation ? 'root-cause-board' : 'period-comparison',
      );
      setActionSpotlight({
        target: hasInvestigation ? 'Investigation Notebook' : 'Date comparison',
        title: hasInvestigation
          ? 'Investigation Notebook updated'
          : 'Last 7 days compared to prior 7 days',
        detail: hasInvestigation
          ? nextBoard.analysisUpdate.summary
          : 'The funnel deltas now show whether the drop is new or persistent.',
      });
      return response(
        hasInvestigation
          ? 'Updated the Investigation Notebook for the current period comparison.'
          : 'Compared last 7 days with the prior period.',
        {
          activeView: 'funnels',
          board: nextBoard,
          filters: nextBoard.filters,
          highlightedPanel: hasInvestigation
            ? 'root-cause-board'
            : 'period-comparison',
        },
      );
    },
    [createBoardForFilters, filters, hasInvestigation],
  );

  const checkReleaseNotes = useCallback((): MetricLoopActionResponse => {
    setActiveView('overview');
    setHighlightedPanel('release-correlation');
    setActionSpotlight({
      target: 'Release correlation',
      title: 'Release notes checked',
      detail:
        'The May 4 PDP size-selector release is now the strongest correlated product change.',
    });
    return response(
      'Checked release notes and found the size selector validation release.',
      {
        activeView: 'overview',
        board,
        highlightedPanel: 'release-correlation',
      },
    );
  }, [board]);

  const clusterSupportTickets = useCallback((): MetricLoopActionResponse => {
    setHighlightedPanel('support-themes');
    setActionSpotlight({
      target: 'Support themes',
      title: 'Support tickets clustered',
      detail:
        'Ticket language is grouped around size selection failing to enable add-to-cart.',
    });
    return response('Clustered support tickets for the active segment.', {
      activeView,
      board,
      highlightedPanel: 'support-themes',
    });
  }, [activeView, board]);

  const openSessionReplays = useCallback(
    (request?: MetricLoopSessionReplayRequest): MetricLoopActionResponse => {
      const replay =
        board.representativeSessions.find((session) =>
          request?.sessionId
            ? session.id === request.sessionId
            : request?.browser
              ? session.browser
                  .toLowerCase()
                  .includes(request.browser.toLowerCase().replace('_', ' '))
              : session.finding.toLowerCase().includes('hiking boots'),
      ) ?? board.representativeSessions[0];
      setActiveView('replays');
      setSelectedReplayId(replay?.id ?? null);
      setHighlightedPanel('session-replays');
      setActionSpotlight({
        target: 'Session replay',
        title: 'Representative replay opened',
        detail:
          (replay?.id ?? 'Replay') +
          ' shows the shopper selecting a size while add-to-cart stays disabled.',
      });
      return response('Opened representative session replays.', {
        activeView: 'replays',
        board,
        selectedReplayId: replay?.id ?? null,
        highlightedPanel: 'session-replays',
      });
    },
    [board],
  );

  const openSessionReplay = useCallback(
    (request?: MetricLoopSessionReplayRequest): MetricLoopActionResponse =>
      openSessionReplays(request),
    [openSessionReplays],
  );

  const generateInvestigationBoard = useCallback(
    (request?: MetricLoopGenerateBoardRequest): MetricLoopActionResponse => {
      const requestedMode =
        request?.mode ??
        getMetricLoopInvestigationOptionsForFilters(filters).mode;
      const nextFilters = applyMetricLoopFilterPatch(filters, {
        excludePaidAds: request?.excludePaidAds ?? filters.excludePaidAds,
        browser:
          requestedMode === 'browser_comparison'
            ? 'mobile_safari'
            : filters.browser,
        breakdown:
          requestedMode === 'browser_comparison'
            ? 'browser'
            : filters.breakdown,
      });
      const currentOptions =
        getMetricLoopInvestigationOptionsForFilters(nextFilters);
      const nextBoard = runMetricLoopInvestigation({
        ...currentOptions,
        mode: requestedMode,
        excludePaidAds: nextFilters.excludePaidAds,
        question: request?.question,
      });
      setFilters(nextFilters);
      applyBoard(nextBoard, 'root-cause-board');
      setActiveView('overview');
      return response('Generated the root-cause investigation notebook.', {
        activeView: 'overview',
        board: nextBoard,
        filters: nextBoard.filters,
        highlightedPanel: 'root-cause-board',
        selectedReplayId: nextBoard.representativeSessions[0]?.id ?? null,
      });
    },
    [applyBoard, filters],
  );

  const startRootCauseInvestigation = useCallback(
    (
      request: MetricLoopRootCauseInvestigationRequest,
    ): MetricLoopActionResponse => {
      const requestedMode = getInvestigationMode(request);
      const nextFilters = applyMetricLoopFilterPatch(filters, {
        excludePaidAds: request.excludePaidAds ?? filters.excludePaidAds,
        browser:
          requestedMode === 'browser_comparison'
            ? 'mobile_safari'
            : filters.browser,
        breakdown:
          requestedMode === 'browser_comparison'
            ? 'browser'
            : filters.breakdown,
      });
      const currentOptions =
        getMetricLoopInvestigationOptionsForFilters(nextFilters);
      const nextBoard = runMetricLoopInvestigation({
        ...currentOptions,
        mode: requestedMode,
        excludePaidAds: nextFilters.excludePaidAds,
        question: request.question,
      });
      setFilters(nextFilters);
      applyBoard(nextBoard, 'root-cause-board');
      setActiveView('overview');
      return response('Generated the root-cause investigation notebook.', {
        activeView: 'overview',
        board: nextBoard,
        filters: nextBoard.filters,
        highlightedPanel: 'root-cause-board',
        selectedReplayId: nextBoard.representativeSessions[0]?.id ?? null,
      });
    },
    [applyBoard, filters],
  );

  const updateInvestigationNotebook = useCallback(
    (
      request: MetricLoopRootCauseInvestigationRequest,
    ): MetricLoopActionResponse => {
      const requestedMode = getInvestigationMode(request);
      const nextFilters = applyMetricLoopFilterPatch(filters, {
        excludePaidAds: request.excludePaidAds ?? filters.excludePaidAds,
        browser:
          requestedMode === 'browser_comparison'
            ? 'mobile_safari'
            : filters.browser,
        breakdown:
          requestedMode === 'browser_comparison'
            ? 'browser'
            : filters.breakdown,
      });
      const currentOptions =
        getMetricLoopInvestigationOptionsForFilters(nextFilters);
      const nextBoard = runMetricLoopInvestigation({
        ...currentOptions,
        mode: requestedMode,
        excludePaidAds: nextFilters.excludePaidAds,
        question: request.question,
      });
      setFilters(nextFilters);
      applyBoard(
        nextBoard,
        request.compareBrowsers?.length
          ? 'browser-breakdown'
          : 'root-cause-board',
      );
      return response('Updated the Investigation Notebook.', {
        activeView,
        board: nextBoard,
        filters: nextBoard.filters,
        highlightedPanel: request.compareBrowsers?.length
          ? 'browser-breakdown'
          : 'root-cause-board',
        selectedReplayId: nextBoard.representativeSessions[0]?.id ?? null,
      });
    },
    [activeView, applyBoard, filters],
  );

  const noOp = useCallback(
    (request: MetricLoopNoOpRequest): MetricLoopActionResponse => {
      setHighlightedPanel(null);
      return response('No MetricLoop action detected: ' + request.reason, {
        activeView,
        board,
        highlightedPanel: null,
      });
    },
    [activeView, board],
  );

  const handleFilterChange = useCallback(
    (patch: Partial<MetricLoopDashboardFilters>) => {
      const nextFilters = applyMetricLoopFilterPatch(filters, patch);
      const nextBoard = createBoardForFilters(nextFilters);

      setFilters(nextFilters);
      setBoard(nextBoard);
      setSelectedReplayId(null);
      setHighlightedPanel(
        hasInvestigation ? 'root-cause-board' : 'segment-filters',
      );
      setActionSpotlight({
        target: hasInvestigation ? 'Investigation Notebook' : 'Filter builder',
        title: hasInvestigation
          ? 'Investigation Notebook updated'
          : 'Manual filter changed',
        detail: hasInvestigation
          ? nextBoard.analysisUpdate.summary
          : describeFilterAction(patch, nextFilters),
      });
    },
    [createBoardForFilters, filters, hasInvestigation],
  );

  const runFilteredInvestigation = useCallback(() => {
    const nextBoard = createBoardForFilters(filters);
    applyBoard(
      nextBoard,
      filters.breakdown === 'browser'
        ? 'browser-breakdown'
        : 'root-cause-board',
    );
  }, [applyBoard, createBoardForFilters, filters]);

  const agentValue = useMemo<MetricLoopAgentContextValue>(
    () => ({
      snapshot: buildSnapshot(),
      getDashboardState: buildSnapshot,
      openActivationFunnel,
      applySegmentFilter,
      applyFilter,
      openInsight,
      setBreakdown,
      switchVisualization,
      comparePeriods,
      checkReleaseNotes,
      clusterSupportTickets,
      openSessionReplays,
      openSessionReplay,
      generateInvestigationBoard,
      startRootCauseInvestigation,
      updateInvestigationNotebook,
      noOp,
    }),
    [
      applySegmentFilter,
      applyFilter,
      buildSnapshot,
      checkReleaseNotes,
      clusterSupportTickets,
      comparePeriods,
      generateInvestigationBoard,
      noOp,
      openActivationFunnel,
      openInsight,
      openSessionReplay,
      openSessionReplays,
      setBreakdown,
      startRootCauseInvestigation,
      switchVisualization,
      updateInvestigationNotebook,
    ],
  );

  return (
    <MetricLoopAgentProvider value={agentValue}>
      <MetricLoopShell
        activeView={activeView}
        actionSpotlight={actionSpotlight}
        board={board}
        filters={filters}
        highlightedPanel={highlightedPanel}
        hasInvestigation={hasInvestigation}
        notebookExpanded={notebookExpanded}
        selectedReplayId={selectedReplayId}
        onActiveView={setActiveView}
        onFilterChange={handleFilterChange}
        onNotebookExpanded={setNotebookExpanded}
        onRunInvestigation={runFilteredInvestigation}
      />
    </MetricLoopAgentProvider>
  );
}

function MetricLoopShell({
  activeView,
  actionSpotlight,
  board,
  filters,
  highlightedPanel,
  hasInvestigation,
  notebookExpanded,
  selectedReplayId,
  onActiveView,
  onFilterChange,
  onNotebookExpanded,
  onRunInvestigation,
}: {
  activeView: MetricLoopView;
  actionSpotlight: MetricLoopActionSpotlight | null;
  board: MetricLoopInvestigationBoard;
  filters: MetricLoopDashboardFilters;
  highlightedPanel: string | null;
  hasInvestigation: boolean;
  notebookExpanded: boolean;
  selectedReplayId: string | null;
  onActiveView: (view: MetricLoopView) => void;
  onFilterChange: (patch: Partial<MetricLoopDashboardFilters>) => void;
  onNotebookExpanded: (expanded: boolean) => void;
  onRunInvestigation: () => void;
}) {
  const drop = board.dropOffStep;
  const [workbenchActivities, setWorkbenchActivities] = useState<MetricLoopToolActivity[]>([]);
  const [analysisRun, setAnalysisRun] = useState<MetricLoopAnalysisRunStatus | null>(null);
  const suggestedPromptRequestId = useRef(0);
  const [suggestedPromptRequest, setSuggestedPromptRequest] =
    useState<MetricLoopConsolePromptRequest | null>(null);
  const handleToolActivities = useCallback((activities: MetricLoopToolActivity[]) => {
    if (!hasMetricLoopWorkbenchActivities(activities)) return;
    setWorkbenchActivities(
      activities.map((activity) => ({
        ...activity,
        details: activity.details ? [...activity.details] : undefined,
      })),
    );
  }, []);
  const handleSuggestedPrompt = useCallback((prompt: string) => {
    suggestedPromptRequestId.current += 1;
    setSuggestedPromptRequest({
      id: suggestedPromptRequestId.current,
      text: prompt,
      submit: true,
    });
  }, []);

  return (
    <div
      className={[
        'metricloop-app',
        hasInvestigation ? '' : 'without-notebook',
        notebookExpanded ? 'notebook-expanded' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <aside className="metricloop-sidebar" aria-label="MetricLoop navigation">
        <div className="metricloop-brand">
          <span>ML</span>
          <div>
            <strong>MetricLoop</strong>
            <small>Supply Co. workspace</small>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <button
              className={activeView === item.id ? 'active' : ''}
              data-agent-target={'metricloop-nav-' + item.id}
              key={item.id}
              type="button"
              onClick={() => onActiveView(item.id)}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="metricloop-main">
        <header className="metricloop-topbar">
          <div>
            <p>Supply Co. / Product analytics</p>
            <h1>Activation investigation</h1>
          </div>
        </header>

        <nav className="metricloop-tabs" aria-label="Product analytics tabs">
          {productAnalyticsTabs.map((tab) => (
            <button
              className={activeView === tab.id ? 'active' : ''}
              key={tab.id}
              type="button"
              onClick={() => onActiveView(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {actionSpotlight && (
          <section className="metricloop-action-spotlight" aria-live="polite">
            <div>
              <span>Investigation update</span>
              <strong>{actionSpotlight.title}</strong>
              <p>{actionSpotlight.detail}</p>
            </div>
            <em>Next step: {actionSpotlight.target}</em>
          </section>
        )}

        <MetricLoopFilters
          filters={filters}
          highlighted={highlightedPanel === 'segment-filters'}
          onChange={onFilterChange}
          onRunInvestigation={onRunInvestigation}
        />

        <section
          className={
            highlightedPanel === 'segment-filters'
              ? 'metricloop-command-band highlighted'
              : 'metricloop-command-band'
          }
        >
          <div
            className="metricloop-filter-chips"
            data-agent-target="segment-filters"
          >
            {getMetricLoopFilterChips(filters).map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
        </section>

        <section className="metricloop-kpis" aria-label="MetricLoop KPIs">
          <MetricLoopKpi
            label="Activation"
            value={formatMetricLoopPercent(
              board.funnel.at(-1)?.currentRate ?? 0,
            )}
            change={formatMetricLoopDelta(board.funnel.at(-1)?.delta ?? 0)}
            tone="bad"
          />
          <MetricLoopKpi
            label={hasInvestigation ? 'Drop-off step' : 'Largest movement'}
            value={drop.label}
            change={formatMetricLoopDelta(drop.delta)}
            tone="bad"
          />
          <MetricLoopKpi
            label={hasInvestigation ? 'Correlated release' : 'Recent release'}
            value={
              hasInvestigation ? 'PDP size selector' : 'No correlation yet'
            }
            change={
              hasInvestigation ? 'May 4 correlation' : 'Run investigation'
            }
            tone="warn"
          />
          <MetricLoopKpi
            label="Investigation"
            value={hasInvestigation ? board.confidence : 'Not started'}
            change={
              hasInvestigation ? 'Evidence aligned' : 'Ask MetricLoop why'
            }
            tone="good"
          />
        </section>

        <section className="metricloop-workspace">
          <div className="metricloop-left-stack">
            <ActivationFunnelDelta
              board={board}
              highlighted={
                highlightedPanel === 'activation-funnel' ||
                highlightedPanel === 'period-comparison'
              }
            />
            <ReleaseCorrelationTimeline board={board} />
            <SearchIntentTable board={board} />
            <CohortsPanel />
          </div>

          <div className="metricloop-right-stack">
            <BrowserBreakdownBars
              board={board}
              highlighted={highlightedPanel === 'browser-breakdown'}
            />
            <SupportThemeCards board={board} />
            <SessionReplayEvidenceStrip
              board={board}
              selectedReplayId={selectedReplayId}
            />
          </div>
        </section>
      </main>

      {hasInvestigation && (
        <MetricLoopNotebook
          board={board}
          highlighted={highlightedPanel === 'root-cause-board'}
          isExpanded={notebookExpanded}
          onExpandedChange={onNotebookExpanded}
          analysisRun={analysisRun}
          onSuggestedPrompt={handleSuggestedPrompt}
          workbenchActivities={workbenchActivities}
        />
      )}
      <MetricLoopActionConsole
        hasInvestigation={hasInvestigation}
        notebookExpanded={notebookExpanded}
        onAnalysisRunChange={setAnalysisRun}
        onToolActivities={handleToolActivities}
        promptRequest={suggestedPromptRequest}
      />
    </div>
  );
}

function MetricLoopKpi({
  label,
  value,
  change,
  tone,
}: {
  label: string;
  value: string;
  change: string;
  tone: 'good' | 'warn' | 'bad';
}) {
  return (
    <article className={'metricloop-kpi ' + tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{change}</small>
    </article>
  );
}

function CohortsPanel() {
  return (
    <section className="metricloop-panel compact">
      <div className="metricloop-panel-heading">
        <div>
          <span>Cohorts</span>
          <h2>Activation by shopper segment</h2>
        </div>
      </div>
      <table className="metricloop-table">
        <tbody>
          {cohortRows.map(([segment, size, activation, delta]) => (
            <tr key={segment}>
              <td>
                <strong>{segment}</strong>
                <span>{size}</span>
              </td>
              <td>{activation}</td>
              <td className={delta.startsWith('-') ? 'bad' : 'good'}>
                {delta}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
