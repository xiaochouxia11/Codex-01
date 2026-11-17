import { randomBytes } from 'node:crypto';
import type { Plugin } from 'vite';

const origin = 'http://127.0.0.1:4320';
const cookieName = 'auth_example_session';
const simulatedProfile = {
  subject: 'local-demo-user',
  name: 'Demo user (simulated)',
  picture: `${origin}/demo/profile-picture.svg`,
};

/** This example simulates identity. It creates a local app session without OAuth or identity verification. */
export function localSessionPlugin(): Plugin {
  const sessions = new Map<string, number>();
  return {
    name: 'local-example-session',
    apply: 'serve',
    configureServer(server) {
      server.httpServer?.once('close', () => sessions.clear());
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', origin);
        if (!['/demo/api/session', '/demo/auth/start'].includes(url.pathname)) {
          return next();
        }
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Content-Type', 'application/json');
        const respond = (status: number, value: unknown) => {
          res.statusCode = status;
          res.end(JSON.stringify(value));
        };
        if (
          req.headers.host !== '127.0.0.1:4320' ||
          url.origin !== origin ||
          !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')
        ) {
          respond(403, { error: 'Use the example at http://127.0.0.1:4320.' });
          return;
        }
        const match = (req.headers.cookie ?? '')
          .split(';')
          .map((part) => part.trim())
          .filter((part) => part.startsWith(`${cookieName}=`));
        const id = match.length === 1 ? match[0]!.slice(cookieName.length + 1) : undefined;
        for (const [key, expiry] of sessions) {
          if (expiry <= Date.now()) {
            sessions.delete(key);
          }
        }
        if (url.pathname === '/demo/auth/start' && req.method === 'GET') {
          const consumer = url.searchParams.get('consumer') === 'react' ? 'react' : 'vanilla';
          res.statusCode = 303;
          res.setHeader('Location', `/demo/provider?mode=redirect&consumer=${consumer}`);
          res.end();
          return;
        }
        if (url.pathname !== '/demo/api/session') {
          return respond(405, { error: 'Use a GET request.' });
        }
        if (req.method === 'GET') {
          const authenticated = Boolean(id && sessions.has(id));
          return respond(200, {
            authenticated,
            simulated: true,
            profile: authenticated ? simulatedProfile : null,
          });
        }
        if (req.headers.origin !== origin) {
          return respond(403, { error: 'Use a same-origin request.' });
        }
        if (req.method === 'POST') {
          // The local provider's explicit Complete action simulates the app's server callback.
          // A real app must verify the identity with its existing auth system before this step.
          if (id) {
            sessions.delete(id);
          }
          if (sessions.size >= 100) {
            sessions.delete(sessions.keys().next().value!);
          }
          const sessionId = randomBytes(24).toString('base64url');
          sessions.set(sessionId, Date.now() + 30 * 60_000);
          res.setHeader(
            'Set-Cookie',
            `${cookieName}=${sessionId}; Path=/demo; HttpOnly; SameSite=Lax; Max-Age=1800`,
          );
          return respond(200, { authenticated: true, simulated: true });
        }
        if (req.method === 'DELETE') {
          if (id) {
            sessions.delete(id);
          }
          res.setHeader(
            'Set-Cookie',
            `${cookieName}=; Path=/demo; HttpOnly; SameSite=Lax; Max-Age=0`,
          );
          return respond(200, { authenticated: false, simulated: true });
        }
        respond(405, { error: 'This request method is not allowed.' });
      });
    },
  };
}
