import type { ChatGPTAuthProfile } from '@openai/auth';
import type { ChatGPTAuthSignInButtonBindingOptions } from '@openai/auth/client';
import type { ProviderController } from './components/ChatGPTAuthProvider/ProviderController.js';
import type { ProviderBinding } from './components/ChatGPTAuthProvider/ProviderController.types.js';

export interface ProviderContextValue {
  readonly controller: ProviderController;
  readonly binding: ProviderBinding;
  readonly profile: ChatGPTAuthProfile | null;
  readonly stylesheet: 'auto' | 'external';
}

export interface ButtonRegistration {
  update(options: ChatGPTAuthSignInButtonBindingOptions): void;
  activate(event: MouseEvent, binding: ProviderBinding, beforeSignIn?: () => void): void;
  detach(): void;
}
