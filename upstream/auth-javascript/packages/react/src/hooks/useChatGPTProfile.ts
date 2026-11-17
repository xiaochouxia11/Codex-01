import { ChatGPTAuthError, type ChatGPTAuthProfile } from '@openai/auth';
import { useContext } from 'react';
import ProviderContext from '../components/ChatGPTAuthProvider/context.cjs';

/** The adapter session source loads this profile with user consent. The hook returns `null` while the profile is unavailable. */
export function useChatGPTProfile(): ChatGPTAuthProfile | null {
  const context = useContext(ProviderContext);
  if (!context) {
    throw new ChatGPTAuthError({
      code: 'missing_provider',
      message: 'useChatGPTProfile must be used within ChatGPTAuthProvider.',
      retryable: false,
    });
  }
  return context.profile;
}
