import { createElement, createRef, type MouseEventHandler, type FocusEventHandler } from 'react';
import type {
  ChatGPTAuthProfilePictureProps,
  ChatGPTAuthProviderProps,
  ChatGPTAuthSignInButtonProps,
} from '@openai/auth-react';
import {
  ChatGPTAuthProvider,
  ChatGPTSignInButton,
  ChatGPTProfilePicture,
  useChatGPTProfile,
  useChatGPTSignInState,
  useChatGPTSignInRecovery,
} from '@openai/auth-react';
import type {
  ChatGPTAuthProfile,
  ChatGPTAuthSession,
  ChatGPTAuthSessionSource,
  ChatGPTAuthSignInAdapter,
  ChatGPTAuthSignInState,
} from '@openai/auth';
const onClick: MouseEventHandler<HTMLButtonElement> = (event) => {
  const button: HTMLButtonElement = event.currentTarget;
  const native: MouseEvent = event.nativeEvent;
  event.preventDefault();
  event.stopPropagation();
  event.isDefaultPrevented();
  event.isPropagationStopped();
  event.persist();
  void button;
  void native;
};
const onFocus: FocusEventHandler<HTMLButtonElement> = (event) => {
  const button: HTMLButtonElement = event.currentTarget;
  const native: FocusEvent = event.nativeEvent;
  void button;
  void native;
};
const reactProps: ChatGPTAuthSignInButtonProps = { onClick, onFocus, onBlur: onFocus };
const localizedReactProps: ChatGPTAuthSignInButtonProps = { locale: 'ja-JP' };
void localizedReactProps;
const reactResets: ChatGPTAuthSignInButtonProps = {
  appearance: undefined,
  className: undefined,
  style: undefined,
  disabled: undefined,
  onClick: undefined,
  onFocus: undefined,
  onBlur: undefined,
};
const reactIntegration: ChatGPTAuthSignInButtonProps = {
  ref: createRef<HTMLButtonElement>(),
  'aria-describedby': 'sign-in-help',
  'aria-details': null,
  'aria-errormessage': undefined,
  'aria-controls': 'account-menu',
  'aria-invalid': 'grammar',
  'data-testid': 'sign-in',
  'data-count': 2,
  'data-enabled': true,
  'data-empty': null,
  'data-removed': undefined,
};
const reactIntegrationResets: ChatGPTAuthSignInButtonProps = {
  ref: undefined,
  'aria-describedby': null,
  'aria-invalid': undefined,
};
const nativeProps: ChatGPTAuthSignInButtonProps = {
  // @ts-expect-error React callback props receive synthetic events, not native DOM events.
  onClick: (event: MouseEvent) => {
    void event;
  },
};
void reactProps;
void reactResets;
void reactIntegration;
void reactIntegrationResets;
void nativeProps;

import { createChatGPTAuth, getChatGPTSignInButtonModel } from '@openai/auth/client';
import type {
  ChatGPTAuthClient,
  ChatGPTAuthSessionSnapshot,
  ChatGPTAuthRecoveryOptions,
  ChatGPTAuthClientSnapshot,
} from '@openai/auth/client';
import type { ChatGPTAuthSignInConfiguration } from '@openai/auth';
declare const host: HTMLElement;
declare const button: HTMLButtonElement;
const presentationResets = {
  appearance: undefined,
  className: undefined,
  style: undefined,
  size: undefined,
  width: undefined,
  text: undefined,
  variant: undefined,
  locale: undefined,
  disabled: undefined,
  id: undefined,
  'data-testid': undefined,
  onClick: undefined,
  onFocus: undefined,
  onBlur: undefined,
};
// Natural inline async adapters receive contextual result typing without assertions.
const delegated = createChatGPTAuth({
  adapter: {
    async signIn() {
      return { status: 'complete' };
    },
  },
  onSignInComplete(result) {
    const delivery: 'delegated' = result.delivery;
    void delivery;
  },
});
const delegatedView = delegated.mountSignInButton(host);
const arrowAdapter = createChatGPTAuth({
  adapter: { signIn: async () => ({ status: 'cancelled' }) },
});
delegatedView.update(presentationResets);
arrowAdapter.updateSignIn({
  adapter: { signIn: async () => ({ status: 'cancelled' }) },
  onInteractionChange: undefined,
  onError: undefined,
  onCancel: undefined,
  onSignInComplete: undefined,
});
const navigation = createChatGPTAuth({ authPath: '/auth/chatgpt' });
navigation.mountSignInButton(host).update(presentationResets);
navigation.updateSignIn({ authPath: '/auth/chatgpt', onError: undefined });
// @ts-expect-error Navigation does not report delegated completion.
navigation.updateSignIn({ authPath: '/auth/chatgpt', onSignInComplete: () => {} });
// @ts-expect-error Navigation does not report delegated cancellation.
createChatGPTAuth({ authPath: '/auth/chatgpt', onCancel: () => {} });
// @ts-expect-error Choose one binding, never both.
createChatGPTAuth({
  authPath: '/start',
  adapter: {
    async signIn() {
      return { status: 'complete' as const };
    },
  },
});
// @ts-expect-error A binding is required.
createChatGPTAuth({});
createChatGPTAuth({
  adapter: {
    // @ts-expect-error Adapter outcomes must use a supported status.
    async signIn() {
      return { status: 'unknown' };
    },
  },
});
// @ts-expect-error View updates cannot replace authentication configuration.
delegatedView.update({ authPath: '/different' });
// @ts-expect-error View updates accept presentation events, not auth callbacks.
delegatedView.update({ onCancel: () => {} });
declare const unionOptions: ChatGPTAuthSignInConfiguration;
const unionClient: ChatGPTAuthClient = createChatGPTAuth(unionOptions);
unionClient.mountSignInButton(host).update({ disabled: undefined });
const sessionSnapshot: ChatGPTAuthSessionSnapshot = unionClient.getSessionSnapshot();
const sessionProfile: ChatGPTAuthProfile | null = sessionSnapshot.profile;
const refresh: Promise<void> = unionClient.refreshSession();
const stopSession: () => void = unionClient.subscribeSession(() => {});
stopSession();
void sessionProfile;
void refresh;
const auth = createChatGPTAuth({
  adapter: {
    async signIn() {
      return { status: 'redirecting' };
    },
  },
  onInteractionChange: undefined,
  onError: undefined,
  onCancel: undefined,
  onSignInComplete: undefined,
});
auth.mountSignInButton(host).update(presentationResets);
auth.bindSignInButton(button, { disabled: undefined }).update({ disabled: undefined });
getChatGPTSignInButtonModel(
  { appearance: undefined, id: undefined },
  { busy: undefined, dark: undefined },
);
const recovery: ChatGPTAuthRecoveryOptions = {
  abandonPending: undefined,
  expectedState: undefined,
};
auth.recover(recovery);
delegated.recover({ abandonPending: true });
delegated.recover({ expectedState: delegated.getSnapshot().state });
navigation.recover();
// @ts-expect-error Recovery requires a boolean acknowledgement.
auth.recover({ abandonPending: 'yes' });
const snapshot: ChatGPTAuthClientSnapshot = delegated.getSnapshot();
if (snapshot.state.status === 'error') {
  const code: string = snapshot.state.error.code;
  void code;
}
const unsubscribe: () => void = navigation.subscribe(() => {});
unsubscribe();
// Inspect hook return types without invoking hooks outside a component.
declare const hookState: ReturnType<typeof useChatGPTSignInState>;
declare const recoverInteraction: ReturnType<typeof useChatGPTSignInRecovery>;
const observedState: ChatGPTAuthSignInState = hookState;
const recovered: void = recoverInteraction({ expectedState: hookState, abandonPending: true });
void observedState;
void recovered;

import type { ChatGPTAuthSignInButtonStyle } from '@openai/auth/client';
const layoutStyle = { marginTop: 12, width: 250 };
const sharedStyle: ChatGPTAuthSignInButtonStyle = layoutStyle;
const customStyle: ChatGPTAuthSignInButtonStyle = {
  marginTop: 8,
  marginInline: 4,
  flexGrow: 1,
};
const styledReact: ChatGPTAuthSignInButtonProps = { className: 'login', style: layoutStyle };
const customReact: ChatGPTAuthSignInButtonProps = { style: customStyle };
auth.mountSignInButton(host, { className: 'login', style: sharedStyle }).update({
  style: customStyle,
});
delegatedView.update({ style: { marginTop: 12 }, className: undefined });
// @ts-expect-error CSS properties must be camelCase.
const invalidCSSKey: ChatGPTAuthSignInButtonStyle = { 'background-color': 'red' };
// @ts-expect-error Style overrides are CSS values, not nested selector objects.
const invalidCSSValue: ChatGPTAuthSignInButtonStyle = { color: { hover: 'red' } };
// @ts-expect-error className is a string, not a class token array.
const invalidClassName: ChatGPTAuthSignInButtonProps = { className: ['login'] };
// @ts-expect-error Custom properties are outside the layout allowlist.
const invalidCustomProperty: ChatGPTAuthSignInButtonStyle = { '--accent': {} };
// @ts-expect-error The SDK controls the branded button's colors.
const invalidBrandColor: ChatGPTAuthSignInButtonStyle = { color: 'red' };
// @ts-expect-error The SDK controls the branded button's typeface.
const invalidBrandFont: ChatGPTAuthSignInButtonStyle = { fontFamily: 'serif' };
// @ts-expect-error Logo styling is outside the layout allowlist.
const invalidBrandFill: ChatGPTAuthSignInButtonStyle = { fill: 'red' };
void invalidBrandColor;
void invalidBrandFont;
void invalidBrandFill;
// @ts-expect-error The pure visual model remains independent of renderer-only overrides.
getChatGPTSignInButtonModel({ style: customStyle });
void styledReact;
void customReact;
void invalidCSSKey;
void invalidCSSValue;
void invalidClassName;
void invalidCustomProperty;

const profile: ChatGPTAuthProfile = {
  subject: 'chatgpt-subject',
  name: 'Example user',
  picture: 'https://images.example/profile.png',
};
const profileResets: ChatGPTAuthProfile = {
  subject: 'chatgpt-subject',
  name: undefined,
  picture: undefined,
};
const sessions: ChatGPTAuthSession[] = [
  { status: 'authenticated', profile },
  { status: 'authenticated', profile: null },
  { status: 'unauthenticated' },
];
const sessionSource: ChatGPTAuthSessionSource = {
  async getSession({ signal }) {
    signal.throwIfAborted();
    return { status: 'authenticated', profile };
  },
  subscribe(onChange) {
    const notify: () => void = onChange;
    void notify;
    return () => {};
  },
};
const profileProvider: ChatGPTAuthProviderProps = {
  options: {
    adapter: {
      async signIn() {
        return { status: 'complete' };
      },
      session: sessionSource,
    },
  },
};
const profileAdapterReset: ChatGPTAuthSignInAdapter = {
  async signIn() {
    return { status: 'redirecting' };
  },
  session: undefined,
};
const profilePictureProps: ChatGPTAuthProfilePictureProps = {
  size: 40,
  alt: 'Account picture',
  className: 'account-picture',
  style: { borderRadius: 8 },
  fallback: createElement('span', null, 'Account'),
};
const profilePictureResets: ChatGPTAuthProfilePictureProps = {
  size: undefined,
  alt: undefined,
  className: undefined,
  style: undefined,
  fallback: undefined,
};
const profilePicture = createElement(ChatGPTProfilePicture, profilePictureProps);
declare const hookProfile: ReturnType<typeof useChatGPTProfile>;
const observedProfile: ChatGPTAuthProfile | null = hookProfile;
// @ts-expect-error A profile can be unavailable while the session loads or no claims were shared.
const alwaysPresentProfile: ChatGPTAuthProfile = hookProfile;
// @ts-expect-error Profile state contains consented display claims, not credentials.
void hookProfile?.accessToken;
// @ts-expect-error The profile component reads context. Its API does not accept arbitrary image sources.
const profilePictureSource: ChatGPTAuthProfilePictureProps = { src: profile.picture };
// @ts-expect-error Picture size is a numeric pixel value.
const invalidPictureSize: ChatGPTAuthProfilePictureProps = { size: 'large' };
void profileResets;
void sessions;
void profileProvider;
void profileAdapterReset;
void profilePictureResets;
void profilePicture;
void observedProfile;
void alwaysPresentProfile;
void profilePictureSource;
void invalidPictureSize;

const externalStylesProvider: ChatGPTAuthProviderProps = {
  options: { authPath: '/auth/start' },
  stylesheet: 'external',
};
createChatGPTAuth({ authPath: '/auth/start' }).mountSignInButton(host, { stylesheet: 'external' });
auth.mountSignInButton(host, { stylesheet: 'external' }).update({ stylesheet: undefined });
// @ts-expect-error Stylesheet loading is a renderer option, not part of the pure visual model.
getChatGPTSignInButtonModel({ stylesheet: 'external' });
void externalStylesProvider;

// Verify that installed component declarations can actually be rendered with this
// consumer's React major, not merely assigned to standalone props interfaces.
const consumerTree = createElement(
  ChatGPTAuthProvider,
  profileProvider,
  createElement(ChatGPTSignInButton, { ref: createRef<HTMLButtonElement>() }),
  createElement(ChatGPTProfilePicture, profilePictureProps),
);
void consumerTree;

// A provider either owns a client created from options or borrows an app-owned client.
const injectedProvider: ChatGPTAuthProviderProps = { client: delegated };
// @ts-expect-error Choose one source of client ownership.
const ambiguousProvider: ChatGPTAuthProviderProps = { client: delegated, options: unionOptions };
// @ts-expect-error A provider requires a client or options.
const missingProvider: ChatGPTAuthProviderProps = {};
// @ts-expect-error The provider does not accept a signIn prop.
const unsupportedProvider: ChatGPTAuthProviderProps = { signIn: unionOptions };
void injectedProvider;
void ambiguousProvider;
void missingProvider;
void unsupportedProvider;
