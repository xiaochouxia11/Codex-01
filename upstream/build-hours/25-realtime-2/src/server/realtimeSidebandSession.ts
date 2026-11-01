import WebSocket from 'ws';
import { createMetricLoopRealtimeSessionConfig } from '../metricloop/metricLoopRealtimeConfig';

export interface RealtimeClientSecretRequestBody {
  expires_after: {
    anchor: 'created_at';
    seconds: number;
  };
  session: ReturnType<typeof createMetricLoopRealtimeSessionConfig>;
}

export interface RealtimeSidebandSession {
  callId: string;
  status: 'connecting' | 'open' | 'closed' | 'error';
  socket: WebSocket | null;
}

export function createMetricLoopClientSecretRequestBody(): RealtimeClientSecretRequestBody {
  return {
    expires_after: {
      anchor: 'created_at',
      seconds: 600,
    },
    session: createMetricLoopRealtimeSessionConfig(),
  };
}

export function extractRealtimeCallId(location: string | null): string | null {
  if (!location) return null;
  const match = location.match(/([^/]+)$/);
  return match?.[1] ?? null;
}

export function createSidebandRealtimeUrl(callId: string): string {
  return 'wss://api.openai.com/v1/realtime?call_id=' + encodeURIComponent(callId);
}

export function createRealtimeSidebandRegistry() {
  const sessions = new Map<string, RealtimeSidebandSession>();

  function register(callId: string, apiKey: string): RealtimeSidebandSession {
    const existing = sessions.get(callId);
    if (existing && (existing.status === 'connecting' || existing.status === 'open')) {
      return existing;
    }

    const session: RealtimeSidebandSession = {
      callId,
      status: 'connecting',
      socket: null,
    };
    sessions.set(callId, session);

    const socket = new WebSocket(createSidebandRealtimeUrl(callId), {
      headers: {
        Authorization: 'Bearer ' + apiKey,
      },
    });
    session.socket = socket;

    socket.on('open', () => {
      session.status = 'open';
    });
    socket.on('close', () => {
      session.status = 'closed';
    });
    socket.on('error', () => {
      session.status = 'error';
    });

    return session;
  }

  function get(callId: string): RealtimeSidebandSession | null {
    return sessions.get(callId) ?? null;
  }

  function closeAll() {
    sessions.forEach((session) => {
      session.socket?.close();
      session.status = 'closed';
    });
    sessions.clear();
  }

  return {
    register,
    get,
    closeAll,
  };
}
