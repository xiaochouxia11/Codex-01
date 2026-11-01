import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react';
import type {
  MetricLoopAnalysisRunStatus,
  MetricLoopConnectionStatus,
  MetricLoopConsolePromptRequest,
  MetricLoopToolActivity,
} from './metricLoopContracts';
import { useMetricLoopRealtime } from './useMetricLoopRealtime';
import { METRIC_LOOP_WAKE_WORD } from './voiceToActionPolicy';

const analysisToolCopy: Record<string, string> = {
  get_dashboard_state: 'Reading dashboard state',
  get_analytics_schema: 'Reading analytics schema',
  run_cohort_query: 'Querying impacted cohorts',
  run_instrumentation_check: 'Checking instrumentation',
  run_analysis_code: 'Running generated analysis code',
  render_forensics_chart: 'Generating chart',
  apply_forensics_result: 'Updating the notebook conclusion',
  generate_investigation_board: 'Generating investigation notebook',
  start_root_cause_investigation: 'Opening root-cause investigation',
  update_investigation_notebook: 'Updating investigation notebook',
};

function getAnalysisRunStatus(
  status: MetricLoopConnectionStatus,
  toolActivities: MetricLoopToolActivity[],
  errorText: string | null,
): MetricLoopAnalysisRunStatus | null {
  if (status === 'error') {
    return {
      isActive: false,
      label: 'Analysis paused',
      detail: errorText ?? 'Lighthouse hit an error before the analysis completed.',
      phase: 'error',
    };
  }

  const runningActivity = [...toolActivities].reverse().find((activity) => activity.status === 'running');
  if (runningActivity) {
    return {
      isActive: true,
      label: 'Running deeper analysis',
      detail: (analysisToolCopy[runningActivity.name] ?? runningActivity.label) + '...',
      phase: 'running',
      currentToolName: runningActivity.name,
    };
  }

  if (status === 'connecting') {
    return {
      isActive: true,
      label: 'Preparing analysis run',
      detail: 'Connecting Lighthouse to the dashboard context...',
      phase: 'connecting',
    };
  }

  if (status === 'speaking') {
    return {
      isActive: true,
      label: 'Running deeper analysis',
      detail: 'Waiting for the model to choose the next analysis step...',
      phase: 'running',
    };
  }

  const latestActivity = [...toolActivities].reverse().find((activity) =>
    activity.status === 'done' ||
    activity.status === 'repaired' ||
    activity.status === 'fallback_used' ||
    activity.status === 'needs_rewrite'
  );
  if (latestActivity) {
    return {
      isActive: false,
      label: 'Analysis complete',
      detail: (analysisToolCopy[latestActivity.name] ?? latestActivity.label) + ' completed.',
      phase: 'complete',
      currentToolName: latestActivity.name,
    };
  }

  return null;
}

export function MetricLoopActionConsole({
  onToolActivities,
  onAnalysisRunChange,
  hasInvestigation = false,
  notebookExpanded = false,
  promptRequest = null,
}: {
  onToolActivities?: (activities: MetricLoopToolActivity[]) => void;
  onAnalysisRunChange?: (analysisRun: MetricLoopAnalysisRunStatus | null) => void;
  hasInvestigation?: boolean;
  notebookExpanded?: boolean;
  promptRequest?: MetricLoopConsolePromptRequest | null;
}): ReactElement {
  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const lastPromptRequestId = useRef<number | null>(null);
  const previousInvestigationState = useRef({
    hasInvestigation,
    notebookExpanded,
  });
  const {
    currentRouteHint,
    disconnect,
    errorText,
    messages,
    micAvailable,
    sendTextMessage,
    setVoiceMode,
    status,
    statusLabel,
    toolActivities,
    voiceMode,
    connect,
  } = useMetricLoopRealtime();
  const analysisRun = useMemo(
    () => getAnalysisRunStatus(status, toolActivities, errorText),
    [errorText, status, toolActivities],
  );

  useEffect(() => {
    onToolActivities?.(toolActivities);
  }, [onToolActivities, toolActivities]);

  useEffect(() => {
    onAnalysisRunChange?.(analysisRun);
  }, [analysisRun, onAnalysisRunChange]);

  useEffect(() => {
    const previous = previousInvestigationState.current;
    const investigationOpened = !previous.hasInvestigation && hasInvestigation;
    const panelExpanded = !previous.notebookExpanded && notebookExpanded;

    if ((investigationOpened || panelExpanded) && expanded) {
      setExpanded(false);
    }

    previousInvestigationState.current = {
      hasInvestigation,
      notebookExpanded,
    };
  }, [expanded, hasInvestigation, notebookExpanded]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setExpanded(true);
      setInput('');
      try {
        await sendTextMessage(text);
      } catch {
        // The hook owns the visible error state.
      }
    },
    [sendTextMessage],
  );

  useEffect(() => {
    if (!promptRequest || lastPromptRequestId.current === promptRequest.id) return;
    lastPromptRequestId.current = promptRequest.id;
    if (promptRequest.submit) {
      void send(promptRequest.text);
      return;
    }
    setInput(promptRequest.text);
    setExpanded(true);
  }, [promptRequest, send]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void send(input);
  };

  return (
    <aside
      className={expanded ? 'metricloop-action-console expanded' : 'metricloop-action-console'}
      aria-label="Lighthouse assistant"
    >
      <div className="metricloop-action-summary">
        <button
          className="metricloop-console-toggle"
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          <span>Lighthouse</span>
          <strong>{statusLabel}</strong>
          <em>{messages.length ? messages.length + ' messages' : 'Transcript'}</em>
        </button>
        <button
          className={status === 'listening' || status === 'speaking' ? 'active' : ''}
          type="button"
          onClick={() => {
            if (status === 'idle' || status === 'error') {
              void connect({ useMic: true });
            } else {
              disconnect();
            }
          }}
        >
          {status === 'connecting' ? '...' : status === 'idle' || status === 'error' ? 'Start' : 'Stop'}
        </button>
      </div>

      {expanded && (
        <div className="metricloop-console-body">
          <p className="metricloop-route-hint">{currentRouteHint}</p>
          {!micAvailable && <p className="metricloop-muted-note">Microphone unavailable. Type a question instead.</p>}
          {errorText && <p className="metricloop-error">{errorText}</p>}
          {analysisRun && (
            <div className={'metricloop-analysis-status ' + analysisRun.phase} aria-live="polite">
              <span>Analysis run</span>
              <strong>{analysisRun.label}</strong>
              <p>{analysisRun.detail}</p>
            </div>
          )}

          <div className="metricloop-voice-setting">
            <div>
              <span>Lighthouse voice replies</span>
              <p className="metricloop-muted-note">
                {voiceMode === 'wake_word'
                  ? 'Say "' + METRIC_LOOP_WAKE_WORD + '" in a request to hear a spoken answer.'
                  : 'Lighthouse will update the dashboard and transcript without audio.'}
              </p>
            </div>
            <button
              className={voiceMode === 'wake_word' ? 'metricloop-voice-toggle active' : 'metricloop-voice-toggle'}
              type="button"
              aria-pressed={voiceMode === 'wake_word'}
              onClick={() => setVoiceMode(voiceMode === 'wake_word' ? 'action_only' : 'wake_word')}
            >
              {voiceMode === 'wake_word' ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <form className="metricloop-command-form" onSubmit={handleSubmit}>
            <input
              aria-label="Ask Lighthouse by text"
              placeholder="Ask the analytics question..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <button type="submit">Send</button>
          </form>

          <section className="metricloop-trace-section transcript">
            <div className="metricloop-section-title">
              <span>Transcript</span>
              <strong>{messages.length}</strong>
            </div>
            <div className="metricloop-transcript-list">
              {messages.length === 0 ? (
                <p>Lighthouse can update the MetricLoop dashboard and Notebook directly from your question.</p>
              ) : (
                messages.slice(-5).map((message) => (
                  <div className={message.role} key={message.id}>
                    <strong>{message.role}</strong>
                    <span>{message.text || '...'}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}
