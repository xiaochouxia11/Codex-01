// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { ChatGPTAuthProvider, ChatGPTSignInButton } from '@openai/auth-react';
import { arabicButtonMessages } from './localization-catalog.utils.js';

it('server renders RTL brand and decorator semantics without browser globals or starting auth', () => {
  expect(typeof window).toBe('undefined');
  const adapter = { signIn: vi.fn() };
  const html = renderToString(
    <ChatGPTAuthProvider options={{ adapter }}>
      <ChatGPTSignInButton
        variant="contained"
        appearance="dark"
        layout="spread"
        text="brand"
        locale="ar-EG"
        endDecorator={<span>Account</span>}
      />
    </ChatGPTAuthProvider>,
  );
  const button = html.match(/<button\b[\s\S]*?<\/button>/)?.[0];
  expect(button).toContain('dir="rtl"');
  expect(button).toContain('lang="ar"');
  expect(button).toContain('disabled=""');
  expect(button).toContain('data-chatgpt-variant="contained"');
  expect(button).toContain('data-chatgpt-layout="spread"');
  expect(button).toContain('data-chatgpt-decorated="true"');
  expect(button).toContain(`aria-label="${arabicButtonMessages()['sign-in']}"`);
  expect(button).toContain('>ChatGPT</span>');
  expect(button).toMatch(/<span[^>]*aria-hidden="true"[^>]*inert=""[^>]*><span>Account<\/span>/);
  expect(adapter.signIn).not.toHaveBeenCalled();
});
