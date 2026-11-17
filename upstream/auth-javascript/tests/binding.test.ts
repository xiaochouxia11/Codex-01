import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatGPTAuthSignInAdapterResult } from '@openai/auth';
import {
  createChatGPTAuth,
  getChatGPTSignInButtonModel,
  type ChatGPTAuthSignInButtonBindingOptions,
  type ChatGPTAuthClient,
} from '@openai/auth/client';

function deferred() {
  let resolve!: (value: ChatGPTAuthSignInAdapterResult) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<ChatGPTAuthSignInAdapterResult>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function ownedButton(group: ChatGPTAuthClient, options?: ChatGPTAuthSignInButtonBindingOptions) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'App-owned button';
  document.body.append(button);
  const binding = group.bindSignInButton(button, options);
  button.addEventListener('click', (event) => binding.activate(event));
  return { button, binding };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('caller-owned button bindings', () => {
  it('shares one lock between bound and DOM-mounted buttons and starts the adapter synchronously', async () => {
    const pending = deferred();
    const adapter = { signIn: vi.fn(() => pending.promise) };
    const onSignInComplete = vi.fn();
    const group = createChatGPTAuth({ adapter, onSignInComplete });
    const bound = ownedButton(group);
    const host = document.createElement('div');
    document.body.append(host);
    group.mountSignInButton(host);
    const native = host.querySelector('button')!;

    bound.button.click();
    expect(adapter.signIn).toHaveBeenCalledTimes(1);
    expect(group.getSnapshot().busy).toBe(true);
    expect(native.disabled).toBe(true);
    expect(bound.button.disabled).toBe(false);
    native.click();
    bound.button.click();
    expect(adapter.signIn).toHaveBeenCalledTimes(1);
    pending.resolve({ status: 'complete' });
    await settle();
    expect(onSignInComplete).toHaveBeenCalledExactlyOnceWith({ delivery: 'delegated' });
    expect(native.disabled).toBe(false);

    native.click();
    bound.button.click();
    expect(adapter.signIn).toHaveBeenCalledTimes(2);
    await settle();
    await group.destroy();
  });

  it('does not register events or mutate app-owned markup on bind, updates, pending, or destroy', async () => {
    const pending = deferred();
    const adapter = { signIn: vi.fn(() => pending.promise) };
    const group = createChatGPTAuth({ adapter });
    const button = document.createElement('button');
    button.innerHTML = '<span>Existing content</span>';
    button.className = 'existing-class';
    document.body.append(button);
    const original = button.outerHTML;
    const addEventListener = vi.spyOn(button, 'addEventListener');
    const binding = group.bindSignInButton(button, { disabled: true });
    expect(addEventListener).not.toHaveBeenCalled();
    expect(button.outerHTML).toBe(original);
    button.click();
    expect(adapter.signIn).not.toHaveBeenCalled();

    binding.update({ disabled: undefined });
    button.addEventListener('click', (event) => binding.activate(event));
    button.click();
    expect(adapter.signIn).toHaveBeenCalledTimes(1);
    expect(button.outerHTML).toBe(original);
    await binding.destroy();
    await group.destroy();
    expect(button.isConnected).toBe(true);
    expect(button.outerHTML).toBe(original);
    pending.resolve({ status: 'complete' });
    await settle();
  });

  it('accepts a descendant click delegated from an ancestor without requiring button currentTarget', async () => {
    const pending = deferred();
    const adapter = { signIn: vi.fn(() => pending.promise) };
    const group = createChatGPTAuth({ adapter });
    const button = document.createElement('button');
    const child = document.createElement('span');
    button.append(child);
    document.body.append(button);
    const binding = group.bindSignInButton(button);
    const listener = (event: MouseEvent) => {
      expect(event.currentTarget).toBe(document);
      binding.activate(event);
    };
    document.addEventListener('click', listener);
    try {
      child.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(adapter.signIn).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener('click', listener);
      await group.destroy();
    }
  });

  it('checks native preventDefault synchronously and blocks callback reentrancy before initiation', async () => {
    const pending = deferred();
    const adapter = { signIn: vi.fn(() => pending.promise) };
    const group = createChatGPTAuth({ adapter });
    const first = document.createElement('button');
    document.body.append(first);
    const binding = group.bindSignInButton(first);
    const second = ownedButton(group);
    const beforeSignIn = vi.fn((event: MouseEvent) => {
      expect(group.getSnapshot().busy).toBe(true);
      second.button.click();
      event.preventDefault();
    });
    first.addEventListener('click', (event) => binding.activate(event, () => beforeSignIn(event)));
    first.click();
    expect(beforeSignIn).toHaveBeenCalledTimes(1);
    expect(adapter.signIn).not.toHaveBeenCalled();
    expect(group.getSnapshot().busy).toBe(false);
    second.button.click();
    expect(adapter.signIn).toHaveBeenCalledTimes(1);
    await group.destroy();
  });

  it('abandons initiation if beforeSignIn detaches its binding, but leaves the group usable', async () => {
    const pending = deferred();
    const adapter = { signIn: vi.fn(() => pending.promise) };
    const group = createChatGPTAuth({ adapter });
    const button = document.createElement('button');
    document.body.append(button);
    const binding = group.bindSignInButton(button);
    button.addEventListener('click', (event) =>
      binding.activate(event, () => {
        void binding.destroy();
      }),
    );
    button.click();
    expect(adapter.signIn).not.toHaveBeenCalled();
    expect(group.getSnapshot().busy).toBe(false);
    const replacement = ownedButton(group);
    replacement.button.click();
    expect(adapter.signIn).toHaveBeenCalledTimes(1);
    await group.destroy();
  });

  it('preserves an already-started attempt after its binding detaches', async () => {
    const pending = deferred();
    const onSignInComplete = vi.fn();
    const group = createChatGPTAuth({
      adapter: { signIn: () => pending.promise },
      onSignInComplete,
    });
    const { button, binding } = ownedButton(group);
    button.click();
    await binding.destroy();
    button.remove();
    expect(group.getSnapshot().busy).toBe(true);
    pending.resolve({ status: 'complete' });
    await settle();
    expect(onSignInComplete).toHaveBeenCalledTimes(1);
    expect(group.getSnapshot().busy).toBe(false);
    await group.destroy();
  });

  it('retains the active configuration and applies updates to the next attempt', async () => {
    const first = deferred();
    const second = deferred();
    const firstComplete = vi.fn();
    const secondComplete = vi.fn();
    const nextAdapter = { signIn: vi.fn(() => second.promise) };
    const group = createChatGPTAuth({
      adapter: { signIn: () => first.promise },
      onSignInComplete: firstComplete,
    });
    const { button } = ownedButton(group);
    button.click();
    group.updateSignIn({ adapter: nextAdapter, onSignInComplete: secondComplete });
    first.resolve({ status: 'complete' });
    await settle();
    expect(firstComplete).toHaveBeenCalledTimes(1);
    expect(secondComplete).not.toHaveBeenCalled();
    button.click();
    expect(nextAdapter.signIn).toHaveBeenCalledTimes(1);
    second.resolve({ status: 'complete' });
    await settle();
    expect(secondComplete).toHaveBeenCalledTimes(1);
    await group.destroy();
  });

  it('patches disabled state and rejects invalid elements, options, and unrelated events', async () => {
    const adapter = { signIn: vi.fn(() => Promise.resolve({ status: 'complete' as const })) };
    const group = createChatGPTAuth({ adapter });
    expect(() =>
      group.bindSignInButton(document.createElement('div') as unknown as HTMLButtonElement),
    ).toThrow();
    expect(() => group.bindSignInButton({ nodeName: 'BUTTON' } as HTMLButtonElement)).toThrow();
    const { button, binding } = ownedButton(group, { disabled: true });
    binding.update({});
    button.click();
    expect(adapter.signIn).not.toHaveBeenCalled();
    expect(() =>
      binding.update({ disabled: 'no' } as unknown as ChatGPTAuthSignInButtonBindingOptions),
    ).toThrow();
    binding.update({ disabled: undefined });
    binding.activate(new MouseEvent('click'));
    const foreign = document.createElement('button');
    foreign.addEventListener('click', (event) => binding.activate(event));
    foreign.click();
    expect(adapter.signIn).not.toHaveBeenCalled();
    button.click();
    expect(adapter.signIn).toHaveBeenCalledTimes(1);
    await settle();
    await binding.destroy();
    expect(() => binding.update({})).toThrow();
    button.click();
    expect(adapter.signIn).toHaveBeenCalledTimes(1);
    await group.destroy();
  });
});

describe('group snapshots', () => {
  it('provides stable frozen snapshots and subscriptions for lock, cancellation, and failures', async () => {
    const cancelled = deferred();
    const failed = deferred();
    const adapter = {
      signIn: vi.fn().mockReturnValueOnce(cancelled.promise).mockReturnValueOnce(failed.promise),
    };
    const group = createChatGPTAuth({ adapter });
    const { button, binding } = ownedButton(group);
    const listener = vi.fn();
    const unsubscribe = group.subscribe(listener);
    const idle = group.getSnapshot();
    expect(Object.isFrozen(idle)).toBe(true);
    expect(group.getSnapshot()).toBe(idle);
    binding.update({ disabled: false });
    expect(group.getSnapshot()).toBe(idle);
    expect(listener).not.toHaveBeenCalled();
    button.click();
    const pending = group.getSnapshot();
    expect(pending.busy).toBe(true);
    expect(pending).not.toBe(idle);
    expect(group.getSnapshot()).toBe(pending);
    expect(listener).toHaveBeenCalledTimes(2);
    cancelled.resolve({ status: 'cancelled' });
    await settle();
    expect(group.getSnapshot().busy).toBe(false);
    expect(listener).toHaveBeenCalledTimes(4);
    button.click();
    failed.reject(new Error('private adapter detail'));
    await settle();
    expect(group.getSnapshot().busy).toBe(false);
    expect(listener).toHaveBeenCalledTimes(8);
    unsubscribe();
    unsubscribe();
    await group.destroy();
    expect(listener).toHaveBeenCalledTimes(8);
  });

  it('notifies recovery once on destroy, clears subscriptions, and suppresses late results', async () => {
    const pending = deferred();
    const onSignInComplete = vi.fn();
    const group = createChatGPTAuth({
      adapter: { signIn: () => pending.promise },
      onSignInComplete,
    });
    const { button } = ownedButton(group);
    const observed: boolean[] = [];
    group.subscribe(() => observed.push(group.getSnapshot().busy));
    button.click();
    await group.destroy();
    expect(observed).toEqual([true, true, false]);
    const retired = group.getSnapshot();
    pending.resolve({ status: 'complete' });
    await settle();
    await group.destroy();
    expect(group.getSnapshot()).toBe(retired);
    expect(observed).toEqual([true, true, false]);
    expect(onSignInComplete).not.toHaveBeenCalled();
    expect(button.isConnected).toBe(true);
  });

  it('contains subscriber failures and checks teardown before the adapter runs', async () => {
    const adapter = { signIn: vi.fn() };
    const group = createChatGPTAuth({ adapter });
    const { button } = ownedButton(group);
    group.subscribe(() => {
      throw new Error('consumer failure');
    });
    group.subscribe(() => {
      if (group.getSnapshot().busy) {
        void group.destroy();
      }
    });
    button.click();
    expect(adapter.signIn).not.toHaveBeenCalled();
    expect(group.getSnapshot().busy).toBe(false);
  });
});

describe('shared button visual model', () => {
  it('is browser-free, immutable, and preserves the fixed branding and state', () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('document', undefined);
    const model = getChatGPTSignInButtonModel(
      { appearance: 'auto', size: 'compact', width: 'full', text: 'sign-in' },
      { busy: true, dark: true },
    );
    expect(model.label).toBe('Sign in with ChatGPT');
    expect(model.disabled).toBe(true);
    expect(model.busy).toBe(true);
    expect(model.style.background).toBe('#171717');
    expect(model.style.width).toBe('100%');
    expect(model.mark.style).toEqual({ width: 18, height: 18, flexShrink: 0 });
    expect(model.mark.viewBox).toBe('0 0 21 21');
    expect(model.mark.path).toMatch(/^M/);
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.style)).toBe(true);
    expect(Object.isFrozen(model.mark.style)).toBe(true);
  });

  it('rejects auth, callback, and branding overrides, and invalid state', () => {
    for (const options of [
      { authPath: '/start' },
      { onClick: () => undefined },
      { label: 'Custom' },
      { appearance: 'rainbow' },
      { className: 'consumer-button' },
      { style: { padding: 12 } },
    ]) {
      expect(() => getChatGPTSignInButtonModel(options as never)).toThrow();
    }
    expect(() => getChatGPTSignInButtonModel({}, { busy: 'yes' } as never)).toThrow();
  });

  it('drives the native renderer with the same label, mark, sizing, and disabled state', async () => {
    const group = createChatGPTAuth({ adapter: { signIn: vi.fn() } });
    const options = {
      appearance: 'dark',
      text: 'sign-in',
      size: 'compact',
      disabled: true,
    } as const;
    const host = document.createElement('div');
    const view = group.mountSignInButton(host, options);
    const button = host.querySelector('button')!;
    const model = getChatGPTSignInButtonModel(options);
    expect(button.textContent).toBe(model.label);
    expect(button.disabled).toBe(model.disabled);
    expect(button.getAttribute('data-chatgpt-sign-in-button')).toBe('');
    expect(button.getAttribute('data-chatgpt-appearance')).toBe('dark');
    expect(button.getAttribute('data-chatgpt-size')).toBe('compact');
    expect(button.getAttribute('data-chatgpt-width')).toBe('content');
    expect(button.hasAttribute('style')).toBe(false);
    expect(button.querySelector('svg')?.hasAttribute('style')).toBe(false);
    expect(button.querySelector('svg')?.getAttribute('viewBox')).toBe(model.mark.viewBox);
    expect(button.querySelector('path')?.getAttribute('d')).toBe(model.mark.path);
    await view.destroy();
    await group.destroy();
  });
});
