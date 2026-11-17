import type { ChatGPTAuthSignInConfiguration, ChatGPTAuthSignInState } from '@openai/auth';
import { InteractionStatus } from './InteractionStatus.js';
import {
  createChatGPTAuth,
  type ChatGPTAuthSignInButtonView,
  type ChatGPTAuthClient,
} from '@openai/auth/client';
import { useId, useLayoutEffect, useRef, useState } from 'react';

export interface DomDemoProps {
  readonly signIn: ChatGPTAuthSignInConfiguration;
  readonly locale: string;
  readonly generation: number;
  readonly onRecovered: () => void;
  readonly showSecondary: boolean;
  readonly onToggleSecondary: () => void;
}

/** The React shell owns the containers. The public DOM API owns both native buttons. */
export function DomDemo({
  signIn,
  locale,
  generation,
  showSecondary,
  onToggleSecondary,
  onRecovered,
}: DomDemoProps) {
  const [state, setState] = useState<ChatGPTAuthSignInState>({ status: 'idle' });
  const primary = useRef<HTMLDivElement>(null);
  const secondary = useRef<HTMLDivElement>(null);
  const activeClient = useRef<ChatGPTAuthClient | null>(null);
  const primaryView = useRef<ChatGPTAuthSignInButtonView | null>(null);
  const secondaryView = useRef<ChatGPTAuthSignInButtonView | null>(null);
  const committedSignIn = useRef(signIn);
  const committedLocale = useRef(locale);
  const headingId = useId();
  const secondaryId = useId();

  useLayoutEffect(() => {
    activeClient.current?.updateSignIn(signIn);
    committedSignIn.current = signIn;
  }, [signIn]);

  useLayoutEffect(() => {
    committedLocale.current = locale;
    primaryView.current?.update({ locale });
    secondaryView.current?.update({ locale });
  }, [locale]);

  useLayoutEffect(() => {
    if (!primary.current) {
      return;
    }
    const auth = createChatGPTAuth(committedSignIn.current);
    activeClient.current = auth;
    const update = () => setState(auth.getSnapshot().state);
    const unsubscribe = auth.subscribe(update);
    update();
    try {
      primaryView.current = auth.mountSignInButton(primary.current, {
        appearance: 'light',
        width: 'full',
        locale: committedLocale.current,
        'data-testid': 'dom-primary',
      });
    } catch (error) {
      activeClient.current = null;
      unsubscribe();
      void auth.destroy();
      throw error;
    }
    return () => {
      unsubscribe();
      if (activeClient.current === auth) {
        activeClient.current = null;
        primaryView.current = null;
      }
      void auth.destroy();
    };
  }, [generation]);

  useLayoutEffect(() => {
    if (!showSecondary || !secondary.current || !activeClient.current) {
      return;
    }
    const view = activeClient.current.mountSignInButton(secondary.current, {
      appearance: 'dark',
      width: 'full',
      text: 'sign-in',
      locale: committedLocale.current,
      'data-testid': 'dom-secondary',
    });
    secondaryView.current = view;
    return () => {
      if (secondaryView.current === view) {
        secondaryView.current = null;
      }
      void view.destroy();
    };
  }, [generation, showSecondary]);

  return (
    <section className="demo-panel" aria-labelledby={headingId} data-testid="dom-demo">
      <header className="demo-panel__header">
        <h2 id={headingId}>DOM</h2>
        <span className="demo-badge">Client</span>
        <p>Both buttons share one core client.</p>
      </header>
      <div className="demo-buttons">
        <div className="demo-button-slot">
          <span className="demo-button-label">Primary button</span>
          <div ref={primary} />
        </div>
        <div className="demo-button-slot" id={secondaryId}>
          <span className="demo-button-label">Second button</span>
          {showSecondary ? (
            <div ref={secondary} />
          ) : (
            <p className="demo-placeholder">The button is detached. The client remains active.</p>
          )}
        </div>
      </div>
      <div className="demo-controls">
        <button
          type="button"
          className="secondary-button"
          onClick={onToggleSecondary}
          aria-controls={secondaryId}
          aria-expanded={showSecondary}
        >
          {showSecondary ? 'Hide second DOM button' : 'Show second DOM button'}
        </button>
        <p>Detach a view during a pending attempt. Its client still owns the attempt.</p>
      </div>
      <InteractionStatus
        api="dom"
        state={state}
        recover={(options) => activeClient.current?.recover(options)}
        onRecovered={onRecovered}
      />
    </section>
  );
}
