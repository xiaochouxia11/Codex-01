import type { ChatGPTAuthSignInConfiguration } from '@openai/auth';
import type { ChatGPTAuthClient, ChatGPTAuthStylesheet } from '@openai/auth/client';
import type { ReactNode } from 'react';

/** Supply an application-owned client or options for a provider-owned client. */
export type ChatGPTAuthProviderProps = (
  | { readonly client: ChatGPTAuthClient; readonly options?: never }
  | { readonly options: ChatGPTAuthSignInConfiguration; readonly client?: never }
) & {
  /** Use `external` when the host loads `@openai/auth-react/styles.css`. The default mode loads styles automatically. */
  readonly stylesheet?: ChatGPTAuthStylesheet | undefined;
  readonly children?: ReactNode;
};
