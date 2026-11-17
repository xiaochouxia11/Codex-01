import { execFileSync } from 'node:child_process';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const fixturePublicClient = { id: 'fixture-public' } as const;
export const fixtureConfidentialClient = {
  id: 'fixture-confidential',
  secret: 'fixture-client-secret',
} as const;
export const fixtureAppOrigin = 'https://app.example.test';

export type TokenFault =
  | 'valid'
  | 'bad-signature'
  | 'unknown-kid'
  | 'unsigned'
  | 'malformed'
  | 'wrong-issuer'
  | 'wrong-audience'
  | 'missing-subject'
  | 'expired'
  | 'future-nbf'
  | 'missing-nonce'
  | 'wrong-nonce'
  | { nonce: string };

interface Transaction {
  clientId: string;
  redirectUri: string;
  challenge: string;
  nonce: string;
  fault: TokenFault;
  consumed: boolean;
}

interface TokenRequest {
  code: string;
  clientId: string;
  method: string;
  pkceVerified: boolean;
  accepted: boolean;
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify(value));
}

async function form(request: IncomingMessage): Promise<URLSearchParams> {
  if (!request.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) {
    throw new Error('Fixture token request must use form encoding');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > 16_384) {
      throw new Error('Fixture token request exceeds the body limit');
    }
    chunks.push(bytes);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString());
}

function basicCredentials(header: string): { id: string; secret: string } | null {
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(header);
  if (!match?.[1]) {
    return null;
  }
  const decoded = Buffer.from(match[1], 'base64').toString();
  const separator = decoded.indexOf(':');
  if (separator < 0) {
    return null;
  }
  try {
    return {
      id: decodeURIComponent(decoded.slice(0, separator)),
      secret: decodeURIComponent(decoded.slice(separator + 1)),
    };
  } catch {
    return null;
  }
}

/** Synthetic HTTPS issuer. Its certificate is trusted only by the calling test. */
export async function createOidcProvider() {
  const directory = await mkdtemp(join(tmpdir(), 'authjs-oidc-'));
  const certificatePath = join(directory, 'certificate.pem');
  const keyPath = join(directory, 'private-key.pem');
  try {
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        keyPath,
        '-out',
        certificatePath,
        '-days',
        '1',
        '-subj',
        '/CN=127.0.0.1',
        '-addext',
        'subjectAltName=IP:127.0.0.1',
        '-addext',
        'basicConstraints=critical,CA:TRUE',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    const [ca, tlsKey] = await Promise.all([readFile(certificatePath), readFile(keyPath)]);
    const signing = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const wrongSigning = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const kid = 'fixture-signing-key';
    const publicKey = {
      ...signing.publicKey.export({ format: 'jwk' }),
      kid,
      alg: 'RS256',
      use: 'sig',
    };
    const transactions = new Map<string, Transaction>();
    const tokenRequests: TokenRequest[] = [];
    const serverErrors: Error[] = [];
    let issuer = '';

    function idToken(transaction: Transaction): string {
      const { fault } = transaction;
      if (fault === 'malformed') {
        return 'fixture-malformed-token';
      }
      const now = Math.floor(Date.now() / 1000);
      const claims: Record<string, unknown> = {
        iss: issuer,
        aud: transaction.clientId,
        sub: 'fixture-subject',
        iat: now - 5,
        exp: now + 300,
        nonce: transaction.nonce,
        name: 'Fixture user',
      };
      if (typeof fault === 'object') {
        claims.nonce = fault.nonce;
      } else if (fault === 'wrong-issuer') {
        claims.iss = 'https://wrong-issuer.example.test';
      } else if (fault === 'wrong-audience') {
        claims.aud = 'fixture-other-client';
      } else if (fault === 'missing-subject') {
        delete claims.sub;
      } else if (fault === 'expired') {
        claims.iat = now - 120;
        claims.exp = now - 60; // Exceeds NextAuth's ten-second clock tolerance.
      } else if (fault === 'future-nbf') {
        claims.nbf = now + 120;
      } else if (fault === 'missing-nonce') {
        delete claims.nonce;
      } else if (fault === 'wrong-nonce') {
        claims.nonce = 'fixture-wrong-nonce';
      }
      const header = {
        alg: fault === 'unsigned' ? 'none' : 'RS256',
        typ: 'JWT',
        kid: fault === 'unknown-kid' ? 'fixture-unknown-key' : kid,
      };
      const message = [header, claims]
        .map((value) => Buffer.from(JSON.stringify(value)).toString('base64url'))
        .join('.');
      const signature =
        fault === 'unsigned'
          ? ''
          : sign(
              'RSA-SHA256',
              Buffer.from(message),
              fault === 'bad-signature' ? wrongSigning.privateKey : signing.privateKey,
            ).toString('base64url');
      return `${message}.${signature}`;
    }

    async function token(request: IncomingMessage, response: ServerResponse): Promise<void> {
      const body = await form(request);
      const authorization = request.headers.authorization;
      const credentials = authorization ? basicCredentials(authorization) : null;
      const clientId = credentials?.id ?? body.get('client_id') ?? '';
      const method = authorization ? 'client_secret_basic' : 'none';
      const code = body.get('code') ?? '';
      const attempt: TokenRequest = {
        code,
        clientId,
        method,
        pkceVerified: false,
        accepted: false,
      };
      tokenRequests.push(attempt);
      const publicClient = clientId === fixturePublicClient.id && !authorization;
      const confidentialClient =
        clientId === fixtureConfidentialClient.id &&
        credentials?.secret === fixtureConfidentialClient.secret;
      if (
        (!publicClient && !confidentialClient) ||
        body.has('client_secret') ||
        (credentials && body.has('client_id') && body.get('client_id') !== credentials.id)
      ) {
        response.setHeader('www-authenticate', 'Basic realm="fixture"');
        json(response, 401, { error: 'invalid_client' });
        return;
      }
      if (body.get('grant_type') !== 'authorization_code') {
        json(response, 400, { error: 'unsupported_grant_type' });
        return;
      }
      const transaction = transactions.get(code);
      if (
        !transaction ||
        transaction.consumed ||
        transaction.clientId !== clientId ||
        transaction.redirectUri !== body.get('redirect_uri')
      ) {
        json(response, 400, { error: 'invalid_grant' });
        return;
      }
      const verifier = body.get('code_verifier') ?? '';
      attempt.pkceVerified =
        /^[A-Za-z0-9._~-]{43,128}$/.test(verifier) &&
        createHash('sha256').update(verifier).digest('base64url') === transaction.challenge;
      if (!attempt.pkceVerified) {
        json(response, 400, { error: 'invalid_grant' });
        return;
      }
      transaction.consumed = true;
      attempt.accepted = true;
      json(response, 200, {
        access_token: 'fixture-access-token',
        token_type: 'Bearer',
        expires_in: 300,
        id_token: idToken(transaction),
      });
    }

    const server = createServer({ key: tlsKey, cert: ca }, (request, response) => {
      void (async () => {
        const url = new URL(request.url ?? '/', issuer);
        if (request.method === 'GET' && url.pathname === '/.well-known/openid-configuration') {
          json(response, 200, {
            issuer,
            authorization_endpoint: `${issuer}/authorize`,
            token_endpoint: `${issuer}/token`,
            jwks_uri: `${issuer}/jwks`,
            response_types_supported: ['code'],
            subject_types_supported: ['public'],
            id_token_signing_alg_values_supported: ['RS256'],
            token_endpoint_auth_methods_supported: ['none', 'client_secret_basic'],
            scopes_supported: ['openid', 'profile', 'email'],
            code_challenge_methods_supported: ['S256'],
          });
        } else if (request.method === 'GET' && url.pathname === '/jwks') {
          json(response, 200, { keys: [publicKey] });
        } else if (request.method === 'POST' && url.pathname === '/token') {
          await token(request, response);
        } else {
          json(response, 404, { error: 'fixture_endpoint_not_found' });
        }
      })().catch((error: unknown) => {
        serverErrors.push(error instanceof Error ? error : new Error('OIDC fixture failed'));
        if (!response.headersSent) {
          json(response, 500, { error: 'fixture_failure' });
        } else {
          response.destroy();
        }
      });
    });
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
          server.off('error', reject);
          resolve();
        });
      });
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('OIDC fixture did not bind a loopback TCP port');
      }
      issuer = `https://127.0.0.1:${address.port}`;
    } catch (error) {
      server.close();
      throw error;
    }

    let closed = false;
    return {
      issuer,
      ca,
      tokenRequests,
      authorize(url: URL, fault: TokenFault = 'valid'): { callbackUrl: URL; code: string } {
        if (closed) {
          throw new Error('OIDC fixture is closed');
        }
        if (
          url.origin !== issuer ||
          url.pathname !== '/authorize' ||
          url.username ||
          url.password ||
          url.hash
        ) {
          throw new Error('Unexpected fixture authorization endpoint');
        }
        const params = url.searchParams;
        const clientId = params.get('client_id');
        const redirectUri = params.get('redirect_uri');
        const state = params.get('state');
        const nonce = params.get('nonce');
        const challenge = params.get('code_challenge');
        const scopes = (params.get('scope') ?? '').split(/\s+/).filter(Boolean);
        if (
          !clientId ||
          ![fixturePublicClient.id as string, fixtureConfidentialClient.id as string].includes(
            clientId,
          ) ||
          redirectUri !== `${fixtureAppOrigin}/api/auth/callback/openai` ||
          params.get('response_type') !== 'code' ||
          !scopes.includes('openid') ||
          scopes.some((scope) => !['openid', 'profile', 'email'].includes(scope)) ||
          !state ||
          !nonce ||
          params.get('code_challenge_method') !== 'S256' ||
          !challenge ||
          !/^[A-Za-z0-9_-]{43}$/.test(challenge)
        ) {
          throw new Error(
            'Fixture authorization requires a registered client, redirect, and OIDC checks',
          );
        }
        const code = randomBytes(24).toString('base64url');
        transactions.set(code, {
          clientId,
          redirectUri,
          challenge,
          nonce,
          fault,
          consumed: false,
        });
        const callbackUrl = new URL(redirectUri);
        callbackUrl.searchParams.set('code', code);
        callbackUrl.searchParams.set('state', state);
        return { callbackUrl, code };
      },
      async close(): Promise<void> {
        if (closed) {
          return;
        }
        closed = true;
        try {
          await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
          });
        } finally {
          await rm(directory, { recursive: true, force: true });
        }
        if (serverErrors.length) {
          throw new AggregateError(serverErrors, 'OIDC fixture had unexpected server failures');
        }
      },
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
