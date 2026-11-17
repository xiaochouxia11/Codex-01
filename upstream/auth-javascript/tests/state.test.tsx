import { StrictMode, useLayoutEffect } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatGPTAuthSignInAdapterResult } from '@openai/auth';
import { createChatGPTAuth } from '@openai/auth/client';
import {
  ChatGPTAuthProvider,
  ChatGPTSignInButton,
  useChatGPTSignInRecovery,
  useChatGPTSignInState,
} from '@openai/auth-react';

function deferred() {
  let resolve!: (result: ChatGPTAuthSignInAdapterResult) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<ChatGPTAuthSignInAdapterResult>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function mount(group: ReturnType<typeof createChatGPTAuth>) {
  const host = document.createElement('div');
  document.body.append(host);
  group.mountSignInButton(host);
  return host.querySelector('button')!;
}
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const tick = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('interaction snapshots and host recovery', () => {
  it('reports invalid browser elements without exposing accessor exceptions', async () => {
    const group = createChatGPTAuth({ authPath: '/auth/start' });
    const element = Object.defineProperty({}, 'ownerDocument', {
      get() {
        throw new Error('private browser detail');
      },
    });
    expect(() => group.mountSignInButton(element as HTMLElement)).toThrowError(
      expect.objectContaining({ code: 'invalid_presentation', param: 'container' }),
    );
    expect(() => group.bindSignInButton(element as HTMLButtonElement)).toThrowError(
      expect.objectContaining({ code: 'invalid_presentation', param: 'button' }),
    );
    await group.destroy();
  });
  it('exposes immutable current state to new readers and subscribers, including sanitized errors', async () => {
    const result = deferred();
    const group = createChatGPTAuth({ adapter: { signIn: () => result.promise } });
    const idle = group.getSnapshot();
    expect(idle.state.status).toBe('idle');
    expect(Object.isFrozen(idle)).toBe(true);
    expect(Object.isFrozen(idle.state)).toBe(true);
    expect(group.getSnapshot()).toBe(idle);
    const button = mount(group);
    button.click();
    expect(group.getSnapshot().state.status).toBe('pending');
    const seen: string[] = [];
    group.subscribe(() => seen.push(group.getSnapshot().state.status));
    result.reject(new Error('secret adapter message'));
    await tick();
    const snapshot = group.getSnapshot();
    expect(snapshot).toMatchObject({
      busy: false,
      state: { status: 'error', error: { code: 'adapter_failed' } },
    });
    if (snapshot.state.status !== 'error') {
      throw new Error('Expected error state');
    }
    expect(Object.isFrozen(snapshot.state.error)).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('secret');
    expect(seen).toContain('error');
    expect(group.getSnapshot()).toBe(snapshot);
    await group.destroy();
  });

  it('recovers redirecting without replacing views, subscribers, or the focused element', async () => {
    const group = createChatGPTAuth({
      adapter: { signIn: async () => ({ status: 'redirecting' }) },
    });
    const button = mount(group);
    const input = document.createElement('input');
    document.body.append(input);
    const changed = vi.fn();
    group.subscribe(changed);
    button.click();
    await tick();
    expect(group.getSnapshot()).toMatchObject({ busy: true, state: { status: 'redirecting' } });
    input.focus();
    group.recover();
    expect(group.getSnapshot()).toMatchObject({ busy: false, state: { status: 'idle' } });
    expect(document.activeElement).toBe(input);
    expect(button.isConnected).toBe(true);
    expect(button.disabled).toBe(false);
    const stable = group.getSnapshot();
    const notifications = changed.mock.calls.length;
    group.recover();
    expect(group.getSnapshot()).toBe(stable);
    expect(changed).toHaveBeenCalledTimes(notifications);
    button.click();
    await tick();
    expect(group.getSnapshot().state.status).toBe('redirecting');
    expect(changed.mock.calls.length).toBeGreaterThan(notifications);
    await group.destroy();
  });

  it('rejects ordinary pending recovery without retiring the active attempt', async () => {
    const result = deferred();
    const complete = vi.fn();
    const group = createChatGPTAuth({
      adapter: { signIn: () => result.promise },
      onSignInComplete: complete,
    });
    mount(group).click();
    const pending = group.getSnapshot();
    expect(() => group.recover()).toThrowError(
      expect.objectContaining({ code: 'interaction_pending', param: 'abandonPending' }),
    );
    expect(group.getSnapshot()).toBe(pending);
    result.resolve({ status: 'complete' });
    await tick();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(group.getSnapshot().state.status).toBe('complete');
    await group.destroy();
  });

  it('does not let a delayed host reconciliation retire a newer attempt', async () => {
    const result = deferred();
    const group = createChatGPTAuth({ adapter: { signIn: () => result.promise } });
    const expectedState = group.getSnapshot().state;
    mount(group).click();
    const pending = group.getSnapshot();
    expect(() => group.recover({ expectedState, abandonPending: true })).toThrowError(
      expect.objectContaining({ code: 'stale_recovery', param: 'expectedState' }),
    );
    expect(group.getSnapshot()).toBe(pending);
    result.resolve({ status: 'complete' });
    await tick();
    expect(group.getSnapshot().state.status).toBe('complete');
    await group.destroy();
  });

  it('keeps recovery idempotent when an idle subscriber requests recovery again', async () => {
    const onInteractionChange = vi.fn();
    const group = createChatGPTAuth({
      adapter: { signIn: async () => ({ status: 'redirecting' }) },
      onInteractionChange,
    });
    mount(group).click();
    await tick();
    group.subscribe(() => {
      if (group.getSnapshot().state.status === 'idle') {
        group.recover();
      }
    });
    group.recover();
    expect(onInteractionChange.mock.calls.map(([state]) => state.status)).toEqual([
      'pending',
      'redirecting',
      'idle',
    ]);
    await group.destroy();
  });

  it.each(['complete', 'reject'] as const)(
    'ignores an explicitly abandoned attempt settling with %s after a fresh attempt starts',
    async (outcome) => {
      const old = deferred();
      const fresh = deferred();
      const complete = vi.fn();
      const error = vi.fn();
      const signIn = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
      const group = createChatGPTAuth({
        adapter: { signIn },
        onSignInComplete: complete,
        onError: error,
      });
      const button = mount(group);
      button.click();
      group.recover({ abandonPending: true });
      button.click();
      const pending = group.getSnapshot();
      if (outcome === 'reject') {
        old.reject(new Error('old'));
      } else {
        old.resolve({ status: 'complete' });
      }
      await tick();
      expect(group.getSnapshot()).toBe(pending);
      expect(complete).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      fresh.resolve({ status: 'cancelled' });
      await tick();
      expect(group.getSnapshot().state.status).toBe('cancelled');
      await group.destroy();
    },
  );

  it('does not recover during the initial click lock and guards subscriber retirement before adapter invocation', async () => {
    const signIn = vi.fn(async () => ({ status: 'complete' as const }));
    const group = createChatGPTAuth({ adapter: { signIn } });
    const host = document.createElement('div');
    document.body.append(host);
    const click = vi.fn(() =>
      expect(() => group.recover({ abandonPending: true })).toThrowError(
        expect.objectContaining({ code: 'interaction_pending' }),
      ),
    );
    group.mountSignInButton(host, { onClick: click });
    group.subscribe(() => {
      if (group.getSnapshot().state.status === 'pending') {
        group.recover({ abandonPending: true });
      }
    });
    host.querySelector('button')!.click();
    expect(click).toHaveBeenCalledTimes(1);
    expect(signIn).not.toHaveBeenCalled();
    expect(group.getSnapshot().state.status).toBe('idle');
    await group.destroy();
    expect(() => group.recover()).toThrowError(
      expect.objectContaining({ code: 'group_destroyed' }),
    );
  });
});

function Status({ id = 'status' }: { id?: string }) {
  const state = useChatGPTSignInState();
  return (
    <output data-testid={id}>{state.status === 'error' ? state.error.code : state.status}</output>
  );
}
let recover: ReturnType<typeof useChatGPTSignInRecovery>;
function Recovery() {
  const current = useChatGPTSignInRecovery();
  useLayoutEffect(() => {
    recover = current;
  }, [current]);
  return <button onClick={() => current()}>Recover</button>;
}

describe('React read-only state and recovery hooks', () => {
  it('reads live and newly mounted status consumers and recovers in place under StrictMode', async () => {
    const pending = deferred();
    const adapter = { signIn: () => pending.promise };
    const tree = (late = false) => (
      <StrictMode>
        <ChatGPTAuthProvider options={{ adapter }}>
          <ChatGPTSignInButton />
          <Status />
          <Recovery />
          {late && <Status id="late" />}
        </ChatGPTAuthProvider>
      </StrictMode>
    );
    const { rerender } = render(tree());
    const button = screen.getByRole('button', { name: 'Continue with ChatGPT' });
    const recovery = recover;
    fireEvent.click(button);
    expect(screen.getByTestId('status').textContent).toBe('pending');
    await act(async () => pending.resolve({ status: 'redirecting' }));
    rerender(tree(true));
    expect(screen.getByTestId('late').textContent).toBe('redirecting');
    expect(recover).toBe(recovery);
    fireEvent.click(screen.getByRole('button', { name: 'Recover' }));
    expect(screen.getByTestId('status').textContent).toBe('idle');
    expect(screen.getByRole('button', { name: 'Continue with ChatGPT' })).toBe(button);
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('requires a provider for both hooks', () => {
    expect(() => render(<Status />)).toThrowError(
      expect.objectContaining({ code: 'missing_provider' }),
    );
    expect(() => render(<Recovery />)).toThrowError(
      expect.objectContaining({ code: 'missing_provider' }),
    );
  });

  it('hydrates idle state without reading application session state or initiating auth', async () => {
    const adapter = { signIn: vi.fn(async () => ({ status: 'complete' as const })) };
    const tree = (
      <ChatGPTAuthProvider options={{ adapter }}>
        <ChatGPTSignInButton />
        <Status />
      </ChatGPTAuthProvider>
    );
    const host = document.createElement('div');
    host.innerHTML = renderToString(tree);
    document.body.append(host);
    expect(host.querySelector('output')!.textContent).toBe('idle');
    const original = host.querySelector('button');
    const onRecoverableError = vi.fn();
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(host, tree, { onRecoverableError });
    });
    expect(host.querySelector('button')).toBe(original);
    expect(host.querySelector('output')!.textContent).toBe('idle');
    expect(adapter.signIn).not.toHaveBeenCalled();
    expect(onRecoverableError).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});
