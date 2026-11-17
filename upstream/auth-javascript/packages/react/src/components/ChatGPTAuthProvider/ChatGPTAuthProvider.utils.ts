import { ChatGPTAuthError, type ChatGPTAuthSessionSource } from '@openai/auth';
import type { ChatGPTAuthProviderProps } from './ChatGPTAuthProvider.types.js';
import type { ProviderBinding } from './ProviderController.types.js';

export const supportedProviderProps: ReadonlySet<string> = new Set([
  'client',
  'options',
  'children',
  'stylesheet',
]);

export function assertProviderBinding(props: ChatGPTAuthProviderProps): void {
  const hasClient = props.client !== undefined;
  const hasOptions = props.options !== undefined;
  if (
    hasClient === hasOptions ||
    (hasOptions && (!props.options || typeof props.options !== 'object'))
  ) {
    throw new ChatGPTAuthError({
      code: 'invalid_configuration',
      message: 'ChatGPTAuthProvider requires exactly one of "client" or "options".',
      retryable: false,
      param: 'options',
    });
  }
  if (hasClient) {
    try {
      const client = props.client;
      if (
        !client ||
        [
          'bindSignInButton',
          'getSnapshot',
          'subscribe',
          'getSessionSnapshot',
          'subscribeSession',
          'recover',
        ].some((key) => typeof (client as unknown as Record<string, unknown>)[key] !== 'function')
      ) {
        throw null;
      }
    } catch {
      throw new ChatGPTAuthError({
        code: 'invalid_configuration',
        message: 'client must be a ChatGPTAuthClient returned by createChatGPTAuth().',
        retryable: false,
        param: 'client',
      });
    }
  }
}

/** Read identity only. The core client validates and manages the session source. */
export function readSessionSource(binding: ProviderBinding): ChatGPTAuthSessionSource | undefined {
  try {
    return binding.options?.adapter?.session;
  } catch {
    throw new ChatGPTAuthError({
      code: 'invalid_configuration',
      message: 'adapter.session requires a getSession() method and an optional subscribe() method.',
      retryable: false,
      param: 'adapter.session',
    });
  }
}

export function readStylesheet(props: ChatGPTAuthProviderProps): 'auto' | 'external' {
  const value = props.stylesheet;
  if (value !== undefined && value !== 'auto' && value !== 'external') {
    throw new ChatGPTAuthError({
      code: 'invalid_configuration',
      message: 'stylesheet must be "auto", "external", or undefined.',
      retryable: false,
      param: 'stylesheet',
    });
  }
  return value ?? 'auto';
}
