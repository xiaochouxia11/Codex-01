import type {
  MetricLoopInvestigationBoard,
  MetricLoopInvestigationOptions,
} from './metricLoopEngine';

export type MetricLoopView =
  | 'home'
  | 'dashboards'
  | 'overview'
  | 'product_analytics'
  | 'events'
  | 'funnels'
  | 'cohorts'
  | 'retention'
  | 'paths'
  | 'stickiness'
  | 'lifecycle'
  | 'replays'
  | 'people'
  | 'activity'
  | 'flags'
  | 'experiments'
  | 'surveys'
  | 'releases'
  | 'support'
  | 'sql'
  | 'pipelines'
  | 'settings'
  | 'board';

export type MetricLoopConnectionStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

export type MetricLoopRealtimePhase = 'commentary' | 'final_answer';

export interface MetricLoopConsolePromptRequest {
  id: number;
  text: string;
  submit?: boolean;
}

export interface MetricLoopAnalysisRunStatus {
  isActive: boolean;
  label: string;
  detail: string;
  phase: 'connecting' | 'running' | 'complete' | 'error';
  currentToolName?: string;
}

export type MetricLoopChartType = 'line' | 'bar' | 'funnel' | 'table' | 'timeline';

export type MetricLoopForensicsChartType = 'heatmap' | 'waterfall' | 'bar' | 'table';

export type MetricLoopForensicsTraceKind =
  | 'schema'
  | 'query'
  | 'instrumentation'
  | 'code'
  | 'code_validation'
  | 'chart'
  | 'dashboard_action';

export type MetricLoopForensicsValue = string | number | boolean | null;

export type MetricLoopForensicsPreviewRow = Record<string, MetricLoopForensicsValue>;

export type MetricLoopForensicsEvidenceVerdict =
  | 'confirmed'
  | 'supported'
  | 'weakened'
  | 'not_supported'
  | 'pending';

export interface MetricLoopForensicsOperation {
  question?: string;
  validation?: string[];
  execution?: string[];
}

export interface MetricLoopForensicsEvidence {
  label: string;
  verdict: MetricLoopForensicsEvidenceVerdict;
  detail: string;
}

export interface MetricLoopForensicsTrace {
  kind: MetricLoopForensicsTraceKind;
  title: string;
  purpose?: string;
  summary?: string;
  query?: string;
  code?: string;
  originalCode?: string;
  repairedCode?: string;
  repairSource?: 'realtime_rewrite' | 'external_model' | 'deterministic_fallback';
  fallbackExplanation?: string;
  validationError?: string;
  rewriteInstructions?: string;
  allowedContract?: string[];
  sampleRows?: MetricLoopForensicsPreviewRow[];
  resultId?: string;
  inputResultId?: string;
  rowCount?: number;
  operation?: MetricLoopForensicsOperation;
  evidence?: MetricLoopForensicsEvidence[];
  previewRows?: MetricLoopForensicsPreviewRow[];
  schema?: {
    tables: Array<{
      name: string;
      fields: string[];
    }>;
    dimensions: string[];
    measures: string[];
  };
  chart?: {
    type: MetricLoopForensicsChartType;
    title: string;
    xDimension?: string;
    yDimension?: string;
    valueField?: string;
    rows: MetricLoopForensicsPreviewRow[];
  };
}

export type MetricLoopTurnMode = 'action' | 'explain';

export type MetricLoopVoiceMode = 'wake_word' | 'action_only';

export interface MetricLoopTurnPolicy {
  mode: MetricLoopTurnMode;
  shouldSpeak: boolean;
}

export interface MetricLoopDashboardFilters {
  interaction: 'all' | 'voice_search' | 'typed_search' | 'manual_click';
  dateRange: 'last_7_days' | 'last_14_days' | 'last_30_days';
  comparison: 'none' | 'prior_7_days';
  segment: 'all_shoppers' | 'first_time_shoppers' | 'returning_shoppers';
  region: 'all' | 'europe' | 'north_america' | 'apac';
  teamAge: 'all' | 'first_time' | 'returning';
  trafficSource: 'all' | 'organic' | 'paid_ads' | 'referral';
  excludePaidAds: boolean;
  browser: 'all' | 'mobile_safari' | 'chrome' | 'firefox' | 'edge';
  device: 'all' | 'mobile' | 'desktop';
  productCategory: 'all' | 'footwear' | 'outerwear' | 'camping';
  event: 'activation' | 'voice_search_started' | 'shoe_size_selected' | 'add_to_cart_clicked';
  breakdown: 'none' | 'browser' | 'device' | 'traffic_source' | 'search_term';
  chartType: MetricLoopChartType;
}

export interface MetricLoopFilters {
  dateRange?: string;
  region: string;
  segment?: string;
  teamAge: string;
  window: string;
  trafficSource?: string;
  excludePaidAds: boolean;
  browserComparison: string | null;
  device?: string;
  productCategory?: string;
}

export interface MetricLoopDashboardSnapshot {
  activeView: MetricLoopView;
  filters: MetricLoopFilters;
  dashboardFilters: MetricLoopDashboardFilters;
  board: MetricLoopInvestigationBoard;
  highlightedPanel: string | null;
  selectedReplayId: string | null;
  safeTargets: Array<{
    targetId: string;
    label: string;
    kind: 'navigation' | 'chart' | 'filter' | 'artifact' | 'replay' | 'trace';
    isVisible: boolean;
  }>;
  capturedAtIso: string;
}

export interface MetricLoopActionResponse {
  status: 'done' | 'blocked' | 'needs_rewrite' | 'failed';
  message: string;
  activeView?: MetricLoopView;
  board?: MetricLoopInvestigationBoard;
  filters?: MetricLoopFilters;
  dashboardFilters?: MetricLoopDashboardFilters;
  highlightedPanel?: string | null;
  selectedReplayId?: string | null;
  artifact?: {
    id: string;
    status: 'ready' | 'running';
    title: string;
    summary: string;
    confidence: MetricLoopInvestigationBoard['confidence'];
  };
  forensics?: MetricLoopForensicsTrace;
}

export interface MetricLoopSegmentFilterRequest {
  region?: string;
  segment?: string;
  teamAge?: string;
  window?: string;
  trafficSource?: string;
  excludePaidAds?: boolean;
  browserComparison?: string | null;
  browser?: string;
  device?: string;
  productCategory?: string;
}

export interface MetricLoopApplyFilterRequest {
  interaction?: MetricLoopDashboardFilters['interaction'];
  dateRange?: MetricLoopDashboardFilters['dateRange'];
  comparison?: MetricLoopDashboardFilters['comparison'];
  segment?: MetricLoopDashboardFilters['segment'];
  region?: MetricLoopDashboardFilters['region'];
  teamAge?: MetricLoopDashboardFilters['teamAge'];
  trafficSource?: MetricLoopDashboardFilters['trafficSource'];
  excludePaidAds?: boolean;
  browser?: MetricLoopDashboardFilters['browser'];
  device?: MetricLoopDashboardFilters['device'];
  productCategory?: MetricLoopDashboardFilters['productCategory'];
  event?: MetricLoopDashboardFilters['event'];
}

export interface MetricLoopSetBreakdownRequest {
  breakdown: MetricLoopDashboardFilters['breakdown'];
}

export interface MetricLoopSwitchVisualizationRequest {
  chartType: MetricLoopChartType;
}

export interface MetricLoopOpenInsightRequest {
  insightId:
    | 'activation_funnel'
    | 'release_correlation'
    | 'browser_breakdown'
    | 'search_intents'
    | 'session_replays'
    | 'support_themes'
    | 'investigation_notebook';
}

export interface MetricLoopComparePeriodsRequest {
  currentWindow?: string;
  previousWindow?: string;
  metric?: string;
}

export interface MetricLoopSessionReplayRequest {
  browser?: string;
  productCategory?: MetricLoopDashboardFilters['productCategory'];
  sessionId?: string;
  limit?: number;
}

export interface MetricLoopGenerateBoardRequest extends MetricLoopInvestigationOptions {}

export interface MetricLoopRootCauseInvestigationRequest extends MetricLoopInvestigationOptions {
  question: string;
  includeCohorts?: boolean;
  includeReleases?: boolean;
  includeSupportTickets?: boolean;
  includeSessionReplays?: boolean;
  compareBrowsers?: Array<'mobile_safari' | 'chrome' | 'firefox' | 'edge'>;
  excludePaidAds?: boolean;
}

export interface MetricLoopNotebookUpdate {
  question: string;
  board: MetricLoopInvestigationBoard;
  updatedSections: Array<
    | 'filters'
    | 'funnel'
    | 'release_timeline'
    | 'browser_breakdown'
    | 'search_intents'
    | 'session_replays'
    | 'support_themes'
    | 'conclusion'
    | 'recommendation'
  >;
}

export interface MetricLoopNoOpRequest {
  category: 'silence' | 'background' | 'filler' | 'unclear' | 'unrelated';
  reason: string;
}

export interface MetricLoopActivityTrace {
  preambleText: string;
  toolActivities: MetricLoopToolActivity[];
  errorText: string | null;
}

export interface MetricLoopTranscriptMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  activityTrace?: MetricLoopActivityTrace;
}

export interface MetricLoopToolActivity {
  id: string;
  name: string;
  label: string;
  status: 'running' | 'done' | 'failed' | 'needs_rewrite' | 'repaired' | 'fallback_used';
  args?: unknown;
  result?: unknown;
  startedAtMs: number;
  completedAtMs?: number;
  durationMs?: number;
  details?: string[];
  forensics?: MetricLoopForensicsTrace;
}

export interface MetricLoopDeveloperEvent {
  id: string;
  type: string;
  label: string;
  phase?: MetricLoopRealtimePhase;
  timestampMs: number;
}

export interface MetricLoopAgentContextValue {
  snapshot: MetricLoopDashboardSnapshot;
  getDashboardState: () => MetricLoopDashboardSnapshot;
  openActivationFunnel: () => MetricLoopActionResponse;
  applySegmentFilter: (request: MetricLoopSegmentFilterRequest) => MetricLoopActionResponse;
  applyFilter: (request: MetricLoopApplyFilterRequest) => MetricLoopActionResponse;
  openInsight: (request: MetricLoopOpenInsightRequest) => MetricLoopActionResponse;
  setBreakdown: (request: MetricLoopSetBreakdownRequest) => MetricLoopActionResponse;
  switchVisualization: (request: MetricLoopSwitchVisualizationRequest) => MetricLoopActionResponse;
  comparePeriods: (request?: MetricLoopComparePeriodsRequest) => MetricLoopActionResponse;
  checkReleaseNotes: () => MetricLoopActionResponse;
  clusterSupportTickets: () => MetricLoopActionResponse;
  openSessionReplays: (request?: MetricLoopSessionReplayRequest) => MetricLoopActionResponse;
  openSessionReplay: (request?: MetricLoopSessionReplayRequest) => MetricLoopActionResponse;
  generateInvestigationBoard: (request?: MetricLoopGenerateBoardRequest) => MetricLoopActionResponse;
  startRootCauseInvestigation: (request: MetricLoopRootCauseInvestigationRequest) => MetricLoopActionResponse;
  updateInvestigationNotebook: (request: MetricLoopRootCauseInvestigationRequest) => MetricLoopActionResponse;
  noOp: (request: MetricLoopNoOpRequest) => MetricLoopActionResponse;
}
