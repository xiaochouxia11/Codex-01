import assert from 'node:assert/strict';
import { get } from 'node:https';
import { test } from 'node:test';
import { decode, encode } from 'next-auth/jwt';
import {
  createAuthjsClient,
  sessionSecret as fixtureSessionSecret,
} from './helpers/authjs-handler.ts';
import {
  createOidcProvider,
  fixtureAppOrigin,
  fixtureConfidentialClient,
  fixturePublicClient,
  type TokenFault,
} from './helpers/oidc-provider.ts';

const sessionCookie = '__Secure-next-auth.session-token';
const nonceCookie = '__Secure-next-auth.nonce';
const stateCookie = '__Secure-next-auth.state';
const pkceCookie = '__Secure-next-auth.pkce.code_verifier';

function object(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}

function location(response: { headers: Map<string, string | string[]> }): URL {
  const value = response.headers.get('location');
  assert.equal(typeof value, 'string');
  return new URL(value as string);
}

// These tests run the real Auth.js handler, cryptography, and HTTPS discovery,
// token, and JWKS requests. Only the identity provider and Next.js request/response
// envelope are fixtures. Each case obtains fresh CSRF/PKCE/state/nonce cookies.
test('Auth.js protocol acceptance and rejection through the configured handler', async (context) => {
  const provider = await createOidcProvider();
  context.after(() => provider.close());
  const client = (confidential = false) =>
    createAuthjsClient({
      issuer: provider.issuer,
      ca: provider.ca,
      clientId: confidential ? fixtureConfidentialClient.id : fixturePublicClient.id,
      ...(confidential ? { clientSecret: fixtureConfidentialClient.secret } : {}),
    });

  await context.test('fixture HTTPS remains untrusted without its explicit test CA', async () => {
    await assert.rejects(
      new Promise<void>((resolve, reject) => {
        const request = get(`${provider.issuer}/.well-known/openid-configuration`, (response) => {
          response.resume();
          response.on('end', resolve);
        });
        request.on('error', reject);
      }),
      /self.signed certificate|unable to verify/i,
    );
  });

  for (const confidential of [false, true]) {
    await context.test(
      `accepts a valid ${confidential ? 'confidential' : 'public'} transaction`,
      async () => {
        const app = client(confidential);
        const authorization = await app.start();
        const transaction = provider.authorize(authorization);
        const response = await app.callback(transaction.callbackUrl);
        assert.equal(response.status, 302);
        assert.equal(location(response).origin, fixtureAppOrigin);
        assert.equal(location(response).search, '');
        assert.deepEqual(app.errors, []);
        assert.ok(app.cookies.has(sessionCookie));
        for (const name of [nonceCookie, stateCookie, pkceCookie]) {
          assert.equal(
            app.cookies.has(name),
            false,
            'successful callbacks retire transaction cookies',
          );
        }
        const headers = response.headers.get('set-cookie');
        assert.ok(Array.isArray(headers));
        const sessionHeader = headers.find((value) => value.startsWith(`${sessionCookie}=`));
        assert.ok(sessionHeader);
        for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Expires=']) {
          assert.ok(sessionHeader.includes(attribute), `session cookie requires ${attribute}`);
        }
        const sessionResponse = await app.request('/api/auth/session');
        assert.match(String(sessionResponse.headers.get('cache-control')), /no-store/);
        const session = object(sessionResponse.body);
        assert.deepEqual(Object.keys(session).sort(), ['expires', 'user']);
        const user = object(session.user);
        const identity = JSON.parse(String(user.id));
        assert.equal(identity[0], provider.issuer);
        assert.equal(
          identity[1],
          confidential ? fixtureConfidentialClient.id : fixturePublicClient.id,
        );
        assert.equal(typeof identity[2], 'string');
        assert.deepEqual(Object.keys(user).sort(), ['id', 'image', 'name']);
        assert.ok(Date.parse(String(session.expires)) > Date.now());
        const exchange = provider.tokenRequests.at(-1);
        assert.ok(exchange?.accepted && exchange.pkceVerified);
        assert.equal(exchange.method, confidential ? 'client_secret_basic' : 'none');
        assert.equal(exchange.clientId, identity[1]);
        const csrf = object((await app.request('/api/auth/csrf')).body);
        await app.request('/api/auth/signout', {
          csrfToken: String(csrf.csrfToken),
          callbackUrl: '/',
        });
        assert.equal(app.cookies.has(sessionCookie), false);
        assert.deepEqual(await app.session(), {});
      },
    );
  }

  await context.test(
    'the initial encrypted session expires after the configured one hour',
    async () => {
      const app = client();
      await app.callback(provider.authorize(await app.start()).callbackUrl);
      // Inspect before the first session read, which independently rotates the JWT.
      const token = await decode({
        token: app.cookies.get(sessionCookie),
        secret: fixtureSessionSecret,
      });
      assert.ok(token && typeof token.exp === 'number' && typeof token.iat === 'number');
      assert.equal(token.exp - token.iat, 60 * 60);
    },
  );

  const faults: Array<[TokenFault, RegExp]> = [
    ['bad-signature', /^failed to validate JWT signature/],
    ['unknown-kid', /^no valid key found/],
    ['unsigned', /^unexpected JWT alg received/],
    ['malformed', /^failed to decode JWT/],
    ['wrong-issuer', /^unexpected iss value/],
    ['wrong-audience', /^aud mismatch/],
    ['missing-subject', /^missing required JWT property sub/],
    ['expired', /^JWT expired/],
    ['future-nbf', /^JWT not active yet/],
    ['missing-nonce', /^nonce mismatch/],
    ['wrong-nonce', /^nonce mismatch/],
  ];
  for (const [fault, reason] of faults) {
    await context.test(`rejects ID token: ${String(fault)}`, async () => {
      const app = client();
      const before = provider.tokenRequests.length;
      const response = await app.callback(provider.authorize(await app.start(), fault).callbackUrl);
      assert.equal(response.status, 302);
      assert.equal(location(response).searchParams.get('error'), 'OAuthCallback');
      assert.equal(provider.tokenRequests.length, before + 1, 'must reach the token endpoint');
      assert.equal(provider.tokenRequests.at(-1)?.accepted, true, 'must receive the faulty token');
      assert.ok(
        app.errors.some((error) => reason.test(error.message)),
        'reject for the intended reason',
      );
      assert.equal(app.cookies.has(sessionCookie), false);
      assert.deepEqual(await app.session(), {});
    });
  }

  await context.test(
    'rejects a correctly signed token carrying another transaction nonce',
    async () => {
      const first = client();
      const other = client();
      const firstAuthorization = await first.start();
      const otherAuthorization = await other.start();
      const nonce = otherAuthorization.searchParams.get('nonce');
      assert.ok(nonce && nonce !== firstAuthorization.searchParams.get('nonce'));
      const response = await first.callback(
        provider.authorize(firstAuthorization, { nonce }).callbackUrl,
      );
      assert.equal(location(response).searchParams.get('error'), 'OAuthCallback');
      assert.ok(first.errors.some((error) => /nonce/i.test(error.message)));
      assert.deepEqual(await first.session(), {});
      // The independent transaction remains usable after the first was rejected.
      await other.callback(provider.authorize(otherAuthorization).callbackUrl);
      assert.ok(object(await other.session()).user);
    },
  );

  for (const [name, reason] of [
    [nonceCookie, /nonce/i],
    [stateCookie, /state/i],
    [pkceCookie, /pkce/i],
  ] as const) {
    await context.test(`rejects a missing ${name} cookie before token exchange`, async () => {
      const app = client();
      const transaction = provider.authorize(await app.start());
      const before = provider.tokenRequests.length;
      app.cookies.delete(name);
      const response = await app.callback(transaction.callbackUrl);
      assert.equal(location(response).searchParams.get('error'), 'OAuthCallback');
      assert.equal(provider.tokenRequests.length, before);
      assert.ok(app.errors.some((error) => reason.test(error.message)));
      assert.deepEqual(await app.session(), {});
    });
  }

  for (const mode of ['tampered', 'expired'] as const) {
    await context.test(`rejects ${mode} nonce cookies before token exchange`, async () => {
      const app = client();
      const authorization = await app.start();
      const transaction = provider.authorize(authorization);
      const before = provider.tokenRequests.length;
      app.cookies.set(
        nonceCookie,
        mode === 'tampered'
          ? 'not-an-authentic-cookie'
          : await encode({
              secret: fixtureSessionSecret,
              salt: nonceCookie,
              maxAge: -60,
              token: { value: authorization.searchParams.get('nonce'), provider: 'openai' },
            }),
      );
      const response = await app.callback(transaction.callbackUrl);
      assert.equal(location(response).searchParams.get('error'), 'OAuthCallback');
      assert.equal(provider.tokenRequests.length, before);
      assert.ok(app.errors.some((error) => /jwe|decrypt|exp|expired/i.test(error.message)));
      assert.deepEqual(await app.session(), {});
    });
  }

  await context.test('rejects mismatched state before token exchange', async () => {
    const app = client();
    const transaction = provider.authorize(await app.start());
    transaction.callbackUrl.searchParams.set('state', 'wrong-state');
    const before = provider.tokenRequests.length;
    const response = await app.callback(transaction.callbackUrl);
    assert.equal(location(response).searchParams.get('error'), 'OAuthCallback');
    assert.equal(provider.tokenRequests.length, before);
    assert.ok(app.errors.some((error) => /state mismatch/i.test(error.message)));
    assert.deepEqual(await app.session(), {});
  });

  await context.test('rejects a token exchange with a different PKCE verifier', async () => {
    const app = client();
    const transaction = provider.authorize(await app.start());
    app.cookies.set(
      pkceCookie,
      await encode({
        secret: fixtureSessionSecret,
        salt: pkceCookie,
        maxAge: 900,
        token: {
          value: 'a-different-fixture-verifier-that-does-not-match-the-challenge',
          provider: 'openai',
        },
      }),
    );
    const before = provider.tokenRequests.length;
    const response = await app.callback(transaction.callbackUrl);
    assert.equal(location(response).searchParams.get('error'), 'OAuthCallback');
    assert.equal(provider.tokenRequests.length, before + 1);
    assert.equal(provider.tokenRequests.at(-1)?.accepted, false);
    assert.equal(provider.tokenRequests.at(-1)?.pkceVerified, false);
    assert.ok(app.errors.some((error) => /invalid_grant/i.test(error.message)));
    assert.deepEqual(await app.session(), {});
  });

  await context.test(
    'rejects confidential-client authentication with the wrong secret',
    async () => {
      const app = createAuthjsClient({
        issuer: provider.issuer,
        ca: provider.ca,
        clientId: fixtureConfidentialClient.id,
        clientSecret: 'incorrect-fixture-client-secret',
      });
      const transaction = provider.authorize(await app.start());
      const response = await app.callback(transaction.callbackUrl);
      assert.equal(location(response).searchParams.get('error'), 'OAuthCallback');
      assert.equal(provider.tokenRequests.at(-1)?.accepted, false);
      assert.ok(app.errors.some((error) => /invalid_client/i.test(error.message)));
      assert.deepEqual(await app.session(), {});
    },
  );

  await context.test('rejects callback replay even with restored transaction cookies', async () => {
    const app = client();
    const transaction = provider.authorize(await app.start());
    const transactionCookies = new Map(app.cookies);
    await app.callback(transaction.callbackUrl);
    assert.ok(object(await app.session()).user);
    const replay = client();
    for (const [name, value] of transactionCookies) {
      replay.cookies.set(name, value);
    }
    const before = provider.tokenRequests.length;
    const response = await replay.callback(transaction.callbackUrl);
    assert.equal(location(response).searchParams.get('error'), 'OAuthCallback');
    assert.equal(provider.tokenRequests.length, before + 1);
    assert.equal(provider.tokenRequests.at(-1)?.accepted, false);
    assert.ok(replay.errors.some((error) => /invalid_grant/i.test(error.message)));
    assert.deepEqual(await replay.session(), {});
  });

  for (const mode of ['tampered', 'expired'] as const) {
    await context.test(`rejects and clears ${mode} application sessions`, async () => {
      const app = client();
      app.cookies.set(
        sessionCookie,
        mode === 'tampered'
          ? 'not-an-authentic-session'
          : await encode({
              secret: fixtureSessionSecret,
              maxAge: -60,
              token: { sub: 'expired-fixture-subject', name: 'Expired fixture user' },
            }),
      );
      assert.deepEqual(await app.session(), {});
      assert.equal(app.cookies.has(sessionCookie), false);
      assert.ok(app.errors.some((error) => error.code === 'JWT_SESSION_ERROR'));
    });
  }

  await context.test('a rejected new sign-in cannot replace an existing app identity', async () => {
    const app = client();
    await app.callback(provider.authorize(await app.start()).callbackUrl);
    const before = object(await app.session()).user;
    const response = await app.callback(
      provider.authorize(await app.start(), 'wrong-nonce').callbackUrl,
    );
    assert.equal(location(response).searchParams.get('error'), 'OAuthCallback');
    assert.deepEqual(object(await app.session()).user, before);
  });
});
