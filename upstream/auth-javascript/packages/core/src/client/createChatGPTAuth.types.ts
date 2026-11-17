import type { ChatGPTAuthSignInState } from '../types.js';

export interface InteractionTarget {
  readonly button: HTMLButtonElement;
  readonly container: HTMLElement;
  disabled(): boolean;
  detach(): void;
}

export interface ResolvedBindingOptions {
  disabled: boolean;
}

export type InteractionErrorResult = Extract<ChatGPTAuthSignInState, { status: 'error' }>;

export type AdapterFailureCode = 'adapter_failed' | 'adapter_invalid_result' | 'navigation_failed';
