import type { NextAuthOptions } from 'next-auth';
import { env } from 'node:process';

const sessionMaxAgeSeconds = 60 * 60;

function required(name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Set the ${name} environment variable on the server.`);
  }
  return value;
}

/** The API handler calls this function so builds do not need live credentials. */
export function authOptions(): NextAuthOptions {
  const secret = required('NEXTAUTH_SECRET');
  if (secret.length < 32) {
    throw new Error('NEXTAUTH_SECRET must contain at least 32 random characters.');
  }
  const applicationUrl = new URL(required('NEXTAUTH_URL'));
  if (
    applicationUrl.username ||
    applicationUrl.password ||
    applicationUrl.pathname !== '/' ||
    applicationUrl.search ||
    applicationUrl.hash ||
    (applicationUrl.protocol !== 'https:' && applicationUrl.origin !== 'http://127.0.0.1:4322')
  ) {
    throw new Error('NEXTAUTH_URL must use HTTPS or the example origin: http://127.0.0.1:4322.');
  }
  const issuer = required('OPENAI_ISSUER');
  const issuerUrl = new URL(issuer);
  if (
    issuerUrl.protocol !== 'https:' ||
    issuerUrl.username ||
    issuerUrl.password ||
    issuerUrl.search ||
    issuerUrl.hash
  ) {
    throw new Error('OPENAI_ISSUER must match the exact HTTPS issuer for this client.');
  }
  const clientId = required('OPENAI_CLIENT_ID');
  const method = required('OPENAI_TOKEN_ENDPOINT_AUTH_METHOD');
  if (method !== 'none' && method !== 'client_secret_basic') {
    throw new Error('Use the token-endpoint authentication method registered for the client.');
  }
  const clientSecret = method === 'none' ? undefined : required('OPENAI_CLIENT_SECRET');
  if (method === 'none' && env.OPENAI_CLIENT_SECRET?.trim()) {
    throw new Error('Do not configure a public client with a client secret.');
  }

  return {
    secret,
    session: { strategy: 'jwt', maxAge: sessionMaxAgeSeconds },
    // The initial callback uses jwt.maxAge independently of the session cookie.
    jwt: { maxAge: sessionMaxAgeSeconds },
    pages: { signIn: '/', error: '/' },
    providers: [
      {
        id: 'openai',
        name: 'ChatGPT',
        type: 'oauth',
        issuer,
        wellKnown: `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`,
        clientId,
        clientSecret,
        client: { token_endpoint_auth_method: method },
        authorization: { params: { scope: 'openid profile email' } },
        idToken: true,
        checks: ['pkce', 'state', 'nonce'],
        allowDangerousEmailAccountLinking: false,
        profile(profile) {
          if (profile.iss !== issuer || typeof profile.sub !== 'string' || !profile.sub.trim()) {
            throw new Error('The verified identity has an unexpected issuer or missing subject.');
          }
          return {
            // Scope the external identity across providers, clients, and environments.
            id: JSON.stringify([issuer, clientId, profile.sub]),
            name: typeof profile.name === 'string' ? profile.name : null,
            image: typeof profile.picture === 'string' ? profile.picture : null,
          };
        },
      },
    ],
    callbacks: {
      jwt({ token, user }) {
        if (user) {
          // Do not put OAuth tokens or the raw identity payload into the app session.
          return { sub: user.id, name: user.name, picture: user.image };
        }
        return token;
      },
      session({ session, token }) {
        return {
          expires: session.expires,
          user: { id: token.sub, name: token.name, image: token.picture },
        };
      },
    },
    logger: {
      error(code) {
        // Do not log provider responses, credentials, or raw callback parameters.
        console.error('Auth.js error:', code);
      },
    },
  };
}
