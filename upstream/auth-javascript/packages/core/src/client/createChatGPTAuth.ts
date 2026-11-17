import { ChatGPTAuthError } from '../ChatGPTAuthError.js';
import type {
  ChatGPTAuthSignInAdapterResult,
  ChatGPTAuthSignInConfiguration,
  ChatGPTAuthSignInState,
} from '../types.js';
import {
  bindingOptions,
  signInError,
  isButtonClick,
  validateElement,
  adapterResult,
} from './createChatGPTAuth.utils.js';
import type {
  AdapterFailureCode,
  InteractionErrorResult,
  InteractionTarget,
} from './createChatGPTAuth.types.js';
import type {
  ChatGPTAuthClient,
  ChatGPTAuthClientSnapshot,
  ButtonView,
  ChatGPTAuthSignInButtonView,
} from './types.js';
import { renderButton } from './renderButton.js';
import { configuration, destination } from './configuration.js';
import { invalid, readOptions } from './options.js';
import { notify } from './notify.js';
import { presentation, presentationKeys } from './presentation.js';
import { SessionController } from './SessionController.js';

/** Create an inert client. Authentication starts only from an attached button's click. */
export function createChatGPTAuth(signIn: ChatGPTAuthSignInConfiguration): ChatGPTAuthClient {
  let next = configuration(signIn);
  const session = new SessionController(next.adapter?.session);
  let destroyed = false;
  let busy = false;
  let starting = false;
  let generation = 0;
  const views = new Set<ButtonView>();
  const targets = new Set<InteractionTarget>();
  const listeners = new Set<() => void>();
  let state: ChatGPTAuthSignInState = Object.freeze({ status: 'idle' });
  let snapshot: ChatGPTAuthClientSnapshot = Object.freeze({ busy: false, state });
  const cleanup = Promise.resolve();
  const assertLive = () => {
    if (destroyed) {
      throw new ChatGPTAuthError({
        code: 'group_destroyed',
        message: 'The sign-in client has been destroyed.',
        retryable: false,
      });
    }
  };
  const render = () => {
    for (const view of views) {
      view.render(busy);
    }
  };
  const publish = (value: boolean, interaction = state) => {
    if (busy === value && state === interaction) {
      return;
    }
    busy = value;
    state = interaction;
    snapshot = Object.freeze({ busy, state });
    render();
    for (const listener of [...listeners]) {
      if (listeners.has(listener)) {
        notify(listener);
      }
    }
  };
  const setBusy = (value: boolean) => publish(value);
  const route = (config: ChatGPTAuthSignInConfiguration, container: HTMLElement) => {
    if (config.authPath === undefined) {
      return undefined;
    }
    const origin = container.ownerDocument.defaultView?.location.origin;
    if (!origin) {
      throw invalid(
        'invalid_configuration',
        'authPath',
        'a button in a browser document with an origin',
      );
    }
    return destination(config.authPath, origin, true);
  };

  function activate(target: InteractionTarget, event: MouseEvent, beforeSignIn?: () => void): void {
    if (
      destroyed ||
      busy ||
      starting ||
      !targets.has(target) ||
      target.disabled() ||
      target.button.disabled ||
      !isButtonClick(target.button, event)
    ) {
      return;
    }
    // Lock before consumer code: onClick can synchronously dispatch another button's click.
    starting = true;
    setBusy(true);
    if (!destroyed) {
      notify(beforeSignIn);
    }
    starting = false;
    if (destroyed) {
      return;
    }
    if (event.defaultPrevented || !targets.has(target) || target.disabled()) {
      setBusy(false);
      return;
    }

    // onClick is the last chance to prevent initiation or replace the upcoming binding.
    const attempt = next;
    const token = ++generation;
    const live = () => !destroyed && generation === token;
    const change = (state: ChatGPTAuthSignInState) => {
      if (!live()) {
        return;
      }
      const current = Object.freeze(state);
      publish(busy, current);
      if (live()) {
        notify(attempt.onInteractionChange, current);
      }
    };
    const finish = (result: ChatGPTAuthSignInAdapterResult | InteractionErrorResult) => {
      if (!live()) {
        return;
      }
      change(result);
      if (live() && result.status === 'complete') {
        notify(attempt.onSignInComplete, Object.freeze({ delivery: 'delegated' }));
      }
      if (live() && result.status === 'cancelled') {
        notify(attempt.onCancel);
      }
      if (live() && result.status === 'error') {
        notify(attempt.onError, result.error);
      }
      if (live()) {
        setBusy(result.status === 'redirecting');
      }
      if (result.status === 'complete') {
        // Complete callbacks can update the app session before the client reads it again.
        // Recovery resets interaction state but does not invalidate an accepted completion.
        queueMicrotask(() => {
          session.refreshObserved();
        });
      }
    };
    const fail = (code: AdapterFailureCode) => finish(signInError(code));

    change({ status: 'pending' });
    if (!live()) {
      return;
    }
    if (attempt.authPath !== undefined) {
      try {
        const destination = route(attempt, target.container)!;
        change({ status: 'redirecting' });
        if (live()) {
          target.container.ownerDocument.defaultView!.location.assign(destination);
        }
      } catch {
        fail('navigation_failed');
      }
      return;
    }

    let result: unknown;
    try {
      // Do not schedule or await before this call: the adapter may open a popup.
      result = attempt.adapter.signIn();
    } catch {
      fail('adapter_failed');
      return;
    }
    void Promise.resolve(result).then(
      (outcome: unknown) => {
        if (!live()) {
          return;
        }
        try {
          finish(adapterResult(outcome));
        } catch {
          fail('adapter_invalid_result');
        }
      },
      () => fail('adapter_failed'),
    );
  }

  return {
    mountSignInButton(container, options = {}): ChatGPTAuthSignInButtonView {
      assertLive();
      validateElement(container, 'container');
      const resolved = presentation(options);
      route(next, container);
      const target: InteractionTarget = {
        get button() {
          return view.button;
        },
        container,
        disabled: () => view.presentation.disabled,
        detach: () => view.detach(),
      };
      const view = renderButton(container, resolved, (view, event) => {
        const onClick = view.presentation.onClick;
        activate(target, event, () => notify(onClick, event));
      });
      targets.add(target);
      views.add(view);
      view.render(busy);
      return {
        update(options) {
          assertLive();
          if (!view.attached) {
            throw new ChatGPTAuthError({
              code: 'group_destroyed',
              message: 'The sign-in button has been destroyed.',
              retryable: false,
            });
          }
          const patch = readOptions(options, presentationKeys, 'invalid_presentation');
          view.presentation = presentation({ ...view.presentation, ...patch });
          view.render(busy);
        },
        destroy() {
          targets.delete(target);
          views.delete(view);
          view.detach();
          return cleanup;
        },
      };
    },
    bindSignInButton(button, options = {}) {
      assertLive();
      validateElement(button, 'button');
      let current = bindingOptions(options);
      route(next, button);
      const target: InteractionTarget = {
        button,
        container: button,
        disabled: () => current.disabled,
        detach: () => undefined,
      };
      targets.add(target);
      return {
        update(options) {
          assertLive();
          if (!targets.has(target)) {
            throw new ChatGPTAuthError({
              code: 'group_destroyed',
              message: 'The sign-in button binding has been destroyed.',
              retryable: false,
            });
          }
          const patch = readOptions(options, ['disabled'], 'invalid_presentation');
          current = bindingOptions({ ...current, ...patch });
        },
        activate(event, beforeSignIn) {
          if (beforeSignIn !== undefined && typeof beforeSignIn !== 'function') {
            throw invalid('invalid_presentation', 'beforeSignIn', 'a function or undefined');
          }
          activate(target, event, beforeSignIn);
        },
        destroy() {
          targets.delete(target);
          return cleanup;
        },
      };
    },
    getSnapshot: () => snapshot,
    getSessionSnapshot: session.getSnapshot,
    subscribeSession(listener) {
      if (typeof listener !== 'function') {
        throw invalid('invalid_configuration', 'listener', 'a function');
      }
      return session.subscribe(listener);
    },
    refreshSession() {
      assertLive();
      return session.refresh();
    },
    recover(options = {}) {
      assertLive();
      const recovery = readOptions(
        options,
        ['abandonPending', 'expectedState'],
        'invalid_configuration',
      );
      if (recovery.abandonPending !== undefined && typeof recovery.abandonPending !== 'boolean') {
        throw new ChatGPTAuthError({
          code: 'invalid_configuration',
          param: 'abandonPending',
          message: 'abandonPending must be a boolean.',
          retryable: false,
        });
      }
      if (recovery.expectedState !== undefined && recovery.expectedState !== state) {
        throw new ChatGPTAuthError({
          code: 'stale_recovery',
          param: 'expectedState',
          message:
            'The interaction changed during host reconciliation. Check external authentication again before recovering.',
          retryable: false,
        });
      }
      if (starting || (state.status === 'pending' && recovery.abandonPending !== true)) {
        throw new ChatGPTAuthError({
          code: 'interaction_pending',
          param: 'abandonPending',
          message: starting
            ? 'Recovery is unavailable during the initiating click handler.'
            : 'Wait for the attempt to settle, or pass abandonPending: true after reconciling external authentication.',
          retryable: false,
        });
      }
      // Retirement is local only. It cannot stop a popup or cancel an external auth transaction.
      const changed = busy || state.status !== 'idle';
      if (!changed) {
        return;
      }
      const token = ++generation;
      const idle = state.status === 'idle' ? state : Object.freeze({ status: 'idle' as const });
      publish(false, idle);
      if (!destroyed && generation === token) {
        notify(next.onInteractionChange, idle);
      }
    },
    subscribe(listener) {
      if (typeof listener !== 'function') {
        throw invalid('invalid_configuration', 'listener', 'a function');
      }
      if (destroyed) {
        return () => undefined;
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    updateSignIn(config) {
      assertLive();
      const candidate = configuration(config);
      for (const target of targets) {
        route(candidate, target.container);
      }
      next = candidate;
      session.updateSource(candidate.adapter?.session);
    },
    destroy() {
      if (!destroyed) {
        destroyed = true;
        generation += 1;
        session.destroy();
        for (const target of targets) {
          target.detach();
        }
        targets.clear();
        views.clear();
        publish(false, state.status === 'idle' ? state : Object.freeze({ status: 'idle' }));
        listeners.clear();
      }
      return cleanup;
    },
  };
}
