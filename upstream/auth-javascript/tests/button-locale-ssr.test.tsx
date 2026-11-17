// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { ChatGPTAuthProvider, ChatGPTSignInButton } from '@openai/auth-react';
import { arabicButtonMessages } from './localization-catalog.utils.js';

it('server renders automatic locale as English and explicit locale without browser globals', () => {
  expect(typeof document).toBe('undefined');
  expect(typeof window).toBe('undefined');
  const adapter = { signIn: vi.fn() };
  const html = renderToString(
    <ChatGPTAuthProvider options={{ adapter }}>
      <ChatGPTSignInButton />
      <ChatGPTSignInButton locale="ar-EG" />
    </ChatGPTAuthProvider>,
  );
  const buttons = html.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
  expect(buttons).toHaveLength(2);
  expect(buttons[0]).toContain('lang="en"');
  expect(buttons[0]).toContain('dir="ltr"');
  expect(buttons[0]).toContain('Continue with ChatGPT');
  expect(buttons[1]).toContain('lang="ar"');
  expect(buttons[1]).toContain('dir="rtl"');
  expect(buttons[1]).toContain(arabicButtonMessages().continue);
  expect(adapter.signIn).not.toHaveBeenCalled();
});
