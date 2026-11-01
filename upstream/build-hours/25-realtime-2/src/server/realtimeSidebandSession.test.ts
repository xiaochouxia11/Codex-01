import { describe, expect, it } from 'vitest';
import {
  createMetricLoopClientSecretRequestBody,
  extractRealtimeCallId,
  createSidebandRealtimeUrl,
} from './realtimeSidebandSession';

describe('realtimeSidebandSession helpers', () => {
  it('creates a MetricLoop client-secret request body with client-owned turns', () => {
    const body = createMetricLoopClientSecretRequestBody();

    expect(body).toMatchObject({
      expires_after: {
        anchor: 'created_at',
        seconds: 600,
      },
      session: {
        type: 'realtime',
        audio: {
          input: {
            turn_detection: {
              create_response: false,
            },
          },
        },
      },
    });
  });

  it('extracts call ids and creates sideband websocket URLs', () => {
    expect(extractRealtimeCallId('/v1/realtime/calls/rtc_123')).toBe('rtc_123');
    expect(createSidebandRealtimeUrl('rtc_123')).toBe('wss://api.openai.com/v1/realtime?call_id=rtc_123');
  });
});
