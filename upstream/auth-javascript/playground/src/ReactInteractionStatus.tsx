import { useChatGPTSignInRecovery, useChatGPTSignInState } from '@openai/auth-react';
import { InteractionStatus } from './InteractionStatus.js';

export function ReactInteractionStatus({ onRecovered }: { onRecovered: () => void }) {
  const state = useChatGPTSignInState();
  const recover = useChatGPTSignInRecovery();
  return (
    <InteractionStatus api="react" state={state} recover={recover} onRecovered={onRecovered} />
  );
}
