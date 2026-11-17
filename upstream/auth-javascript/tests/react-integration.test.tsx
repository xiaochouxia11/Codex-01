// @vitest-environment jsdom
import { StrictMode, createRef } from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatGPTAuthSignInAdapterResult } from '@openai/auth';
import {
  ChatGPTAuthProvider,
  ChatGPTSignInButton,
  type ChatGPTAuthSignInButtonProps,
} from '@openai/auth-react';

const complete = () => Promise.resolve({ status: 'complete' } as const);

afterEach(() => cleanup());

describe('React button refs', () => {
  it('exposes the actual button for focus and clears an object ref on unmount', () => {
    const ref = createRef<HTMLButtonElement>();
    const onFocus = vi.fn();
    const signIn = vi.fn(complete);
    const { unmount } = render(
      <ChatGPTAuthProvider options={{ adapter: { signIn } }}>
        <p id="ref-hint">Use your existing account.</p>
        <ChatGPTSignInButton ref={ref} onFocus={onFocus} aria-describedby="ref-hint" />
      </ChatGPTAuthProvider>,
    );
    const button = screen.getByRole('button', {
      name: 'Continue with ChatGPT',
      description: 'Use your existing account.',
    });
    expect(ref.current).toBe(button);
    ref.current?.focus();
    expect(document.activeElement).toBe(button);
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(signIn).not.toHaveBeenCalled();
    unmount();
    expect(ref.current).toBeNull();
  });

  it('keeps callback refs stable on ordinary renders and honors cleanup when replacing them', () => {
    const first = vi.fn<(button: HTMLButtonElement | null) => void>();
    const secondCleanup = vi.fn();
    const second = vi.fn((button: HTMLButtonElement | null) =>
      button ? secondCleanup : undefined,
    );
    const signIn = { adapter: { signIn: complete } };
    const { rerender, unmount } = render(
      <ChatGPTAuthProvider options={signIn}>
        <ChatGPTSignInButton ref={first} appearance="light" />
      </ChatGPTAuthProvider>,
    );
    const button = screen.getByRole('button');
    expect(first.mock.calls).toEqual([[button]]);
    button.focus();
    rerender(
      <ChatGPTAuthProvider options={signIn}>
        <ChatGPTSignInButton ref={first} appearance="dark" aria-describedby="new-hint" />
      </ChatGPTAuthProvider>,
    );
    expect(first.mock.calls).toEqual([[button]]);
    expect(document.activeElement).toBe(button);
    rerender(
      <ChatGPTAuthProvider options={signIn}>
        <ChatGPTSignInButton ref={second} appearance="dark" />
      </ChatGPTAuthProvider>,
    );
    expect(screen.getByRole('button')).toBe(button);
    expect(first.mock.calls).toEqual([[button], [null]]);
    expect(second.mock.calls).toEqual([[button]]);
    expect(secondCleanup).not.toHaveBeenCalled();
    const third = createRef<HTMLButtonElement>();
    rerender(
      <ChatGPTAuthProvider options={signIn}>
        <ChatGPTSignInButton ref={third} appearance="dark" />
      </ChatGPTAuthProvider>,
    );
    expect(secondCleanup).toHaveBeenCalledTimes(1);
    expect(second.mock.calls).toEqual([[button]]);
    expect(third.current).toBe(button);
    unmount();
    expect(secondCleanup).toHaveBeenCalledTimes(1);
    expect(second.mock.calls).toEqual([[button]]);
    expect(third.current).toBeNull();
  });

  it('runs each React 19 ref cleanup exactly once across StrictMode replay and unmount', () => {
    const cleanups: ReturnType<typeof vi.fn>[] = [];
    const ref = vi.fn((button: HTMLButtonElement | null) => {
      if (!button) {
        return;
      }
      const dispose = vi.fn();
      cleanups.push(dispose);
      return dispose;
    });
    const signIn = vi.fn(complete);
    const { unmount } = render(
      <StrictMode>
        <ChatGPTAuthProvider options={{ adapter: { signIn } }}>
          <ChatGPTSignInButton ref={ref} />
        </ChatGPTAuthProvider>
      </StrictMode>,
    );
    expect(cleanups.length).toBeGreaterThanOrEqual(2);
    expect(cleanups.slice(0, -1).every((dispose) => dispose.mock.calls.length === 1)).toBe(true);
    expect(cleanups.at(-1)).not.toHaveBeenCalled();
    expect(ref.mock.calls.every(([button]) => button instanceof HTMLButtonElement)).toBe(true);
    expect(signIn).not.toHaveBeenCalled();
    unmount();
    expect(cleanups.every((dispose) => dispose.mock.calls.length === 1)).toBe(true);
  });

  it('does not re-invoke a failed attachment when React detaches its ref', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ref = vi.fn<(button: HTMLButtonElement | null) => void>(() => {
      throw new Error('Consumer ref attachment failed');
    });
    const signIn = vi.fn(complete);
    try {
      expect(() =>
        render(
          <ChatGPTAuthProvider options={{ adapter: { signIn } }}>
            <ChatGPTSignInButton ref={ref} />
          </ChatGPTAuthProvider>,
        ),
      ).toThrow('Consumer ref attachment failed');
      expect(ref).toHaveBeenCalledTimes(1);
      expect(ref.mock.calls[0]?.[0]).toBeInstanceOf(HTMLButtonElement);
      expect(signIn).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it('preserves pending group work while object refs are replaced and removed', async () => {
    let resolve!: (result: ChatGPTAuthSignInAdapterResult) => void;
    const promise = new Promise<ChatGPTAuthSignInAdapterResult>((complete) => {
      resolve = complete;
    });
    const first = createRef<HTMLButtonElement>();
    const second = createRef<HTMLButtonElement>();
    const onSignInComplete = vi.fn();
    const signIn = { adapter: { signIn: vi.fn(() => promise) }, onSignInComplete };
    const { rerender } = render(
      <ChatGPTAuthProvider options={signIn}>
        <ChatGPTSignInButton ref={first} />
      </ChatGPTAuthProvider>,
    );
    const button = screen.getByRole('button');
    fireEvent.click(button);
    rerender(
      <ChatGPTAuthProvider options={signIn}>
        <ChatGPTSignInButton ref={second} />
      </ChatGPTAuthProvider>,
    );
    expect(first.current).toBeNull();
    expect(second.current).toBe(button);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    rerender(
      <ChatGPTAuthProvider options={signIn}>
        <ChatGPTSignInButton ref={undefined} />
      </ChatGPTAuthProvider>,
    );
    expect(second.current).toBeNull();
    await act(async () => resolve({ status: 'complete' }));
    expect(onSignInComplete).toHaveBeenCalledExactlyOnceWith({ delivery: 'delegated' });
    expect(signIn.adapter.signIn).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button')).toBe(button);
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('React integration attributes', () => {
  it('forwards supported ARIA and primitive data attributes, including resets', () => {
    const signIn = { adapter: { signIn: complete } };
    const { rerender } = render(
      <ChatGPTAuthProvider options={signIn}>
        <ChatGPTSignInButton
          aria-describedby="hint-one hint-two"
          aria-details="details"
          aria-errormessage="error"
          aria-controls="destination"
          aria-invalid="grammar"
          data-testid={123}
          data-tracking-id="signup"
          data-count={2}
          data-enabled={true}
          data-off={false}
          data-empty=""
          data-null={null}
          data-unset={undefined}
        />
      </ChatGPTAuthProvider>,
    );
    const button = screen.getByTestId('123');
    for (const [name, value] of Object.entries({
      'aria-describedby': 'hint-one hint-two',
      'aria-details': 'details',
      'aria-errormessage': 'error',
      'aria-controls': 'destination',
      'aria-invalid': 'grammar',
      'data-tracking-id': 'signup',
      'data-count': '2',
      'data-enabled': 'true',
      'data-off': 'false',
      'data-empty': '',
    })) {
      expect(button.getAttribute(name)).toBe(value);
    }
    expect(button.hasAttribute('data-null')).toBe(false);
    expect(button.hasAttribute('data-unset')).toBe(false);
    rerender(
      <ChatGPTAuthProvider options={signIn}>
        <ChatGPTSignInButton
          aria-describedby={null}
          aria-details={undefined}
          aria-invalid={false}
          data-testid={undefined}
          data-tracking-id={null}
          data-count={undefined}
        />
      </ChatGPTAuthProvider>,
    );
    expect(screen.getByRole('button')).toBe(button);
    expect(button.getAttribute('aria-invalid')).toBe('false');
    for (const name of [
      'aria-describedby',
      'aria-details',
      'aria-controls',
      'aria-errormessage',
      'data-testid',
      'data-tracking-id',
      'data-count',
      'data-enabled',
      'data-off',
      'data-empty',
    ]) {
      expect(button.hasAttribute(name)).toBe(false);
    }
  });

  it('serializes integration attributes on the server without invoking refs or auth', () => {
    const ref = vi.fn();
    const signIn = vi.fn(complete);
    const html = renderToString(
      <ChatGPTAuthProvider options={{ adapter: { signIn } }}>
        <ChatGPTSignInButton
          ref={ref}
          aria-describedby="help"
          aria-invalid={null}
          data-count={3}
          data-enabled={true}
          data-cleared={null}
        />
      </ChatGPTAuthProvider>,
    );
    const template = document.createElement('template');
    template.innerHTML = html;
    const button = template.content.querySelector('button')!;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBe('help');
    expect(button.getAttribute('data-count')).toBe('3');
    expect(button.getAttribute('data-enabled')).toBe('true');
    expect(button.hasAttribute('aria-invalid')).toBe(false);
    expect(button.hasAttribute('data-cleared')).toBe(false);
    expect(ref).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('accepts explicit undefined for all optional React props', () => {
    const props: ChatGPTAuthSignInButtonProps = {
      className: undefined,
      style: undefined,
      appearance: undefined,
      size: undefined,
      width: undefined,
      text: undefined,
      variant: undefined,
      locale: undefined,
      disabled: undefined,
      id: undefined,
      ref: undefined,
      onClick: undefined,
      onFocus: undefined,
      onBlur: undefined,
      'data-testid': undefined,
      'data-optional': undefined,
      'aria-describedby': undefined,
      'aria-details': undefined,
      'aria-errormessage': undefined,
      'aria-controls': undefined,
      'aria-invalid': undefined,
    };
    render(
      <ChatGPTAuthProvider options={{ adapter: { signIn: complete } }}>
        <ChatGPTSignInButton {...props} />
      </ChatGPTAuthProvider>,
    );
    expect(screen.getByRole('button', { name: 'Continue with ChatGPT' })).toBeDefined();
  });

  it.each([
    ['aria-describedby', 123],
    ['aria-details', false],
    ['aria-errormessage', { secret: 'private-value' }],
    ['aria-controls', () => {}],
    ['aria-invalid', 'unsupported'],
    ['aria-invalid', 1],
    ['data-object', { secret: 'private-value' }],
    ['data-function', () => {}],
    ['data-number', NaN],
    ['data-number', Infinity],
    ['data-bigint', 1n],
    ['data-testid', {}],
  ])('rejects invalid %s values with a safe field-specific error', (field, value) => {
    const props = { [field as string]: value } as unknown as ChatGPTAuthSignInButtonProps;
    expect(() =>
      render(
        <ChatGPTAuthProvider options={{ adapter: { signIn: complete } }}>
          <ChatGPTSignInButton {...props} />
        </ChatGPTAuthProvider>,
      ),
    ).toThrowError(
      expect.objectContaining({
        name: 'ChatGPTAuthError',
        code: 'invalid_presentation',
        param: field,
        message: expect.stringContaining(`"${field}"`),
      }),
    );
  });

  it('does not serialize invalid data values during server rendering', () => {
    const props = {
      'data-token': { secret: 'private-value' },
    } as unknown as ChatGPTAuthSignInButtonProps;
    expect(() =>
      renderToString(
        <ChatGPTAuthProvider options={{ adapter: { signIn: complete } }}>
          <ChatGPTSignInButton {...props} />
        </ChatGPTAuthProvider>,
      ),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid_presentation',
        param: 'data-token',
        message: expect.not.stringContaining('private-value'),
      }),
    );
  });

  it.each([42, 'legacy-string-ref', {}])(
    'rejects invalid ref shapes when attaching the button',
    (ref) => {
      expect(() =>
        render(
          <ChatGPTAuthProvider options={{ adapter: { signIn: complete } }}>
            <ChatGPTSignInButton ref={ref as never} />
          </ChatGPTAuthProvider>,
        ),
      ).toThrowError(expect.objectContaining({ code: 'invalid_presentation', param: 'ref' }));
    },
  );

  it('warns and ignores protected attributes and arbitrary events without changing branding or state', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unsupportedEvent = vi.fn();
    let resolve!: (value: ChatGPTAuthSignInAdapterResult) => void;
    const promise = new Promise<ChatGPTAuthSignInAdapterResult>((complete) => {
      resolve = complete;
    });
    const protectedProps = {
      'aria-label': 'Custom label',
      'aria-labelledby': 'custom-label',
      role: 'link',
      type: 'submit',
      name: 'custom-name',
      children: 'Custom text',
      'aria-busy': false,
      'aria-disabled': false,
      onMouseEnter: unsupportedEvent,
      dangerouslySetInnerHTML: { __html: '<b>Custom HTML</b>' },
      'data-Uppercase': 'not-supported',
      'data-': 'not-supported',
    };
    render(
      <ChatGPTAuthProvider options={{ adapter: { signIn: () => promise } }}>
        <p id="custom-label">Custom label</p>
        <ChatGPTSignInButton data-testid="protected-button" {...protectedProps} />
      </ChatGPTAuthProvider>,
    );
    const button = screen.getByRole('button', { name: 'Continue with ChatGPT' });
    expect(button.getAttribute('type')).toBe('button');
    for (const name of [
      'aria-label',
      'aria-labelledby',
      'role',
      'name',
      'class',
      'data-uppercase',
      'data-',
    ]) {
      expect(button.hasAttribute(name)).toBe(false);
    }
    expect(button.hasAttribute('style')).toBe(false);
    expect(button.textContent).not.toContain('Custom');
    fireEvent.mouseEnter(button);
    expect(unsupportedEvent).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect((button as HTMLButtonElement).disabled).toBe(true);
    for (const key of Object.keys(protectedProps)) {
      expect(consoleWarn).toHaveBeenCalledWith(
        `ChatGPTSignInButton does not support the "${key}" prop. It will be ignored.`,
      );
    }
    await act(async () => resolve({ status: 'complete' }));
  });

  it('keeps the server-rendered label and disabled state protected', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = renderToString(
      <ChatGPTAuthProvider options={{ adapter: { signIn: complete } }}>
        <ChatGPTSignInButton
          data-testid="server-button"
          {...{
            'aria-label': 'Custom label',
            'aria-disabled': false,
            role: 'link',
            type: 'submit',
          }}
        />
      </ChatGPTAuthProvider>,
    );
    const template = document.createElement('template');
    template.innerHTML = html;
    const button = template.content.querySelector('button')!;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.hasAttribute('aria-label')).toBe(false);
    expect(button.hasAttribute('role')).toBe(false);
    expect(button.textContent).toContain('Continue with ChatGPT');
  });
});

describe('React button styling', () => {
  it('applies layout classes and styles with React numeric semantics', () => {
    const style: ChatGPTAuthSignInButtonProps['style'] = {
      marginTop: 12,
      width: 250,
      flexGrow: 2,
      order: 3,
    };
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <ChatGPTAuthProvider options={{ adapter: { signIn: complete } }}>
        <ChatGPTSignInButton className="account-button rounded" style={style} />
      </ChatGPTAuthProvider>,
    );
    const button = screen.getByRole('button');
    expect(button.className).toBe('account-button rounded');
    expect(button.style.marginTop).toBe('12px');
    expect(button.style.width).toBe('250px');
    expect(button.style.flexGrow).toBe('2');
    expect(button.style.order).toBe('3');
    expect(button.style.display).toBe('');
    expect(button.querySelector('svg')?.hasAttribute('style')).toBe(false);
    expect(Object.isFrozen(style)).toBe(false);
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('snapshots caller styles, replaces removed properties, and resets classes and styles in place', () => {
    const style = { marginTop: 8, width: 250, flexGrow: 2 };
    const signIn = { adapter: { signIn: complete } };
    const tree = (props: ChatGPTAuthSignInButtonProps) => (
      <ChatGPTAuthProvider options={signIn}>
        <ChatGPTSignInButton {...props} />
      </ChatGPTAuthProvider>
    );
    const { rerender } = render(tree({ className: 'first', style }));
    const button = screen.getByRole('button');
    style.marginTop = 16;
    expect(button.style.marginTop).toBe('8px');
    rerender(tree({ className: 'second', style }));
    expect(screen.getByRole('button')).toBe(button);
    expect(button.style.marginTop).toBe('16px');
    expect(button.className).toBe('second');
    rerender(tree({ className: '', style: { marginTop: 4 } }));
    expect(button.className).toBe('');
    expect(button.style.marginTop).toBe('4px');
    expect(button.style.width).toBe('');
    expect(button.style.flexGrow).toBe('');
    rerender(tree({ className: undefined, style: undefined }));
    expect(button.hasAttribute('class')).toBe(false);
    expect(button.style.cssText).toBe('');
    rerender(tree({ className: 'last', style: { marginInline: 4 } }));
    rerender(tree({}));
    expect(button.hasAttribute('class')).toBe(false);
    expect(button.style.cssText).toBe('');
  });

  it('keeps SDK appearance selectors and authentication state protected from custom styles and data attributes', async () => {
    let resolve!: (result: ChatGPTAuthSignInAdapterResult) => void;
    const result = new Promise<ChatGPTAuthSignInAdapterResult>((done) => {
      resolve = done;
    });
    const signIn = vi.fn(() => result);
    render(
      <ChatGPTAuthProvider options={{ adapter: { signIn } }}>
        <ChatGPTSignInButton
          appearance="dark"
          size="compact"
          width="full"
          className="custom"
          style={{ width: 250 }}
          data-chatgpt-sign-in-button="overridden"
          data-chatgpt-appearance="light"
          data-chatgpt-size="standard"
          data-chatgpt-width="content"
        />
      </ChatGPTAuthProvider>,
    );
    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.getAttribute('data-chatgpt-sign-in-button')).toBe('');
    expect(button.getAttribute('data-chatgpt-appearance')).toBe('dark');
    expect(button.getAttribute('data-chatgpt-size')).toBe('compact');
    expect(button.getAttribute('data-chatgpt-width')).toBe('full');
    fireEvent.click(button);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.type).toBe('button');
    expect(button.className).toBe('custom');
    expect(button.style.width).toBe('250px');
    fireEvent.click(button);
    expect(signIn).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ status: 'complete' }));
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-busy')).toBe('false');
  });

  it.each([
    ['className', null],
    ['className', 1],
    ['className', { secret: 'private-value' }],
    ['style', null],
    ['style', []],
    ['style', new Date()],
    ['style', Object.create({ color: 'red' })],
    ['style', { [Symbol('private-value')]: 'red' }],
    ['style', { 'background-color': 'private-value' }],
    ['style', { '--': 'private-value' }],
    ['style', { hasOwnProperty: 'private-value' }],
    ['style', { setProperty: 'private-value' }],
    ['style', { cssText: 'color:private-value' }],
    ['style', { length: 1 }],
    ['style', { color: { secret: 'private-value' } }],
    ['style', { marginTop: NaN }],
    ['style', { width: Infinity }],
    ['style', { marginTop: true }],
    ['style', { color: 'red' }],
    ['style', { background: 'red' }],
    ['style', { backgroundColor: 'red' }],
    ['style', { font: '14px serif' }],
    ['style', { fontFamily: 'serif' }],
    ['style', { fontSize: 32 }],
    ['style', { fill: 'red' }],
    ['style', { stroke: 'red' }],
    ['style', { borderRadius: 50 }],
    ['style', { '--accent': 'red' }],
    ['style', { '--chatgpt-button-side-size': '50px' }],
    ['style', { opacity: Infinity }],
    ['style', { opacity: true }],
    [
      'style',
      {
        get color() {
          throw new Error('private-value');
        },
      },
    ],
  ])('rejects invalid %s inputs with safe diagnostics', (field, value) => {
    const props = { [field as string]: value } as ChatGPTAuthSignInButtonProps;
    expect(() =>
      renderToString(
        <ChatGPTAuthProvider options={{ adapter: { signIn: complete } }}>
          <ChatGPTSignInButton {...props} />
        </ChatGPTAuthProvider>,
      ),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid_presentation',
        param: field,
        message: expect.not.stringContaining('private-value'),
      }),
    );
  });

  it('validates callbacks before inspecting custom style properties', () => {
    const readColor = vi.fn(() => 'purple');
    const style = Object.defineProperty({}, 'color', { get: readColor, enumerable: true });
    expect(() =>
      renderToString(
        <ChatGPTAuthProvider options={{ adapter: { signIn: complete } }}>
          <ChatGPTSignInButton style={style} onClick={'invalid' as never} />
        </ChatGPTAuthProvider>,
      ),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid_presentation',
        message: 'The sign-in button presentation is invalid.',
      }),
    );
    expect(readColor).not.toHaveBeenCalled();
  });
});
