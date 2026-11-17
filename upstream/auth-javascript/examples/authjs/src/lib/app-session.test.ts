import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appSession, refreshAppSession } from './app-session.ts';

const session = {
  expires: '2099-01-01T00:00:00.000Z',
  user: { id: 'verified-subject', name: 'Test user' },
};

test('reads the same-origin application session with the caller abort signal', async (context) => {
  const controller = new AbortController();
  const fetch = context.mock.method(
    globalThis,
    'fetch',
    async (...[url, options]: Parameters<typeof globalThis.fetch>) => {
      assert.equal(url, '/api/auth/session');
      assert.deepEqual(options, {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
      });
      return Response.json(session);
    },
  );
  assert.deepEqual(await appSession.getSession({ signal: controller.signal }), {
    status: 'authenticated',
    profile: { subject: session.user.id, name: session.user.name },
  });
  assert.equal(fetch.mock.callCount(), 1);
});

test('a successful explicit recovery notifies the SDK to replace its previous profile snapshot', async (context) => {
  let currentSession: unknown = { ...session };
  context.mock.method(globalThis, 'fetch', async () => Response.json(currentSession));
  const signal = new AbortController().signal;
  const snapshots: unknown[] = [];
  const reads: Promise<void>[] = [];
  const unsubscribe = appSession.subscribe!(() => {
    // This is the SDK session-source contract: notifications cause a fresh read.
    reads.push(
      Promise.resolve(appSession.getSession({ signal })).then((value) => {
        snapshots.push(value);
      }),
    );
  });
  try {
    await appSession.getSession({ signal });
    assert.equal(reads.length, 0, 'ordinary SDK reads must not cause a notification loop');
    currentSession = { ...session, user: { id: 'new-subject', name: 'Updated user' } };
    await refreshAppSession(signal);
    await Promise.all(reads);
    assert.deepEqual(snapshots, [
      { status: 'authenticated', profile: { subject: 'new-subject', name: 'Updated user' } },
    ]);
    currentSession = {};
    await refreshAppSession(signal);
    await Promise.all(reads);
    assert.deepEqual(snapshots.at(-1), { status: 'unauthenticated' });
    unsubscribe();
    await refreshAppSession(signal);
    assert.equal(reads.length, 2, 'unmounted providers must no longer receive notifications');
  } finally {
    unsubscribe();
  }
});

test('failed reconciliation rejects without reporting that the session was refreshed', async (context) => {
  const fetch = context.mock.method(globalThis, 'fetch');
  const onChange = context.mock.fn();
  const unsubscribe = appSession.subscribe!(onChange);
  try {
    for (const response of [
      new Response('', { status: 503 }),
      new Response('not-json'),
      Response.json({ expires: session.expires, user: {} }),
    ]) {
      fetch.mock.mockImplementation(async () => response);
      await assert.rejects(refreshAppSession(new AbortController().signal));
    }
    assert.equal(onChange.mock.callCount(), 0);
  } finally {
    unsubscribe();
  }
});
