// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  ChatGPTAuthProvider,
  ChatGPTSignInButton,
  type ChatGPTAuthProviderProps,
} from '@openai/auth-react';
import { arabicButtonMessages, japaneseButtonMessages } from './localization-catalog.utils.js';

function expectInertButtons(html: string, count: number, label = 'Continue with ChatGPT') {
  expect(html).toMatch(/<button\b/);
  const buttons = html.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
  expect(buttons).toHaveLength(count);
  for (const button of buttons) {
    const openingTag = button.slice(0, button.indexOf('>') + 1);
    expect(openingTag).toContain('type="button"');
    expect(openingTag).toMatch(/\sdisabled(?:="")?(?:\s|>)/);
    expect(button).toContain(label);
    expect(button).toMatch(/<svg\b/);
  }
}

describe('React server rendering', () => {
  it('Arabic and fallback labels serialize their own direction without browser globals', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    const messages = arabicButtonMessages();
    const adapter = { signIn: vi.fn() };
    const html = renderToString(
      <div dir="rtl">
        <ChatGPTAuthProvider options={{ adapter }}>
          <ChatGPTSignInButton locale="ar-EG" text="sign-in" />
          <ChatGPTSignInButton locale="zz-ZZ" />
          <ChatGPTSignInButton locale="ja" />
        </ChatGPTAuthProvider>
      </div>,
    );
    const buttons = html.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toContain('lang="ar"');
    expect(buttons[0]).toContain('dir="rtl"');
    expect(buttons[0]).toContain(messages['sign-in']);
    for (const button of buttons.slice(1)) {
      expect(button).toContain('dir="ltr"');
    }
    expect(buttons[1]).toContain('lang="en"');
    expect(buttons[2]).toContain('lang="ja-JP"');
    for (const button of buttons) {
      expect(button).toMatch(/<svg\b[\s\S]*<\/svg><span>/);
    }
    expect(adapter.signIn).not.toHaveBeenCalled();
  });

  it('Persian labels render right to left without browser globals', () => {
    const html = renderToString(
      <ChatGPTAuthProvider options={{ adapter: { signIn: vi.fn() } }}>
        <ChatGPTSignInButton locale="fa-IR" text="sign-in" />
        <ChatGPTSignInButton locale="fa" />
      </ChatGPTAuthProvider>,
    );
    const buttons = html.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button).toContain('lang="fa"');
      expect(button).toContain('dir="rtl"');
    }
    expect(buttons[0]).toContain('ورود با ChatGPT');
    expect(buttons[1]).toContain('ادامه با ChatGPT');
  });

  it('Japanese and English labels render independently without browser globals', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    const messages = japaneseButtonMessages();
    const adapter = { signIn: vi.fn() };
    const html = renderToString(
      <ChatGPTAuthProvider options={{ adapter }}>
        <ChatGPTSignInButton locale="ja" text="sign-in" />
        <ChatGPTSignInButton locale="zz-ZZ" />
      </ChatGPTAuthProvider>,
    );
    const buttons = html.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toContain('lang="ja-JP"');
    expect(buttons[0]).toContain(messages['sign-in']);
    expect(buttons[1]).toContain('lang="en"');
    expect(buttons[1]).toContain('Continue with ChatGPT');
    expect(adapter.signIn).not.toHaveBeenCalled();
  });

  it('imports and renders without DOM globals or starting authentication', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    const adapter = { signIn: vi.fn() };
    const html = renderToString(
      <ChatGPTAuthProvider options={{ adapter }}>
        <ChatGPTSignInButton />
        <ChatGPTSignInButton />
      </ChatGPTAuthProvider>,
    );
    expectInertButtons(html, 2);
    expect(html.match(/<style\b/g)).toHaveLength(1);
    expect(html).toContain('data-href="openai-auth-button-v3"');
    expect(html).toContain('data-precedence="openai-auth"');
    expect(html).toContain('[data-chatgpt-sign-in-button]');
    expect(adapter.signIn).not.toHaveBeenCalled();
  });

  it('serializes custom styling alongside automatic defaults without starting authentication', () => {
    const adapter = { signIn: vi.fn() };
    const html = renderToString(
      <ChatGPTAuthProvider options={{ adapter }}>
        <ChatGPTSignInButton
          className="account-button"
          style={{ marginTop: 12, width: 250, flexGrow: 2 }}
          appearance="dark"
          size="compact"
          width="full"
        />
      </ChatGPTAuthProvider>,
    );
    expectInertButtons(html, 1);
    const button = html.match(/<button\b[\s\S]*?<\/button>/)?.[0];
    expect(button).toContain('class="account-button"');
    expect(button).toContain('style="margin-top:12px;width:250px;flex-grow:2"');
    expect(button).toContain('data-chatgpt-sign-in-button=""');
    expect(button).toContain('data-chatgpt-appearance="dark"');
    expect(button).toContain('data-chatgpt-size="compact"');
    expect(button).toContain('data-chatgpt-width="full"');
    expect(button).not.toMatch(/<svg[^>]*\sstyle=/);
    expect(html).toContain('data-href="openai-auth-button-v3"');
    expect(adapter.signIn).not.toHaveBeenCalled();
  });

  it('supports keyed providers and buttons without reading React reserved-key getters', () => {
    const consoleError = vi.spyOn(console, 'error');
    const consoleWarn = vi.spyOn(console, 'warn');
    const adapter = { signIn: vi.fn() };
    const html = renderToString(
      <ChatGPTAuthProvider key="provider" options={{ adapter }}>
        {['first', 'second'].map((key) => (
          <ChatGPTSignInButton key={key} />
        ))}
      </ChatGPTAuthProvider>,
    );
    expectInertButtons(html, 2);
    expect(adapter.signIn).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', {}],
    ['null', { options: null }],
    ['undefined', { options: undefined }],
  ])('rejects a %s configuration during server rendering', (_description, props) => {
    expect(() =>
      renderToString(
        <ChatGPTAuthProvider {...(props as ChatGPTAuthProviderProps)}>
          <ChatGPTSignInButton />
        </ChatGPTAuthProvider>,
      ),
    ).toThrowError(
      expect.objectContaining({
        name: 'ChatGPTAuthError',
        code: 'invalid_configuration',
        param: 'options',
        message: 'ChatGPTAuthProvider requires exactly one of "client" or "options".',
      }),
    );
  });

  it('warns about unsupported props without forwarding them or starting auth on the server', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = { signIn: vi.fn() };
    const html = renderToString(
      <ChatGPTAuthProvider options={{ adapter }} {...{ authPath: '/unsupported-route' }}>
        <ChatGPTSignInButton
          text="sign-in"
          {...{ logo: 'injected-logo', children: 'Injected children' }}
        />
      </ChatGPTAuthProvider>,
    );
    expectInertButtons(html, 1, 'Sign in with ChatGPT');
    expect(html).not.toContain('injected-logo');
    expect(html).not.toContain('Injected children');
    for (const [component, key] of [
      ['ChatGPTAuthProvider', 'authPath'],
      ['ChatGPTSignInButton', 'logo'],
      ['ChatGPTSignInButton', 'children'],
    ]) {
      expect(consoleWarn).toHaveBeenCalledWith(
        `${component} does not support the "${key}" prop. It will be ignored.`,
      );
    }
    expect(adapter.signIn).not.toHaveBeenCalled();
  });
});
