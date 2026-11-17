// @vitest-environment jsdom
import { StrictMode, Suspense } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatGPTAuthSignInAdapterResult } from '@openai/auth';
import { ChatGPTAuthProvider, ChatGPTSignInButton } from '@openai/auth-react';
import { arabicButtonMessages, japaneseButtonMessages } from './localization-catalog.utils.js';

const originalLang = document.documentElement.getAttribute('lang');
const complete = () => Promise.resolve({ status: 'complete' } as const);

afterEach(() => {
  cleanup();
  if (originalLang === null) {
    document.documentElement.removeAttribute('lang');
  } else {
    document.documentElement.lang = originalLang;
  }
});

describe('React automatic button locale', () => {
  it.each([
    ['ar-EG', 'ja-JP', 'ar', 'rtl'],
    ['ja', 'ar-EG', 'ja-JP', 'ltr'],
    ['', 'ja-JP', 'en', 'ltr'],
    [null, 'ja-JP', 'en', 'ltr'],
    ['not_a_locale', 'ja-JP', 'en', 'ltr'],
    ['zz-ZZ', 'ja-JP', 'en', 'ltr'],
    ['', 'not_a_locale', 'en', 'ltr'],
    ['', '', 'en', 'ltr'],
  ])(
    'resolves document %s with browser %s to %s without reading browser language',
    (documentLocale, browserLocale, expectedLocale, direction) => {
      if (documentLocale === null) {
        document.documentElement.removeAttribute('lang');
      } else {
        document.documentElement.lang = documentLocale;
      }
      const browserLanguage = vi
        .spyOn(window.navigator, 'language', 'get')
        .mockReturnValue(browserLocale);
      render(
        <ChatGPTAuthProvider options={{ adapter: { signIn: complete } }}>
          <ChatGPTSignInButton />
        </ChatGPTAuthProvider>,
      );
      const button = screen.getByRole('button');
      expect(button.lang).toBe(expectedLocale);
      expect(button.dir).toBe(direction);
      expect(browserLanguage).not.toHaveBeenCalled();
      expect(button.textContent).toBe(
        expectedLocale === 'ar'
          ? arabicButtonMessages().continue
          : expectedLocale === 'ja-JP'
            ? japaneseButtonMessages().continue
            : 'Continue with ChatGPT',
      );
    },
  );

  it('keeps explicit locale authoritative and returns to automatic locale when removed', () => {
    document.documentElement.lang = 'ar';
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('ja-JP');
    const signIn = { adapter: { signIn: complete } };
    const tree = (locale?: string) => (
      <ChatGPTAuthProvider options={signIn}>
        <ChatGPTSignInButton locale={locale} />
      </ChatGPTAuthProvider>
    );
    const { rerender } = render(tree('ja'));
    const button = screen.getByRole('button');
    expect(button.lang).toBe('ja-JP');
    rerender(tree('zz-ZZ'));
    expect(button.lang).toBe('en');
    rerender(tree());
    expect(screen.getByRole('button')).toBe(button);
    expect(button.lang).toBe('ar');
    expect(button.dir).toBe('rtl');
  });

  it('still rejects a malformed explicit locale even when the document has a valid language', () => {
    document.documentElement.lang = 'ar';
    expect(() =>
      renderToString(
        <ChatGPTAuthProvider options={{ adapter: { signIn: complete } }}>
          <ChatGPTSignInButton locale="not_a_locale" />
        </ChatGPTAuthProvider>,
      ),
    ).toThrowError(expect.objectContaining({ code: 'invalid_presentation', param: 'locale' }));
  });

  it('releases document observers when locale becomes explicit and when the button unmounts', () => {
    document.documentElement.lang = 'ar';
    const observe = vi.spyOn(window.MutationObserver.prototype, 'observe');
    const disconnect = vi.spyOn(window.MutationObserver.prototype, 'disconnect');
    const signIn = { adapter: { signIn: complete } };
    const tree = (locale?: string) => (
      <ChatGPTAuthProvider options={signIn}>
        <ChatGPTSignInButton locale={locale} />
      </ChatGPTAuthProvider>
    );
    const { rerender, unmount } = render(tree());
    expect(observe).toHaveBeenCalledTimes(1);
    rerender(tree('en'));
    expect(observe).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    rerender(tree());
    expect(observe).toHaveBeenCalledTimes(2);
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(2);
  });

  it('follows document language changes and ignores browser changes without replacing the button or pending auth', async () => {
    document.documentElement.lang = 'ar';
    const browserLocale = vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('ja-JP');
    let resolve!: (result: ChatGPTAuthSignInAdapterResult) => void;
    const pending = new Promise<ChatGPTAuthSignInAdapterResult>((complete) => {
      resolve = complete;
    });
    const adapter = { signIn: vi.fn(() => pending) };
    const onSignInComplete = vi.fn();
    render(
      <StrictMode>
        <ChatGPTAuthProvider options={{ adapter, onSignInComplete }}>
          <ChatGPTSignInButton data-testid="automatic" />
          <ChatGPTSignInButton locale="ar" data-testid="explicit" />
        </ChatGPTAuthProvider>
      </StrictMode>,
    );
    const button = screen.getByTestId('automatic') as HTMLButtonElement;
    const mark = button.querySelector('svg');
    button.focus();
    fireEvent.click(button);
    expect(adapter.signIn).toHaveBeenCalledTimes(1);
    await act(async () => {
      document.documentElement.lang = 'en';
    });
    expect(screen.getByTestId('automatic')).toBe(button);
    expect(button.lang).toBe('en');
    expect(button.dir).toBe('ltr');
    expect(button.querySelector('svg')).toBe(mark);
    expect(document.activeElement).toBe(button);
    expect(button.disabled).toBe(true);
    expect(screen.getByTestId('explicit').lang).toBe('ar');
    await act(async () => {
      document.documentElement.removeAttribute('lang');
    });
    expect(button.lang).toBe('en');
    browserLocale.mockReturnValue('ar-EG');
    await act(async () => {
      window.dispatchEvent(new Event('languagechange'));
    });
    expect(button.lang).toBe('en');
    expect(browserLocale).not.toHaveBeenCalled();
    await act(async () => {
      document.documentElement.lang = 'ar-EG';
    });
    expect(button.lang).toBe('ar');
    expect(button.dir).toBe('rtl');
    expect(button.disabled).toBe(true);
    await act(async () => resolve({ status: 'complete' }));
    expect(onSignInComplete).toHaveBeenCalledExactlyOnceWith({ delivery: 'delegated' });
    expect(adapter.signIn).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('automatic')).toBe(button);
    expect(button.disabled).toBe(false);
  });

  it('uses the actual button document and ignores its navigator when rendered in another window', async () => {
    document.documentElement.lang = 'en';
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    frameDocument.documentElement.lang = 'ar';
    const browserLanguage = vi
      .spyOn(frameWindow.navigator, 'language', 'get')
      .mockReturnValue('ja-JP');
    const { unmount } = render(
      <ChatGPTAuthProvider options={{ adapter: { signIn: complete } }}>
        <ChatGPTSignInButton />
      </ChatGPTAuthProvider>,
      { container: frameDocument.body },
    );
    try {
      const button = frameDocument.querySelector('button')!;
      expect(button.lang).toBe('ar');
      expect(button.dir).toBe('rtl');
      await act(async () => {
        frameDocument.documentElement.removeAttribute('lang');
      });
      expect(button.lang).toBe('en');
      expect(button.dir).toBe('ltr');
      expect(browserLanguage).not.toHaveBeenCalled();
      await act(async () => {
        frameDocument.documentElement.lang = 'ja';
      });
      expect(button.lang).toBe('ja-JP');
    } finally {
      unmount();
      iframe.remove();
    }
  });
});

describe('React automatic locale hydration', () => {
  it.each([undefined, 'ja'])(
    'hydrates locale %s in place before inheriting after commit',
    async (locale) => {
      document.documentElement.lang = 'ar-EG';
      const adapter = { signIn: vi.fn(complete) };
      const attachedLanguages: string[] = [];
      const tree = (
        <ChatGPTAuthProvider options={{ adapter }}>
          <ChatGPTSignInButton
            locale={locale}
            ref={(button) => {
              if (button) {
                attachedLanguages.push(button.lang);
              }
            }}
          />
        </ChatGPTAuthProvider>
      );
      const container = document.createElement('div');
      container.innerHTML = renderToString(tree);
      document.body.append(container);
      const button = container.querySelector('button')!;
      const initialLocale = locale === undefined ? 'en' : 'ja-JP';
      expect(button.lang).toBe(initialLocale);
      const onRecoverableError = vi.fn();
      const consoleError = vi.spyOn(console, 'error');
      let root: Root | undefined;
      try {
        await act(async () => {
          root = hydrateRoot(container, tree, { onRecoverableError });
        });
        expect(attachedLanguages).toEqual([initialLocale]);
        expect(container.querySelector('button')).toBe(button);
        expect(button.lang).toBe(locale === undefined ? 'ar' : 'ja-JP');
        expect(button.dir).toBe(locale === undefined ? 'rtl' : 'ltr');
        expect(button.disabled).toBe(false);
        expect(onRecoverableError).not.toHaveBeenCalled();
        expect(consoleError).not.toHaveBeenCalled();
        expect(adapter.signIn).not.toHaveBeenCalled();
      } finally {
        await act(async () => root?.unmount());
        container.remove();
      }
    },
  );

  it('keeps a delayed Suspense button hydration stable after its provider is already ready', async () => {
    document.documentElement.lang = 'ar';
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let waiting = false;
    function Pause() {
      if (waiting) {
        throw gate;
      }
      return null;
    }
    const adapter = { signIn: vi.fn(complete) };
    const tree = (
      <ChatGPTAuthProvider options={{ adapter }}>
        <ChatGPTSignInButton locale="en" data-testid="ready" />
        <Suspense fallback={<span>Loading</span>}>
          <Pause />
          <ChatGPTSignInButton data-testid="delayed" />
        </Suspense>
      </ChatGPTAuthProvider>
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(tree);
    document.body.append(container);
    const button = container.querySelector<HTMLButtonElement>('[data-testid="delayed"]')!;
    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, 'error');
    let root: Root | undefined;
    waiting = true;
    try {
      await act(async () => {
        root = hydrateRoot(container, tree, { onRecoverableError });
      });
      expect(container.querySelector<HTMLButtonElement>('[data-testid="ready"]')!.disabled).toBe(
        false,
      );
      expect(button.disabled).toBe(true);
      expect(button.lang).toBe('en');
      await act(async () => {
        waiting = false;
        release();
      });
      expect(container.querySelector('[data-testid="delayed"]')).toBe(button);
      expect(button.lang).toBe('ar');
      expect(button.dir).toBe('rtl');
      expect(button.disabled).toBe(false);
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      expect(adapter.signIn).not.toHaveBeenCalled();
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  });
});
