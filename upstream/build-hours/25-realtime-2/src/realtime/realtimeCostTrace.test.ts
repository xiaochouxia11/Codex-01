import { beforeEach, describe, expect, it } from 'vitest';
import {
  completeRealtimeCostTraceSession,
  getRealtimeCostTraceSnapshot,
  recordRealtimeResponseUsage,
  recordRealtimeTranscriptionUsage,
  registerRealtimeCostTraceSession,
  resetRealtimeCostTrace,
} from './realtimeCostTrace';

describe('realtime cost trace collector', () => {
  beforeEach(() => {
    resetRealtimeCostTrace();
  });

  it('registers session metadata for downstream pricing analysis', () => {
    registerRealtimeCostTraceSession({
      app: 'supply-co',
      sessionKey: 'supply-1',
      realtimeModel: 'gpt-realtime-2',
      transcriptionModel: 'gpt-realtime-whisper',
    });

    expect(getRealtimeCostTraceSnapshot()).toMatchObject({
      sessions: [
        {
          app: 'supply-co',
          sessionKey: 'supply-1',
          realtimeModel: 'gpt-realtime-2',
          transcriptionModel: 'gpt-realtime-whisper',
        },
      ],
    });
  });

  it('captures response and transcription usage with aggregate rollups', () => {
    registerRealtimeCostTraceSession({
      app: 'metricloop',
      sessionKey: 'metricloop-1',
      realtimeModel: 'gpt-realtime-2',
      transcriptionModel: 'gpt-realtime-whisper',
    });

    recordRealtimeResponseUsage({
      sessionKey: 'metricloop-1',
      usage: {
        total_tokens: 253,
        input_tokens: 132,
        output_tokens: 121,
        input_token_details: {
          text_tokens: 119,
          audio_tokens: 13,
          image_tokens: 0,
          cached_tokens: 64,
          cached_tokens_details: {
            text_tokens: 64,
            audio_tokens: 0,
            image_tokens: 0,
          },
        },
        output_token_details: {
          text_tokens: 30,
          audio_tokens: 91,
        },
      },
    });

    recordRealtimeTranscriptionUsage({
      sessionKey: 'metricloop-1',
      usage: {
        type: 'tokens',
        total_tokens: 26,
        input_tokens: 17,
        output_tokens: 9,
        input_token_details: {
          text_tokens: 0,
          audio_tokens: 17,
        },
      },
    });

    expect(getRealtimeCostTraceSnapshot()).toMatchObject({
      responseEvents: [
        {
          sessionKey: 'metricloop-1',
          usage: {
            totalTokens: 253,
            inputTokens: 132,
            outputTokens: 121,
            cachedInputTokens: 64,
            inputAudioTokens: 13,
            outputAudioTokens: 91,
          },
        },
      ],
      transcriptionEvents: [
        {
          sessionKey: 'metricloop-1',
          usage: {
            totalTokens: 26,
            inputTokens: 17,
            outputTokens: 9,
            inputAudioTokens: 17,
          },
        },
      ],
      totals: {
        responseTotalTokens: 253,
        responseInputTokens: 132,
        responseOutputTokens: 121,
        responseCachedInputTokens: 64,
        transcriptionTotalTokens: 26,
        transcriptionInputTokens: 17,
        transcriptionOutputTokens: 9,
      },
    });
  });

  it('finalizes a completed session with duration and session-scoped totals', async () => {
    registerRealtimeCostTraceSession({
      app: 'supply-co',
      sessionKey: 'supply-2',
      realtimeModel: 'gpt-realtime-2',
      transcriptionModel: 'gpt-realtime-whisper',
    });
    recordRealtimeResponseUsage({
      sessionKey: 'supply-2',
      usage: {
        total_tokens: 40,
        input_tokens: 25,
        output_tokens: 15,
        input_token_details: { cached_tokens: 8 },
      },
    });
    recordRealtimeTranscriptionUsage({
      sessionKey: 'supply-2',
      usage: {
        total_tokens: 10,
        input_tokens: 7,
        output_tokens: 3,
      },
    });

    const persisted: unknown[] = [];
    const completed = await completeRealtimeCostTraceSession('supply-2', async (_url, init) => {
      persisted.push(JSON.parse(String(init?.body ?? '{}')));
      return new Response(null, { status: 204 });
    });

    expect(completed).toMatchObject({
      session: { sessionKey: 'supply-2' },
      totals: {
        responseTotalTokens: 40,
        responseInputTokens: 25,
        responseOutputTokens: 15,
        responseCachedInputTokens: 8,
        transcriptionTotalTokens: 10,
        transcriptionInputTokens: 7,
        transcriptionOutputTokens: 3,
      },
    });
    expect(completed?.durationMs).toBeGreaterThanOrEqual(0);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({ session: { sessionKey: 'supply-2' } });
  });
});
