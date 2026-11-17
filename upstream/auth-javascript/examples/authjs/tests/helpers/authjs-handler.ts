import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { env } from 'node:process';
import type { NextApiRequest, NextApiResponse } from 'next';
import type NextAuthType from 'next-auth';
import { authOptions } from '../../src/lib/auth.ts';

// Native Node exposes this CommonJS entry as an object rather than the function
// default that the Next.js bundler supplies to the real API route.
const load = createRequire(import.meta.url);
const NextAuth = load('next-auth').default as typeof NextAuthType;

export const appOrigin = 'https://app.example.test';
export const sessionSecret = 'synthetic-authjs-session-secret-at-least-32-characters';

export interface AuthjsResponse {
  status: number;
  /** Header names use lowercase. Set-Cookie remains an array. */
  headers: Map<string, string | string[]>;
  body: unknown;
}

interface ClientConfiguration {
  issuer: string;
  ca: string | Buffer;
  clientId: string;
  clientSecret?: string;
}

function errorMessage(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }
  if (value && typeof value === 'object') {
    if ('error' in value) {
      return errorMessage(value.error);
    }
    if ('message' in value && typeof value.message === 'string') {
      return value.message;
    }
  }
  return typeof value === 'string' ? value : '';
}

function applyEnvironment(values: Record<string, string | undefined>): void {
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) {
      delete env[name];
    } else {
      env[name] = value;
    }
  }
}

/**
 * This client calls the NextAuth API handler with test implementations of Next.js requests and responses.
 * It uses the installed framework and production authOptions() for OIDC discovery, TLS, cookies, cryptography, callbacks, and sessions.
 * Calls are sequential because the example reads process.env on each request.
 */
export function createAuthjsClient(configuration: ClientConfiguration) {
  assert.equal(new URL(configuration.issuer).protocol, 'https:');
  assert.ok(configuration.ca.length > 0, 'the fixture must supply its TLS certificate');
  assert.ok(configuration.clientId, 'the fixture must supply a client ID');

  const cookies = new Map<string, string>();
  const errors: Array<{ code: string; message: string }> = [];

  async function request(path: string, body?: Record<string, string>): Promise<AuthjsResponse> {
    const url = new URL(path, appOrigin);
    assert.equal(url.origin, appOrigin, 'requests must stay on the synthetic application origin');
    assert.ok(url.pathname.startsWith('/api/auth/'), 'requests must target the real Auth.js route');
    const nextauth = url.pathname.slice('/api/auth/'.length).split('/');
    assert.ok(nextauth[0], 'requests must select an Auth.js action');

    const syntheticEnvironment = {
      NEXTAUTH_URL: appOrigin,
      NEXTAUTH_SECRET: sessionSecret,
      OPENAI_ISSUER: configuration.issuer,
      OPENAI_CLIENT_ID: configuration.clientId,
      OPENAI_TOKEN_ENDPOINT_AUTH_METHOD: configuration.clientSecret
        ? 'client_secret_basic'
        : 'none',
      OPENAI_CLIENT_SECRET: configuration.clientSecret,
    };
    const previousEnvironment = Object.fromEntries(
      Object.keys(syntheticEnvironment).map((name) => [name, env[name]]),
    );
    const result: AuthjsResponse = { status: 200, headers: new Map(), body: undefined };
    const response = {
      status(value: number) {
        result.status = value;
        return response;
      },
      getHeader(name: string) {
        return result.headers.get(name.toLowerCase());
      },
      setHeader(name: string, value: string | string[]) {
        result.headers.set(name.toLowerCase(), value);
        return response;
      },
      end(value?: unknown) {
        result.body = value;
        return response;
      },
      send(value: unknown) {
        result.body = value;
        return response;
      },
      json(value: unknown) {
        result.headers.set('content-type', 'application/json');
        result.body = value;
        return response;
      },
    };
    const incomingRequest = {
      method: body === undefined ? 'GET' : 'POST',
      url: `${url.pathname}${url.search}`,
      query: { ...Object.fromEntries(url.searchParams), nextauth },
      cookies: Object.fromEntries(cookies),
      headers: {
        host: url.host,
        ...(body === undefined ? {} : { 'content-type': 'application/x-www-form-urlencoded' }),
      },
      body,
    };

    applyEnvironment(syntheticEnvironment);
    try {
      const options = authOptions();
      const provider = options.providers[0];
      assert.ok(provider && typeof provider !== 'function' && provider.type === 'oauth');
      // A per-provider test CA retains hostname and certificate verification.
      provider.httpOptions = { ca: configuration.ca, timeout: 5_000 };
      options.logger = {
        error(code, metadata) {
          errors.push({ code, message: errorMessage(metadata) });
        },
      };
      await NextAuth(
        incomingRequest as unknown as NextApiRequest,
        response as unknown as NextApiResponse,
        options,
      );
    } finally {
      applyEnvironment(previousEnvironment);
    }

    const setCookie = result.headers.get('set-cookie');
    for (const cookie of setCookie === undefined
      ? []
      : Array.isArray(setCookie)
        ? setCookie
        : [setCookie]) {
      const [pair, ...attributes] = cookie.split(';');
      assert.ok(pair, 'Set-Cookie must contain a name/value pair');
      const equals = pair.indexOf('=');
      assert.ok(equals > 0, 'Set-Cookie must have a nonempty name');
      const name = pair.slice(0, equals);
      const value = decodeURIComponent(pair.slice(equals + 1));
      const expired = attributes.some((attribute) => {
        const [key, ...parts] = attribute.trim().split('=');
        const field = parts.join('=');
        return (
          (key?.toLowerCase() === 'max-age' && Number(field) <= 0) ||
          (key?.toLowerCase() === 'expires' && Date.parse(field) <= Date.now())
        );
      });
      if (expired) {
        cookies.delete(name);
      } else {
        cookies.set(name, value);
      }
    }
    return result;
  }

  return {
    cookies,
    errors,
    request,
    async start(): Promise<URL> {
      const csrf = await request('/api/auth/csrf');
      assert.equal(csrf.status, 200, 'CSRF setup must succeed before testing authorization');
      assert.ok(csrf.body && typeof csrf.body === 'object' && 'csrfToken' in csrf.body);
      assert.equal(typeof csrf.body.csrfToken, 'string');
      const result = await request('/api/auth/signin/openai', {
        csrfToken: csrf.body.csrfToken as string,
        callbackUrl: appOrigin,
      });
      assert.equal(result.status, 302, 'sign-in must create a real authorization redirect');
      const location = result.headers.get('location');
      assert.equal(typeof location, 'string');
      const authorization = new URL(location as string);
      assert.equal(authorization.origin, new URL(configuration.issuer).origin);
      assert.equal(authorization.searchParams.get('response_type'), 'code');
      assert.equal(authorization.searchParams.get('client_id'), configuration.clientId);
      for (const name of ['state', 'nonce', 'code_challenge']) {
        assert.ok(authorization.searchParams.get(name), `authorization must include ${name}`);
      }
      assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
      return authorization;
    },
    callback(url: URL): Promise<AuthjsResponse> {
      assert.equal(url.origin, appOrigin);
      assert.equal(url.pathname, '/api/auth/callback/openai');
      return request(url.href);
    },
    async session(): Promise<unknown> {
      const result = await request('/api/auth/session');
      assert.equal(result.status, 200, 'session reads must succeed');
      return result.body;
    },
  };
}
