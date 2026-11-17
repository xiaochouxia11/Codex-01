import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatGPTAuthSignInAdapterResult } from '@openai/auth';
import { getChatGPTSignInButtonModel } from '@openai/auth/client';
import {
  ChatGPTAuthProvider,
  ChatGPTSignInButton,
  type ChatGPTAuthSignInButtonProps,
} from '@openai/auth-react';
import { arabicButtonMessages } from './localization-catalog.utils.js';

afterEach(() => cleanup());

describe('button presentation variants', () => {
  it('preserves the default presentation through the deprecated button alias', () => {
    const defaults = getChatGPTSignInButtonModel();
    const legacy = getChatGPTSignInButtonModel({ variant: 'button' });
    const explicit = getChatGPTSignInButtonModel({ variant: 'outlined', layout: 'inline' });
    expect(legacy).toEqual(defaults);
    expect(explicit).toEqual(defaults);
    expect(defaults.label).toBe('Continue with ChatGPT');
    expect(defaults.style.minHeight).toBe('44px');
    expect(getChatGPTSignInButtonModel({ size: 'compact' }).style.minHeight).toBe('36px');
  });

  it.each([{ variant: 'raised' }, { layout: 'between' }, { text: 'custom' }])(
    'rejects unsupported presentation choices without starting authentication: %o',
    (props) => {
      const adapter = { signIn: vi.fn() };
      const param = Object.keys(props)[0];
      expect(() =>
        renderToString(
          <ChatGPTAuthProvider options={{ adapter }}>
            <ChatGPTSignInButton {...(props as ChatGPTAuthSignInButtonProps)} />
          </ChatGPTAuthProvider>,
        ),
      ).toThrowError(expect.objectContaining({ code: 'invalid_presentation', param }));
      expect(adapter.signIn).not.toHaveBeenCalled();
    },
  );

  it('keeps brand text and decorative content out of the localized accessible action name', () => {
    const adapter = { signIn: vi.fn() };
    render(
      <ChatGPTAuthProvider options={{ adapter }}>
        <ChatGPTSignInButton
          variant="contained"
          layout="spread"
          text="brand"
          locale="ar-EG"
          endDecorator={<span data-testid="account-decoration">Ada Lovelace</span>}
        />
      </ChatGPTAuthProvider>,
    );
    const button = screen.getByRole('button', { name: arabicButtonMessages()['sign-in'] });
    expect(button.lang).toBe('ar');
    expect(button.dir).toBe('rtl');
    expect(button.querySelector('span')?.textContent).toBe('ChatGPT');
    const decoration = screen.getByTestId('account-decoration').parentElement!;
    expect(decoration.getAttribute('aria-hidden')).toBe('true');
    expect(decoration.hasAttribute('inert')).toBe(true);
    expect(adapter.signIn).not.toHaveBeenCalled();
  });

  it('removes the brand-only accessible name and decorator when presentation resets', () => {
    const adapter = { signIn: vi.fn() };
    const signIn = { adapter };
    const { rerender } = render(
      <ChatGPTAuthProvider options={signIn}>
        <ChatGPTSignInButton
          text="brand"
          locale="ar"
          layout="spread"
          endDecorator={<span>Account</span>}
        />
      </ChatGPTAuthProvider>,
    );
    const button = screen.getByRole('button', { name: arabicButtonMessages()['sign-in'] });
    rerender(
      <ChatGPTAuthProvider options={signIn}>
        <ChatGPTSignInButton />
      </ChatGPTAuthProvider>,
    );
    expect(screen.getByRole('button', { name: 'Continue with ChatGPT' })).toBe(button);
    expect(button.hasAttribute('aria-label')).toBe(false);
    expect(button.dir).toBe('ltr');
    expect(button.textContent).toBe('Continue with ChatGPT');
    expect(adapter.signIn).not.toHaveBeenCalled();
  });

  it('omits the decorator slot for falsy content and boolean React nodes', () => {
    const adapter = { signIn: vi.fn() };
    const signIn = { adapter };
    const fixture = (endDecorator: ChatGPTAuthSignInButtonProps['endDecorator']) => (
      <ChatGPTAuthProvider options={signIn}>
        <ChatGPTSignInButton layout="spread" endDecorator={endDecorator} />
      </ChatGPTAuthProvider>
    );
    const { rerender } = render(fixture(<span>Account</span>));
    const button = screen.getByRole('button', { name: 'Continue with ChatGPT' });
    expect(button.querySelector('[data-chatgpt-end-decorator]')).not.toBeNull();
    expect(button.getAttribute('data-chatgpt-decorated')).toBe('true');
    for (const empty of [false, true, null, undefined, 0, '']) {
      rerender(fixture(empty));
      expect(button.querySelector('[data-chatgpt-end-decorator]')).toBeNull();
      expect(button.hasAttribute('data-chatgpt-decorated')).toBe(false);
      expect(button.textContent).toBe('Continue with ChatGPT');
    }
    expect(adapter.signIn).not.toHaveBeenCalled();
  });

  it('preserves the button, focus, and shared busy guard when the layout changes during sign-in', async () => {
    let complete!: (result: ChatGPTAuthSignInAdapterResult) => void;
    const adapter = {
      signIn: vi.fn(
        () => new Promise<ChatGPTAuthSignInAdapterResult>((resolve) => (complete = resolve)),
      ),
    };
    const signIn = { adapter };
    const fixture = (spread: boolean) => (
      <ChatGPTAuthProvider options={signIn}>
        <ChatGPTSignInButton
          data-testid="primary"
          variant={spread ? 'contained' : 'outlined'}
          layout={spread ? 'spread' : 'inline'}
          locale={spread ? 'ar' : 'en'}
          endDecorator={spread ? <span>Account</span> : undefined}
        />
        <ChatGPTSignInButton data-testid="secondary" text="brand" />
      </ChatGPTAuthProvider>
    );
    const { rerender } = render(fixture(false));
    const button = screen.getByTestId('primary') as HTMLButtonElement;
    const mark = button.querySelector('svg');
    button.focus();
    fireEvent.click(button);
    rerender(fixture(true));
    expect(screen.getByTestId('primary')).toBe(button);
    expect(button.querySelector('svg')).toBe(mark);
    expect(document.activeElement).toBe(button);
    for (const current of [button, screen.getByTestId('secondary') as HTMLButtonElement]) {
      expect(current.disabled).toBe(true);
      expect(current.getAttribute('aria-busy')).toBe('true');
      fireEvent.click(current);
    }
    expect(adapter.signIn).toHaveBeenCalledTimes(1);
    await act(async () => complete({ status: 'complete' }));
    expect(button.disabled).toBe(false);
    expect(button.dir).toBe('rtl');
  });

  it('allows synchronous preventDefault on a decorated variant before any auth begins', () => {
    const adapter = { signIn: vi.fn() };
    const onClick = vi.fn((event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault());
    render(
      <ChatGPTAuthProvider options={{ adapter }}>
        <ChatGPTSignInButton
          variant="contained"
          layout="spread"
          text="brand"
          endDecorator={<span>Account</span>}
          onClick={onClick}
        />
      </ChatGPTAuthProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with ChatGPT' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(adapter.signIn).not.toHaveBeenCalled();
  });
});
