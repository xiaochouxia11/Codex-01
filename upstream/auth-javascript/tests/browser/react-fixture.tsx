import { StrictMode, createRef, useState, useEffect, type SyntheticEvent } from 'react';
import type { ChatGPTAuthSignInConfiguration, ChatGPTAuthSignInAdapterResult } from '@openai/auth';
import type { ChatGPTAuthSignInButtonProps } from '@openai/auth-react';
import type { ReactFixtureState } from './react-fixture-types.js';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import {
  ChatGPTAuthProvider,
  ChatGPTSignInButton,
  useChatGPTSignInState,
  useChatGPTSignInRecovery,
} from '@openai/auth-react';

const mode = new URLSearchParams(location.search).get('mode') ?? 'adapter';
const objectRef = createRef<HTMLButtonElement>();
const refs = { attachments: 0, cleanups: 0, nulls: 0 };
let callbackElement: HTMLButtonElement | null = null;
function callbackRef(element: HTMLButtonElement | null) {
  callbackElement = element;
  if (!element) {
    refs.nulls++;
    return;
  }
  refs.attachments++;
  if (mode === 'ref-cleanup') {
    return () => {
      refs.cleanups++;
      callbackElement = null;
    };
  }
}
const state: ReactFixtureState = {
  calls: 0,
  reconciliations: 0,
  recoveryErrors: [],
  completed: [],
  cancelled: 0,
  interactions: [],
  events: [],
  order: [],
  activation: [],
  popupOpened: false,
};
const persist = () => sessionStorage.setItem('react-auth-fixture', JSON.stringify(state));
const record = (listener: string, event: SyntheticEvent<HTMLElement>) => {
  state.events.push({
    listener,
    type: event.type,
    nativeType: event.nativeEvent?.type,
    currentTargetTag: event.currentTarget?.tagName,
    currentTargetId: event.currentTarget?.id,
    targetTag: event.target instanceof Element ? event.target.tagName.toLowerCase() : '',
    targetId: event.target instanceof Element ? event.target.id : '',
    synthetic: typeof event.isDefaultPrevented === 'function' && !(event instanceof Event),
    nativeMouseEvent: event.nativeEvent instanceof MouseEvent,
    nativeFocusEvent: event.nativeEvent instanceof FocusEvent,
  });
  state.order.push(listener);
  persist();
};
let settle: ((result: ChatGPTAuthSignInAdapterResult) => void) | undefined;
const signIn: ChatGPTAuthSignInConfiguration = mode.startsWith('auth-path')
  ? {
      authPath: '/auth/start?react=1',
      onInteractionChange: ({ status }) => {
        state.interactions.push(status);
        persist();
      },
    }
  : {
      adapter: {
        signIn() {
          state.calls++;
          state.order.push('adapter');
          state.activation.push(navigator.userActivation.isActive);
          if (mode === 'popup') {
            state.popupOpened = Boolean(
              window.open('/popup', '_blank', 'popup,width=400,height=500'),
            );
          }
          persist();
          return new Promise<ChatGPTAuthSignInAdapterResult>((resolve) => {
            settle = resolve;
          });
        },
      },
      onInteractionChange: ({ status }) => {
        state.interactions.push(status);
        persist();
      },
      onSignInComplete: (result) => {
        state.completed.push(result);
        persist();
      },
      onCancel: () => {
        state.cancelled++;
        persist();
      },
    };

let finishReconciliation: (() => void) | undefined;
function InteractionControls() {
  const interaction = useChatGPTSignInState();
  const recover = useChatGPTSignInRecovery();
  useEffect(() => {
    let active = true;
    const restored = (event: PageTransitionEvent) => {
      if (!event.persisted) {
        return;
      }
      state.reconciliations++;
      // Stand-in for the host checking its authoritative transaction/session endpoint.
      void new Promise<void>((resolve) => {
        finishReconciliation = resolve;
      })
        .then(() => {
          if (active) {
            recover();
          }
        })
        .catch((error) => {
          state.recoveryErrors.push(
            typeof error === 'object' &&
              error !== null &&
              'code' in error &&
              typeof error.code === 'string'
              ? error.code
              : 'unknown',
          );
        });
    };
    window.addEventListener('pageshow', restored);
    return () => {
      active = false;
      window.removeEventListener('pageshow', restored);
    };
  }, [recover]);
  return <output data-testid="react-interaction-state">{interaction.status}</output>;
}

function Fixture() {
  const [showFirst, setShowFirst] = useState(true);
  const buttonProps = (id: string): ChatGPTAuthSignInButtonProps & { 'data-testid': string } => ({
    id,
    'data-testid': id,
    onClick(event) {
      record('button:click', event);
      if (mode.endsWith('prevent-default')) {
        event.preventDefault();
      }
      if (mode === 'stop-propagation') {
        event.stopPropagation();
      }
      if (mode === 'reentrant' && id === 'react-primary') {
        document.getElementById('react-secondary')?.click();
      }
      if (mode === 'detach-onclick' && id === 'react-primary') {
        flushSync(() => setShowFirst(false));
      }
    },
    onFocus: (event) => record('button:focus', event),
    onBlur: (event) => record('button:blur', event),
  });

  return (
    <div
      id="react-parent"
      onClick={(event) => record('parent:click', event)}
      onFocus={(event) => record('parent:focus', event)}
      onBlur={(event) => record('parent:blur', event)}
    >
      <ChatGPTAuthProvider options={signIn}>
        <InteractionControls />
        {showFirst && (
          <ChatGPTSignInButton
            {...buttonProps('react-primary')}
            ref={mode.startsWith('ref-') ? callbackRef : undefined}
          />
        )}
        <ChatGPTSignInButton
          {...buttonProps('react-secondary')}
          ref={mode.startsWith('ref-') ? objectRef : undefined}
          appearance="dark"
          text="sign-in"
        />
      </ChatGPTAuthProvider>
    </div>
  );
}

const element = document.getElementById('react-root');
if (!element) {
  throw new Error('Missing React fixture root');
}
const root = createRoot(element);
window.reactFixture = {
  state,
  finishReconciliation() {
    finishReconciliation?.();
  },
  resolve(status) {
    if (!settle) {
      throw new Error('No React adapter attempt is pending');
    }
    const resolve = settle;
    settle = undefined;
    resolve({ status });
  },
  destroy: () => root.unmount(),
  readRefs: () => ({
    ...refs,
    callbackElementId: callbackElement?.id ?? null,
    objectElementId: objectRef.current?.id ?? null,
  }),
};
root.render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);
