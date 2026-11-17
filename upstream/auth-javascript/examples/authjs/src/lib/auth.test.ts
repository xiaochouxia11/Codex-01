import assert from 'node:assert/strict';
import { env } from 'node:process';
import { test } from 'node:test';
import type { NextAuthOptions } from 'next-auth';
import { authOptions } from './auth.ts';

const fixture = {
  NEXTAUTH_URL: 'http://127.0.0.1:4322',
  NEXTAUTH_SECRET: 'test-only-secret-with-at-least-32-characters',
  OPENAI_CLIENT_ID: 'test-client',
  OPENAI_ISSUER: 'https://issuer.example.test',
  OPENAI_TOKEN_ENDPOINT_AUTH_METHOD: 'none',
  OPENAI_CLIENT_SECRET: undefined,
};

/** These tests require no local environment file or registered client. */
function options(overrides: Partial<Record<keyof typeof fixture, string | undefined>> = {}) {
  const values = { ...fixture, ...overrides };
  const previous = Object.fromEntries(Object.keys(values).map((name) => [name, env[name]]));
  const apply = (settings: Record<string, string | undefined>) => {
    for (const [name, value] of Object.entries(settings)) {
      if (value === undefined) {
        delete env[name];
      } else {
        env[name] = value;
      }
    }
  };
  try {
    apply(values);
    return authOptions();
  } finally {
    apply(previous);
  }
}

function provider(configuration: NextAuthOptions = options()) {
  const value = configuration.providers[0];
  assert.ok(value && typeof value !== 'function' && value.type === 'oauth');
  return value;
}

test('uses the registered client auth method and retains all OIDC checks', () => {
  for (const method of ['none', 'client_secret_basic']) {
    const value = provider(
      options({
        OPENAI_TOKEN_ENDPOINT_AUTH_METHOD: method,
        OPENAI_CLIENT_SECRET: method === 'none' ? undefined : 'test-only-client-secret',
      }),
    );
    assert.equal(value.client?.token_endpoint_auth_method, method);
    assert.equal(value.clientSecret, method === 'none' ? undefined : 'test-only-client-secret');
    assert.equal(value.idToken, true);
    assert.deepEqual(value.checks, ['pkce', 'state', 'nonce']);
    assert.equal(value.allowDangerousEmailAccountLinking, false);
    assert.deepEqual(value.authorization, { params: { scope: 'openid profile email' } });
  }
});

test('fails closed on incomplete client configuration and never infers an auth method', () => {
  for (const name of [
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'OPENAI_CLIENT_ID',
    'OPENAI_ISSUER',
    'OPENAI_TOKEN_ENDPOINT_AUTH_METHOD',
  ] as const) {
    assert.throws(() => options({ [name]: undefined }), new RegExp(name));
    assert.throws(() => options({ [name]: '  ' }), new RegExp(name));
  }
  assert.throws(() => options({ NEXTAUTH_SECRET: 'too-short' }), /NEXTAUTH_SECRET/);
  assert.throws(
    () => options({ OPENAI_TOKEN_ENDPOINT_AUTH_METHOD: 'client_secret_basic' }),
    /OPENAI_CLIENT_SECRET/,
  );
  assert.throws(
    () => options({ OPENAI_CLIENT_SECRET: 'test-only-client-secret' }),
    /public client/,
  );
  assert.throws(
    () => options({ OPENAI_TOKEN_ENDPOINT_AUTH_METHOD: 'client_secret_post' }),
    /registered for the client/,
  );
});

test('rejects unsafe app origins while allowing the exact local callback origin and HTTPS', () => {
  for (const value of [
    'http://localhost:4322',
    'http://127.0.0.1:4323',
    'http://app.example.test',
    'https://user:password@app.example.test',
    'https://app.example.test/api/auth',
    'https://app.example.test/?next=other',
    'https://app.example.test/#fragment',
  ]) {
    assert.throws(() => options({ NEXTAUTH_URL: value }), /NEXTAUTH_URL/);
  }
  assert.doesNotThrow(() => options());
  assert.doesNotThrow(() => options({ NEXTAUTH_URL: 'https://app.example.test' }));
});

test('preserves the registered issuer exactly and rejects non-HTTPS or credentialed discovery', () => {
  for (const value of [
    'http://issuer.example.test',
    'https://user:password@issuer.example.test',
    'https://issuer.example.test?other=issuer',
    'https://issuer.example.test#fragment',
  ]) {
    assert.throws(() => options({ OPENAI_ISSUER: value }), /OPENAI_ISSUER/);
  }
  const issuer = 'https://issuer.example.test/tenant/';
  const value = provider(options({ OPENAI_ISSUER: issuer }));
  assert.equal(value.issuer, issuer);
  assert.equal(value.wellKnown, `${issuer}.well-known/openid-configuration`);
});

test('maps only display fields and scopes the subject to both issuer and client', async () => {
  const claims = {
    iss: fixture.OPENAI_ISSUER,
    sub: 'verified-subject',
    name: 'Test user',
    picture: 'https://images.example.test/avatar.png',
    email: 'test@example.test',
    roles: ['admin'],
  };
  const first = await provider().profile(claims, {});
  assert.deepEqual(first, {
    id: JSON.stringify([fixture.OPENAI_ISSUER, fixture.OPENAI_CLIENT_ID, claims.sub]),
    name: claims.name,
    image: claims.picture,
  });
  const anotherClient = await provider(options({ OPENAI_CLIENT_ID: 'another-client' })).profile(
    claims,
    {},
  );
  const anotherIssuer = 'https://another-issuer.example.test';
  const anotherEnvironment = await provider(options({ OPENAI_ISSUER: anotherIssuer })).profile(
    { ...claims, iss: anotherIssuer },
    {},
  );
  assert.notEqual(first.id, anotherClient.id);
  assert.notEqual(first.id, anotherEnvironment.id);
});

test('rejects mismatched issuer and missing subject even after framework verification', () => {
  const value = provider();
  for (const claims of [
    { iss: 'https://another-issuer.example.test', sub: 'subject' },
    { iss: `${fixture.OPENAI_ISSUER}/`, sub: 'subject' },
    { sub: 'subject' },
    { iss: fixture.OPENAI_ISSUER },
    { iss: fixture.OPENAI_ISSUER, sub: '' },
    { iss: fixture.OPENAI_ISSUER, sub: '  ' },
    { iss: fixture.OPENAI_ISSUER, sub: 42 },
  ]) {
    assert.throws(() => value.profile(claims, {}), /issuer or missing subject/);
  }
  assert.deepEqual(value.profile({ iss: fixture.OPENAI_ISSUER, sub: 'subject' }, {}), {
    id: JSON.stringify([fixture.OPENAI_ISSUER, fixture.OPENAI_CLIENT_ID, 'subject']),
    name: null,
    image: null,
  });
});

test('keeps provider tokens and raw claims out of the app JWT and browser session', async () => {
  const { callbacks } = options();
  assert.ok(callbacks?.jwt && callbacks.session);
  const user = { id: 'scoped-subject', name: 'Test user', image: null };
  const token = await callbacks.jwt({
    token: { email: 'test@example.test', extra: 'discard-me' },
    user,
    account: {
      provider: 'openai',
      providerAccountId: user.id,
      type: 'oauth',
      access_token: 'test-access-token',
      id_token: 'test-id-token',
      refresh_token: 'test-refresh-token',
    },
    profile: { sub: 'raw-subject', email: 'test@example.test' },
    trigger: 'signIn',
  });
  assert.deepEqual(token, { sub: user.id, name: user.name, picture: null });
  const expires = '2099-01-01T00:00:00.000Z';
  const session = await callbacks.session({
    token: { ...token, access_token: 'unexposed-token', iat: 42, exp: 43 },
    session: { expires, user: { email: 'test@example.test' } },
    user: { ...user, email: 'test@example.test', emailVerified: null },
    newSession: undefined,
    trigger: 'update',
  });
  assert.deepEqual(session, { expires, user });
});

test('does not let a browser session update replace the verified identity or display claims', async () => {
  const callback = options().callbacks?.jwt;
  assert.ok(callback);
  const token = { sub: 'verified-subject', name: 'Verified name', picture: null };
  // NextAuth supplies no user or account on a session-update invocation, despite
  // their required declarations in the v4 callback type.
  const update = {
    token,
    trigger: 'update',
    session: { sub: 'different-subject', name: 'Forged name', access_token: 'injected' },
  } as Parameters<typeof callback>[0];
  assert.equal(await callback(update), token);
});
