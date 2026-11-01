import type {
  MetricLoopActionResponse,
  MetricLoopApplyFilterRequest,
  MetricLoopDashboardFilters,
  MetricLoopNoOpRequest,
  MetricLoopOpenInsightRequest,
  MetricLoopRootCauseInvestigationRequest,
  MetricLoopSetBreakdownRequest,
  MetricLoopSessionReplayRequest,
  MetricLoopSwitchVisualizationRequest,
  MetricLoopView,
} from '../metricloop/metricLoopContracts';
import { getMetricLoopInvestigationOptionsForFilters } from '../metricloop/metricLoopDashboardFilters';
import { runMetricLoopInvestigation } from '../metricloop/metricLoopEngine';
import { createMetricLoopForensicsRuntime } from './metricloopForensicsRuntime';
import type { MetricLoopCodeRepairer } from './metricloopForensicsRuntime';
import { createMetricLoopReportArtifact } from './metricloopReportGenerator';
import {
  MetricLoopSessionStore,
  createMetricLoopSnapshotFromServerState,
  type MetricLoopServerSessionState,
} from './metricloopSessionStore';

export interface MetricLoopServerToolOutput {
  source: 'server';
  action: MetricLoopActionResponse;
}

export interface MetricLoopToolRuntimeContext {
  dashboardFilters?: Partial<MetricLoopDashboardFilters>;
}

function withSnapshot(state: MetricLoopServerSessionState, response: MetricLoopActionResponse): MetricLoopActionResponse {
  return {
    ...response,
    activeView: response.activeView ?? state.activeView,
    board: response.board ?? state.board,
    filters: response.filters ?? state.board.filters,
    dashboardFilters: response.dashboardFilters ?? state.dashboardFilters,
    highlightedPanel: response.highlightedPanel ?? state.highlightedPanel,
    selectedReplayId: response.selectedReplayId ?? state.selectedReplayId,
  };
}

function getInvestigationMode(request: Partial<MetricLoopRootCauseInvestigationRequest>) {
  if (request.mode) return request.mode;
  if (request.compareBrowsers?.length || request.excludePaidAds) return 'browser_comparison';
  return 'initial';
}

const forensicsToolNames = new Set([
  'get_analytics_schema',
  'run_cohort_query',
  'run_instrumentation_check',
  'run_analysis_code',
  'render_forensics_chart',
  'apply_forensics_result',
]);

export interface MetricLoopToolRuntimeOptions {
  repairGeneratedCode?: MetricLoopCodeRepairer;
}

export function createMetricLoopToolRuntime(
  store = new MetricLoopSessionStore(),
  options: MetricLoopToolRuntimeOptions = {},
) {
  const forensicsRuntime = createMetricLoopForensicsRuntime(undefined, {
    repairGeneratedCode: options.repairGeneratedCode,
  });

  async function runTool(
    sessionId: string,
    name: string,
    args: Record<string, unknown> = {},
    context: MetricLoopToolRuntimeContext = {},
  ): Promise<MetricLoopServerToolOutput> {
    let state = context.dashboardFilters
      ? store.patchFilters(sessionId, context.dashboardFilters)
      : store.get(sessionId);
    let action: MetricLoopActionResponse;

    if (name === 'get_dashboard_state') {
      action = {
        status: 'done',
        message: 'Read current MetricLoop dashboard state.',
        ...createMetricLoopSnapshotFromServerState(state),
      };
    } else if (name === 'open_activation_funnel') {
      state = store.update(sessionId, (current) => ({
        ...current,
        activeView: 'funnels',
        highlightedPanel: 'activation-funnel',
      }));
      action = { status: 'done', message: 'Opened the activation funnel.' };
    } else if (name === 'apply_segment_filter' || name === 'apply_filter') {
      const request = args as MetricLoopApplyFilterRequest;
      state = store.patchFilters(sessionId, request);
      action = {
        status: 'done',
        message: state.hasInvestigation
          ? 'Updated the Investigation Notebook for the current filters.'
          : 'Applied dashboard filters.',
        highlightedPanel: state.hasInvestigation ? 'root-cause-board' : 'segment-filters',
      };
    } else if (name === 'open_insight') {
      const request = args as unknown as MetricLoopOpenInsightRequest;
      const insightMap: Record<MetricLoopOpenInsightRequest['insightId'], { view: MetricLoopView; highlight: string; message: string }> = {
        activation_funnel: { view: 'funnels', highlight: 'activation-funnel', message: 'Opened the activation funnel.' },
        release_correlation: { view: 'overview', highlight: 'release-correlation', message: 'Opened release correlation.' },
        browser_breakdown: { view: 'overview', highlight: 'browser-breakdown', message: 'Opened browser breakdown.' },
        search_intents: { view: 'overview', highlight: 'search-intents', message: 'Opened search intent analysis.' },
        session_replays: { view: 'replays', highlight: 'session-replays', message: 'Opened session replays.' },
        support_themes: { view: 'overview', highlight: 'support-themes', message: 'Opened support themes.' },
        investigation_notebook: { view: state.activeView, highlight: 'root-cause-board', message: 'Opened the Investigation Notebook.' },
      };
      const next = insightMap[request.insightId] ?? insightMap.activation_funnel;
      state = store.update(sessionId, (current) => ({
        ...current,
        activeView: next.view,
        highlightedPanel: next.highlight,
        hasInvestigation: current.hasInvestigation || request.insightId === 'investigation_notebook',
      }));
      action = { status: 'done', message: next.message };
    } else if (name === 'set_breakdown') {
      const request = args as unknown as MetricLoopSetBreakdownRequest;
      state = store.patchFilters(sessionId, {
        breakdown: request.breakdown,
        browser: request.breakdown === 'browser' ? 'mobile_safari' : state.dashboardFilters.browser,
      });
      action = {
        status: 'done',
        message: state.hasInvestigation
          ? 'Updated the Investigation Notebook for the current breakdown.'
          : 'Set dashboard breakdown.',
        highlightedPanel: state.hasInvestigation ? 'root-cause-board' : 'browser-breakdown',
      };
    } else if (name === 'switch_visualization') {
      const request = args as unknown as MetricLoopSwitchVisualizationRequest;
      state = store.patchFilters(sessionId, { chartType: request.chartType });
      action = {
        status: 'done',
        message: 'Switched visualization.',
        highlightedPanel: request.chartType === 'timeline' ? 'release-correlation' : 'activation-funnel',
      };
    } else if (name === 'compare_periods') {
      state = store.patchFilters(sessionId, {
        dateRange: 'last_7_days',
        comparison: 'prior_7_days',
      });
      state = store.update(sessionId, (current) => ({
        ...current,
        activeView: 'funnels',
        highlightedPanel: current.hasInvestigation ? 'root-cause-board' : 'period-comparison',
      }));
      action = {
        status: 'done',
        message: state.hasInvestigation
          ? 'Updated the Investigation Notebook for the current period comparison.'
          : 'Compared last 7 days with the prior period.',
      };
    } else if (name === 'check_release_notes') {
      state = store.update(sessionId, (current) => ({
        ...current,
        activeView: 'overview',
        highlightedPanel: 'release-correlation',
      }));
      action = {
        status: 'done',
        message: 'Checked release notes and found the size selector validation release.',
      };
    } else if (name === 'cluster_support_tickets') {
      state = store.update(sessionId, (current) => ({
        ...current,
        highlightedPanel: 'support-themes',
      }));
      action = { status: 'done', message: 'Clustered support tickets for the active segment.' };
    } else if (name === 'open_session_replays' || name === 'open_session_replay') {
      const request = args as MetricLoopSessionReplayRequest;
      const replay = state.board.representativeSessions.find((session) =>
        request.sessionId
          ? session.id === request.sessionId
          : request.browser
            ? session.browser.toLowerCase().includes(request.browser.toLowerCase().replace('_', ' '))
            : session.finding.toLowerCase().includes('hiking boots'),
      ) ?? state.board.representativeSessions[0];
      state = store.update(sessionId, (current) => ({
        ...current,
        activeView: 'replays',
        hasInvestigation: true,
        selectedReplayId: replay?.id ?? null,
        highlightedPanel: 'session-replays',
      }));
      action = { status: 'done', message: 'Opened representative session replays.' };
    } else if (
      name === 'generate_investigation_board' ||
      name === 'start_root_cause_investigation' ||
      name === 'update_investigation_notebook'
    ) {
      const request = args as Partial<MetricLoopRootCauseInvestigationRequest>;
      const mode = getInvestigationMode(request);
      state = store.patchFilters(
        sessionId,
        {
          excludePaidAds: request.excludePaidAds ?? state.dashboardFilters.excludePaidAds,
          browser: mode === 'browser_comparison' ? 'mobile_safari' : state.dashboardFilters.browser,
          breakdown: mode === 'browser_comparison' ? 'browser' : state.dashboardFilters.breakdown,
        },
        { forceInvestigation: true, question: request.question },
      );
      const options = getMetricLoopInvestigationOptionsForFilters(state.dashboardFilters);
      const board = runMetricLoopInvestigation({
        ...options,
        mode,
        excludePaidAds: state.dashboardFilters.excludePaidAds,
        question: request.question,
      });
      state = store.update(sessionId, (current) => ({
        ...current,
        activeView: 'overview',
        board,
        hasInvestigation: true,
        highlightedPanel: request.compareBrowsers?.length ? 'browser-breakdown' : 'root-cause-board',
        selectedReplayId: board.representativeSessions[0]?.id ?? null,
      }));
      action = {
        status: 'done',
        message: name === 'update_investigation_notebook'
          ? 'Updated the Investigation Notebook.'
          : 'Generated the root-cause investigation notebook.',
        artifact: createMetricLoopReportArtifact(sessionId, board),
      };
    } else if (forensicsToolNames.has(name)) {
      const forensicsAction = await forensicsRuntime.runTool(sessionId, name, args);

      if (name === 'apply_forensics_result' && forensicsAction.dashboardFilters) {
        state = store.patchFilters(sessionId, forensicsAction.dashboardFilters, {
          forceInvestigation: true,
          question: 'Cohort forensics investigation',
        });
        state = store.update(sessionId, (current) => ({
          ...current,
          activeView: 'overview',
          hasInvestigation: true,
          highlightedPanel: 'root-cause-board',
          selectedReplayId: current.board.representativeSessions[0]?.id ?? current.selectedReplayId,
        }));
      }

      action = forensicsAction;
    } else if (name === 'no_op') {
      const request = args as unknown as MetricLoopNoOpRequest;
      action = {
        status: 'done',
        message: 'No MetricLoop action detected: ' + request.reason,
        highlightedPanel: null,
      };
    } else {
      action = { status: 'blocked', message: 'That analytics action is not available.' };
    }

    return {
      source: 'server',
      action: withSnapshot(state, action),
    };
  }

  return {
    runTool,
    getSessionSnapshot(sessionId: string) {
      return createMetricLoopSnapshotFromServerState(store.get(sessionId));
    },
  };
}
