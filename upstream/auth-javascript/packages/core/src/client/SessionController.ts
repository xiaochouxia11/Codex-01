import type { ChatGPTAuthSessionSource } from '../types.js';
import { notify } from './notify.js';
import { readSession } from './SessionController.utils.js';
import type { SessionObservation, SessionRequest } from './SessionController.types.js';
import type { ChatGPTAuthSessionSnapshot } from './types.js';

const unavailable: ChatGPTAuthSessionSnapshot = Object.freeze({
  status: 'unavailable',
  profile: null,
});
const loading: ChatGPTAuthSessionSnapshot = Object.freeze({ status: 'loading', profile: null });
const failed: ChatGPTAuthSessionSnapshot = Object.freeze({ status: 'error', profile: null });

/** Own the app-session reader independently of any renderer or button. */
export class SessionController {
  private source: ChatGPTAuthSessionSource | undefined;
  private snapshot: ChatGPTAuthSessionSnapshot;
  private observation: SessionObservation | undefined;
  private request: SessionRequest | undefined;
  private listeners = new Set<() => void>();
  private generation = 0;
  private destroyed = false;

  constructor(source: ChatGPTAuthSessionSource | undefined) {
    this.source = source;
    this.snapshot = source ? loading : unavailable;
  }

  getSnapshot = (): ChatGPTAuthSessionSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    if (this.destroyed) {
      return () => undefined;
    }
    // Each subscription owns its lifetime, including repeated use of the same callback.
    const subscription = () => listener();
    this.listeners.add(subscription);
    if (this.listeners.size === 1) {
      this.start();
    }
    return () => {
      if (!this.listeners.delete(subscription) || this.listeners.size !== 0) {
        return;
      }
      const generation = ++this.generation;
      this.stop();
      if (generation === this.generation && !this.destroyed && !this.listeners.size) {
        this.publish(this.source ? loading : unavailable);
      }
    };
  };

  updateSource(source: ChatGPTAuthSessionSource | undefined): void {
    if (this.destroyed || this.source === source) {
      return;
    }
    const generation = ++this.generation;
    this.source = source;
    this.stop();
    if (generation !== this.generation || this.destroyed) {
      return;
    }
    this.publish(source ? loading : unavailable);
    if (generation === this.generation) {
      this.start();
    }
  }

  refresh = (): Promise<void> => this.read(true);

  refreshObserved(): void {
    if (this.listeners.size) {
      void this.refresh();
    }
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.generation += 1;
    this.source = undefined;
    this.stop();
    this.publish(unavailable);
    this.listeners.clear();
  }

  private publish(snapshot: ChatGPTAuthSessionSnapshot): void {
    if (this.snapshot === snapshot) {
      return;
    }
    this.snapshot = Object.freeze(snapshot);
    for (const listener of [...this.listeners]) {
      if (this.listeners.has(listener)) {
        notify(listener);
      }
    }
  }

  private stop(): void {
    const observation = this.observation;
    const request = this.request;
    // Retire identities before application abort handlers or cleanup can re-enter the client.
    this.observation = undefined;
    this.request = undefined;
    request?.controller.abort();
    request?.finish();
    observation?.cleanup?.();
  }

  private start(): void {
    const source = this.source;
    if (this.destroyed || this.observation || !source || !this.listeners.size) {
      return;
    }
    this.generation += 1;
    const observation: SessionObservation = {};
    this.observation = observation;
    const live = () => this.observation === observation && this.source === source;
    let notified = false;
    const refresh = () => {
      if (live()) {
        notified = true;
        void this.read(true);
      }
    };
    const revalidate = () => {
      if (live()) {
        void this.read(false);
      }
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        revalidate();
      }
    };
    const browser = typeof window === 'undefined' ? undefined : window;
    let unsubscribe: (() => void) | undefined;
    observation.cleanup = () => {
      browser?.removeEventListener('focus', revalidate);
      browser?.removeEventListener('pageshow', onPageShow);
      notify(unsubscribe);
    };
    browser?.addEventListener('focus', revalidate);
    browser?.addEventListener('pageshow', onPageShow);
    try {
      if (source.subscribe) {
        const cleanup = source.subscribe(refresh);
        if (typeof cleanup !== 'function') {
          throw new Error('Invalid session subscription');
        }
        if (!live()) {
          notify(cleanup);
          return;
        }
        unsubscribe = cleanup;
      }
      // A source can notify synchronously during subscribe(). Share that first read.
      if (live() && !notified && !this.request) {
        void this.read(true);
      }
    } catch {
      if (live()) {
        const generation = ++this.generation;
        this.stop();
        if (generation === this.generation && !this.destroyed) {
          this.publish(failed);
        }
      }
    }
  }

  private read(invalidate: boolean): Promise<void> {
    const source = this.source;
    if (this.destroyed || !source) {
      return Promise.resolve();
    }
    // Focus and pageshow events can arrive together. An active read already revalidates.
    if (!invalidate && this.request) {
      return this.request.promise;
    }
    const previous = this.request;
    let finish!: () => void;
    const request: SessionRequest = {
      controller: new AbortController(),
      promise: new Promise<void>((resolve) => {
        finish = resolve;
      }),
      finish: () => finish(),
    };
    this.request = request;
    previous?.controller.abort();
    previous?.finish();
    const live = () =>
      this.request === request && this.source === source && !request.controller.signal.aborted;
    if (invalidate && live()) {
      this.publish(loading);
    }
    const complete = (snapshot: ChatGPTAuthSessionSnapshot) => {
      if (live()) {
        this.request = undefined;
        this.publish(snapshot);
      }
      request.finish();
    };
    try {
      if (!live()) {
        request.finish();
        return request.promise;
      }
      void Promise.resolve(source.getSession({ signal: request.controller.signal })).then(
        (value: unknown) => {
          if (!live()) {
            request.finish();
            return;
          }
          try {
            complete(readSession(value));
          } catch {
            complete(failed);
          }
        },
        () => complete(failed),
      );
    } catch {
      complete(failed);
    }
    return request.promise;
  }
}
