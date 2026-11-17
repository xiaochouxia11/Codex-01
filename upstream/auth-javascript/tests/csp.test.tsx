import { renderToString } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { getChatGPTSignInButtonModel, createChatGPTAuth } from '@openai/auth/client';
import {
  ChatGPTAuthProvider,
  ChatGPTProfilePicture,
  ChatGPTSignInButton,
} from '@openai/auth-react';

afterEach(() => {
  document.body.replaceChildren();
  document.head
    .querySelectorAll('style[data-href="openai-auth-button-v3"]')
    .forEach((style) => style.remove());
});

it('external DOM styling skips injection and retains sign-in and automatic-style reset', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const signIn = vi.fn(async () => ({ status: 'complete' as const }));
  const auth = createChatGPTAuth({ adapter: { signIn } });
  const handle = auth.mountSignInButton(host, { stylesheet: 'external' });
  expect(document.querySelector('style')).toBeNull();
  host.querySelector('button')!.click();
  expect(signIn).toHaveBeenCalledOnce();
  handle.update({ stylesheet: undefined });
  expect(document.querySelectorAll('style[data-href="openai-auth-button-v3"]')).toHaveLength(1);
  handle.update({ stylesheet: 'external' });
  // Previously installed shared CSS still belongs to other automatic consumers.
  expect(document.querySelectorAll('style[data-href="openai-auth-button-v3"]')).toHaveLength(1);
  await auth.destroy();
});

it('external React styling emits no SDK styles or inline size overrides during SSR', () => {
  const html = renderToString(
    <ChatGPTAuthProvider options={{ authPath: '/auth/start' }} stylesheet="external">
      <ChatGPTSignInButton />
      <ChatGPTProfilePicture size={56} alt="Account" />
    </ChatGPTAuthProvider>,
  );
  expect(html).not.toMatch(/<style\b|\sstyle=/);
  expect(html).toContain('width="56" height="56"');
  expect(html).toContain('disabled=""');
  expect(html).toContain('aria-label="Account"');
});

it.each(['standard', 'compact'] as const)(
  'external React styling keeps default profile sizing free of inline styles in %s buttons',
  (size) => {
    const html = renderToString(
      <ChatGPTAuthProvider options={{ authPath: '/auth/start' }} stylesheet="external">
        <ChatGPTSignInButton size={size} endDecorator={<ChatGPTProfilePicture />} />
        <ChatGPTProfilePicture size={Number.NaN} />
      </ChatGPTAuthProvider>,
    );
    const document = new DOMParser().parseFromString(html, 'text/html');
    expect(html).not.toMatch(/<style\b|\sstyle=/);
    expect(document.querySelectorAll('[data-chatgpt-profile-picture-default-size]')).toHaveLength(
      2,
    );
    const button = document.querySelector('button')!;
    expect(button.getAttribute('data-chatgpt-size')).toBe(size);
    expect(
      button.querySelector(
        '[data-chatgpt-end-decorator] [data-chatgpt-profile-picture-default-size]',
      ),
    ).not.toBeNull();
    for (const sizer of document.querySelectorAll('[data-chatgpt-profile-picture-sizer]')) {
      expect(sizer.getAttribute('width')).toBe('20');
      expect(sizer.getAttribute('height')).toBe('20');
    }
  },
);

it('validates renderer stylesheet options without adding them to the pure visual API', () => {
  expect(() =>
    createChatGPTAuth({ authPath: '/auth/start' }).mountSignInButton(
      document.createElement('div'),
      {
        stylesheet: 'invalid' as 'auto',
      },
    ),
  ).toThrow(expect.objectContaining({ code: 'invalid_presentation', param: 'stylesheet' }));
  expect(() =>
    renderToString(
      <ChatGPTAuthProvider options={{ authPath: '/auth/start' }} stylesheet={'invalid' as 'auto'}>
        <ChatGPTSignInButton />
      </ChatGPTAuthProvider>,
    ),
  ).toThrow(expect.objectContaining({ code: 'invalid_configuration', param: 'stylesheet' }));
  expect(() => getChatGPTSignInButtonModel({ stylesheet: 'external' } as never)).toThrow();
});
