import { StrictMode, Suspense, startTransition, useLayoutEffect, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ChatGPTAuthProfile,
  ChatGPTAuthSession,
  ChatGPTAuthSignInAdapterResult,
} from '@openai/auth';
import { createChatGPTAuth, type ChatGPTAuthClient } from '@openai/auth/client';
import {
  ChatGPTAuthProvider,
  ChatGPTSignInButton,
  useChatGPTProfile,
  useChatGPTSignInState,
  type ChatGPTAuthProviderProps,
} from '@openai/auth-react';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const clients: ChatGPTAuthClient[] = [];
function fixture(subject = 'alice') {
  const pending = deferred<ChatGPTAuthSignInAdapterResult>();
  const signIn = vi.fn(() => pending.promise);
  const getSession = vi.fn(async (): Promise<ChatGPTAuthSession> => ({
    status: 'authenticated',
    profile: { subject },
  }));
  const unsubscribe = vi.fn();
  const subscribe = vi.fn(() => unsubscribe);
  const options = {
    adapter: { signIn, session: { getSession, subscribe } },
    onSignInComplete: vi.fn(),
  };
  const client = createChatGPTAuth(options);
  clients.push(client);
  return { client, options, pending, signIn, getSession, subscribe, unsubscribe };
}

function Observer({
  id = 'observed',
  onCommit,
}: {
  id?: string;
  onCommit?: (profile: ChatGPTAuthProfile | null) => void;
}) {
  const profile = useChatGPTProfile();
  const state = useChatGPTSignInState();
  useLayoutEffect(() => {
    onCommit?.(profile);
  });
  return <output data-testid={id}>{JSON.stringify({ profile, state: state.status })}</output>;
}

async function flush() {
  await act(async () => {});
}

afterEach(async () => {
  cleanup();
  for (const client of clients.splice(0)) {
    await client.destroy();
  }
  document.body.replaceChildren();
});

describe('React client ownership', () => {
  it('shares the lock with a DOM view in both directions and preserves it after provider unmount', async () => {
    const f = fixture();
    const container = document.createElement('div');
    document.body.append(container);
    const dom = f.client.mountSignInButton(container);
    const domButton = container.querySelector('button')!;
    const destroy = vi.spyOn(f.client, 'destroy');
    const update = vi.spyOn(f.client, 'updateSignIn');
    const tree = (
      <StrictMode>
        <ChatGPTAuthProvider client={f.client}>
          <ChatGPTSignInButton data-testid="react-button" />
          <Observer />
        </ChatGPTAuthProvider>
      </StrictMode>
    );
    const first = render(tree);
    await flush();
    fireEvent.click(screen.getByTestId('react-button'));
    expect(domButton.disabled).toBe(true);
    fireEvent.click(domButton);
    expect(f.signIn).toHaveBeenCalledTimes(1);
    first.unmount();
    expect(f.client.getSnapshot().busy).toBe(true);
    expect(domButton.isConnected).toBe(true);
    expect(destroy).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    await act(async () => f.pending.resolve({ status: 'complete' }));
    expect(f.options.onSignInComplete).toHaveBeenCalledTimes(1);
    expect(domButton.disabled).toBe(false);

    const secondAttempt = deferred<ChatGPTAuthSignInAdapterResult>();
    f.signIn.mockReturnValueOnce(secondAttempt.promise);
    const second = render(tree);
    await flush();
    fireEvent.click(domButton);
    expect((screen.getByTestId('react-button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('observed').textContent).toContain('pending');
    fireEvent.click(screen.getByTestId('react-button'));
    expect(f.signIn).toHaveBeenCalledTimes(2);
    await act(async () => secondAttempt.resolve({ status: 'complete' }));
    expect(screen.getByTestId('observed').textContent).toContain('complete');
    expect(f.options.onSignInComplete).toHaveBeenCalledTimes(2);
    second.unmount();
    expect(destroy).not.toHaveBeenCalled();
    await dom.destroy();
  });

  it('shares one session observer between providers and preserves the remaining subscription', async () => {
    const f = fixture();
    const first = render(
      <ChatGPTAuthProvider client={f.client}>
        <Observer id="first" />
      </ChatGPTAuthProvider>,
    );
    const second = render(
      <ChatGPTAuthProvider client={f.client}>
        <Observer id="second" />
      </ChatGPTAuthProvider>,
    );
    await flush();
    expect(f.getSession).toHaveBeenCalledTimes(1);
    expect(f.subscribe).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('first').textContent).toContain('alice');
    expect(screen.getByTestId('second').textContent).toContain('alice');
    first.unmount();
    expect(f.unsubscribe).not.toHaveBeenCalled();
    expect(screen.getByTestId('second').textContent).toContain('alice');
    second.unmount();
    expect(f.unsubscribe).toHaveBeenCalledTimes(1);
    expect(() => f.client.bindSignInButton(document.createElement('button'))).not.toThrow();
  });

  it('switches clients without showing the previous profile or retiring its pending attempt', async () => {
    const first = fixture('alice');
    const second = fixture('bob');
    const seen: (ChatGPTAuthProfile | null)[] = [];
    const tree = (client: ChatGPTAuthClient) => (
      <ChatGPTAuthProvider client={client}>
        <ChatGPTSignInButton />
        <Observer onCommit={(profile) => seen.push(profile)} />
      </ChatGPTAuthProvider>
    );
    const { rerender } = render(tree(first.client));
    await flush();
    expect(seen.at(-1)).toEqual({ subject: 'alice' });
    fireEvent.click(screen.getByRole('button'));
    seen.length = 0;
    rerender(tree(second.client));
    expect(seen[0]).toBeNull();
    await flush();
    expect(seen.at(-1)).toEqual({ subject: 'bob' });
    expect(first.client.getSnapshot().busy).toBe(true);
    fireEvent.click(screen.getByRole('button'));
    expect(second.signIn).toHaveBeenCalledTimes(1);
    await act(async () => first.pending.resolve({ status: 'complete' }));
    expect(first.options.onSignInComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('observed').textContent).toContain('bob');
    expect(screen.getByTestId('observed').textContent).toContain('pending');
    await act(async () => second.pending.resolve({ status: 'complete' }));
  });

  it('uses a committed replacement client when a descendant layout effect clicks', async () => {
    const first = fixture();
    const second = fixture();
    function Click({ enabled }: { enabled: boolean }) {
      useLayoutEffect(() => {
        if (enabled) {
          screen.getByRole('button').click();
        }
      }, [enabled]);
      return null;
    }
    const tree = (updated: boolean) => (
      <ChatGPTAuthProvider client={updated ? second.client : first.client}>
        <ChatGPTSignInButton />
        <Click enabled={updated} />
      </ChatGPTAuthProvider>
    );
    const { rerender } = render(tree(false));
    rerender(tree(true));
    expect(first.signIn).not.toHaveBeenCalled();
    expect(second.signIn).toHaveBeenCalledTimes(1);
    await act(async () => second.pending.resolve({ status: 'complete' }));
  });

  it('does not subscribe to a suspended replacement or change the committed client', async () => {
    const first = fixture();
    const second = fixture('bob');
    const gate = deferred<void>();
    let waiting = true;
    const suspended = vi.fn();
    function Pause({ enabled }: { enabled: boolean }) {
      if (enabled && waiting) {
        suspended();
        throw gate.promise;
      }
      return null;
    }
    function App() {
      const [updated, setUpdated] = useState(false);
      return (
        <>
          <button onClick={() => startTransition(() => setUpdated(true))}>Switch client</button>
          <Suspense fallback={<p>Waiting</p>}>
            <ChatGPTAuthProvider client={updated ? second.client : first.client}>
              <ChatGPTSignInButton data-testid="sign-in" />
              <Observer />
              <Pause enabled={updated} />
            </ChatGPTAuthProvider>
          </Suspense>
        </>
      );
    }
    render(<App />);
    await flush();
    await act(async () => fireEvent.click(screen.getByText('Switch client')));
    expect(suspended).toHaveBeenCalled();
    expect(second.getSession).not.toHaveBeenCalled();
    expect(second.subscribe).not.toHaveBeenCalled();
    expect(first.unsubscribe).not.toHaveBeenCalled();
    expect(screen.getByTestId('observed').textContent).toContain('alice');
    fireEvent.click(screen.getByTestId('sign-in'));
    expect(first.signIn).toHaveBeenCalledTimes(1);
    expect(second.signIn).not.toHaveBeenCalled();
    await act(async () => {
      waiting = false;
      gate.resolve();
    });
    await flush();
    expect(screen.getByTestId('observed').textContent).toContain('bob');
    await act(async () => first.pending.resolve({ status: 'complete' }));
    expect(first.options.onSignInComplete).toHaveBeenCalledTimes(1);
  });

  it('destroys only the owned client when changing between options and client', async () => {
    const owned = fixture('owned');
    const injected = fixture('injected');
    const destroy = vi.spyOn(injected.client, 'destroy');
    const tree = (external: boolean) => (
      <ChatGPTAuthProvider
        {...(external ? { client: injected.client } : { options: owned.options })}
      >
        <ChatGPTSignInButton />
        <Observer />
      </ChatGPTAuthProvider>
    );
    const { rerender, unmount } = render(tree(false));
    fireEvent.click(screen.getByRole('button'));
    rerender(tree(true));
    await act(async () => owned.pending.resolve({ status: 'complete' }));
    expect(owned.options.onSignInComplete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button'));
    rerender(tree(false));
    await act(async () => injected.pending.resolve({ status: 'complete' }));
    expect(injected.options.onSignInComplete).toHaveBeenCalledTimes(1);
    unmount();
    expect(destroy).not.toHaveBeenCalled();
  });

  it('keeps injected clients inert during SSR and rejects conflicting ownership', async () => {
    const f = fixture();
    const html = renderToString(
      <ChatGPTAuthProvider client={f.client}>
        <ChatGPTSignInButton />
        <Observer />
      </ChatGPTAuthProvider>,
    );
    expect(html).toContain('disabled');
    expect(f.getSession).not.toHaveBeenCalled();
    expect(f.subscribe).not.toHaveBeenCalled();
    expect(f.signIn).not.toHaveBeenCalled();
    const both = { client: f.client, options: f.options } as unknown as ChatGPTAuthProviderProps;
    expect(() => renderToString(<ChatGPTAuthProvider {...both} />)).toThrowError(
      expect.objectContaining({ code: 'invalid_configuration', param: 'options' }),
    );
  });
});
