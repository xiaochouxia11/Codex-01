import {
  applyMetricLoopFilterPatch,
  createDefaultMetricLoopDashboardFilters,
  createMetricLoopInvestigationBoardForFilters,
  getMetricLoopInvestigationOptionsForFilters,
} from '../metricloop/metricLoopDashboardFilters';
import type {
  MetricLoopDashboardFilters,
  MetricLoopDashboardSnapshot,
  MetricLoopView,
} from '../metricloop/metricLoopContracts';
import type { MetricLoopInvestigationBoard } from '../metricloop/metricLoopEngine';
import { runMetricLoopInvestigation } from '../metricloop/metricLoopEngine';

export interface MetricLoopServerSessionState {
  activeView: MetricLoopView;
  dashboardFilters: MetricLoopDashboardFilters;
  board: MetricLoopInvestigationBoard;
  hasInvestigation: boolean;
  highlightedPanel: string | null;
  selectedReplayId: string | null;
}

export function createDefaultMetricLoopServerSessionState(): MetricLoopServerSessionState {
  const dashboardFilters = createDefaultMetricLoopDashboardFilters();
  return {
    activeView: 'overview',
    dashboardFilters,
    board: createMetricLoopInvestigationBoardForFilters(dashboardFilters),
    hasInvestigation: false,
    highlightedPanel: 'activation-funnel',
    selectedReplayId: null,
  };
}

export function createMetricLoopSnapshotFromServerState(
  state: MetricLoopServerSessionState,
): MetricLoopDashboardSnapshot {
  return {
    activeView: state.activeView,
    board: state.board,
    filters: state.board.filters,
    dashboardFilters: state.dashboardFilters,
    highlightedPanel: state.highlightedPanel,
    selectedReplayId: state.selectedReplayId,
    safeTargets: [
      {
        targetId: 'metricloop-nav-funnels',
        label: 'Funnels',
        kind: 'navigation',
        isVisible: true,
      },
      {
        targetId: 'metricloop-board',
        label: 'Investigation notebook',
        kind: 'artifact',
        isVisible: state.hasInvestigation,
      },
      {
        targetId: 'metricloop-funnel',
        label: 'Activation funnel',
        kind: 'chart',
        isVisible: true,
      },
    ],
    capturedAtIso: new Date().toISOString(),
  };
}

export class MetricLoopSessionStore {
  private sessions = new Map<string, MetricLoopServerSessionState>();

  get(sessionId: string): MetricLoopServerSessionState {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;

    const next = createDefaultMetricLoopServerSessionState();
    this.sessions.set(sessionId, next);
    return next;
  }

  update(
    sessionId: string,
    updater: (state: MetricLoopServerSessionState) => MetricLoopServerSessionState,
  ): MetricLoopServerSessionState {
    const next = updater(this.get(sessionId));
    this.sessions.set(sessionId, next);
    return next;
  }

  patchFilters(
    sessionId: string,
    patch: Partial<MetricLoopDashboardFilters>,
    options: { forceInvestigation?: boolean; question?: string } = {},
  ): MetricLoopServerSessionState {
    return this.update(sessionId, (state) => {
      const dashboardFilters = applyMetricLoopFilterPatch(state.dashboardFilters, patch);
      const board = options.forceInvestigation || state.hasInvestigation
        ? runMetricLoopInvestigation({
            ...getMetricLoopInvestigationOptionsForFilters(dashboardFilters),
            question: options.question,
          })
        : createMetricLoopInvestigationBoardForFilters(dashboardFilters, {
            previousBoard: state.hasInvestigation ? state.board : undefined,
            question: options.question,
          });

      return {
        ...state,
        dashboardFilters,
        board,
        hasInvestigation: options.forceInvestigation || state.hasInvestigation,
      };
    });
  }

  clear() {
    this.sessions.clear();
  }
}
