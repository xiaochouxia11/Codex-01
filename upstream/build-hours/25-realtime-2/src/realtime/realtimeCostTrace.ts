export type RealtimeCostTraceApp = 'supply-co' | 'metricloop';

export interface RealtimeCostTraceSession {
  app: RealtimeCostTraceApp;
  sessionKey: string;
  realtimeModel: string;
  transcriptionModel?: string;
  registeredAtMs: number;
}

interface RawCachedTokenDetails {
  text_tokens?: number;
  audio_tokens?: number;
  image_tokens?: number;
}

interface RawResponseUsage {
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  input_token_details?: {
    text_tokens?: number;
    audio_tokens?: number;
    image_tokens?: number;
    cached_tokens?: number;
    cached_tokens_details?: RawCachedTokenDetails;
  };
  output_token_details?: {
    text_tokens?: number;
    audio_tokens?: number;
  };
}

interface RawTranscriptionUsage {
  type?: string;
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  input_token_details?: {
    text_tokens?: number;
    audio_tokens?: number;
  };
}

export interface RealtimeResponseCostEvent {
  sessionKey: string;
  recordedAtMs: number;
  usage: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    inputTextTokens: number;
    inputAudioTokens: number;
    inputImageTokens: number;
    cachedInputTokens: number;
    cachedInputTextTokens: number;
    cachedInputAudioTokens: number;
    cachedInputImageTokens: number;
    outputTextTokens: number;
    outputAudioTokens: number;
  };
}

export interface RealtimeTranscriptionCostEvent {
  sessionKey: string;
  recordedAtMs: number;
  usage: {
    type?: string;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    inputTextTokens: number;
    inputAudioTokens: number;
  };
}

export interface RealtimeCostTraceSnapshot {
  sessions: RealtimeCostTraceSession[];
  responseEvents: RealtimeResponseCostEvent[];
  transcriptionEvents: RealtimeTranscriptionCostEvent[];
  totals: {
    responseTotalTokens: number;
    responseInputTokens: number;
    responseOutputTokens: number;
    responseCachedInputTokens: number;
    transcriptionTotalTokens: number;
    transcriptionInputTokens: number;
    transcriptionOutputTokens: number;
  };
}

export interface CompletedRealtimeCostTrace {
  session: RealtimeCostTraceSession;
  completedAtMs: number;
  durationMs: number;
  responseEvents: RealtimeResponseCostEvent[];
  transcriptionEvents: RealtimeTranscriptionCostEvent[];
  totals: RealtimeCostTraceSnapshot['totals'];
}

const sessions = new Map<string, RealtimeCostTraceSession>();
const responseEvents: RealtimeResponseCostEvent[] = [];
const transcriptionEvents: RealtimeTranscriptionCostEvent[] = [];

function numberOrZero(value: number | undefined) {
  return typeof value === 'number' ? value : 0;
}

function cloneSnapshot(): RealtimeCostTraceSnapshot {
  const totals = {
    responseTotalTokens: 0,
    responseInputTokens: 0,
    responseOutputTokens: 0,
    responseCachedInputTokens: 0,
    transcriptionTotalTokens: 0,
    transcriptionInputTokens: 0,
    transcriptionOutputTokens: 0,
  };

  for (const event of responseEvents) {
    totals.responseTotalTokens += event.usage.totalTokens;
    totals.responseInputTokens += event.usage.inputTokens;
    totals.responseOutputTokens += event.usage.outputTokens;
    totals.responseCachedInputTokens += event.usage.cachedInputTokens;
  }

  for (const event of transcriptionEvents) {
    totals.transcriptionTotalTokens += event.usage.totalTokens;
    totals.transcriptionInputTokens += event.usage.inputTokens;
    totals.transcriptionOutputTokens += event.usage.outputTokens;
  }

  return {
    sessions: [...sessions.values()].map((session) => ({ ...session })),
    responseEvents: responseEvents.map((event) => ({ ...event, usage: { ...event.usage } })),
    transcriptionEvents: transcriptionEvents.map((event) => ({ ...event, usage: { ...event.usage } })),
    totals,
  };
}

function buildTotals(
  scopedResponseEvents: RealtimeResponseCostEvent[],
  scopedTranscriptionEvents: RealtimeTranscriptionCostEvent[],
): RealtimeCostTraceSnapshot['totals'] {
  const totals = {
    responseTotalTokens: 0,
    responseInputTokens: 0,
    responseOutputTokens: 0,
    responseCachedInputTokens: 0,
    transcriptionTotalTokens: 0,
    transcriptionInputTokens: 0,
    transcriptionOutputTokens: 0,
  };

  for (const event of scopedResponseEvents) {
    totals.responseTotalTokens += event.usage.totalTokens;
    totals.responseInputTokens += event.usage.inputTokens;
    totals.responseOutputTokens += event.usage.outputTokens;
    totals.responseCachedInputTokens += event.usage.cachedInputTokens;
  }

  for (const event of scopedTranscriptionEvents) {
    totals.transcriptionTotalTokens += event.usage.totalTokens;
    totals.transcriptionInputTokens += event.usage.inputTokens;
    totals.transcriptionOutputTokens += event.usage.outputTokens;
  }

  return totals;
}

export function registerRealtimeCostTraceSession(input: Omit<RealtimeCostTraceSession, 'registeredAtMs'>) {
  sessions.set(input.sessionKey, {
    ...input,
    registeredAtMs: Date.now(),
  });
}

export function recordRealtimeResponseUsage(input: { sessionKey: string; usage?: RawResponseUsage }) {
  if (!input.usage) return;
  const cachedDetails = input.usage.input_token_details?.cached_tokens_details;
  responseEvents.push({
    sessionKey: input.sessionKey,
    recordedAtMs: Date.now(),
    usage: {
      totalTokens: numberOrZero(input.usage.total_tokens),
      inputTokens: numberOrZero(input.usage.input_tokens),
      outputTokens: numberOrZero(input.usage.output_tokens),
      inputTextTokens: numberOrZero(input.usage.input_token_details?.text_tokens),
      inputAudioTokens: numberOrZero(input.usage.input_token_details?.audio_tokens),
      inputImageTokens: numberOrZero(input.usage.input_token_details?.image_tokens),
      cachedInputTokens: numberOrZero(input.usage.input_token_details?.cached_tokens),
      cachedInputTextTokens: numberOrZero(cachedDetails?.text_tokens),
      cachedInputAudioTokens: numberOrZero(cachedDetails?.audio_tokens),
      cachedInputImageTokens: numberOrZero(cachedDetails?.image_tokens),
      outputTextTokens: numberOrZero(input.usage.output_token_details?.text_tokens),
      outputAudioTokens: numberOrZero(input.usage.output_token_details?.audio_tokens),
    },
  });
}

export function recordRealtimeTranscriptionUsage(input: { sessionKey: string; usage?: RawTranscriptionUsage }) {
  if (!input.usage) return;
  transcriptionEvents.push({
    sessionKey: input.sessionKey,
    recordedAtMs: Date.now(),
    usage: {
      type: input.usage.type,
      totalTokens: numberOrZero(input.usage.total_tokens),
      inputTokens: numberOrZero(input.usage.input_tokens),
      outputTokens: numberOrZero(input.usage.output_tokens),
      inputTextTokens: numberOrZero(input.usage.input_token_details?.text_tokens),
      inputAudioTokens: numberOrZero(input.usage.input_token_details?.audio_tokens),
    },
  });
}

export function getRealtimeCostTraceSnapshot() {
  return cloneSnapshot();
}

type CostTraceFetch = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{ ok?: boolean; status?: number }>;

export async function completeRealtimeCostTraceSession(
  sessionKey: string,
  persistFetch: CostTraceFetch = fetch,
): Promise<CompletedRealtimeCostTrace | null> {
  const session = sessions.get(sessionKey);
  if (!session) return null;

  const completedAtMs = Date.now();
  const scopedResponseEvents = responseEvents
    .filter((event) => event.sessionKey === sessionKey)
    .map((event) => ({ ...event, usage: { ...event.usage } }));
  const scopedTranscriptionEvents = transcriptionEvents
    .filter((event) => event.sessionKey === sessionKey)
    .map((event) => ({ ...event, usage: { ...event.usage } }));
  const completedTrace: CompletedRealtimeCostTrace = {
    session: { ...session },
    completedAtMs,
    durationMs: Math.max(0, completedAtMs - session.registeredAtMs),
    responseEvents: scopedResponseEvents,
    transcriptionEvents: scopedTranscriptionEvents,
    totals: buildTotals(scopedResponseEvents, scopedTranscriptionEvents),
  };

  try {
    await persistFetch('/api/realtime-cost-traces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(completedTrace),
    });
  } catch {
    // Keep the completed trace available to callers even if local persistence fails.
  }

  return completedTrace;
}

export function resetRealtimeCostTrace() {
  sessions.clear();
  responseEvents.length = 0;
  transcriptionEvents.length = 0;
}

const globalTrace = globalThis as typeof globalThis & {
  __realtimeCostTrace?: {
    getSnapshot: typeof getRealtimeCostTraceSnapshot;
    completeSession: typeof completeRealtimeCostTraceSession;
    reset: typeof resetRealtimeCostTrace;
  };
};

globalTrace.__realtimeCostTrace = {
  getSnapshot: getRealtimeCostTraceSnapshot,
  completeSession: completeRealtimeCostTraceSession,
  reset: resetRealtimeCostTrace,
};
