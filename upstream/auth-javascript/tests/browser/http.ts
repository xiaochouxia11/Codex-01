import { createServer } from 'node:http';
import { testPort } from './origin.ts';

export function respond(body: string | Uint8Array, type: string, status = 200): Response {
  return new Response(typeof body === 'string' ? body : new Uint8Array(body), {
    status,
    headers: { 'Content-Type': type, 'Cache-Control': 'no-store' },
  });
}

/** Serve static and SSR browser fixtures on the loopback test origin. */
export function serveLoopback(handler: (url: URL) => Promise<Response>) {
  const server = createServer((request, response) => {
    void (async () => {
      let result: Response;
      try {
        const host = request.headers.host;
        if (![`127.0.0.1:${testPort}`, `localhost:${testPort}`].includes(host ?? '')) {
          throw new Error('Unexpected host.');
        }
        result =
          request.method === 'GET' || request.method === 'HEAD'
            ? await handler(new URL(request.url ?? '/', `http://${host}`))
            : respond('Only GET and HEAD are supported', 'text/plain', 405);
      } catch {
        result = respond('Request could not be served', 'text/plain', 400);
      }
      response.statusCode = result.status;
      for (const [key, value] of result.headers) {
        response.setHeader(key, value);
      }
      response.end(request.method === 'HEAD' ? undefined : Buffer.from(await result.arrayBuffer()));
    })().catch(() => response.destroy());
  });
  server.listen(testPort, '127.0.0.1');
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
  return server;
}
