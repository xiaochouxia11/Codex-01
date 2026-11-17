import { ChatGPTAuthError, type ChatGPTAuthSignInState } from '@openai/auth';
import {
  createChatGPTAuth,
  type ChatGPTAuthClientSnapshot,
  type ChatGPTAuthRecoveryOptions,
} from '@openai/auth/client';
import type {
  ActiveClient,
  ProviderBinding,
  ProviderSessionSnapshot,
  ProviderSnapshot,
  RegisteredButton,
} from './ProviderController.types.js';
import { readSessionSource } from './ChatGPTAuthProvider.utils.js';
import type { ButtonRegistration } from '../../types.js';

const idleState: ChatGPTAuthSignInState = Object.freeze({ status: 'idle' });
const inactiveSnapshot: ProviderSnapshot = Object.freeze({
  ready: false,
  busy: false,
  state: idleState,
});
const inactiveSessionSnapshot: ProviderSessionSnapshot = Object.freeze({
  client: undefined,
  source: undefined,
  session: Object.freeze({ status: 'unavailable', profile: null }),
});

/** Bind committed React elements to a client and dispose only provider-owned resources. */
export class ProviderController {
  private binding: ProviderBinding | undefined;
  private readonly buttons = new Set<RegisteredButton>();
  private readonly listeners = new Set<() => void>();
  private readonly sessionListeners = new Set<() => void>();
  private active: ActiveClient | undefined;
  private activation: object | undefined;
  private snapshot = inactiveSnapshot;
  private sessionSnapshot = inactiveSessionSnapshot;

  getSnapshot = (): ProviderSnapshot => this.snapshot;
  getServerSnapshot = (): ProviderSnapshot => inactiveSnapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSessionSnapshot = (): ProviderSessionSnapshot => this.sessionSnapshot;
  getServerSessionSnapshot = (): ProviderSessionSnapshot => inactiveSessionSnapshot;
  subscribeSession = (listener: () => void): (() => void) => {
    this.sessionListeners.add(listener);
    return () => {
      this.sessionListeners.delete(listener);
    };
  };

  private publish(ready: boolean, snapshot: ChatGPTAuthClientSnapshot = inactiveSnapshot): void {
    if (
      this.snapshot.ready === ready &&
      this.snapshot.busy === snapshot.busy &&
      this.snapshot.state === snapshot.state
    ) {
      return;
    }
    this.snapshot = Object.freeze({ ready, busy: snapshot.busy, state: snapshot.state });
    for (const listener of this.listeners) {
      listener();
    }
  }

  private publishSession(): void {
    const active = this.active;
    const binding = this.binding;
    const next: ProviderSessionSnapshot =
      active && binding
        ? {
            client: binding.client,
            source: readSessionSource(binding),
            session: active.client.getSessionSnapshot(),
          }
        : inactiveSessionSnapshot;
    if (
      next.client === this.sessionSnapshot.client &&
      next.source === this.sessionSnapshot.source &&
      next.session === this.sessionSnapshot.session
    ) {
      return;
    }
    this.sessionSnapshot = Object.freeze(next);
    for (const listener of this.sessionListeners) {
      listener();
    }
  }

  recover = (options?: ChatGPTAuthRecoveryOptions): void => {
    if (!this.active) {
      throw new ChatGPTAuthError({
        code: 'group_inactive',
        message: 'Wait until the provider has mounted before recovering the interaction.',
        retryable: false,
      });
    }
    this.active.client.recover(options);
  };

  update(binding: ProviderBinding): void {
    const previous = this.binding;
    if (binding === previous) {
      return;
    }
    const changesClient = binding.client !== previous?.client;
    if (changesClient) {
      this.stop();
      this.binding = binding;
      if (this.activation) {
        this.start();
      }
      return;
    }
    if (binding.options && binding.options !== previous?.options) {
      // The client captures configuration per attempt. Updating only affects the next attempt.
      this.active?.client.updateSignIn(binding.options);
    }
    this.binding = binding;
    this.publishSession();
  }

  private start(): void {
    const binding = this.binding;
    if (!binding || (!binding.client && !binding.options)) {
      throw new ChatGPTAuthError({
        code: 'invalid_configuration',
        message: 'ChatGPTAuthProvider requires exactly one of "client" or "options".',
        retryable: false,
        param: 'options',
      });
    }
    const active: ActiveClient = {
      client: binding.client ?? createChatGPTAuth(binding.options!),
      owned: !binding.client,
      handles: new Map(),
      unsubscribe: [],
    };
    this.active = active;
    try {
      active.unsubscribe.push(
        active.client.subscribe(() => {
          if (this.active === active) {
            this.publish(true, active.client.getSnapshot());
          }
        }),
      );
      active.unsubscribe.push(
        active.client.subscribeSession(() => {
          if (this.active === active) {
            this.publishSession();
          }
        }),
      );
      for (const button of this.buttons) {
        active.handles.set(button, active.client.bindSignInButton(button.element, button.options));
      }
      this.publish(true, active.client.getSnapshot());
      this.publishSession();
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  private stop(): void {
    const active = this.active;
    this.active = undefined;
    if (active) {
      for (const unsubscribe of active.unsubscribe) {
        unsubscribe();
      }
      for (const handle of active.handles.values()) {
        void handle.destroy();
      }
      active.handles.clear();
      if (active.owned) {
        void active.client.destroy();
      }
    }
    this.publish(false);
    this.publishSession();
  }

  activate(): () => void {
    const activation = {};
    this.activation = activation;
    this.start();
    return () => {
      if (this.activation === activation) {
        this.activation = undefined;
        this.stop();
      }
    };
  }

  register(element: HTMLButtonElement): ButtonRegistration {
    const button: RegisteredButton = { element, options: {} };
    this.buttons.add(button);
    const active = this.active;
    if (active) {
      try {
        active.handles.set(button, active.client.bindSignInButton(element));
      } catch (error) {
        this.buttons.delete(button);
        throw error;
      }
    }
    return {
      update: (options) => {
        if (!this.buttons.has(button)) {
          return;
        }
        this.active?.handles.get(button)?.update(options);
        button.options = options;
      },
      activate: (event, binding, beforeSignIn) => {
        if (!this.active?.handles.has(button)) {
          return;
        }
        // Descendant layout effects can click before the provider's layout effect.
        // Only committed event handlers supply a binding; suspended renders stay inert.
        this.update(binding);
        this.active?.handles.get(button)?.activate(event, beforeSignIn);
      },
      detach: () => {
        if (!this.buttons.delete(button)) {
          return;
        }
        const current = this.active;
        const handle = current?.handles.get(button);
        current?.handles.delete(button);
        if (handle) {
          void handle.destroy();
        }
      },
    };
  }
}
