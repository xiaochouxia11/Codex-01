// @vitest-environment jsdom
import {
  StrictMode,
  Suspense,
  startTransition,
  useLayoutEffect,
  useState,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { flushSync } from 'react-dom';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTAuthError, type ChatGPTAuthSignInAdapterResult } from '@openai/auth';
import {
  ChatGPTAuthProvider,
  ChatGPTSignInButton,
  type ChatGPTAuthProviderProps,
} from '@openai/auth-react';
import { arabicButtonMessages, japaneseButtonMessages } from './localization-catalog.utils.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function pendingSignIn() {
  const result = deferred<ChatGPTAuthSignInAdapterResult>();
  const adapter = { signIn: vi.fn(() => result.promise) };
  const onSignInComplete = vi.fn();
  return { result, adapter, onSignInComplete, configuration: { adapter, onSignInComplete } };
}

function ClickAfterLayout({ enabled }: { enabled: boolean }) {
  useLayoutEffect(() => {
    if (enabled) {
      screen.getByTestId('commit-button').click();
    }
  }, [enabled]);
  return null;
}

afterEach(() => cleanup());

describe('React sign-in ownership', () => {
  it('Arabic direction updates independently of the host while preserving button and mark identity', () => {
    const messages = arabicButtonMessages();
    const flow = pendingSignIn();
    const { rerender } = render(
      <div dir="ltr">
        <ChatGPTAuthProvider options={flow.configuration}>
          <ChatGPTSignInButton locale="ar" text="sign-in" data-testid="localized" />
          <ChatGPTSignInButton locale="en" data-testid="english" />
        </ChatGPTAuthProvider>
      </div>,
    );
    const arabic = screen.getByRole('button', { name: messages['sign-in'] });
    const mark = arabic.querySelector('svg')!;
    const path = mark.querySelector('path')!.getAttribute('d');
    arabic.focus();
    expect(arabic.lang).toBe('ar');
    expect(arabic.dir).toBe('rtl');
    expect(arabic.firstElementChild).toBe(mark);
    expect(screen.getByTestId('english').dir).toBe('ltr');

    rerender(
      <div dir="rtl">
        <ChatGPTAuthProvider options={flow.configuration}>
          <ChatGPTSignInButton locale="de-DE" text="sign-in" data-testid="localized" />
          <ChatGPTSignInButton locale="en" data-testid="english" />
        </ChatGPTAuthProvider>
      </div>,
    );
    expect(screen.getByRole('button', { name: 'Mit ChatGPT anmelden' })).toBe(arabic);
    expect(arabic.lang).toBe('de');
    expect(arabic.dir).toBe('ltr');
    expect(document.activeElement).toBe(arabic);
    expect(arabic.firstElementChild).toBe(mark);
    expect(mark.querySelector('path')!.getAttribute('d')).toBe(path);
    expect(mark.hasAttribute('transform')).toBe(false);
    expect(mark.style.transform).toBe('');
    expect(screen.getByTestId('english').dir).toBe('ltr');
    expect(flow.adapter.signIn).not.toHaveBeenCalled();
  });

  it('Japanese labels update in place without affecting a sibling or starting auth', () => {
    const flow = pendingSignIn();
    const { rerender } = render(
      <ChatGPTAuthProvider options={flow.configuration}>
        <ChatGPTSignInButton locale="ja-JP" text="sign-in" />
        <ChatGPTSignInButton locale="en" />
      </ChatGPTAuthProvider>,
    );
    const japanese = screen.getByRole('button', {
      name: japaneseButtonMessages()['sign-in'],
    });
    const english = screen.getByRole('button', { name: 'Continue with ChatGPT' });
    japanese.focus();
    expect(japanese.lang).toBe('ja-JP');
    expect(japanese.dir).toBe('ltr');
    expect(english.lang).toBe('en');

    rerender(
      <ChatGPTAuthProvider options={flow.configuration}>
        <ChatGPTSignInButton text="sign-in" />
        <ChatGPTSignInButton locale="en" />
      </ChatGPTAuthProvider>,
    );
    expect(screen.getByRole('button', { name: 'Sign in with ChatGPT' })).toBe(japanese);
    expect(japanese.lang).toBe('en');
    expect(document.activeElement).toBe(japanese);
    expect(screen.getByRole('button', { name: 'Continue with ChatGPT' })).toBe(english);
    expect(flow.adapter.signIn).not.toHaveBeenCalled();
  });

  it('mounts without starting auth and shares one attempt across buttons', async () => {
    const flow = pendingSignIn();
    render(
      <ChatGPTAuthProvider options={flow.configuration}>
        <ChatGPTSignInButton data-testid="first" />
        <ChatGPTSignInButton data-testid="second" />
      </ChatGPTAuthProvider>,
    );

    expect(flow.adapter.signIn).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('first'));
    fireEvent.click(screen.getByTestId('second'));
    expect(flow.adapter.signIn).toHaveBeenCalledTimes(1);

    await act(async () => flow.result.resolve({ status: 'complete' }));
    expect(flow.onSignInComplete).toHaveBeenCalledExactlyOnceWith({ delivery: 'delegated' });
  });

  it('isolates independent providers and uses the closest nested provider', async () => {
    const outer = pendingSignIn();
    const inner = pendingSignIn();
    const separate = pendingSignIn();
    render(
      <>
        <ChatGPTAuthProvider options={outer.configuration}>
          <ChatGPTSignInButton data-testid="outer-first" />
          <ChatGPTAuthProvider options={inner.configuration}>
            <ChatGPTSignInButton data-testid="inner" />
          </ChatGPTAuthProvider>
          <ChatGPTSignInButton data-testid="outer-second" />
        </ChatGPTAuthProvider>
        <ChatGPTAuthProvider options={separate.configuration}>
          <ChatGPTSignInButton data-testid="separate" />
        </ChatGPTAuthProvider>
      </>,
    );

    for (const id of ['outer-first', 'inner', 'outer-second', 'separate']) {
      fireEvent.click(screen.getByTestId(id));
    }
    for (const flow of [outer, inner, separate]) {
      expect(flow.adapter.signIn).toHaveBeenCalledTimes(1);
    }
    await act(async () => {
      for (const flow of [outer, inner, separate]) {
        flow.result.resolve({ status: 'complete' });
      }
    });
    for (const flow of [outer, inner, separate]) {
      expect(flow.onSignInComplete).toHaveBeenCalledTimes(1);
    }
  });

  it('retains a provider attempt when every button detaches', async () => {
    const flow = pendingSignIn();
    const { rerender } = render(
      <ChatGPTAuthProvider options={flow.configuration}>
        <ChatGPTSignInButton />
      </ChatGPTAuthProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    rerender(<ChatGPTAuthProvider options={flow.configuration} />);
    expect(screen.queryByRole('button')).toBeNull();

    await act(async () => flow.result.resolve({ status: 'complete' }));
    expect(flow.onSignInComplete).toHaveBeenCalledTimes(1);
    expect(flow.adapter.signIn).toHaveBeenCalledTimes(1);
  });

  it('suppresses late outcomes after the provider unmounts', async () => {
    const flow = pendingSignIn();
    const onInteractionChange = vi.fn();
    const { unmount } = render(
      <ChatGPTAuthProvider options={{ ...flow.configuration, onInteractionChange }}>
        <ChatGPTSignInButton />
      </ChatGPTAuthProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    const observedStates = onInteractionChange.mock.calls.length;
    unmount();
    await act(async () => flow.result.resolve({ status: 'complete' }));
    expect(flow.onSignInComplete).not.toHaveBeenCalled();
    expect(onInteractionChange).toHaveBeenCalledTimes(observedStates);
  });

  it('retires the active attempt when a keyed provider is replaced', async () => {
    const consoleWarn = vi.spyOn(console, 'warn');
    const original = pendingSignIn();
    const replacement = pendingSignIn();
    const { rerender } = render(
      <ChatGPTAuthProvider key="original" options={original.configuration}>
        <ChatGPTSignInButton key="button" />
      </ChatGPTAuthProvider>,
    );
    const originalButton = screen.getByRole('button');
    fireEvent.click(originalButton);
    rerender(
      <ChatGPTAuthProvider key="replacement" options={replacement.configuration}>
        <ChatGPTSignInButton key="button" />
      </ChatGPTAuthProvider>,
    );
    const replacementButton = screen.getByRole('button');
    expect(replacementButton).not.toBe(originalButton);
    expect(replacement.adapter.signIn).not.toHaveBeenCalled();
    fireEvent.click(replacementButton);
    expect(original.adapter.signIn).toHaveBeenCalledTimes(1);
    expect(replacement.adapter.signIn).toHaveBeenCalledTimes(1);

    await act(async () => original.result.resolve({ status: 'complete' }));
    expect(original.onSignInComplete).not.toHaveBeenCalled();
    expect(replacement.onSignInComplete).not.toHaveBeenCalled();
    await act(async () => replacement.result.resolve({ status: 'complete' }));
    expect(replacement.onSignInComplete).toHaveBeenCalledTimes(1);
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('applies committed signIn updates to the next attempt without replacing the active attempt', async () => {
    const original = pendingSignIn();
    const next = pendingSignIn();
    const { rerender } = render(
      <ChatGPTAuthProvider options={original.configuration}>
        <ChatGPTSignInButton />
      </ChatGPTAuthProvider>,
    );
    const button = screen.getByRole('button');
    fireEvent.click(button);
    rerender(
      <ChatGPTAuthProvider options={next.configuration}>
        <ChatGPTSignInButton />
      </ChatGPTAuthProvider>,
    );
    expect(screen.getByRole('button')).toBe(button);
    fireEvent.click(button);
    expect(next.adapter.signIn).not.toHaveBeenCalled();

    await act(async () => original.result.resolve({ status: 'complete' }));
    expect(original.onSignInComplete).toHaveBeenCalledTimes(1);
    expect(next.onSignInComplete).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(next.adapter.signIn).toHaveBeenCalledTimes(1);
    await act(async () => next.result.resolve({ status: 'complete' }));
    expect(next.onSignInComplete).toHaveBeenCalledTimes(1);
  });

  it('commits configuration and presentation before a following layout effect can click', async () => {
    const original = pendingSignIn();
    const next = pendingSignIn();
    const onClick = vi.fn((event: ReactMouseEvent<HTMLButtonElement>) => event.preventDefault());
    const { rerender } = render(
      <>
        <ChatGPTAuthProvider options={original.configuration}>
          <ChatGPTSignInButton data-testid="commit-button" onClick={onClick} />
        </ChatGPTAuthProvider>
        <ClickAfterLayout enabled={false} />
      </>,
    );
    rerender(
      <>
        <ChatGPTAuthProvider options={next.configuration}>
          <ChatGPTSignInButton data-testid="commit-button" />
        </ChatGPTAuthProvider>
        <ClickAfterLayout enabled />
      </>,
    );
    expect(onClick).not.toHaveBeenCalled();
    expect(original.adapter.signIn).not.toHaveBeenCalled();
    expect(next.adapter.signIn).toHaveBeenCalledTimes(1);
    await act(async () => next.result.resolve({ status: 'complete' }));
  });

  it('commits a new provider configuration before a descendant layout effect clicks an existing button', async () => {
    const previous = pendingSignIn();
    const next = pendingSignIn();
    const tree = (updated: boolean) => (
      <ChatGPTAuthProvider options={updated ? next.configuration : previous.configuration}>
        <ChatGPTSignInButton data-testid="commit-button" />
        <ClickAfterLayout enabled={updated} />
      </ChatGPTAuthProvider>
    );
    const { rerender } = render(tree(false));
    const button = screen.getByRole('button');
    rerender(tree(true));
    expect(screen.getByRole('button')).toBe(button);
    expect(previous.adapter.signIn).not.toHaveBeenCalled();
    expect(next.adapter.signIn).toHaveBeenCalledTimes(1);
    await act(async () => next.result.resolve({ status: 'complete' }));
    expect(previous.onSignInComplete).not.toHaveBeenCalled();
    expect(next.onSignInComplete).toHaveBeenCalledExactlyOnceWith({ delivery: 'delegated' });
  });

  it('does not leak a suspended provider configuration into the currently committed button', async () => {
    const original = pendingSignIn();
    const next = pendingSignIn();
    const gate = deferred<void>();
    const suspendedRender = vi.fn();
    let waiting = true;
    function Pause({ updated }: { updated: boolean }) {
      if (updated && waiting) {
        suspendedRender();
        throw gate.promise;
      }
      return null;
    }
    function App() {
      const [updated, setUpdated] = useState(false);
      return (
        <>
          <button onClick={() => startTransition(() => setUpdated(true))}>Update config</button>
          <Suspense fallback={<p>Waiting for update</p>}>
            <ChatGPTAuthProvider options={updated ? next.configuration : original.configuration}>
              <ChatGPTSignInButton data-testid="committed-button" />
              <Pause updated={updated} />
            </ChatGPTAuthProvider>
          </Suspense>
        </>
      );
    }
    render(<App />);
    const button = screen.getByTestId('committed-button');
    await act(async () => fireEvent.click(screen.getByText('Update config')));
    expect(suspendedRender).toHaveBeenCalled();
    expect(screen.queryByText('Waiting for update')).toBeNull();
    expect(screen.getByTestId('committed-button')).toBe(button);
    fireEvent.click(button);
    expect(original.adapter.signIn).toHaveBeenCalledTimes(1);
    expect(next.adapter.signIn).not.toHaveBeenCalled();
    await act(async () => original.result.resolve({ status: 'complete' }));
    expect(original.onSignInComplete).toHaveBeenCalledExactlyOnceWith({ delivery: 'delegated' });
    await act(async () => {
      waiting = false;
      gate.resolve();
    });
    fireEvent.click(screen.getByTestId('committed-button'));
    expect(next.adapter.signIn).toHaveBeenCalledTimes(1);
    await act(async () => next.result.resolve({ status: 'complete' }));
    expect(next.onSignInComplete).toHaveBeenCalledExactlyOnceWith({ delivery: 'delegated' });
  });

  it('survives StrictMode effect replay and keeps native views through ordinary rerenders', async () => {
    const flow = pendingSignIn();
    const tree = (appearance: 'light' | 'dark') => (
      <StrictMode>
        <ChatGPTAuthProvider options={{ ...flow.configuration }}>
          <ChatGPTSignInButton appearance={appearance} />
        </ChatGPTAuthProvider>
      </StrictMode>
    );
    const { rerender } = render(tree('light'));
    expect(flow.adapter.signIn).not.toHaveBeenCalled();
    const button = screen.getByRole('button');
    button.focus();
    rerender(tree('dark'));
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button')).toBe(button);
    expect(document.activeElement).toBe(button);

    fireEvent.click(button);
    expect(flow.adapter.signIn).toHaveBeenCalledTimes(1);
    rerender(tree('light'));
    fireEvent.click(button);
    expect(flow.adapter.signIn).toHaveBeenCalledTimes(1);
    await act(async () => flow.result.resolve({ status: 'complete' }));
    expect(flow.onSignInComplete).toHaveBeenCalledTimes(1);
  });

  it('provides synthetic click and focus events and removes old presentation callbacks', async () => {
    const flow = pendingSignIn();
    let clickTarget: HTMLButtonElement | null = null;
    let focusTarget: HTMLButtonElement | null = null;
    let blurTarget: HTMLButtonElement | null = null;
    let preventedBefore: boolean | undefined;
    let preventedAfter: boolean | undefined;
    const onClick = vi.fn((event: ReactMouseEvent<HTMLButtonElement>) => {
      clickTarget = event.currentTarget;
      preventedBefore = event.isDefaultPrevented();
      event.preventDefault();
      preventedAfter = event.isDefaultPrevented();
    });
    const onFocus = vi.fn((event: ReactFocusEvent<HTMLButtonElement>) => {
      focusTarget = event.currentTarget;
    });
    const onBlur = vi.fn((event: ReactFocusEvent<HTMLButtonElement>) => {
      blurTarget = event.currentTarget;
    });
    const { rerender } = render(
      <ChatGPTAuthProvider options={flow.configuration}>
        <ChatGPTSignInButton onClick={onClick} onFocus={onFocus} onBlur={onBlur} />
      </ChatGPTAuthProvider>,
    );
    const button = screen.getByRole('button');
    button.focus();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocus.mock.calls[0]?.[0].nativeEvent).toBeInstanceOf(FocusEvent);
    expect(focusTarget).toBe(button);
    expect(onFocus.mock.calls[0]?.[0].isPropagationStopped()).toBe(false);
    fireEvent.click(button);
    expect(onClick.mock.calls[0]?.[0].nativeEvent).toBeInstanceOf(MouseEvent);
    expect(clickTarget).toBe(button);
    expect(preventedBefore).toBe(false);
    expect(preventedAfter).toBe(true);
    expect(flow.adapter.signIn).not.toHaveBeenCalled();
    button.blur();
    expect(onBlur.mock.calls[0]?.[0].nativeEvent).toBeInstanceOf(FocusEvent);
    expect(blurTarget).toBe(button);

    rerender(
      <ChatGPTAuthProvider options={flow.configuration}>
        <ChatGPTSignInButton />
      </ChatGPTAuthProvider>,
    );
    expect(screen.getByRole('button')).toBe(button);
    button.focus();
    expect(onFocus).toHaveBeenCalledTimes(1);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(flow.adapter.signIn).toHaveBeenCalledTimes(1);
    await act(async () => flow.result.resolve({ status: 'complete' }));
  });

  it('keeps the button as currentTarget for SVG clicks and invokes the adapter in the same stack', async () => {
    const result = deferred<ChatGPTAuthSignInAdapterResult>();
    const order: string[] = [];
    const adapter = {
      signIn: vi.fn(() => {
        order.push('adapter');
        return result.promise;
      }),
    };
    let clickedTarget: EventTarget | null = null;
    let clickedCurrentTarget: HTMLButtonElement | null = null;
    let hasSyntheticMethods = false;
    const onClick = vi.fn((event: ReactMouseEvent<HTMLButtonElement>) => {
      order.push('callback');
      clickedTarget = event.target;
      clickedCurrentTarget = event.currentTarget;
      hasSyntheticMethods =
        typeof event.persist === 'function' &&
        typeof event.isDefaultPrevented === 'function' &&
        typeof event.isPropagationStopped === 'function';
      event.persist();
    });
    render(
      <ChatGPTAuthProvider options={{ adapter }}>
        <ChatGPTSignInButton onClick={onClick} />
      </ChatGPTAuthProvider>,
    );
    const button = screen.getByRole('button');
    const logoPath = button.querySelector('svg path')!;
    expect(logoPath).not.toBeNull();
    fireEvent.click(logoPath);
    order.push('returned');
    expect(order).toEqual(['callback', 'adapter', 'returned']);
    expect(clickedTarget).toBe(logoPath);
    expect(clickedCurrentTarget).toBe(button);
    expect(hasSyntheticMethods).toBe(true);
    expect(onClick.mock.calls[0]?.[0].nativeEvent).toBeInstanceOf(MouseEvent);
    await act(async () => result.resolve({ status: 'complete' }));
  });

  it('honors synthetic stopPropagation without treating it as preventDefault', async () => {
    const flow = pendingSignIn();
    const ancestorClick = vi.fn();
    let propagationStopped = false;
    render(
      <div onClick={ancestorClick}>
        <ChatGPTAuthProvider options={flow.configuration}>
          <ChatGPTSignInButton
            onClick={(event) => {
              event.stopPropagation();
              propagationStopped = event.isPropagationStopped();
            }}
          />
        </ChatGPTAuthProvider>
      </div>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(propagationStopped).toBe(true);
    expect(ancestorClick).not.toHaveBeenCalled();
    expect(flow.adapter.signIn).toHaveBeenCalledTimes(1);
    await act(async () => flow.result.resolve({ status: 'complete' }));
  });

  it('locks the group before a consumer callback dispatches a nested click', async () => {
    const flow = pendingSignIn();
    const secondClick = vi.fn();
    const firstClick = vi.fn(() => {
      screen
        .getByTestId('nested-second')
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    render(
      <ChatGPTAuthProvider options={flow.configuration}>
        <ChatGPTSignInButton data-testid="nested-first" onClick={firstClick} />
        <ChatGPTSignInButton data-testid="nested-second" onClick={secondClick} />
      </ChatGPTAuthProvider>,
    );
    fireEvent.click(screen.getByTestId('nested-first'));
    expect(firstClick).toHaveBeenCalledTimes(1);
    expect(secondClick).not.toHaveBeenCalled();
    expect(flow.adapter.signIn).toHaveBeenCalledTimes(1);
    await act(async () => flow.result.resolve({ status: 'complete' }));
    expect(flow.onSignInComplete).toHaveBeenCalledTimes(1);
  });

  it.each(['throw', 'reject'] as const)(
    'contains handler failures that %s without changing auth outcomes',
    async (mode) => {
      const flow = pendingSignIn();
      const onError = vi.fn();
      const failure = vi.fn(() => {
        if (mode === 'throw') {
          throw new Error('Consumer handler failure');
        }
        return Promise.reject(new Error('Consumer handler failure'));
      });
      render(
        <ChatGPTAuthProvider options={{ ...flow.configuration, onError }}>
          <ChatGPTSignInButton onClick={failure} onFocus={failure} onBlur={failure} />
        </ChatGPTAuthProvider>,
      );
      const button = screen.getByRole('button');
      button.focus();
      button.blur();
      fireEvent.click(button);
      expect(failure).toHaveBeenCalledTimes(3);
      expect(flow.adapter.signIn).toHaveBeenCalledTimes(1);
      await act(async () => flow.result.resolve({ status: 'complete' }));
      expect(flow.onSignInComplete).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    },
  );

  it('does not initiate auth when the clicked button detaches synchronously in onClick', async () => {
    const flow = pendingSignIn();
    function DetachableButton() {
      const [visible, setVisible] = useState(true);
      return visible ? (
        <ChatGPTSignInButton
          data-testid="detach-on-click"
          onClick={() => {
            flushSync(() => setVisible(false));
          }}
        />
      ) : null;
    }
    render(
      <ChatGPTAuthProvider options={flow.configuration}>
        <DetachableButton />
        <ChatGPTSignInButton data-testid="retained-button" />
      </ChatGPTAuthProvider>,
    );
    fireEvent.click(screen.getByTestId('detach-on-click'));
    expect(screen.queryByTestId('detach-on-click')).toBeNull();
    expect(flow.adapter.signIn).not.toHaveBeenCalled();
    expect((screen.getByTestId('retained-button') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId('retained-button'));
    expect(flow.adapter.signIn).toHaveBeenCalledTimes(1);
    await act(async () => flow.result.resolve({ status: 'complete' }));
  });

  it('resets removed React presentation props to core defaults without replacing the view', () => {
    const flow = pendingSignIn();
    const { rerender } = render(
      <ChatGPTAuthProvider options={flow.configuration}>
        <ChatGPTSignInButton
          data-testid="updated"
          appearance="dark"
          width="full"
          text="sign-in"
          id="custom-id"
          disabled
        />
        <ChatGPTSignInButton data-testid="default" />
      </ChatGPTAuthProvider>,
    );
    const updated = screen.getByTestId('updated') as HTMLButtonElement;
    const defaults = screen.getByTestId('default') as HTMLButtonElement;
    expect(updated.getAttribute('data-chatgpt-appearance')).toBe('dark');
    expect(updated.getAttribute('data-chatgpt-width')).toBe('full');
    expect(defaults.getAttribute('data-chatgpt-appearance')).toBe('auto');
    expect(updated.disabled).toBe(true);
    rerender(
      <ChatGPTAuthProvider options={flow.configuration}>
        <ChatGPTSignInButton data-testid="updated" />
        <ChatGPTSignInButton data-testid="default" />
      </ChatGPTAuthProvider>,
    );
    expect(screen.getByTestId('updated')).toBe(updated);
    expect(updated.getAttribute('data-chatgpt-appearance')).toBe('auto');
    expect(updated.getAttribute('data-chatgpt-width')).toBe('content');
    expect(updated.hasAttribute('style')).toBe(false);
    expect(updated.textContent).toBe(defaults.textContent);
    expect(updated.disabled).toBe(false);
    expect(updated.hasAttribute('id')).toBe(false);
    expect(flow.adapter.signIn).not.toHaveBeenCalled();
  });
});

describe('React hydration', () => {
  it.each([
    {
      language: 'Japanese',
      locale: 'ja',
      lang: 'ja-JP',
      dir: 'ltr',
      messages: japaneseButtonMessages,
    },
    { language: 'Arabic', locale: 'ar-EG', lang: 'ar', dir: 'rtl', messages: arabicButtonMessages },
  ])(
    '$language label hydrates without replacing the button or changing its direction',
    async ({ locale, lang, dir, messages }) => {
      const expectedMessages = messages();
      const flow = pendingSignIn();
      const tree = (
        <div dir="rtl">
          <ChatGPTAuthProvider options={flow.configuration}>
            <ChatGPTSignInButton locale={locale} />
          </ChatGPTAuthProvider>
        </div>
      );
      const container = document.createElement('div');
      container.innerHTML = renderToString(tree);
      document.body.append(container);
      const serverButton = container.querySelector('button')!;
      expect(serverButton.textContent).toBe(expectedMessages.continue);
      expect(serverButton.lang).toBe(lang);
      expect(serverButton.dir).toBe(dir);
      const onRecoverableError = vi.fn();
      let root: Root | undefined;
      try {
        await act(async () => {
          root = hydrateRoot(container, tree, { onRecoverableError });
        });
        expect(container.querySelector('button')).toBe(serverButton);
        expect(serverButton.textContent).toBe(expectedMessages.continue);
        expect(serverButton.lang).toBe(lang);
        expect(serverButton.dir).toBe(dir);
        expect(serverButton.disabled).toBe(false);
        expect(onRecoverableError).not.toHaveBeenCalled();
        expect(flow.adapter.signIn).not.toHaveBeenCalled();
      } finally {
        await act(async () => root?.unmount());
        container.remove();
      }
    },
  );

  it('hydrates the inert server button in place and starts auth only after a client click', async () => {
    const flow = pendingSignIn();
    const tree = (
      <ChatGPTAuthProvider options={flow.configuration}>
        <ChatGPTSignInButton />
      </ChatGPTAuthProvider>
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(tree);
    document.body.append(container);
    const serverButton = container.querySelector('button')!;
    expect(serverButton).not.toBeNull();
    expect(serverButton.disabled).toBe(true);
    expect(serverButton.textContent).toContain('Continue with ChatGPT');
    serverButton.click();
    expect(flow.adapter.signIn).not.toHaveBeenCalled();
    const onRecoverableError = vi.fn();
    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, tree, { onRecoverableError });
      });
      expect(container.querySelector('button')).toBe(serverButton);
      expect(serverButton.disabled).toBe(false);
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(flow.adapter.signIn).not.toHaveBeenCalled();
      fireEvent.click(serverButton);
      expect(flow.adapter.signIn).toHaveBeenCalledTimes(1);
      await act(async () => flow.result.resolve({ status: 'complete' }));
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  });

  it('hydrates custom styles and the automatic stylesheet without replacing the button', async () => {
    const flow = pendingSignIn();
    const tree = (
      <ChatGPTAuthProvider options={flow.configuration}>
        <ChatGPTSignInButton
          className="account-button"
          style={{ marginTop: 10, width: 250, flexGrow: 2 }}
        />
      </ChatGPTAuthProvider>
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(tree);
    document.body.append(container);
    const serverButton = container.querySelector('button')!;
    expect(serverButton.className).toBe('account-button');
    expect(serverButton.style.marginTop).toBe('10px');
    expect(serverButton.style.width).toBe('250px');
    const onRecoverableError = vi.fn();
    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, tree, { onRecoverableError });
      });
      expect(container.querySelector('button')).toBe(serverButton);
      expect(serverButton.disabled).toBe(false);
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(document.querySelector('style[data-href~="openai-auth-button-v3"]')).not.toBeNull();
      await act(async () =>
        root?.render(
          <ChatGPTAuthProvider options={flow.configuration}>
            <ChatGPTSignInButton />
          </ChatGPTAuthProvider>,
        ),
      );
      expect(container.querySelector('button')).toBe(serverButton);
      expect(serverButton.hasAttribute('class')).toBe(false);
      expect(serverButton.style.cssText).toBe('');
      expect(flow.adapter.signIn).not.toHaveBeenCalled();
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  });
});

describe('React configuration validation', () => {
  it('reports a missing provider before attempting auth', () => {
    expect(() => render(<ChatGPTSignInButton />)).toThrowError(
      expect.objectContaining({ code: 'missing_provider', name: 'ChatGPTAuthError' }),
    );
  });

  it.each([
    ['missing', {}],
    ['null', { options: null }],
    ['undefined', { options: undefined }],
  ])('rejects a %s configuration before mounting', (_description, props) => {
    expect(() =>
      render(
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
    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each([
    'adapter',
    'authPath',
    'onSignInComplete',
    'onCancel',
    'onError',
    'onInteractionChange',
    'children',
    'logo',
  ])('warns and ignores the unsupported button prop %s without changing sign-in', async (key) => {
    const flow = pendingSignIn();
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unsupportedCallback = vi.fn();
    const values: Record<string, unknown> = {
      adapter: { signIn: unsupportedCallback },
      authPath: '/unsupported-route',
      onSignInComplete: unsupportedCallback,
      onCancel: unsupportedCallback,
      onError: unsupportedCallback,
      onInteractionChange: unsupportedCallback,
      children: 'Injected children',
      logo: 'injected-logo',
    };
    render(
      <ChatGPTAuthProvider options={flow.configuration}>
        <ChatGPTSignInButton text="sign-in" id="supported-id" {...{ [key]: values[key] }} />
      </ChatGPTAuthProvider>,
    );
    const button = screen.getByRole('button', { name: 'Sign in with ChatGPT' });
    expect(button.id).toBe('supported-id');
    expect(button.className).not.toContain('injected-class');
    expect(button.hasAttribute('style')).toBe(false);
    expect(button.hasAttribute('logo')).toBe(false);
    expect(button.textContent).not.toContain('Injected children');
    expect(consoleWarn).toHaveBeenCalledWith(
      `ChatGPTSignInButton does not support the "${key}" prop. It will be ignored.`,
    );
    expect(flow.adapter.signIn).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(flow.adapter.signIn).toHaveBeenCalledTimes(1);
    await act(async () => flow.result.resolve({ status: 'complete' }));
    expect(flow.onSignInComplete).toHaveBeenCalledExactlyOnceWith({ delivery: 'delegated' });
    expect(unsupportedCallback).not.toHaveBeenCalled();
  });

  it('warns and ignores unsupported provider props while keeping its signIn binding', async () => {
    const flow = pendingSignIn();
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <ChatGPTAuthProvider options={flow.configuration} {...{ authPath: '/unsupported-route' }}>
        <ChatGPTSignInButton />
      </ChatGPTAuthProvider>,
    );
    expect(consoleWarn).toHaveBeenCalledWith(
      'ChatGPTAuthProvider does not support the "authPath" prop. It will be ignored.',
    );
    expect(flow.adapter.signIn).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button'));
    expect(flow.adapter.signIn).toHaveBeenCalledTimes(1);
    await act(async () => flow.result.resolve({ status: 'complete' }));
    expect(flow.onSignInComplete).toHaveBeenCalledExactlyOnceWith({ delivery: 'delegated' });
  });

  it('still rejects invalid values for supported presentation props', () => {
    const flow = pendingSignIn();
    expect(() =>
      render(
        <ChatGPTAuthProvider options={flow.configuration}>
          <ChatGPTSignInButton {...{ appearance: 'invalid' as never }} />
        </ChatGPTAuthProvider>,
      ),
    ).toThrowError(ChatGPTAuthError);
    expect(flow.adapter.signIn).not.toHaveBeenCalled();
  });
});
