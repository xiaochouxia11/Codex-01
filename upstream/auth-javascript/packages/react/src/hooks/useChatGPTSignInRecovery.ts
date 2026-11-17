import { ChatGPTAuthError } from '@openai/auth';
import type { ChatGPTAuthRecoveryOptions } from '@openai/auth/client';
import { useContext } from 'react';
import ProviderContext from '../components/ChatGPTAuthProvider/context.cjs';

/** Recover local interaction state after the host reconciles its external auth/session state. */
export function useChatGPTSignInRecovery(): (options?: ChatGPTAuthRecoveryOptions) => void {
  const context = useContext(ProviderContext);
  if (!context) {
    throw new ChatGPTAuthError({
      code: 'missing_provider',
      message: 'useChatGPTSignInRecovery must be used within ChatGPTAuthProvider.',
      retryable: false,
    });
  }
  return context.controller.recover;
}
