import { ChatGPTAuthError, type ChatGPTAuthSignInState } from '@openai/auth';
import { useContext, useSyncExternalStore } from 'react';
import ProviderContext from '../components/ChatGPTAuthProvider/context.cjs';

/** Current UI interaction only. This does not describe the application's authenticated session. */
export function useChatGPTSignInState(): ChatGPTAuthSignInState {
  const context = useContext(ProviderContext);
  if (!context) {
    throw new ChatGPTAuthError({
      code: 'missing_provider',
      message: 'useChatGPTSignInState must be used within ChatGPTAuthProvider.',
      retryable: false,
    });
  }
  const providerController = context.controller;
  return useSyncExternalStore(
    providerController.subscribe,
    providerController.getSnapshot,
    providerController.getServerSnapshot,
  ).state;
}
