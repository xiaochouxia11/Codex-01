import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatGPTAuthSignInAdapterResult } from '@openai/auth';
import { createChatGPTAuth, type ChatGPTAuthClient } from '@openai/auth/client';
import { ChatGPTAuthProvider, ChatGPTSignInButton } from '@openai/auth-react';

// Keep the consumer's selector literal so changes to the SDK cannot silently change this contract.
const selector = '[data-chatgpt-sign-in-button]';
const groups: ChatGPTAuthClient[] = [];

function discoverButtons(parent: ParentNode) {
  const matches = [...parent.querySelectorAll(selector)];
  for (const match of matches) {
    expect(match).toBeInstanceOf(HTMLButtonElement);
    expect(match.getAttribute('type')).toBe('button');
  }
  return matches as HTMLButtonElement[];
}

function pendingSignIn() {
  let resolve!: (result: ChatGPTAuthSignInAdapterResult) => void;
  const promise = new Promise<ChatGPTAuthSignInAdapterResult>((complete) => {
    resolve = complete;
  });
  const adapter = { signIn: vi.fn(() => promise) };
  return { adapter, resolve };
}

afterEach(async () => {
  cleanup();
  for (const group of groups.splice(0)) {
    await group.destroy();
  }
  document.body.replaceChildren();
});

describe('button discovery', () => {
  it('discovers DOM buttons across presentation updates and activates one shared attempt', async () => {
    const flow = pendingSignIn();
    const ui = createChatGPTAuth({ adapter: flow.adapter });
    groups.push(ui);
    const host = document.createElement('div');
    document.body.append(host);
    const view = ui.mountSignInButton(host, { locale: 'ja', className: 'account-entry' });
    ui.mountSignInButton(host, { text: 'brand', variant: 'contained' });

    const buttons = discoverButtons(host);
    expect(buttons).toHaveLength(2);
    const [first, second] = buttons as [HTMLButtonElement, HTMLButtonElement];
    expect(first.lang).toBe('ja-JP');
    expect(first.className).toBe('account-entry');
    expect(second.textContent).toBe('ChatGPT');
    expect(flow.adapter.signIn).not.toHaveBeenCalled();

    view.update({ locale: 'ar', className: 'updated-entry', variant: 'contained' });
    expect(discoverButtons(host)).toEqual(buttons);
    expect(first.lang).toBe('ar');
    first.click();
    expect(first.disabled).toBe(true);
    expect(second.disabled).toBe(true);
    expect(discoverButtons(host)).toEqual(buttons);
    second.click();
    expect(flow.adapter.signIn).toHaveBeenCalledTimes(1);

    flow.resolve({ status: 'cancelled' });
    await vi.waitFor(() => expect(buttons.every((button) => !button.disabled)).toBe(true));
    expect(discoverButtons(host)).toEqual(buttons);
  });

  it('discovers React buttons despite consumer marker overrides and presentation changes', async () => {
    const flow = pendingSignIn();
    const signIn = { adapter: flow.adapter };
    const tree = (updated: boolean) => (
      <ChatGPTAuthProvider options={signIn}>
        <ChatGPTSignInButton
          locale={updated ? 'ar' : 'ja'}
          className={updated ? 'updated-entry' : 'account-entry'}
          variant={updated ? 'contained' : 'outlined'}
          data-chatgpt-sign-in-button={null}
        />
        <ChatGPTSignInButton text="brand" data-chatgpt-sign-in-button={undefined} />
      </ChatGPTAuthProvider>
    );
    const { container, rerender } = render(tree(false));
    const buttons = discoverButtons(container);
    expect(buttons).toHaveLength(2);
    const [first, second] = buttons as [HTMLButtonElement, HTMLButtonElement];
    expect(first.lang).toBe('ja-JP');
    expect(first.className).toBe('account-entry');
    expect(second.textContent).toBe('ChatGPT');
    expect(flow.adapter.signIn).not.toHaveBeenCalled();

    rerender(tree(true));
    expect(discoverButtons(container)).toEqual(buttons);
    expect(first.lang).toBe('ar');
    act(() => first.click());
    expect(first.disabled).toBe(true);
    expect(second.disabled).toBe(true);
    expect(discoverButtons(container)).toEqual(buttons);
    act(() => second.click());
    expect(flow.adapter.signIn).toHaveBeenCalledTimes(1);

    await act(async () => flow.resolve({ status: 'cancelled' }));
    expect(buttons.every((button) => !button.disabled)).toBe(true);
    expect(discoverButtons(container)).toEqual(buttons);
  });

  it('discovers the same React button before and after hydration, with activation gated by readiness', async () => {
    const flow = pendingSignIn();
    const tree = (
      <ChatGPTAuthProvider options={{ adapter: flow.adapter }}>
        <ChatGPTSignInButton locale="ja" data-chatgpt-sign-in-button={null} />
      </ChatGPTAuthProvider>
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(tree);
    document.body.append(container);
    const buttons = discoverButtons(container);
    expect(buttons).toHaveLength(1);
    const button = buttons[0]!;
    expect(button.disabled).toBe(true);
    button.click();
    expect(flow.adapter.signIn).not.toHaveBeenCalled();

    const onRecoverableError = vi.fn();
    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, tree, { onRecoverableError });
      });
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(discoverButtons(container)).toHaveLength(1);
      expect(discoverButtons(container)[0]).toBe(button);
      expect(button.disabled).toBe(false);
      expect(flow.adapter.signIn).not.toHaveBeenCalled();
      act(() => button.click());
      expect(flow.adapter.signIn).toHaveBeenCalledTimes(1);
      expect(button.disabled).toBe(true);
      await act(async () => flow.resolve({ status: 'cancelled' }));
      expect(button.disabled).toBe(false);
    } finally {
      await act(async () => root?.unmount());
    }
  });
});
