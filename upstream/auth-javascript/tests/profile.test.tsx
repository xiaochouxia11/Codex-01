import { StrictMode, useLayoutEffect } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ChatGPTAuthProfile,
  ChatGPTAuthSession,
  ChatGPTAuthSessionSource,
  ChatGPTAuthSignInAdapter,
} from '@openai/auth';
import {
  ChatGPTAuthProvider,
  ChatGPTSignInButton,
  useChatGPTProfile,
  useChatGPTSignInState,
} from '@openai/auth-react';

const alice: ChatGPTAuthProfile = {
  subject: 'alice',
  name: 'Alice',
  picture: 'https://images.example.test/alice.png',
};
const signedIn: ChatGPTAuthSession = { status: 'authenticated', profile: alice };
const signedOut: ChatGPTAuthSession = { status: 'unauthenticated' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function setup(initial: ChatGPTAuthSession = signedOut) {
  let session = initial;
  const listeners = new Set<() => void>();
  const getSession = vi.fn<ChatGPTAuthSessionSource['getSession']>(async () => session);
  const unsubscribe = vi.fn();
  const source: ChatGPTAuthSessionSource = {
    getSession,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        unsubscribe();
      };
    },
  };
  const signIn = vi.fn<ChatGPTAuthSignInAdapter['signIn']>(async () => ({ status: 'complete' }));
  return {
    source,
    signIn,
    getSession,
    unsubscribe,
    listeners,
    adapter: { session: source, signIn },
    setSession(value: ChatGPTAuthSession) {
      session = value;
    },
    notify() {
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

function Profile({ onCommit }: { onCommit?: (profile: ChatGPTAuthProfile | null) => void }) {
  const profile = useChatGPTProfile();
  const state = useChatGPTSignInState();
  useLayoutEffect(() => {
    onCommit?.(profile);
  });
  return (
    <>
      <output data-testid="profile">{JSON.stringify(profile)}</output>
      <output data-testid="interaction">{state.status}</output>
    </>
  );
}

async function flush() {
  await act(async () => {});
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('automatic adapter profiles', () => {
  it('keeps the current profile during background revalidation and applies the authoritative result', async () => {
    const f = setup(signedIn);
    const waiting = deferred<ChatGPTAuthSession>();
    render(
      <ChatGPTAuthProvider options={{ adapter: f.adapter }}>
        <Profile />
      </ChatGPTAuthProvider>,
    );
    await flush();
    f.getSession.mockReturnValueOnce(waiting.promise);
    fireEvent(window, new Event('focus'));
    expect(screen.getByTestId('profile').textContent).toBe(JSON.stringify(alice));
    await act(async () => waiting.resolve(signedOut));
    expect(screen.getByTestId('profile').textContent).toBe('null');
  });

  it('retires reads before abort handlers can reenter a failed subscription', async () => {
    let notify: () => void = () => {};
    const getSession = vi.fn<ChatGPTAuthSessionSource['getSession']>(({ signal }) => {
      signal.addEventListener('abort', () => notify());
      return new Promise(() => {});
    });
    const session: ChatGPTAuthSessionSource = {
      getSession,
      subscribe(listener) {
        notify = listener;
        notify();
        throw new Error('private subscription failure');
      },
    };
    render(
      <ChatGPTAuthProvider
        options={{ adapter: { signIn: async () => ({ status: 'complete' }), session } }}
      >
        <Profile />
      </ChatGPTAuthProvider>,
    );
    await flush();
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(getSession.mock.calls[0]![0].signal.aborted).toBe(true);
    act(() => notify());
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('profile').textContent).toBe('null');
  });

  it('restores an existing session on mount and shares one sanitized, readonly profile', async () => {
    const f = setup({
      status: 'authenticated',
      profile: { ...alice, access_token: 'private' },
    } as ChatGPTAuthSession);
    const profiles: (ChatGPTAuthProfile | null)[] = [];
    render(
      <ChatGPTAuthProvider options={{ adapter: f.adapter }}>
        <Profile onCommit={(profile) => profiles.push(profile)} />
        <Profile />
      </ChatGPTAuthProvider>,
    );
    expect(screen.getAllByTestId('profile')[0]!.textContent).toBe('null');
    await flush();
    expect(f.getSession).toHaveBeenCalledTimes(1);
    expect(f.signIn).not.toHaveBeenCalled();
    expect(profiles.at(-1)).toEqual(alice);
    expect(Object.isFrozen(profiles.at(-1))).toBe(true);
    expect(screen.getAllByTestId('interaction')[0]!.textContent).toBe('idle');
  });

  it('refreshes after successful sign-in without replacing the consumer completion callback', async () => {
    const f = setup();
    const onComplete = vi.fn();
    render(
      <ChatGPTAuthProvider options={{ adapter: f.adapter, onSignInComplete: onComplete }}>
        <Profile />
        <ChatGPTSignInButton />
      </ChatGPTAuthProvider>,
    );
    await flush();
    f.setSession(signedIn);
    fireEvent.click(screen.getByRole('button'));
    await flush();
    expect(onComplete).toHaveBeenCalledExactlyOnceWith({ delivery: 'delegated' });
    expect(f.getSession).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('profile').textContent).toBe(JSON.stringify(alice));
    expect(screen.getByTestId('interaction').textContent).toBe('complete');
  });

  it('does not treat cancellation as a changed session', async () => {
    const f = setup(signedIn);
    f.signIn.mockResolvedValue({ status: 'cancelled' });
    render(
      <ChatGPTAuthProvider options={{ adapter: f.adapter }}>
        <Profile />
        <ChatGPTSignInButton />
      </ChatGPTAuthProvider>,
    );
    await flush();
    fireEvent.click(screen.getByRole('button'));
    await flush();
    expect(f.getSession).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('profile').textContent).toBe(JSON.stringify(alice));
  });

  it('clears on invalidation and ignores an older read after sign-out', async () => {
    const f = setup(signedIn);
    render(
      <ChatGPTAuthProvider options={{ adapter: f.adapter }}>
        <Profile />
      </ChatGPTAuthProvider>,
    );
    await flush();
    const old = deferred<ChatGPTAuthSession>();
    f.getSession.mockReturnValueOnce(old.promise);
    act(() => f.notify());
    expect(screen.getByTestId('profile').textContent).toBe('null');
    const oldSignal = f.getSession.mock.calls.at(-1)![0].signal;
    f.setSession(signedOut);
    act(() => f.notify());
    await flush();
    expect(oldSignal.aborted).toBe(true);
    await act(async () => old.resolve(signedIn));
    expect(screen.getByTestId('profile').textContent).toBe('null');
  });

  it('hides the previous source before descendant layout effects and rejects its late result', async () => {
    const first = setup(signedIn);
    const second = setup({ status: 'authenticated', profile: { subject: 'bob' } });
    const late = deferred<ChatGPTAuthSession>();
    const seen: (ChatGPTAuthProfile | null)[] = [];
    const tree = (adapter: ChatGPTAuthSignInAdapter) => (
      <ChatGPTAuthProvider options={{ adapter }}>
        <Profile onCommit={(profile) => seen.push(profile)} />
      </ChatGPTAuthProvider>
    );
    const { rerender } = render(tree(first.adapter));
    await flush();
    first.getSession.mockReturnValueOnce(late.promise);
    act(() => first.notify());
    seen.length = 0;
    rerender(tree(second.adapter));
    expect(seen[0]).toBeNull();
    await flush();
    await act(async () => late.resolve(signedIn));
    expect(first.unsubscribe).toHaveBeenCalledOnce();
    expect(screen.getByTestId('profile').textContent).toBe('{"subject":"bob"}');
  });

  it('retires subscriptions and pending reads through StrictMode and unmount', async () => {
    const f = setup();
    const first = deferred<ChatGPTAuthSession>();
    const second = deferred<ChatGPTAuthSession>();
    f.getSession.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { unmount } = render(
      <StrictMode>
        <ChatGPTAuthProvider options={{ adapter: f.adapter }}>
          <Profile />
        </ChatGPTAuthProvider>
      </StrictMode>,
    );
    expect(f.getSession).toHaveBeenCalledTimes(2);
    expect(f.getSession.mock.calls[0]![0].signal.aborted).toBe(true);
    await act(async () => first.resolve(signedIn));
    expect(screen.getByTestId('profile').textContent).toBe('null');
    const signal = f.getSession.mock.calls[1]![0].signal;
    unmount();
    expect(signal.aborted).toBe(true);
    expect(f.listeners.size).toBe(0);
    expect(f.unsubscribe).toHaveBeenCalledTimes(2);
    await act(async () => second.resolve(signedIn));
  });

  it('isolates separate providers and preserves the session method receiver', async () => {
    const f = setup(signedIn);
    f.getSession.mockImplementation(async function (this: unknown) {
      expect(this).toBe(f.source);
      return signedIn;
    });
    const other = setup();
    render(
      <>
        <ChatGPTAuthProvider options={{ adapter: f.adapter }}>
          <Profile />
        </ChatGPTAuthProvider>
        <ChatGPTAuthProvider options={{ adapter: other.adapter }}>
          <Profile />
        </ChatGPTAuthProvider>
      </>,
    );
    await flush();
    expect(screen.getAllByTestId('profile').map((node) => node.textContent)).toEqual([
      JSON.stringify(alice),
      'null',
    ]);
    act(() => other.notify());
    await flush();
    expect(f.getSession).toHaveBeenCalledTimes(1);
  });

  it('revalidates on focus and bfcache restoration', async () => {
    const f = setup(signedIn);
    render(
      <ChatGPTAuthProvider options={{ adapter: f.adapter }}>
        <Profile />
      </ChatGPTAuthProvider>,
    );
    await flush();
    f.setSession(signedOut);
    fireEvent(window, new Event('focus'));
    await flush();
    expect(screen.getByTestId('profile').textContent).toBe('null');
    f.setSession(signedIn);
    fireEvent(window, new PageTransitionEvent('pageshow', { persisted: true }));
    await flush();
    expect(screen.getByTestId('profile').textContent).toBe(JSON.stringify(alice));
    expect(f.getSession).toHaveBeenCalledTimes(3);
  });

  it('treats missing picture as a valid profile and a missing linked profile as a valid session', async () => {
    const f = setup({ status: 'authenticated', profile: { subject: 'alice' } });
    render(
      <ChatGPTAuthProvider options={{ adapter: f.adapter }}>
        <Profile />
      </ChatGPTAuthProvider>,
    );
    await flush();
    expect(screen.getByTestId('profile').textContent).toBe('{"subject":"alice"}');
    f.setSession({ status: 'authenticated', profile: null });
    act(() => f.notify());
    await flush();
    expect(screen.getByTestId('profile').textContent).toBe('null');
  });

  it('loads nothing for existing adapters without a session capability', async () => {
    const f = setup();
    render(
      <ChatGPTAuthProvider options={{ adapter: { signIn: f.signIn } }}>
        <Profile />
      </ChatGPTAuthProvider>,
    );
    await flush();
    expect(screen.getByTestId('profile').textContent).toBe('null');
    expect(f.getSession).not.toHaveBeenCalled();
  });

  it('requires a provider and rejects malformed session sources with safe errors', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Profile />)).toThrow(
      'useChatGPTProfile must be used within ChatGPTAuthProvider.',
    );
    const adapter = {
      signIn: async () => ({ status: 'complete' }),
      session: { getSession: 3 },
    } as unknown as ChatGPTAuthSignInAdapter;
    expect(() =>
      render(
        <ChatGPTAuthProvider options={{ adapter }}>
          <Profile />
        </ChatGPTAuthProvider>,
      ),
    ).toThrow('adapter.session requires a getSession() method');
  });
});

describe('profile session recovery', () => {
  it.each(['reject', 'throw', 'bad-result'] as const)(
    'clears the profile when session reads %s and recovers on a later notification',
    async (failure) => {
      const f = setup(signedIn);
      render(
        <ChatGPTAuthProvider options={{ adapter: f.adapter }}>
          <Profile />
        </ChatGPTAuthProvider>,
      );
      await flush();
      if (failure === 'reject') {
        f.getSession.mockRejectedValue(new Error('private-token-error'));
      }
      if (failure === 'throw') {
        f.getSession.mockImplementation(() => {
          throw new Error('private-token-error');
        });
      }
      if (failure === 'bad-result') {
        f.getSession.mockResolvedValue({ status: 'authenticated' } as ChatGPTAuthSession);
      }
      act(() => f.notify());
      await flush();
      expect(screen.getByTestId('profile').textContent).toBe('null');
      expect(document.body.textContent).not.toContain('private-token-error');
      expect(f.getSession).toHaveBeenCalledTimes(2);
      expect(f.signIn).not.toHaveBeenCalled();
      f.getSession.mockResolvedValue(signedIn);
      act(() => f.notify());
      await flush();
      expect(screen.getByTestId('profile').textContent).toBe(JSON.stringify(alice));
      expect(f.getSession).toHaveBeenCalledTimes(3);
      expect(f.signIn).not.toHaveBeenCalled();
    },
  );
});
