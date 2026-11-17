import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ChatGPTAuthError,
  type ChatGPTAuthSignInAdapterResult,
  type ChatGPTAuthSignInConfiguration,
} from '../packages/core/src/index.js';
import {
  createChatGPTAuth,
  getChatGPTSignInButtonModel,
  type ChatGPTAuthClient,
  type ChatGPTAuthSignInButtonPresentation,
  type ChatGPTAuthSignInButtonStyle,
} from '../packages/core/src/client/index.js';
import { styleValue } from '../packages/core/src/client/renderButton.utils.js';
import { arabicButtonMessages, japaneseButtonMessages } from './localization-catalog.utils.js';

const groups: ChatGPTAuthClient[] = [];
function group(config: ChatGPTAuthSignInConfiguration) {
  const result = createChatGPTAuth(config);
  groups.push(result);
  return result;
}
function container() {
  const element = document.createElement('div');
  document.body.append(element);
  return element;
}
function button(parent: HTMLElement) {
  return parent.querySelector('button')!;
}
function deferred() {
  let resolve!: (result: ChatGPTAuthSignInAdapterResult) => void;
  const promise = new Promise<ChatGPTAuthSignInAdapterResult>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
const complete = () => Promise.resolve({ status: 'complete' } as const);
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('consumer button styling', () => {
  it('accepts layout styles and rejects branding and custom-variable properties', () => {
    const valid: ChatGPTAuthSignInButtonStyle = { marginTop: 4, width: '100%' };
    const invalidCSS: ChatGPTAuthSignInButtonStyle = {
      // @ts-expect-error CSS property values cannot be objects.
      marginTop: {},
    };
    const invalidVariable: ChatGPTAuthSignInButtonStyle = {
      // @ts-expect-error Custom properties are outside the layout allowlist.
      '--accent': false,
    };
    const ui = group({ adapter: { signIn: complete } });
    const host = container();
    ui.mountSignInButton(host, { style: valid });
    expect(button(host).style.marginTop).toBe('4px');
    for (const style of [invalidCSS, invalidVariable]) {
      expect(() => ui.mountSignInButton(host, { style })).toThrow(ChatGPTAuthError);
    }
  });

  it('automatically installs one shared document stylesheet before consumer styles and keeps it on teardown', async () => {
    const document = window.document.implementation.createHTMLDocument('styles');
    const existing = document.createElement('style');
    existing.textContent = '.consumer { color: red; }';
    document.head.append(existing);
    const host = document.createElement('div');
    // Use the live document for valid browser element bindings; install the helper directly in this isolated document.
    const { ensureButtonStyles } =
      await import('../packages/core/src/client/renderButton.utils.js');
    ensureButtonStyles(host);
    ensureButtonStyles(host);
    const styles = document.querySelectorAll('style[data-href~="openai-auth-button-v3"]');
    expect(styles).toHaveLength(1);
    expect(document.head.firstElementChild).toBe(styles[0]);
    expect(styles[0]!.getAttribute('data-precedence')).toBe('openai-auth');
    expect(styles[0]!.textContent).toContain('data-chatgpt-sign-in-button');
    const ui = group({ adapter: { signIn: complete } });
    const parent = container();
    const view = ui.mountSignInButton(parent);
    const installed = window.document.querySelector('style[data-href~="openai-auth-button-v3"]');
    expect(installed).not.toBeNull();
    await view.destroy();
    expect(window.document.querySelector('style[data-href~="openai-auth-button-v3"]')).toBe(
      installed,
    );
  });

  it.each(['document', 'shadow'] as const)(
    'does not reuse component-owned SSR styles in a %s subtree',
    async (kind) => {
      const isolated = document.implementation.createHTMLDocument('style ownership');
      const shadowHost = isolated.createElement('div');
      isolated.body.append(shadowHost);
      const tree = kind === 'shadow' ? shadowHost.attachShadow({ mode: 'open' }) : isolated.body;
      const resourceHost = kind === 'shadow' ? tree : isolated.head;
      const reactRoot = isolated.createElement('div');
      const ephemeral = isolated.createElement('style');
      ephemeral.setAttribute('data-href', 'openai-auth-button-v3');
      ephemeral.textContent = '/* Component-owned server output. */';
      reactRoot.append(ephemeral);
      const domHost = isolated.createElement('div');
      tree.append(reactRoot, domHost);
      const { ensureButtonStyles } =
        await import('../packages/core/src/client/renderButton.utils.js');
      ensureButtonStyles(domHost);
      ensureButtonStyles(domHost);
      const persistent = resourceHost.firstElementChild;
      expect(persistent?.tagName).toBe('STYLE');
      expect(persistent).not.toBe(ephemeral);
      expect(persistent?.getAttribute('data-href')).toBe('openai-auth-button-v3');
      expect(persistent?.textContent).toContain('data-chatgpt-sign-in-button');
      expect(
        Array.from(resourceHost.children).filter((child) =>
          child.matches('style[data-href="openai-auth-button-v3"]'),
        ),
      ).toHaveLength(1);
      reactRoot.remove();
      expect(resourceHost.firstElementChild).toBe(persistent);
    },
  );

  it('recognizes React resource markers and installs defaults when a view moves to another shadow root', () => {
    const host = container();
    const shadow = host.attachShadow({ mode: 'open' });
    const resource = document.createElement('style');
    resource.setAttribute('data-href', 'other-resource openai-auth-button-v3');
    shadow.append(resource);
    const parent = document.createElement('div');
    shadow.append(parent);
    const ui = group({ adapter: { signIn: complete } });
    const view = ui.mountSignInButton(parent);
    expect(shadow.querySelectorAll('style')).toHaveLength(1);
    const destination = container().attachShadow({ mode: 'open' });
    destination.append(button(parent));
    view.update({ className: 'moved' });
    expect(destination.querySelectorAll('style[data-href~="openai-auth-button-v3"]')).toHaveLength(
      1,
    );
    expect(destination.firstElementChild?.tagName).toBe('STYLE');
    expect(destination.querySelector('button')?.className).toBe('moved');
  });

  it('emits stable CSS markers and leaves default root and mark styles to the stylesheet', () => {
    const host = container();
    const ui = group({ adapter: { signIn: complete } });
    const view = ui.mountSignInButton(host);
    const control = button(host);
    expect(control.getAttribute('data-chatgpt-sign-in-button')).toBe('');
    expect(control.getAttribute('data-chatgpt-appearance')).toBe('auto');
    expect(control.getAttribute('data-chatgpt-size')).toBe('standard');
    expect(control.getAttribute('data-chatgpt-width')).toBe('content');
    expect(control.hasAttribute('style')).toBe(false);
    expect(control.querySelector('svg')!.hasAttribute('style')).toBe(false);
    expect(control.querySelector('path')!.getAttribute('fill')).toBe('currentColor');
    view.update({ appearance: 'dark', size: 'compact', width: 'full' });
    expect(button(host)).toBe(control);
    expect(control.getAttribute('data-chatgpt-appearance')).toBe('dark');
    expect(control.getAttribute('data-chatgpt-size')).toBe('compact');
    expect(control.getAttribute('data-chatgpt-width')).toBe('full');
    expect(control.hasAttribute('style')).toBe(false);
  });

  it('applies layout lengths and unitless placement values without changing authentication', async () => {
    const result = deferred();
    const signIn = vi.fn(() => result.promise);
    const host = container();
    const ui = group({ adapter: { signIn } });
    ui.mountSignInButton(host, {
      className: 'consumer primary',
      style: {
        width: 250,
        marginTop: -2.5,
        marginInline: 0,
        flexGrow: 2,
        order: 1,
      },
    });
    const control = button(host);
    expect(control.className).toBe('consumer primary');
    expect(control.style.width).toBe('250px');
    expect(control.style.marginTop).toBe('-2.5px');
    expect(control.style.marginInline).toBe('0px');
    expect(control.style.flexGrow).toBe('2');
    expect(control.style.order).toBe('1');
    control.click();
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(control.disabled).toBe(true);
    expect(control.getAttribute('aria-busy')).toBe('true');
    expect(control.style.width).toBe('250px');
    result.resolve({ status: 'complete' });
    await settle();
    expect(control.disabled).toBe(false);
    expect(control.style.width).toBe('250px');
  });

  it.each([
    ['flexGrow', 2, '2'],
    ['flexShrink', 1, '1'],
    ['order', 3, '3'],
    ['marginTop', 0, '0'],
    ['marginInline', 12, '12px'],
    ['width', '  80%  ', '80%'],
  ] as const)('converts %s using React-compatible numeric units', (property, value, expected) => {
    expect(styleValue(property, value)).toBe(expected);
  });

  it('snapshots styles, retains omitted fields, replaces supplied objects, and clears explicit undefined', () => {
    const host = container();
    const ui = group({ adapter: { signIn: complete } });
    const style = { width: '250px', marginTop: 8, flexGrow: 1 };
    const view = ui.mountSignInButton(host, { className: 'initial', style });
    const control = button(host);
    control.focus();
    style.width = '300px';
    style.marginTop = 100;
    style.flexGrow = 2;
    view.update({ text: 'sign-in' });
    expect(control.className).toBe('initial');
    expect(control.style.width).toBe('250px');
    expect(control.style.marginTop).toBe('8px');
    expect(control.style.flexGrow).toBe('1');
    view.update({ className: 'replacement', style: { marginInline: 3, width: undefined } });
    expect(control.className).toBe('replacement');
    expect(control.style.marginInline).toBe('3px');
    expect(control.style.width).toBe('');
    expect(control.style.marginTop).toBe('');
    expect(control.style.flexGrow).toBe('');
    view.update({ className: undefined, style: undefined });
    expect(control.hasAttribute('class')).toBe(false);
    expect(control.hasAttribute('style')).toBe(false);
    expect(document.activeElement).toBe(control);
    expect(button(host)).toBe(control);
  });

  it('accepts an empty class and a null-prototype style object', () => {
    const style = Object.assign(Object.create(null), { marginInlineStart: 4 });
    const host = container();
    group({ adapter: { signIn: complete } }).mountSignInButton(host, { className: '', style });
    expect(button(host).getAttribute('class')).toBe('');
    expect(button(host).style.marginInlineStart).toBe('4px');
  });

  it.each([
    null,
    [],
    1,
    new Date(),
    { marginTop: NaN },
    { width: Infinity },
    { marginTop: true },
    { marginTop: {} },
    { marginTop: () => 'red' },
    { color: 'red' },
    { background: 'red' },
    { backgroundColor: 'red' },
    { font: 'italic 14px serif' },
    { fontFamily: 'serif' },
    { fontSize: 40 },
    { fontWeight: 900 },
    { fill: 'red' },
    { stroke: 'red' },
    { filter: 'hue-rotate(90deg)' },
    { borderRadius: 99 },
    { padding: 0 },
    { '--accent': 'red' },
    { '--chatgpt-button-side-size': '50px' },
    { color: undefined },
    { opacity: Infinity },
    { color: true },
    { color: {} },
    { color: () => 'red' },
    { hasOwnProperty: 'red' },
    { setProperty: 'red' },
    { cssText: 'color: red' },
    { length: 2 },
    { 'background-color': 'red' },
    { '--': 'red' },
    { [Symbol('private-css-secret')]: 'red' },
    {
      get color() {
        throw new Error('private-css-secret');
      },
    },
    new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('private-css-secret');
        },
      },
    ),
  ])('rejects invalid style %# atomically with redacted errors', (style) => {
    const host = container();
    const ui = group({ adapter: { signIn: complete } });
    const view = ui.mountSignInButton(host, { className: 'original', style: { marginTop: 8 } });
    const before = button(host).outerHTML;
    let failure: unknown;
    try {
      view.update({ disabled: true, className: 'changed', style } as never);
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ code: 'invalid_presentation', param: 'style' });
    expect(String(failure)).not.toContain('private-css-secret');
    expect(button(host).outerHTML).toBe(before);
  });
});

afterEach(async () => {
  await Promise.all(groups.splice(0).map((entry) => entry.destroy()));
  document.body.replaceChildren();
  document.head.querySelector('base')?.remove();
});

describe('group attempts', () => {
  it('classifies malformed conventional outcomes', async () => {
    for (const outcome of [
      undefined,
      { status: 'complete', token: 'credential-secret' },
      Object.create({ status: 'complete' }),
    ]) {
      const adapter = { signIn: async () => outcome };
      const errors: unknown[] = [];
      const states: string[] = [];
      let delivered!: () => void;
      const done = new Promise<void>((resolve) => {
        delivered = resolve;
      });
      const ui = group({
        adapter,
        onInteractionChange: (state) => states.push(state.status),
        onError(error) {
          errors.push(error);
          delivered();
        },
      });
      const parent = container();
      ui.mountSignInButton(parent);
      button(parent).click();
      await done;
      expect(errors).toEqual([
        {
          code: 'adapter_invalid_result',
          message: 'The sign-in adapter returned an invalid result.',
          retryable: true,
        },
      ]);
      expect(states).toEqual(['pending', 'error']);
      expect(button(parent).disabled).toBe(false);
      expect(JSON.stringify([errors, ui.getSnapshot()])).not.toContain('credential-secret');
    }
  });

  it('does not trust thrown public error codes', async () => {
    const codeGetter = vi.fn(() => {
      throw new Error('credential-secret');
    });
    for (const error of [
      new ChatGPTAuthError({
        code: 'adapter_invalid_result',
        message: 'credential-secret',
        retryable: false,
        requestId: 'credential-secret',
      }),
      { code: 'adapter_invalid_result', message: 'credential-secret' },
      new ChatGPTAuthError({
        code: 'navigation_failed',
        message: 'credential-secret',
        retryable: false,
      }),
      { code: 'navigation_failed', message: 'credential-secret' },
      Object.create({ code: 'navigation_failed', message: 'credential-secret' }),
      Object.defineProperty({}, 'code', { get: codeGetter }),
      'adapter_invalid_result',
      'navigation_failed',
    ]) {
      for (const synchronous of [true, false]) {
        const adapter = {
          signIn: () => {
            if (synchronous) {
              throw error;
            }
            return Promise.reject(error);
          },
        };
        let received: unknown;
        let delivered!: () => void;
        const done = new Promise<void>((resolve) => {
          delivered = resolve;
        });
        const ui = group({
          adapter,
          onError(error) {
            received = error;
            delivered();
          },
        });
        const parent = container();
        ui.mountSignInButton(parent);
        button(parent).click();
        await done;
        expect(received).toEqual({
          code: 'adapter_failed',
          message: 'Sign-in could not be started or completed.',
          retryable: true,
        });
        expect(JSON.stringify([received, ui.getSnapshot()])).not.toContain('credential-secret');
      }
    }
    expect(codeGetter).not.toHaveBeenCalled();
  });

  it('calls the adapter in the click stack and locks before reentrant onClick code', async () => {
    const pending = deferred();
    const order: string[] = [];
    const signIn = vi.fn(() => {
      order.push('adapter');
      return pending.promise;
    });
    const ui = group({ adapter: { signIn } });
    const first = container();
    const second = container();
    ui.mountSignInButton(second);
    ui.mountSignInButton(first, {
      onClick() {
        order.push('click');
        button(second).dispatchEvent(new MouseEvent('click', { cancelable: true }));
      },
    });
    button(first).click();
    order.push('returned');
    expect(order).toEqual(['click', 'adapter', 'returned']);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(button(first).disabled).toBe(true);
    expect(button(second).getAttribute('aria-busy')).toBe('true');
    pending.resolve({ status: 'complete' });
    await settle();
    expect(button(second).disabled).toBe(false);
  });

  it('honors preventDefault and acquires the final binding after onClick', () => {
    const oldSignIn = vi.fn(complete);
    const newSignIn = vi.fn(complete);
    const ui = group({ adapter: { signIn: oldSignIn } });
    const parent = container();
    const view = ui.mountSignInButton(parent, { onClick: (event) => event.preventDefault() });
    button(parent).click();
    expect(oldSignIn).not.toHaveBeenCalled();
    expect(button(parent).disabled).toBe(false);
    view.update({ onClick: () => ui.updateSignIn({ adapter: { signIn: newSignIn } }) });
    button(parent).click();
    expect(newSignIn).toHaveBeenCalledTimes(1);
    expect(oldSignIn).not.toHaveBeenCalled();
  });

  it.each(['complete', 'cancelled', 'redirecting'] as const)(
    'handles explicit %s outcomes',
    async (status) => {
      const completed = vi.fn();
      const cancelled = vi.fn();
      const changed = vi.fn();
      const parent = container();
      const ui = group({
        adapter: { signIn: async () => ({ status }) },
        onSignInComplete: completed,
        onCancel: cancelled,
        onInteractionChange: changed,
      });
      ui.mountSignInButton(parent);
      button(parent).click();
      await settle();
      expect(changed.mock.calls.map(([state]) => state.status)).toEqual(['pending', status]);
      expect(completed).toHaveBeenCalledTimes(status === 'complete' ? 1 : 0);
      if (status === 'complete') {
        expect(completed).toHaveBeenCalledWith({ delivery: 'delegated' });
      }
      expect(cancelled).toHaveBeenCalledTimes(status === 'cancelled' ? 1 : 0);
      expect(button(parent).disabled).toBe(status === 'redirecting');
    },
  );

  it('keeps an active attempt and its callbacks unchanged by updates', async () => {
    const pending = deferred();
    const oldComplete = vi.fn();
    const newComplete = vi.fn();
    const nextAdapter = vi.fn(complete);
    const ui = group({ adapter: { signIn: () => pending.promise }, onSignInComplete: oldComplete });
    const parent = container();
    ui.mountSignInButton(parent);
    button(parent).click();
    ui.updateSignIn({ adapter: { signIn: nextAdapter }, onSignInComplete: newComplete });
    pending.resolve({ status: 'complete' });
    await settle();
    expect(oldComplete).toHaveBeenCalledTimes(1);
    expect(newComplete).not.toHaveBeenCalled();
    button(parent).click();
    expect(nextAdapter).toHaveBeenCalledTimes(1);
    await settle();
    expect(newComplete).toHaveBeenCalledTimes(1);
  });

  it('contains throwing and rejecting callbacks without losing or duplicating auth outcomes', async () => {
    const parent = container();
    const signIn = vi.fn(complete);
    const onError = vi.fn();
    const onSignInComplete = vi.fn(() => Promise.reject(new Error('callback-secret')));
    const ui = group({
      adapter: { signIn },
      onError,
      onSignInComplete,
      onInteractionChange(state) {
        button(parent).dispatchEvent(new MouseEvent('click', { cancelable: true }));
        if (state.status === 'complete') {
          throw new Error('callback-secret');
        }
        return Promise.reject(new Error('callback-secret'));
      },
    });
    ui.mountSignInButton(parent, {
      onClick() {
        throw new Error('callback-secret');
      },
    });
    button(parent).click();
    await settle();
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(onSignInComplete).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(button(parent).disabled).toBe(false);
  });

  it.each([
    {
      code: 'adapter_failed',
      signIn: () => {
        throw new Error('credential-secret');
      },
    },
    { code: 'adapter_failed', signIn: () => Promise.reject({ access_token: 'credential-secret' }) },
    { code: 'adapter_invalid_result', signIn: () => Promise.resolve(undefined) },
    {
      code: 'adapter_invalid_result',
      signIn: () => Promise.resolve({ status: 'complete', access_token: 'credential-secret' }),
    },
    {
      code: 'adapter_invalid_result',
      signIn: () => Promise.resolve(Object.create({ status: 'complete' })),
    },
  ])('sanitizes $code without retrying', async ({ code, signIn }) => {
    const adapter = vi.fn(signIn);
    const onError = vi.fn();
    const onInteractionChange = vi.fn();
    const ui = group({
      adapter: { signIn: adapter },
      onError,
      onInteractionChange,
    } as unknown as ChatGPTAuthSignInConfiguration);
    const parent = container();
    ui.mountSignInButton(parent);
    button(parent).click();
    await settle();
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith({ code, message: expect.any(String), retryable: true });
    expect(JSON.stringify([onError.mock.calls, onInteractionChange.mock.calls])).not.toContain(
      'credential-secret',
    );
    expect(button(parent).disabled).toBe(false);
  });

  it('detaches a view without cancelling shared work and suppresses results after group disposal', async () => {
    const pending = deferred();
    const completed = vi.fn();
    const changed = vi.fn();
    const ui = group({
      adapter: { signIn: () => pending.promise },
      onSignInComplete: completed,
      onInteractionChange: changed,
    });
    const first = container();
    const second = container();
    const firstView = ui.mountSignInButton(first);
    ui.mountSignInButton(second);
    button(first).click();
    await firstView.destroy();
    expect(first.querySelector('button')).toBeNull();
    expect(button(second).disabled).toBe(true);
    await ui.destroy();
    await ui.destroy();
    const changeCount = changed.mock.calls.length;
    pending.resolve({ status: 'complete' });
    await settle();
    expect(completed).not.toHaveBeenCalled();
    expect(changed).toHaveBeenCalledTimes(changeCount);
    expect(second.querySelector('button')).toBeNull();
    expect(() => ui.mountSignInButton(second)).toThrow(ChatGPTAuthError);
    expect(() => ui.updateSignIn({ adapter: { signIn: complete } })).toThrow(ChatGPTAuthError);
  });

  it('still reports an outcome when the last view detaches', async () => {
    const pending = deferred();
    const completed = vi.fn();
    const ui = group({ adapter: { signIn: () => pending.promise }, onSignInComplete: completed });
    const parent = container();
    const view = ui.mountSignInButton(parent);
    button(parent).click();
    await view.destroy();
    pending.resolve({ status: 'complete' });
    await settle();
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it('stops initiation when a click callback destroys the group', () => {
    const signIn = vi.fn(complete);
    const ui = group({ adapter: { signIn } });
    const parent = container();
    ui.mountSignInButton(parent, {
      onClick: () => {
        void ui.destroy();
      },
    });
    button(parent).click();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('isolates independent groups', () => {
    const pending = deferred();
    const signIn = vi.fn(() => pending.promise);
    const first = container();
    const second = container();
    group({ adapter: { signIn } }).mountSignInButton(first);
    group({ adapter: { signIn } }).mountSignInButton(second);
    button(first).click();
    button(second).click();
    expect(signIn).toHaveBeenCalledTimes(2);
  });
});

describe('localized button presentation', () => {
  it.each(['ar', 'ar-EG', 'AR-sa', 'ar-u-nu-arab'])(
    'Arabic catalog resolves %s with RTL presentation for both labels',
    (locale) => {
      const messages = arabicButtonMessages();
      for (const text of ['continue', 'sign-in'] as const) {
        const arabic = getChatGPTSignInButtonModel({ locale, text });
        const english = getChatGPTSignInButtonModel({ text });
        expect(arabic).toMatchObject({
          label: messages[text],
          lang: 'ar',
          dir: 'rtl',
          style: { direction: 'rtl' },
        });
        expect(arabic.mark).toEqual(english.mark);
      }
    },
  );

  it.each(['ja', 'ja-JP', 'JA-jp', 'ja-JP-x-test', 'ja-JP-u-ca-japanese'])(
    'Japanese catalog resolves %s for both labels',
    (locale) => {
      for (const text of ['continue', 'sign-in'] as const) {
        expect(getChatGPTSignInButtonModel({ locale, text })).toMatchObject({
          label: japaneseButtonMessages()[text],
          lang: 'ja-JP',
          dir: 'ltr',
          style: { direction: 'ltr' },
        });
      }
    },
  );

  it.each([undefined, 'en', 'en-US', 'zz-ZZ'])(
    'uses English for %s without consulting the browser language',
    (locale) => {
      vi.spyOn(navigator, 'language', 'get').mockReturnValue('ja-JP');
      expect(getChatGPTSignInButtonModel({ locale })).toMatchObject({
        label: 'Continue with ChatGPT',
        lang: 'en',
        dir: 'ltr',
        style: { direction: 'ltr' },
      });
    },
  );

  it.each(['fa', 'fa-IR', 'FA-af', 'fa-u-nu-arabext'])(
    'Persian catalog resolves %s with RTL labels and accessible names',
    (locale) => {
      expect(getChatGPTSignInButtonModel({ locale })).toMatchObject({
        label: 'ادامه با ChatGPT',
        lang: 'fa',
        dir: 'rtl',
        style: { direction: 'rtl' },
      });
      expect(getChatGPTSignInButtonModel({ locale, text: 'brand' })).toMatchObject({
        label: 'ChatGPT',
        ariaLabel: 'ورود با ChatGPT',
        lang: 'fa',
        dir: 'rtl',
      });
    },
  );

  it.each(['ur', 'ur-PK', 'UR-in', 'ur-u-nu-arabext'])(
    'Urdu catalog resolves %s with RTL labels and accessible names',
    (locale) => {
      expect(getChatGPTSignInButtonModel({ locale })).toMatchObject({
        label: 'ChatGPT کے ساتھ جاری رکھیں',
        lang: 'ur',
        dir: 'rtl',
        style: { direction: 'rtl' },
      });
      expect(getChatGPTSignInButtonModel({ locale, text: 'brand' })).toMatchObject({
        label: 'ChatGPT',
        ariaLabel: 'ChatGPT کے ساتھ سائن ان کریں',
        lang: 'ur',
        dir: 'rtl',
      });
    },
  );

  it.each([
    ['pt', 'pt', 'Entrar com o ChatGPT'],
    ['pt-BR', 'pt', 'Entrar com o ChatGPT'],
    ['pt-PT', 'pt-PT', 'Iniciar sessão com o ChatGPT'],
  ])('preserves the Portuguese catalog selected by %s', (locale, lang, label) => {
    expect(getChatGPTSignInButtonModel({ locale, text: 'sign-in' })).toMatchObject({
      label,
      lang,
      dir: 'ltr',
    });
  });

  it.each(['fil', 'fil-PH', 'tl', 'tl-PH'])(
    'canonicalizes Filipino locale %s to the fil catalog',
    (locale) => {
      expect(getChatGPTSignInButtonModel({ locale, text: 'sign-in' })).toMatchObject({
        label: 'Mag-sign in gamit ang ChatGPT',
        lang: 'fil',
        dir: 'ltr',
      });
    },
  );

  it.each([
    ['zh', 'zh', '使用 ChatGPT 登录'],
    ['zh-CN', 'zh', '使用 ChatGPT 登录'],
    ['zh-Hans-HK', 'zh', '使用 ChatGPT 登录'],
    ['zh-HK', 'zh-HK', '使用 ChatGPT 登入'],
    ['zh-Hant', 'zh-Hant', '使用 ChatGPT 登入'],
    ['zh-Hant-TW', 'zh-Hant', '使用 ChatGPT 登入'],
    ['zh-Hant-HK', 'zh-Hant', '使用 ChatGPT 登入'],
    ['zh-TW', 'zh-Hant', '使用 ChatGPT 登入'],
  ])('preserves the available Chinese script for %s', (locale, lang, label) => {
    expect(getChatGPTSignInButtonModel({ locale, text: 'sign-in' })).toMatchObject({
      label,
      lang,
      dir: 'ltr',
    });
  });

  it('Japanese and English models remain independent', () => {
    const japanese = getChatGPTSignInButtonModel({ locale: 'ja' });
    const english = getChatGPTSignInButtonModel({ locale: 'en' });
    expect(japanese.label).toBe(japaneseButtonMessages().continue);
    expect(english.label).toBe('Continue with ChatGPT');
    expect(japanese.lang).toBe('ja-JP');
    expect(english.lang).toBe('en');
  });

  it('Arabic direction updates in place while keeping the original leading mark', () => {
    const messages = arabicButtonMessages();
    const parent = container();
    parent.dir = 'ltr';
    const ui = group({ adapter: { signIn: complete } });
    const view = ui.mountSignInButton(parent, { locale: 'ar', text: 'sign-in' });
    const original = button(parent);
    const mark = original.querySelector('svg')!;
    const path = mark.querySelector('path')!.getAttribute('d');
    original.focus();
    expect(original.textContent).toBe(messages['sign-in']);
    expect(original.lang).toBe('ar');
    expect(original.dir).toBe('rtl');
    expect(original.firstElementChild).toBe(mark);

    parent.dir = 'rtl';
    for (const [locale, lang] of [
      ['ja', 'ja-JP'],
      ['en', 'en'],
      ['de-DE', 'de'],
    ]) {
      view.update({ locale });
      expect(button(parent)).toBe(original);
      expect(document.activeElement).toBe(original);
      expect(original.lang).toBe(lang);
      expect(original.dir).toBe('ltr');
      expect(original.firstElementChild).toBe(mark);
      expect(mark.querySelector('path')!.getAttribute('d')).toBe(path);
      expect(mark.hasAttribute('transform')).toBe(false);
      expect(mark.style.transform).toBe('');
    }
    view.update({ locale: 'ar-EG' });
    expect(original.dir).toBe('rtl');
    expect(original.lang).toBe('ar');
  });

  it('Japanese locale updates preserve mounted buttons, focus, and sibling labels', () => {
    const ui = group({ adapter: { signIn: complete } });
    const parent = container();
    const sibling = container();
    const view = ui.mountSignInButton(parent, { locale: 'ja', text: 'sign-in' });
    ui.mountSignInButton(sibling);
    const original = button(parent);
    original.focus();
    expect(original.textContent).toBe(japaneseButtonMessages()['sign-in']);
    expect(original.lang).toBe('ja-JP');

    view.update({ locale: 'en-US' });
    expect(button(parent)).toBe(original);
    expect(document.activeElement).toBe(original);
    expect(original.textContent).toBe('Sign in with ChatGPT');
    expect(original.lang).toBe('en');
    expect(button(sibling).textContent).toBe('Continue with ChatGPT');
    expect(button(sibling).lang).toBe('en');

    view.update({ locale: 'ja-JP' });
    expect(() => view.update({ locale: 'ja_JP' })).toThrowError(
      expect.objectContaining({ code: 'invalid_presentation', param: 'locale' }),
    );
    expect(original.textContent).toBe(japaneseButtonMessages()['sign-in']);
    expect(original.lang).toBe('ja-JP');
    view.update({ locale: undefined });
    expect(original.textContent).toBe('Sign in with ChatGPT');
    expect(original.lang).toBe('en');
  });

  it.each([null, 42, {}, [], '', 'ja_JP', ' ja-JP '])(
    'rejects malformed locale %j before rendering',
    (locale) => {
      expect(() => getChatGPTSignInButtonModel({ locale } as never)).toThrowError(
        expect.objectContaining({ code: 'invalid_presentation', param: 'locale' }),
      );
    },
  );
});

describe('presentation and client ownership', () => {
  it('patches the same native button, preserves focus, and explicitly resets callbacks', () => {
    const focused = vi.fn();
    const parent = container();
    parent.append(document.createElement('p'));
    const ui = group({ adapter: { signIn: complete } });
    const view = ui.mountSignInButton(parent, {
      id: 'first',
      onFocus: focused,
      appearance: 'dark',
      text: 'sign-in',
    });
    const original = button(parent);
    original.focus();
    expect(focused).toHaveBeenCalledTimes(1);
    view.update({ size: 'compact', width: 'full' });
    expect(button(parent)).toBe(original);
    expect(document.activeElement).toBe(original);
    expect(original.textContent?.trim()).toBe('Sign in with ChatGPT');
    expect(original.id).toBe('first');
    expect(original.getAttribute('data-chatgpt-appearance')).toBe('dark');
    view.update({ disabled: true });
    expect(original.textContent?.trim()).toBe('Sign in with ChatGPT');
    expect(original.getAttribute('data-chatgpt-appearance')).toBe('dark');
    view.update({ disabled: false });
    original.blur();
    original.focus();
    expect(focused).toHaveBeenCalledTimes(2);
    view.update({ onFocus: undefined, id: undefined });
    expect(original.hasAttribute('id')).toBe(false);
    original.blur();
    original.focus();
    expect(focused).toHaveBeenCalledTimes(2);
    void view.destroy();
    expect(parent.querySelector('p')).not.toBeNull();
  });

  it.each([
    { appearance: 'rainbow' },
    { style: null },
    { className: 123 },
    { text: 'Custom label' },
    { variant: 'tile' },
    { locale: 'ja_JP' },
    { disabled: 'yes' },
  ])('rejects invalid presentation %j before mounting', (options) => {
    const ui = group({ adapter: { signIn: complete } });
    const parent = container();
    expect(() =>
      ui.mountSignInButton(parent, options as unknown as ChatGPTAuthSignInButtonPresentation),
    ).toThrow(ChatGPTAuthError);
    expect(parent.childElementCount).toBe(0);
  });

  it.each([
    'javascript:alert(1)',
    'https://other.example.test/auth',
    '//other.example.test/auth',
    '/auth#fragment',
    'https://user:secret@app.example.test/auth',
  ])('rejects unsafe authPath %s', (authPath) => {
    expect(() => {
      const ui = group({ authPath });
      ui.mountSignInButton(container());
    }).toThrow(ChatGPTAuthError);
  });

  it('resolves app routes against the document origin rather than its base element', () => {
    const base = document.createElement('base');
    base.href = 'https://other.example.test/';
    document.head.append(base);
    expect(() => group({ authPath: 'auth/start' }).mountSignInButton(container())).not.toThrow();
  });

  it('rejects unknown or conflicting configuration', () => {
    for (const config of [
      {},
      { adapter: { signIn: complete }, authPath: '/auth' },
      { authPath: '/auth', onCancel() {} },
      { authPath: '/auth', arbitrary: true },
    ]) {
      expect(() => createChatGPTAuth(config as unknown as ChatGPTAuthSignInConfiguration)).toThrow(
        ChatGPTAuthError,
      );
    }
  });

  it('keeps client callbacks independent of presentation updates', async () => {
    const parent = container();
    const onSignInComplete = vi.fn();
    const onFocus = vi.fn();
    const adapter = { signIn: complete };
    const auth = group({ adapter, onSignInComplete });
    const view = auth.mountSignInButton(parent, { appearance: 'dark', text: 'sign-in', onFocus });
    view.update({ disabled: true });
    view.update({ disabled: false });
    expect(button(parent).textContent?.trim()).toBe('Sign in with ChatGPT');
    expect(button(parent).getAttribute('data-chatgpt-appearance')).toBe('dark');
    button(parent).focus();
    button(parent).click();
    await settle();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onSignInComplete).toHaveBeenCalledTimes(1);
    auth.updateSignIn({ adapter });
    view.update({ onFocus: undefined });
    button(parent).blur();
    button(parent).focus();
    button(parent).click();
    await settle();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onSignInComplete).toHaveBeenCalledTimes(1);
  });

  it('rejects delegated-only callbacks on navigation configurations in types and at runtime', () => {
    const auth = group({ authPath: '/auth/start' });
    expect(() => {
      // @ts-expect-error Navigation has no delegated completion signal.
      auth.updateSignIn({ authPath: '/auth/start', onSignInComplete() {} });
    }).toThrow(ChatGPTAuthError);
    expect(() => {
      // @ts-expect-error Navigation has no delegated cancellation signal.
      auth.updateSignIn({ authPath: '/auth/start', onCancel() {} });
    }).toThrow(ChatGPTAuthError);
  });
});
