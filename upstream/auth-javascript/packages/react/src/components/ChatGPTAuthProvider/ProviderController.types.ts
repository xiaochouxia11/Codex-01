import type { ChatGPTAuthSessionSource } from '@openai/auth';
import type {
  ChatGPTAuthClient,
  ChatGPTAuthClientSnapshot,
  ChatGPTAuthSessionSnapshot,
  ChatGPTAuthSignInButtonBinding,
  ChatGPTAuthSignInButtonBindingOptions,
} from '@openai/auth/client';
import type { ChatGPTAuthProviderProps } from './ChatGPTAuthProvider.types.js';

export type ProviderBinding = Pick<ChatGPTAuthProviderProps, 'client' | 'options'>;

export interface RegisteredButton {
  readonly element: HTMLButtonElement;
  options: ChatGPTAuthSignInButtonBindingOptions;
}

export interface ActiveClient {
  readonly client: ChatGPTAuthClient;
  readonly owned: boolean;
  readonly handles: Map<RegisteredButton, ChatGPTAuthSignInButtonBinding>;
  readonly unsubscribe: (() => void)[];
}

export interface ProviderSnapshot extends ChatGPTAuthClientSnapshot {
  readonly ready: boolean;
}

export interface ProviderSessionSnapshot {
  readonly client: ChatGPTAuthClient | undefined;
  readonly source: ChatGPTAuthSessionSource | undefined;
  readonly session: ChatGPTAuthSessionSnapshot;
}
