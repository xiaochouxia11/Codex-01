import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChatGPTAuth, type ChatGPTAuthClient } from '../packages/core/src/client/index.js';
import type {
  ChatGPTAuthSession,
  ChatGPTAuthSessionSource,
  ChatGPTAuthSignInAdapter,
  ChatGPTAuthSignInAdapterResult,
} from '../packages/core/src/index.js';

const authenticated: ChatGPTAuthSession = {
  status: 'authenticated',
  profile: { subject: 'alice', name: 'Alice', picture: 'https://example.test/alice.png' },
};
const unauthenticated: ChatGPTAuthSession = { status: 'unauthenticated' };
const clients: ChatGPTAuthClient[] = [];
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
function deferred<T>() {
  let resolve!: (result: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
function setup(initial = authenticated) {
  const listeners = new Set<() => void>();
  const unsubscribe = vi.fn();
  const getSession = vi
    .fn<(options: { signal: AbortSignal }) => Promise<ChatGPTAuthSession>>()
    .mockResolvedValue(initial);
  const source: ChatGPTAuthSessionSource = {
    getSession,
    subscribe: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        unsubscribe();
      };
    }),
  };
  const signIn = vi
    .fn<() => Promise<ChatGPTAuthSignInAdapterResult>>()
    .mockResolvedValue({ status: 'complete' });
  const adapter = { signIn, session: source };
  const client = createChatGPTAuth({ adapter });
  clients.push(client);
  return {
    client,
    adapter,
    source,
    signIn,
    getSession,
    unsubscribe,
    listeners,
    notify: () => [...listeners].forEach((listener) => listener()),
  };
}

afterEach(async () => {
  for (const client of clients.splice(0)) {
    await client.destroy();
  }
  vi.unstubAllGlobals();
});

describe('core app-session observation', () => {
  it('constructs without browser access, subscriptions, or reads', async () => {
    vi.stubGlobal('window', undefined);
    const f = setup();
    expect(f.client.getSessionSnapshot()).toEqual({ status: 'loading', profile: null });
    expect(f.source.subscribe).not.toHaveBeenCalled();
    expect(f.getSession).not.toHaveBeenCalled();
    const client = createChatGPTAuth({ authPath: '/auth/login' });
    clients.push(client);
    const unsubscribe = client.subscribeSession(vi.fn());
    await client.refreshSession();
    expect(client.getSessionSnapshot()).toEqual({ status: 'unavailable', profile: null });
    unsubscribe();
  });

  it('shares one read and source subscription until the last subscriber leaves', async () => {
    const f = setup();
    const pending = deferred<ChatGPTAuthSession>();
    f.getSession.mockReturnValue(pending.promise);
    const listener = vi.fn();
    const first = f.client.subscribeSession(listener);
    const second = f.client.subscribeSession(listener);
    expect(f.getSession).toHaveBeenCalledTimes(1);
    expect(f.source.subscribe).toHaveBeenCalledTimes(1);
    const signal = f.getSession.mock.calls[0]![0].signal;
    first();
    first();
    expect(signal.aborted).toBe(false);
    second();
    expect(signal.aborted).toBe(true);
    expect(f.unsubscribe).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('focus'));
    pending.resolve(authenticated);
    await settle();
    expect(f.getSession).toHaveBeenCalledTimes(1);
    expect(listener).not.toHaveBeenCalled();
    expect(f.client.getSessionSnapshot()).toEqual({ status: 'loading', profile: null });
    f.client.subscribeSession(listener);
    await settle();
    expect(f.getSession).toHaveBeenCalledTimes(2);
    expect(f.client.getSessionSnapshot().profile).toEqual(authenticated.profile);
  });

  it('preserves source identity and its method receiver across configuration updates', async () => {
    const f = setup();
    f.getSession.mockImplementation(async function (this: unknown) {
      expect(this).toBe(f.source);
      return authenticated;
    });
    f.client.subscribeSession(vi.fn());
    await settle();
    const snapshot = f.client.getSessionSnapshot();
    f.client.updateSignIn({ adapter: { ...f.adapter }, onSignInComplete: vi.fn() });
    expect(f.client.getSessionSnapshot()).toBe(snapshot);
    expect(f.source.subscribe).toHaveBeenCalledTimes(1);
    expect(f.getSession).toHaveBeenCalledTimes(1);
    expect(f.unsubscribe).not.toHaveBeenCalled();
  });

  it('clears old account claims immediately and ignores superseded reads', async () => {
    const f = setup();
    f.client.subscribeSession(vi.fn());
    await settle();
    const old = deferred<ChatGPTAuthSession>();
    const current = deferred<ChatGPTAuthSession>();
    f.getSession.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    f.notify();
    expect(f.client.getSessionSnapshot()).toEqual({ status: 'loading', profile: null });
    f.notify();
    expect(f.getSession.mock.calls[1]![0].signal.aborted).toBe(true);
    current.resolve(unauthenticated);
    await settle();
    const snapshot = f.client.getSessionSnapshot();
    old.resolve(authenticated);
    await settle();
    expect(f.client.getSessionSnapshot()).toBe(snapshot);
    expect(snapshot).toEqual({ status: 'unauthenticated', profile: null });
  });

  it('replaces session sources and retires their subscriptions and pending results', async () => {
    const f = setup();
    const old = deferred<ChatGPTAuthSession>();
    f.getSession.mockReturnValue(old.promise);
    f.client.subscribeSession(vi.fn());
    const oldNotify = [...f.listeners][0]!;
    const other = setup(unauthenticated);
    f.client.updateSignIn({ adapter: other.adapter });
    expect(f.unsubscribe).toHaveBeenCalledTimes(1);
    expect(f.getSession.mock.calls[0]![0].signal.aborted).toBe(true);
    oldNotify();
    old.resolve(authenticated);
    await settle();
    expect(f.getSession).toHaveBeenCalledTimes(1);
    expect(f.client.getSessionSnapshot()).toEqual({ status: 'unauthenticated', profile: null });
    f.client.updateSignIn({ authPath: '/auth/login' });
    expect(other.unsubscribe).toHaveBeenCalledTimes(1);
    expect(f.client.getSessionSnapshot()).toEqual({ status: 'unavailable', profile: null });
  });

  it('keeps the current profile during coalesced focus and persisted pageshow reads', async () => {
    const f = setup();
    f.client.subscribeSession(vi.fn());
    await settle();
    const snapshot = f.client.getSessionSnapshot();
    const pending = deferred<ChatGPTAuthSession>();
    f.getSession.mockReturnValue(pending.promise);
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
    expect(f.getSession).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expect(f.getSession).toHaveBeenCalledTimes(2);
    expect(f.client.getSessionSnapshot()).toBe(snapshot);
    pending.resolve(unauthenticated);
    await settle();
    expect(f.client.getSessionSnapshot()).toEqual({ status: 'unauthenticated', profile: null });
    expect(f.signIn).not.toHaveBeenCalled();
  });

  it('allows explicit reads without observation and resolves cancelled refreshes', async () => {
    const f = setup();
    await f.client.refreshSession();
    expect(f.client.getSessionSnapshot().profile).toEqual(authenticated.profile);
    expect(f.source.subscribe).not.toHaveBeenCalled();
    const pending = deferred<ChatGPTAuthSession>();
    f.getSession.mockReturnValue(pending.promise);
    const refresh = f.client.refreshSession();
    await f.client.destroy();
    await refresh;
    pending.resolve(authenticated);
    await settle();
    expect(f.getSession.mock.calls[1]![0].signal.aborted).toBe(true);
    expect(f.client.getSessionSnapshot()).toEqual({ status: 'unavailable', profile: null });
  });

  it('copies and freezes display claims, excluding credentials and invalid picture URLs', async () => {
    const f = setup();
    const profile = {
      subject: 'alice',
      name: 'Alice',
      picture: 'javascript:alert(1)',
      token: 'secret',
    };
    f.getSession.mockResolvedValue({ status: 'authenticated', profile });
    await f.client.refreshSession();
    profile.name = 'mutated';
    const snapshot = f.client.getSessionSnapshot();
    expect(snapshot).toEqual({
      status: 'authenticated',
      profile: { subject: 'alice', name: 'Alice' },
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.profile)).toBe(true);
  });

  it.each(['reject', 'throw', 'bad-result'] as const)(
    'contains a %s failure and recovers on a later notification',
    async (failure) => {
      const f = setup();
      f.client.subscribeSession(() => {
        throw new Error('consumer error');
      });
      await settle();
      if (failure === 'reject') {
        f.getSession.mockRejectedValue(new Error('private-token-error'));
      } else if (failure === 'throw') {
        f.getSession.mockImplementation(() => {
          throw new Error('private-token-error');
        });
      } else {
        f.getSession.mockResolvedValue({ status: 'authenticated' } as ChatGPTAuthSession);
      }
      await f.client.refreshSession();
      expect(f.client.getSessionSnapshot()).toEqual({ status: 'error', profile: null });
      f.getSession.mockResolvedValue(authenticated);
      f.notify();
      await settle();
      expect(f.client.getSessionSnapshot().profile).toEqual(authenticated.profile);
    },
  );

  it('retires synchronous source notifications if source subscription fails', async () => {
    const pending = deferred<ChatGPTAuthSession>();
    const getSession = vi.fn(() => pending.promise);
    let notify!: () => void;
    const client = createChatGPTAuth({
      adapter: {
        signIn: async () => ({ status: 'complete' }),
        session: {
          getSession,
          subscribe(listener) {
            notify = listener;
            listener();
            throw new Error('private-subscription-error');
          },
        },
      },
    });
    clients.push(client);
    client.subscribeSession(vi.fn());
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(client.getSessionSnapshot()).toEqual({ status: 'error', profile: null });
    notify();
    window.dispatchEvent(new Event('focus'));
    pending.resolve(authenticated);
    await settle();
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(client.getSessionSnapshot()).toEqual({ status: 'error', profile: null });
  });

  it('keeps reentrant source changes made by abort handlers', async () => {
    const f = setup();
    const intermediate = setup();
    const replacement = setup(unauthenticated);
    f.getSession.mockImplementation(({ signal }) => {
      signal.addEventListener('abort', () => {
        f.client.updateSignIn({ adapter: replacement.adapter });
      });
      return new Promise(() => {});
    });
    f.client.subscribeSession(vi.fn());
    f.client.updateSignIn({ adapter: intermediate.adapter });
    await settle();
    expect(intermediate.getSession).not.toHaveBeenCalled();
    expect(replacement.getSession).toHaveBeenCalledTimes(1);
    expect(f.client.getSessionSnapshot()).toEqual({ status: 'unauthenticated', profile: null });
    expect(f.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('keeps reentrant source changes made by subscription cleanup', async () => {
    const f = setup();
    const intermediate = setup();
    const replacement = setup(unauthenticated);
    f.unsubscribe.mockImplementation(() => {
      f.client.updateSignIn({ adapter: replacement.adapter });
      throw new Error('private-cleanup-error');
    });
    f.client.subscribeSession(vi.fn());
    await settle();
    f.client.updateSignIn({ adapter: intermediate.adapter });
    await settle();
    expect(intermediate.getSession).not.toHaveBeenCalled();
    expect(replacement.getSession).toHaveBeenCalledTimes(1);
    expect(f.client.getSessionSnapshot()).toEqual({ status: 'unauthenticated', profile: null });
    expect(f.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('retires a read before a snapshot subscriber can replace its source', async () => {
    const f = setup();
    const replacement = setup(unauthenticated);
    let replace = false;
    f.client.subscribeSession(() => {
      if (replace && f.client.getSessionSnapshot().status === 'loading') {
        replace = false;
        f.client.updateSignIn({ adapter: replacement.adapter });
      }
    });
    await settle();
    replace = true;
    await f.client.refreshSession();
    await settle();
    expect(f.getSession).toHaveBeenCalledTimes(1);
    expect(replacement.getSession).toHaveBeenCalledTimes(1);
    expect(f.client.getSessionSnapshot()).toEqual({ status: 'unauthenticated', profile: null });
  });

  it.each([
    { getSession: 3 },
    { getSession: async () => unauthenticated, subscribe: 3 },
    {
      get getSession() {
        throw new Error('private-source-error');
      },
    },
  ])('rejects invalid session sources without exposing application errors', (session) => {
    const adapter = { signIn: async () => ({ status: 'complete' }), session };
    expect(() =>
      createChatGPTAuth({ adapter: adapter as unknown as ChatGPTAuthSignInAdapter }),
    ).toThrow('adapter.session requires a getSession() method and an optional subscribe() method.');
  });
});

describe('session refresh after sign-in', () => {
  it('preserves synchronous sign-in and runs completion callbacks before reading the session', async () => {
    const f = setup(unauthenticated);
    const events: string[] = [];
    f.signIn.mockImplementation(() => {
      events.push('signIn');
      return Promise.resolve({ status: 'complete' });
    });
    f.getSession.mockImplementation(async () => {
      events.push('session');
      return authenticated;
    });
    f.client.updateSignIn({
      adapter: f.adapter,
      onInteractionChange(state) {
        events.push(state.status);
      },
      onSignInComplete() {
        events.push('callback');
      },
    });
    f.client.subscribeSession(vi.fn());
    await settle();
    events.length = 0;
    const button = document.createElement('button');
    const binding = f.client.bindSignInButton(button);
    button.addEventListener('click', binding.activate);
    button.click();
    expect(events).toEqual(['pending', 'signIn']);
    await settle();
    expect(events).toEqual(['pending', 'signIn', 'complete', 'callback', 'session']);
    expect(f.client.getSessionSnapshot().profile).toEqual(authenticated.profile);
  });

  it.each(['cancelled', 'redirecting'] as const)(
    'does not refresh for a %s outcome',
    async (status) => {
      const f = setup();
      f.signIn.mockResolvedValue({ status });
      f.client.subscribeSession(vi.fn());
      await settle();
      const button = document.createElement('button');
      const binding = f.client.bindSignInButton(button);
      button.addEventListener('click', binding.activate);
      button.click();
      await settle();
      expect(f.getSession).toHaveBeenCalledTimes(1);
    },
  );

  it('skips the queued refresh after the completion callback removes the last subscriber', async () => {
    const f = setup();
    const unsubscribe = f.client.subscribeSession(vi.fn());
    await settle();
    f.client.updateSignIn({ adapter: f.adapter, onSignInComplete: unsubscribe });
    const button = document.createElement('button');
    const binding = f.client.bindSignInButton(button);
    button.addEventListener('click', binding.activate);
    button.click();
    await settle();
    expect(f.getSession).toHaveBeenCalledTimes(1);
    expect(f.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('refreshes an accepted completion when its callback resets interaction state', async () => {
    const f = setup(unauthenticated);
    f.client.subscribeSession(vi.fn());
    await settle();
    f.client.updateSignIn({
      adapter: f.adapter,
      onSignInComplete() {
        f.getSession.mockResolvedValue(authenticated);
        f.client.recover();
      },
    });
    const button = document.createElement('button');
    const binding = f.client.bindSignInButton(button);
    button.addEventListener('click', binding.activate);
    button.click();
    await settle();
    expect(f.client.getSnapshot().state.status).toBe('idle');
    expect(f.getSession).toHaveBeenCalledTimes(2);
    expect(f.client.getSessionSnapshot().profile).toEqual(authenticated.profile);
  });
});
