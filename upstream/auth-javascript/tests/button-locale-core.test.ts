import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatGPTAuthSignInAdapterResult } from '@openai/auth';
import {
  createChatGPTAuth,
  getChatGPTSignInButtonModel,
  type ChatGPTAuthSignInButtonPresentation,
} from '@openai/auth/client';
import { arabicButtonMessages, japaneseButtonMessages } from './localization-catalog.utils.js';

const owned: { destroy(): Promise<void> }[] = [];
const originalLang = document.documentElement.getAttribute('lang');
const complete = () => Promise.resolve({ status: 'complete' } as const);
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

function own<T extends { destroy(): Promise<void> }>(value: T): T {
  owned.push(value);
  return value;
}

function container(ownerDocument = document) {
  const host = ownerDocument.createElement('div');
  ownerDocument.body.append(host);
  return host;
}

function mount(options: ChatGPTAuthSignInButtonPresentation = {}) {
  const host = container();
  const handle = own(createChatGPTAuth({ adapter: { signIn: complete } })).mountSignInButton(
    host,
    options,
  );
  return { host, handle, button: host.querySelector('button')! };
}

afterEach(async () => {
  await Promise.all(owned.splice(0).map((value) => value.destroy()));
  document.body.replaceChildren();
  if (originalLang === null) {
    document.documentElement.removeAttribute('lang');
  } else {
    document.documentElement.setAttribute('lang', originalLang);
  }
});

describe('client automatic button locale', () => {
  it('inherits the document language without consulting the browser preference', () => {
    document.documentElement.lang = 'ar-EG';
    const language = vi.spyOn(navigator, 'language', 'get').mockReturnValue('ja-JP');
    const { button } = mount();
    expect(button.lang).toBe('ar');
    expect(button.dir).toBe('rtl');
    expect(button.textContent).toBe(arabicButtonMessages().continue);
    expect(language).not.toHaveBeenCalled();
  });

  it.each(['', 'ja_JP', ' not a language '])(
    'uses English when the document language is %j, ignoring the browser preference',
    (lang) => {
      document.documentElement.lang = lang;
      vi.spyOn(navigator, 'language', 'get').mockReturnValue('ja-JP');
      const { button } = mount();
      expect(button.lang).toBe('en');
      expect(button.textContent).toBe('Continue with ChatGPT');
    },
  );

  it.each(['ja-JP', 'ar', 'zz-ZZ'])(
    'uses English when document lang is absent regardless of browser language: %j',
    (language) => {
      document.documentElement.removeAttribute('lang');
      vi.spyOn(navigator, 'language', 'get').mockReturnValue(language);
      const { button } = mount();
      expect(button.lang).toBe('en');
      expect(button.dir).toBe('ltr');
      expect(button.textContent).toBe('Continue with ChatGPT');
    },
  );

  it('keeps a valid unsupported document language authoritative and falls back to English', () => {
    document.documentElement.lang = 'zz-ZZ';
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('ja-JP');
    expect(mount().button.lang).toBe('en');
  });

  it('keeps explicit locales authoritative, including unsupported tags', async () => {
    document.documentElement.lang = 'ar';
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('ja-JP');
    const { handle, button } = mount({ locale: 'ja-JP' });
    expect(button.lang).toBe('ja-JP');
    handle.update({ className: 'updated' });
    document.documentElement.lang = 'en';
    window.dispatchEvent(new Event('languagechange'));
    await settle();
    expect(button.lang).toBe('ja-JP');
    handle.update({ locale: 'zz-ZZ' });
    document.documentElement.lang = 'ar';
    await settle();
    expect(button.lang).toBe('en');
    expect(button.textContent).toBe('Continue with ChatGPT');
  });

  it('rejects an invalid override without leaving automatic mode or applying other changes', async () => {
    document.documentElement.lang = 'ja';
    expect(() => mount({ locale: 'ja_JP' })).toThrowError(
      expect.objectContaining({ code: 'invalid_presentation', param: 'locale' }),
    );
    const { handle, button } = mount();
    expect(() => handle.update({ locale: 'ja_JP', disabled: true })).toThrowError(
      expect.objectContaining({ code: 'invalid_presentation', param: 'locale' }),
    );
    expect(button.disabled).toBe(false);
    expect(button.lang).toBe('ja-JP');
    document.documentElement.lang = 'ar';
    await settle();
    expect(button.lang).toBe('ar');
  });

  it('retains automatic locale across unrelated updates and restores it with undefined', async () => {
    document.documentElement.lang = 'ja';
    const { handle, button } = mount();
    handle.update({ className: 'automatic', text: 'sign-in' });
    document.documentElement.lang = 'ar';
    await settle();
    expect(button.lang).toBe('ar');
    expect(button.textContent).toBe(arabicButtonMessages()['sign-in']);
    handle.update({ locale: 'en' });
    handle.update({ appearance: 'dark' });
    document.documentElement.lang = 'ja';
    await settle();
    expect(button.lang).toBe('en');
    handle.update({ locale: undefined });
    expect(button.lang).toBe('ja-JP');
    handle.update({ width: 'full' });
    document.documentElement.lang = 'ar';
    await settle();
    expect(button.lang).toBe('ar');
    expect(button.className).toBe('automatic');
    expect(button.getAttribute('data-chatgpt-appearance')).toBe('dark');
  });

  it('ignores browser language changes and follows only document language changes', async () => {
    document.documentElement.removeAttribute('lang');
    const language = vi.spyOn(navigator, 'language', 'get').mockReturnValue('ja-JP');
    const { button } = mount();
    language.mockReturnValue('ar-EG');
    window.dispatchEvent(new Event('languagechange'));
    await settle();
    expect(button.lang).toBe('en');
    expect(button.dir).toBe('ltr');
    document.documentElement.lang = 'ja';
    await settle();
    language.mockReturnValue('en');
    window.dispatchEvent(new Event('languagechange'));
    await settle();
    expect(button.lang).toBe('ja-JP');
    document.documentElement.removeAttribute('lang');
    await settle();
    expect(button.lang).toBe('en');
  });

  it('does not update a destroyed button when ambient language changes', async () => {
    document.documentElement.lang = 'ja';
    const language = vi.spyOn(navigator, 'language', 'get').mockReturnValue('ja-JP');
    const { host, handle, button } = mount();
    await handle.destroy();
    document.documentElement.lang = 'ar';
    language.mockReturnValue('ar');
    window.dispatchEvent(new Event('languagechange'));
    await settle();
    expect(host.querySelector('button')).toBeNull();
    expect(button.lang).toBe('ja-JP');
    expect(button.textContent).toBe(japaneseButtonMessages().continue);
  });
});

describe('automatic locale integration', () => {
  it('uses only the mounted button owner document language, including later changes', async () => {
    document.documentElement.lang = 'ar';
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('ar');
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const childDocument = frame.contentDocument!;
    const childWindow = childDocument.defaultView!;
    childDocument.documentElement.lang = 'ja';
    const language = vi.spyOn(childWindow.navigator, 'language', 'get').mockReturnValue('en');
    const host = container(childDocument);
    const group = own(createChatGPTAuth({ adapter: { signIn: complete } }));
    group.mountSignInButton(host);
    const button = host.querySelector('button')!;
    expect(button.ownerDocument).toBe(childDocument);
    expect(button.lang).toBe('ja-JP');
    childDocument.documentElement.removeAttribute('lang');
    await settle();
    expect(button.lang).toBe('en');
    language.mockReturnValue('ar');
    document.documentElement.lang = 'ja';
    window.dispatchEvent(new Event('languagechange'));
    await settle();
    expect(button.lang).toBe('en');
    childWindow.dispatchEvent(new childWindow.Event('languagechange'));
    await settle();
    expect(button.lang).toBe('en');
    childDocument.documentElement.lang = 'ar';
    await settle();
    expect(button.lang).toBe('ar');
    expect(button.dir).toBe('rtl');
  });

  it('preserves DOM identity, focus, and the shared pending attempt when automatic locale changes', async () => {
    document.documentElement.lang = 'ja';
    let finish!: (result: ChatGPTAuthSignInAdapterResult) => void;
    const signIn = vi.fn(
      () => new Promise<ChatGPTAuthSignInAdapterResult>((resolve) => (finish = resolve)),
    );
    const group = own(createChatGPTAuth({ adapter: { signIn } }));
    const host = container();
    const siblingHost = container();
    group.mountSignInButton(host, { text: 'sign-in' });
    group.mountSignInButton(siblingHost);
    const button = host.querySelector('button')!;
    const sibling = siblingHost.querySelector('button')!;
    const mark = button.querySelector('svg');
    button.focus();
    button.click();
    const pending = group.getSnapshot();
    expect(pending.busy).toBe(true);
    document.documentElement.lang = 'ar';
    await settle();
    expect(host.querySelector('button')).toBe(button);
    expect(button.querySelector('svg')).toBe(mark);
    expect(document.activeElement).toBe(button);
    expect(button.textContent).toBe(arabicButtonMessages()['sign-in']);
    expect(button.dir).toBe('rtl');
    expect(sibling.lang).toBe('ar');
    expect(group.getSnapshot()).toBe(pending);
    for (const current of [button, sibling]) {
      expect(current.disabled).toBe(true);
      expect(current.getAttribute('aria-busy')).toBe('true');
      current.click();
    }
    expect(signIn).toHaveBeenCalledTimes(1);
    finish({ status: 'complete' });
    await settle();
    expect(button.disabled).toBe(false);
    expect(sibling.disabled).toBe(false);
    expect(button.lang).toBe('ar');
  });

  it('keeps the pure button model independent of document and browser language', () => {
    document.documentElement.lang = 'ar';
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('ja-JP');
    expect(getChatGPTSignInButtonModel()).toMatchObject({
      label: 'Continue with ChatGPT',
      lang: 'en',
      dir: 'ltr',
    });
    expect(getChatGPTSignInButtonModel({ locale: 'ja' }).lang).toBe('ja-JP');
  });
});
