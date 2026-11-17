import { ChatGPTAuthError } from '../ChatGPTAuthError.js';
import type { ChatGPTAuthSignInAdapterResult } from '../types.js';
import type { ChatGPTAuthSignInButtonBindingOptions } from './types.js';
import type {
  AdapterFailureCode,
  InteractionErrorResult,
  ResolvedBindingOptions,
} from './createChatGPTAuth.types.js';
import { invalid, readOptions } from './options.js';

export function bindingOptions(
  value: ChatGPTAuthSignInButtonBindingOptions = {},
): ResolvedBindingOptions {
  const next = readOptions(value, ['disabled'], 'invalid_presentation');
  if (next.disabled !== undefined && typeof next.disabled !== 'boolean') {
    throw invalid('invalid_presentation', 'disabled', 'a boolean or undefined to reset the field');
  }
  return { disabled: next.disabled === true };
}

export function isButtonClick(button: HTMLButtonElement, event: MouseEvent): boolean {
  const window = button.ownerDocument.defaultView;
  return (
    !!window &&
    event instanceof window.MouseEvent &&
    event.type === 'click' &&
    event.target instanceof window.Node &&
    button.contains(event.target)
  );
}

export function validateElement(element: HTMLElement, param: 'container' | 'button'): void {
  try {
    const window = element?.ownerDocument?.defaultView;
    if (
      window &&
      element instanceof (param === 'button' ? window.HTMLButtonElement : window.HTMLElement)
    ) {
      return;
    }
  } catch {
    // Invalid element accessors must not disclose arbitrary exception messages.
  }
  throw invalid(
    'invalid_presentation',
    param,
    param === 'button'
      ? 'an HTMLButtonElement in a browser document'
      : 'an HTML element in a browser document',
  );
}

/** Normalize the adapter's result without accepting credentials or extra properties. */
export function adapterResult(value: unknown): ChatGPTAuthSignInAdapterResult {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !Object.hasOwn(value, 'status') ||
    Reflect.ownKeys(value).some((key) => key !== 'status')
  ) {
    throw null;
  }
  const status: unknown = Reflect.get(value, 'status');
  if (status !== 'complete' && status !== 'cancelled' && status !== 'redirecting') {
    throw null;
  }
  return Object.freeze({ status });
}

export function signInError(code: AdapterFailureCode): InteractionErrorResult {
  return Object.freeze({
    status: 'error',
    error: Object.freeze(
      new ChatGPTAuthError({
        code,
        message:
          code === 'adapter_invalid_result'
            ? 'The sign-in adapter returned an invalid result.'
            : 'Sign-in could not be started or completed.',
        retryable: true,
      }).toJSON(),
    ),
  });
}
