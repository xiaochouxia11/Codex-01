import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { fetch as undiciFetch, FormData, ProxyAgent } from 'undici';
import {
  SUPPLY_REALTIME_INSTRUCTIONS,
  SUPPLY_REALTIME_TOOLS,
} from './src/agent/supplyPrompt';
import {
  SUPPLY_REALTIME_MODEL,
  SUPPLY_REALTIME_REASONING,
} from './src/agent/supplyRealtimeConfig';
import {
  METRIC_LOOP_REALTIME_INSTRUCTIONS,
  METRIC_LOOP_REALTIME_TOOLS,
} from './src/metricloop/metricLoopPrompt';
import {
  METRIC_LOOP_REALTIME_MODEL,
  METRIC_LOOP_REALTIME_REASONING,
  METRIC_LOOP_REALTIME_TURN_DETECTION,
} from './src/metricloop/metricLoopRealtimeConfig';
import {
  createRealtimeSessionConfig,
  type RealtimeAssistantConfig,
} from './src/realtimeSessionConfig';
import { createMetricLoopToolRuntime } from './src/server/metricloopToolRuntime';
import type { MetricLoopCodeRepairRequest } from './src/server/metricloopForensicsRuntime';
import {
  createMetricLoopClientSecretRequestBody,
  createRealtimeSidebandRegistry,
} from './src/server/realtimeSidebandSession';

const LOCAL_ENV_PATH = path.resolve(__dirname, '.env');
const REALTIME_COST_TRACE_DIR = path.resolve(__dirname, 'output', 'realtime-cost-traces');
const REALTIME_COST_TRACE_ENABLED = process.env.ENABLE_REALTIME_COST_TRACES === '1';
const REALTIME_SAFETY_IDENTIFIER = process.env.OPENAI_SAFETY_IDENTIFIER || 'realtime-2-demos-local-user';

const supplyRealtimeConfig: RealtimeAssistantConfig = {
  model: SUPPLY_REALTIME_MODEL,
  reasoning: SUPPLY_REALTIME_REASONING,
  instructions: SUPPLY_REALTIME_INSTRUCTIONS,
  tools: SUPPLY_REALTIME_TOOLS,
};

const metricLoopRealtimeConfig: RealtimeAssistantConfig = {
  model: METRIC_LOOP_REALTIME_MODEL,
  reasoning: METRIC_LOOP_REALTIME_REASONING,
  instructions: METRIC_LOOP_REALTIME_INSTRUCTIONS,
  tools: METRIC_LOOP_REALTIME_TOOLS,
  turnDetection: METRIC_LOOP_REALTIME_TURN_DETECTION,
};

function getProxyUrl() {
  return (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    ''
  );
}

const realtimeProxyAgent = getProxyUrl() ? new ProxyAgent(getProxyUrl()) : undefined;

function parseEnvFile(envPath: string): Record<string, string> {
  if (!existsSync(envPath)) {
    return {};
  }

  return readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .reduce<Record<string, string>>((parsedEnv, line) => {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith('#')) {
        return parsedEnv;
      }

      const keyValueMatch = trimmedLine.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!keyValueMatch) {
        return parsedEnv;
      }

      const [, key, rawValue] = keyValueMatch;
      parsedEnv[key] = rawValue.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
      return parsedEnv;
    }, {});
}

const fallbackEnv = parseEnvFile(LOCAL_ENV_PATH);

function stripCodeFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:javascript|js)?\\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function extractResponseText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === 'string') return record.output_text;
  if (!Array.isArray(record.output)) return '';

  return record.output
    .flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const content = (item as Record<string, unknown>).content;
      return Array.isArray(content) ? content : [];
    })
    .map((content) => {
      if (!content || typeof content !== 'object') return '';
      const contentRecord = content as Record<string, unknown>;
      return typeof contentRecord.text === 'string' ? contentRecord.text : '';
    })
    .join('\\n')
    .trim();
}

async function repairMetricLoopGeneratedCode(request: MetricLoopCodeRepairRequest) {
  const apiKey = process.env.OPENAI_API_KEY || fallbackEnv.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is unavailable for generated code repair.');
  }

  const upstreamResponse = await undiciFetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    dispatcher: realtimeProxyAgent,
    body: JSON.stringify({
      model: 'gpt-5.4-mini',
      input: [
        {
          role: 'system',
          content: 'You repair short JavaScript reducer code for a sandbox. Return only corrected JavaScript code. No markdown, no explanation.',
        },
        {
          role: 'user',
          content: [
            'Purpose: ' + (request.purpose ?? 'Rank MetricLoop cohort rows.'),
            'Validation error: ' + request.validationError,
            'Allowed contract:',
            request.allowedContract.map((item) => '- ' + item).join('\\n'),
            'Sample input row:',
            JSON.stringify(request.sampleRow ?? {}, null, 2),
            'Required output: an array of plain row objects with primitive values. Include cohort, lost_activations, and drop_pp when available.',
            'Original code:',
            request.code,
          ].join('\\n\\n'),
        },
      ],
    }),
  });

  if (!upstreamResponse.ok) {
    throw new Error('External generated code repair failed with status ' + upstreamResponse.status + '.');
  }

  const payload = await upstreamResponse.json();
  const repairedCode = stripCodeFence(extractResponseText(payload));
  if (!repairedCode) {
    throw new Error('External generated code repair returned no code.');
  }
  return repairedCode;
}

const metricLoopToolRuntime = createMetricLoopToolRuntime(undefined, {
  repairGeneratedCode: repairMetricLoopGeneratedCode,
});
const metricLoopSidebandRegistry = createRealtimeSidebandRegistry();

function sendJsonResponse(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks).toString('utf8');
}

async function readJsonRequestBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const body = await readRequestBody(request);
  if (!body.trim()) return {};
  const parsed = JSON.parse(body) as unknown;
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

async function handleRealtimeClientSecret(
  request: IncomingMessage,
  response: ServerResponse,
  assistantConfig: RealtimeAssistantConfig,
) {
  if (request.method !== 'POST') {
    sendJsonResponse(response, 405, { error: 'Use POST for this endpoint.' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY || fallbackEnv.OPENAI_API_KEY;
  if (!apiKey) {
    sendJsonResponse(response, 500, { error: 'Assistant connection is unavailable right now.' });
    return;
  }

  try {
    const upstreamResponse = await undiciFetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Safety-Identifier': REALTIME_SAFETY_IDENTIFIER,
      },
      dispatcher: realtimeProxyAgent,
      body: JSON.stringify(
        assistantConfig === metricLoopRealtimeConfig
          ? createMetricLoopClientSecretRequestBody()
          : { session: createRealtimeSessionConfig(assistantConfig) },
      ),
    });

    const payload = await upstreamResponse.json();
    sendJsonResponse(response, upstreamResponse.status, payload);
  } catch {
    sendJsonResponse(response, 500, { error: 'Assistant connection is unavailable right now.' });
  }
}

async function handleMetricLoopTool(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'POST') {
    sendJsonResponse(response, 405, { error: 'Use POST for this endpoint.' });
    return;
  }

  try {
    const body = await readJsonRequestBody(request);
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : 'metricloop-demo-session';
    const toolName = typeof body.toolName === 'string' ? body.toolName : '';
    const args = body.args && typeof body.args === 'object' && !Array.isArray(body.args)
      ? body.args as Record<string, unknown>
      : {};
    const dashboardFilters = body.dashboardFilters && typeof body.dashboardFilters === 'object' && !Array.isArray(body.dashboardFilters)
      ? body.dashboardFilters as Record<string, unknown>
      : undefined;

    const output = await metricLoopToolRuntime.runTool(sessionId, toolName, args, { dashboardFilters });
    sendJsonResponse(response, 200, output);
  } catch {
    sendJsonResponse(response, 500, { error: 'MetricLoop tool execution failed.' });
  }
}

async function handleMetricLoopSidebandRegister(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'POST') {
    sendJsonResponse(response, 405, { error: 'Use POST for this endpoint.' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY || fallbackEnv.OPENAI_API_KEY;
  if (!apiKey) {
    sendJsonResponse(response, 500, { error: 'MetricLoop sideband is unavailable right now.' });
    return;
  }

  try {
    const body = await readJsonRequestBody(request);
    const callId = typeof body.callId === 'string' ? body.callId : '';
    if (!callId) {
      sendJsonResponse(response, 400, { error: 'Missing Realtime call id.' });
      return;
    }

    const session = metricLoopSidebandRegistry.register(callId, apiKey);
    sendJsonResponse(response, 200, {
      callId: session.callId,
      status: session.status,
    });
  } catch {
    sendJsonResponse(response, 500, { error: 'MetricLoop sideband registration failed.' });
  }
}

function createTraceFilename(body: Record<string, unknown>) {
  const session = body.session && typeof body.session === 'object' && !Array.isArray(body.session)
    ? body.session as Record<string, unknown>
    : {};
  const app = typeof session.app === 'string' ? session.app : 'realtime';
  const sessionKey = typeof session.sessionKey === 'string' ? session.sessionKey : 'session';
  const completedAtMs = typeof body.completedAtMs === 'number' ? body.completedAtMs : Date.now();
  const safe = `${app}-${sessionKey}-${completedAtMs}`.replace(/[^A-Za-z0-9_-]+/g, '-');
  return `${safe}.json`;
}

async function handleRealtimeCostTrace(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'POST') {
    sendJsonResponse(response, 405, { error: 'Use POST for this endpoint.' });
    return;
  }
  if (!REALTIME_COST_TRACE_ENABLED) {
    sendJsonResponse(response, 404, { error: 'Realtime cost trace persistence is disabled.' });
    return;
  }

  try {
    const body = await readJsonRequestBody(request);
    mkdirSync(REALTIME_COST_TRACE_DIR, { recursive: true });
    const fileName = createTraceFilename(body);
    writeFileSync(path.join(REALTIME_COST_TRACE_DIR, fileName), `${JSON.stringify(body, null, 2)}\n`, 'utf8');
    sendJsonResponse(response, 201, { fileName });
  } catch {
    sendJsonResponse(response, 500, { error: 'Realtime cost trace persistence failed.' });
  }
}

async function handleRealtimeCall(
  request: IncomingMessage,
  response: ServerResponse,
  assistantConfig: RealtimeAssistantConfig,
) {
  if (request.method !== 'POST') {
    sendJsonResponse(response, 405, { error: 'Use POST for this endpoint.' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY || fallbackEnv.OPENAI_API_KEY;
  if (!apiKey) {
    sendJsonResponse(response, 500, { error: 'Assistant connection is unavailable right now.' });
    return;
  }

  try {
    const offerSdp = await readRequestBody(request);
    const formData = new FormData();
    formData.set('sdp', offerSdp);
    formData.set(
      'session',
      JSON.stringify(createRealtimeSessionConfig(assistantConfig)),
    );

    const upstreamResponse = await undiciFetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      dispatcher: realtimeProxyAgent,
      body: formData,
    });

    response.statusCode = upstreamResponse.status;
    response.setHeader('Content-Type', upstreamResponse.headers.get('content-type') ?? 'application/sdp');
    response.end(await upstreamResponse.text());
  } catch {
    sendJsonResponse(response, 500, { error: 'Assistant connection is unavailable right now.' });
  }
}

function supplyRealtimeApiPlugin(): PluginOption {
  return {
    name: 'supply-realtime-api',
    configureServer(server) {
      server.middlewares.use('/api/realtime/client-secret', (request, response) => {
        void handleRealtimeClientSecret(request, response, supplyRealtimeConfig);
      });
      server.middlewares.use('/api/realtime/calls', (request, response) => {
        void handleRealtimeCall(request, response, supplyRealtimeConfig);
      });
      server.middlewares.use('/api/realtime/metricloop/client-secret', (request, response) => {
        void handleRealtimeClientSecret(request, response, metricLoopRealtimeConfig);
      });
      server.middlewares.use('/api/realtime/metricloop/calls', (request, response) => {
        void handleRealtimeCall(request, response, metricLoopRealtimeConfig);
      });
      server.middlewares.use('/api/realtime/metricloop/sideband/register', (request, response) => {
        void handleMetricLoopSidebandRegister(request, response);
      });
      server.middlewares.use('/api/metricloop/tools', (request, response) => {
        void handleMetricLoopTool(request, response);
      });
      server.middlewares.use('/api/realtime-cost-traces', (request, response) => {
        void handleRealtimeCostTrace(request, response);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/realtime/client-secret', (request, response) => {
        void handleRealtimeClientSecret(request, response, supplyRealtimeConfig);
      });
      server.middlewares.use('/api/realtime/calls', (request, response) => {
        void handleRealtimeCall(request, response, supplyRealtimeConfig);
      });
      server.middlewares.use('/api/realtime/metricloop/client-secret', (request, response) => {
        void handleRealtimeClientSecret(request, response, metricLoopRealtimeConfig);
      });
      server.middlewares.use('/api/realtime/metricloop/calls', (request, response) => {
        void handleRealtimeCall(request, response, metricLoopRealtimeConfig);
      });
      server.middlewares.use('/api/realtime/metricloop/sideband/register', (request, response) => {
        void handleMetricLoopSidebandRegister(request, response);
      });
      server.middlewares.use('/api/metricloop/tools', (request, response) => {
        void handleMetricLoopTool(request, response);
      });
      server.middlewares.use('/api/realtime-cost-traces', (request, response) => {
        void handleRealtimeCostTrace(request, response);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), supplyRealtimeApiPlugin()],
  preview: {
    allowedHosts: ['voice-shopping-metricloop.app.openai.org'],
  },
});
