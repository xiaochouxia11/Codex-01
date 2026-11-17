/** The existing auth system reported completion. This result does not prove that the application has a verified session. */
export interface ChatGPTAuthDelegatedSignInCompletion {
  readonly delivery: 'delegated';
}

/** An auth adapter in the application returns one of these explicit outcomes. */
export type ChatGPTAuthSignInAdapterResult =
  | { readonly status: 'complete' }
  | { readonly status: 'cancelled' }
  | { readonly status: 'redirecting' };

/** These display claims come from the integration's verified ChatGPT identity, with user consent. They never contain tokens. */
export interface ChatGPTAuthProfile {
  readonly subject: string;
  readonly name?: string | undefined;
  /** Absolute HTTP(S) image URL, when the picture claim was shared and is available. */
  readonly picture?: string | undefined;
}

/** The application supplies this authoritative session. A session may have no linked ChatGPT profile. */
export type ChatGPTAuthSession =
  | { readonly status: 'authenticated'; readonly profile: ChatGPTAuthProfile | null }
  | { readonly status: 'unauthenticated' };

/** Read the app session after redirects or reloads. Notify subscribers when the session may have changed. */
export interface ChatGPTAuthSessionSource {
  getSession(options: { readonly signal: AbortSignal }): Promise<ChatGPTAuthSession>;
  /** Notify subscribers on sign-out, account changes, and session invalidation. Return a function that removes the listener. */
  subscribe?(onChange: () => void): () => void;
}

/** Bridge to an existing auth SDK without exposing credentials. */
export interface ChatGPTAuthSignInAdapter {
  /** Start the external flow synchronously within this call to preserve user activation. */
  signIn(): Promise<ChatGPTAuthSignInAdapterResult>;
  /** The client uses this optional application session reader to load profiles for its subscribers. */
  readonly session?: ChatGPTAuthSessionSource | undefined;
}

/** Safe error details for application UI and diagnostics. */
export interface ChatGPTAuthErrorInfo {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly status?: number | undefined;
  readonly requestId?: string | undefined;
  readonly param?: string | undefined;
}

/** UI interaction status, independent of the app's authenticated session. */
export type ChatGPTAuthSignInState =
  | { readonly status: 'idle' | 'pending' | 'cancelled' | 'redirecting' | 'complete' }
  | { readonly status: 'error'; readonly error: ChatGPTAuthErrorInfo };

export interface ChatGPTAuthSignInOutcomeCallbacks {
  readonly onInteractionChange?: ((state: ChatGPTAuthSignInState) => void) | undefined;
  readonly onError?: ((error: ChatGPTAuthErrorInfo) => void) | undefined;
  readonly onCancel?: (() => void) | undefined;
}

export interface ChatGPTAuthDelegatedSignInBinding {
  readonly adapter: ChatGPTAuthSignInAdapter;
  readonly authPath?: never;
  readonly onSignInComplete?: ((result: ChatGPTAuthDelegatedSignInCompletion) => void) | undefined;
}

export interface ChatGPTAuthNavigationSignInBinding {
  /** Use a same-origin GET route in your application that starts sign-in. Do not use an OpenAI authorization URL. */
  readonly authPath: string;
  readonly adapter?: never;
  readonly onSignInComplete?: never;
  readonly onCancel?: never;
}

export type ChatGPTAuthSignInBinding =
  ChatGPTAuthNavigationSignInBinding | ChatGPTAuthDelegatedSignInBinding;

/** Select exactly one method to start sign-in. The application retains ownership of accounts and sessions. */
export type ChatGPTAuthSignInConfiguration = ChatGPTAuthSignInBinding &
  ChatGPTAuthSignInOutcomeCallbacks;
