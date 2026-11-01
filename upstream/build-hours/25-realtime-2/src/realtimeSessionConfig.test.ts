import { describe, expect, it } from 'vitest';
import {
  REALTIME_TRANSCRIPTION_MODEL,
  createRealtimeSessionConfig,
} from './realtimeSessionConfig';

describe('Realtime session config', () => {
  it('uses gpt-realtime-whisper for input transcription', () => {
    const previousTranscriptionModel = ['gpt', '4o-mini-transcribe'].join('-');
    const session = createRealtimeSessionConfig({
      model: 'gpt-realtime-2',
      instructions: 'Test instructions',
      tools: [],
      turnDetection: {
        type: 'semantic_vad',
        eagerness: 'high',
        interrupt_response: false,
        create_response: true,
      },
    });

    expect(REALTIME_TRANSCRIPTION_MODEL).toBe('gpt-realtime-whisper');
    expect(session.audio.input.transcription).toEqual({
      model: 'gpt-realtime-whisper',
    });
    expect(JSON.stringify(session)).not.toContain(previousTranscriptionModel);
  });

  it('passes through reasoning effort for Realtime 2 sessions', () => {
    const session = createRealtimeSessionConfig({
      model: 'gpt-realtime-2',
      reasoning: { effort: 'low' },
      instructions: 'Test instructions',
      tools: [],
    });

    expect(session).toMatchObject({
      type: 'realtime',
      model: 'gpt-realtime-2',
      reasoning: { effort: 'low' },
    });
  });
});
