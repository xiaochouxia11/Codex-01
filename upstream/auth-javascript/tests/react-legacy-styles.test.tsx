// @vitest-environment jsdom
import { renderToString } from 'react-dom/server';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  ChatGPTAuthProvider,
  ChatGPTProfilePicture,
  ChatGPTSignInButton,
} from '@openai/auth-react';
import { createChatGPTAuth } from '@openai/auth/client';
import { buttonStyles } from '../shared/buttonStyles.js';
import { profilePictureStyles } from '../packages/react/src/components/ChatGPTProfilePicture/ChatGPTProfilePicture.styles.js';

// Exercise the legacy serialization branch here; installed-package/browser fixtures
// separately run the complete integration against actual React 18 runtimes.
vi.mock('../packages/react/src/utils/supportsReact19.js', () => ({ supportsReact19: false }));

afterEach(() => {
  cleanup();
  document.head
    .querySelectorAll('style[data-href="openai-auth-button-v3"]')
    .forEach((style) => style.remove());
});

it('serializes canonical legacy CSS without escaping raw-text selectors or claiming persistent resource ownership', () => {
  const html = renderToString(
    <ChatGPTAuthProvider options={{ authPath: '/auth/start' }}>
      <ChatGPTSignInButton />
      <ChatGPTSignInButton />
      <ChatGPTProfilePicture />
    </ChatGPTAuthProvider>,
  );
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const buttonRules = parsed.querySelectorAll('style[data-chatgpt-style="openai-auth-button-v3"]');
  expect(buttonRules).toHaveLength(2);
  expect(Array.from(buttonRules, (style) => style.textContent)).toEqual([
    buttonStyles,
    buttonStyles,
  ]);
  expect(
    parsed.querySelector('style[data-chatgpt-style="openai-auth-profile-picture-v4"]')?.textContent,
  ).toBe(profilePictureStyles);
  expect(parsed.querySelector('style[data-href]')).toBeNull();
  expect(html).not.toContain('&gt;');
  expect(html).not.toContain('&#x27;');
});

it('keeps DOM-owned CSS after the last legacy React button unmounts', async () => {
  const react = render(
    <ChatGPTAuthProvider options={{ authPath: '/auth/start' }}>
      <ChatGPTSignInButton />
    </ChatGPTAuthProvider>,
  );
  const host = document.createElement('div');
  document.body.append(host);
  const dom = createChatGPTAuth({ authPath: '/auth/start' });
  dom.mountSignInButton(host);
  const persistent = document.head.querySelector('style[data-href="openai-auth-button-v3"]');
  expect(persistent?.textContent).toBe(buttonStyles);
  react.unmount();
  expect(document.querySelector('style[data-chatgpt-style]')).toBeNull();
  expect(document.head.querySelector('style[data-href="openai-auth-button-v3"]')).toBe(persistent);
  expect(host.querySelector('button')).not.toBeNull();
  await dom.destroy();
  host.remove();
});

it('omits legacy inline CSS entirely when the host owns the external stylesheet', () => {
  const html = renderToString(
    <ChatGPTAuthProvider options={{ authPath: '/auth/start' }} stylesheet="external">
      <ChatGPTSignInButton />
      <ChatGPTProfilePicture size={48} />
    </ChatGPTAuthProvider>,
  );
  expect(html).not.toMatch(/<style\b|\sstyle=/);
  expect(html).toContain('width="48" height="48"');
});
