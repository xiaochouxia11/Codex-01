import type {
  MetricLoopDashboardFilters,
  MetricLoopDashboardSnapshot,
  MetricLoopView,
  MetricLoopTurnPolicy,
  MetricLoopVoiceMode,
} from './metricLoopContracts';

export interface MetricLoopCompactResponseContext {
  activeView: MetricLoopView;
  dashboardFilters: MetricLoopDashboardFilters;
  selectedReplayId: string | null;
  capturedAtIso: string;
  currentReport: {
    title: string;
    summary: string;
    hypotheses: Array<{
      label: string;
      status: 'primary' | 'secondary' | 'watch' | 'ruled_out';
      confidence: 'Low' | 'Medium' | 'High';
      nextStep: string;
    }>;
  };
  dropOffStep: {
    step: string;
    label: string;
    delta: number;
    currentRate: number;
    previousRate: number;
  };
}

export interface MetricLoopResponseCreateEvent {
  type: 'response.create';
  response: {
    output_modalities: Array<'audio' | 'text'>;
    metadata: {
      metricloop_turn_mode: MetricLoopTurnPolicy['mode'];
      metricloop_should_speak: string;
    };
  };
}

export interface MetricLoopContextItemEvent {
  type: 'conversation.item.create';
  item: {
    type: 'message';
    role: 'system';
    content: Array<{
      type: 'input_text';
      text: string;
    }>;
  };
}

export function getInitialMetricLoopVoiceMode(search?: string): MetricLoopVoiceMode {
  const query = search ?? (typeof window === 'undefined' ? '' : window.location.search);
  return new URLSearchParams(query).get('voice') === 'action-only' ? 'action_only' : 'wake_word';
}

export function createMetricLoopCompactResponseContext(
  snapshot: MetricLoopDashboardSnapshot,
): MetricLoopCompactResponseContext {
  return {
    activeView: snapshot.activeView,
    dashboardFilters: snapshot.dashboardFilters,
    selectedReplayId: snapshot.selectedReplayId,
    capturedAtIso: snapshot.capturedAtIso,
    currentReport: {
      title: snapshot.board.scopedReport.title,
      summary: snapshot.board.scopedReport.summary,
      hypotheses: snapshot.board.scopedReport.hypotheses
        .slice(0, 2)
        .map((hypothesis) => ({
          label: hypothesis.label,
          status: hypothesis.status,
          confidence: hypothesis.confidence,
          nextStep: hypothesis.nextStep,
        })),
    },
    dropOffStep: {
      step: snapshot.board.dropOffStep.step,
      label: snapshot.board.dropOffStep.label,
      delta: snapshot.board.dropOffStep.delta,
      currentRate: snapshot.board.dropOffStep.currentRate,
      previousRate: snapshot.board.dropOffStep.previousRate,
    },
  };
}

function formatMetricLoopContextText(context: MetricLoopCompactResponseContext): string {
  return [
    'Current MetricLoop dashboard context from the application, not a new user request:',
    JSON.stringify(context),
    'Treat this compact state as authoritative for the visible filters, selected replay, and current report summary. Continue following the session instructions, and call tools when you need full dashboard details or need to change the UI.',
  ].join('\n');
}

export function createMetricLoopContextItem(
  context: MetricLoopCompactResponseContext,
): MetricLoopContextItemEvent {
  return {
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'system',
      content: [
        {
          type: 'input_text',
          text: formatMetricLoopContextText(context),
        },
      ],
    },
  };
}

export function createMetricLoopResponsePayload(
  policy: MetricLoopTurnPolicy,
  _context?: MetricLoopCompactResponseContext,
): MetricLoopResponseCreateEvent {
  return {
    type: 'response.create',
    response: {
      output_modalities: [policy.shouldSpeak ? 'audio' : 'text'],
      metadata: {
        metricloop_turn_mode: policy.mode,
        metricloop_should_speak: String(policy.shouldSpeak),
      },
    },
  };
}
