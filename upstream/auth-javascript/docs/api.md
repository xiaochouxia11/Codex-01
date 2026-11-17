# API reference

Use this reference after the [getting-started guide](getting-started.md). The SDK
connects sign-in UI to your application's authentication system. It does not verify
identity or create sessions.

| Entry point           | Use                                                                            |
| --------------------- | ------------------------------------------------------------------------------ |
| `@openai/auth`        | Portable adapter/session types and `ChatGPTAuthError`. No React dependency.    |
| `@openai/auth/client` | Client factory, shared interaction and session state, and DOM/framework views. |
| `@openai/auth-react`  | React provider, buttons, profile pictures, and hooks.                          |

All entry points provide ESM and CommonJS builds with TypeScript declarations.
For styles and deployment policy, see [CSP setup](csp.md).

## Authentication configuration

Supply exactly one of `authPath` and `adapter`:

- `authPath` is a same-origin GET route implemented by your app. The SDK navigates
  to that route, and your auth framework handles the callback and session.
- `adapter` implements `signIn(): Promise<ChatGPTAuthSignInAdapterResult>`.
  It starts your auth client synchronously from the click and resolves with
  `{ status: 'complete' }`, `{ status: 'cancelled' }`, or `{ status: 'redirecting' }`.
  See the [adapter example](getting-started.md#connect-an-auth-client).

Do not return tokens, authorization codes, or raw provider responses from the
adapter. Its optional `session` capability supplies verified profile data for
any renderer. See [session observation](#session-observation).

| Callback                                      | When it runs                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| `onInteractionChange(state)`                  | The shared interaction state changes.                                             |
| `onError(error)`                              | A sign-in operation fails. The callback receives sanitized SDK error information. |
| `onSignInComplete({ delivery: 'delegated' })` | An adapter reports completion. Read your app session separately.                  |
| `onCancel()`                                  | An adapter reports cancellation.                                                  |

`onSignInComplete` and `onCancel` apply only to adapters. A navigation-based
configuration cannot report either outcome after the page leaves. The SDK does not
await callback promises. Handle errors in your own callbacks. Configure React callbacks
inside the provider's `options` prop or when creating its injected client. Configure
DOM callbacks on the client.

## Create a client

`createChatGPTAuth(options)` is the entry point for sign-in interaction and app-session
observation. Creating a client is inert: it does not access the DOM, start authentication,
read the session, or subscribe to its source. It is safe during server rendering.

```ts
import { createChatGPTAuth } from '@openai/auth/client';

const auth = createChatGPTAuth({
  authPath: '/auth/chatgpt',
  onInteractionChange: (state) => console.log(state.status),
});
const header = auth.mountSignInButton(headerContainer);
const dialog = auth.mountSignInButton(dialogContainer, { width: 'full' });

dialog.update({ disabled: true });
await dialog.destroy(); // Detach only this view. The client retains any active attempt.
auth.updateSignIn({ authPath: '/auth/chatgpt' }); // Full replacement for later attempts.
await auth.destroy(); // Remove all remaining views and retire local work.
```

You can also configure a client with an adapter. The
[browser example](../examples/browser/README.md) demonstrates both options.
A mounted button exposes only `update(presentation)` and `destroy()`. Updates patch
presentation and DOM event handlers; omitted fields stay unchanged, and explicit
`undefined` restores defaults. Authentication callbacks and configuration belong
on the client.

The client exposes `getSnapshot()`, `subscribe()`, and `recover()`. The snapshot
includes readonly interaction `state` and `busy`. See [recovery](recovery.md) to
check sessions and retire pending attempts. Session observation has its own
snapshot and subscription, described [below](#session-observation).

A client permits one active attempt across all its buttons. It captures configuration
and callbacks when the attempt starts. It disables its SDK buttons while pending.
It calls the adapter synchronously during the click event. It performs no
automatic retries. Separate clients own independent attempts.

The DOM API's `onClick` receives a native `MouseEvent`. Synchronous
`preventDefault()` stops initiation. Its focus/blur callbacks receive native `FocusEvent`s.

The SDK never awaits callback promises. It contains exceptions or rejected promises
from consumer callbacks. They do not change the authentication outcome. Applications
should handle their own callback errors.

Adapter exceptions become sanitized `adapter_failed` errors. Malformed outcomes
become `adapter_invalid_result`. Arbitrary thrown objects cannot supply error
codes or messages. The SDK does not forward original exception messages, credentials,
or causes. A navigation failure detectable synchronously becomes
`navigation_failed`. Invalid configuration, button, and recovery options throw
`invalid_configuration` or `invalid_presentation` before mutation.

`destroy()` is idempotent. Local invalidation happens immediately, and its promise
covers only local cleanup. Destroying a client suppresses late callbacks but cannot
cancel or undo the external auth SDK's work. You cannot mount or update a destroyed
client.

### Framework-owned buttons

Framework integrations can render their own button while using the same public
client:

- `auth.bindSignInButton(button, { disabled })` binds an actual `HTMLButtonElement`
  without changing its DOM or installing event listeners.
- Call `binding.activate(nativeMouseEvent, beforeSignIn)` synchronously from the
  button's click handler. The client acquires its shared lock before calling the
  optional `beforeSignIn` callback. Call the consumer's framework handler there.
  Synchronous `preventDefault()` prevents auth while preserving user activation.
- `auth.getSnapshot()` returns a stable, frozen `{ busy, state }` snapshot.
  `auth.subscribe(listener)` observes changes and returns an unsubscribe function.
  The renderer uses this state and its own disabled option to update the button.
- `binding.update({ disabled })` patches the binding's disabled option.
  `binding.destroy()` detaches it without removing the caller-owned button or
  cancelling an active attempt. Client destruction retires all bindings and
  subscriptions. The framework still owns its DOM cleanup.

`getChatGPTSignInButtonModel(visualOptions, { busy, dark })` checks presentation options for custom renderers.
It provides the visible label, accessible name, disabled/busy state, styles, and official mark geometry.
It does not access the DOM. It accepts presentation options only, with no callbacks
or auth configuration. It also excludes renderer-specific `className` and `style`
overrides.

The DOM view and React component share this model's labels and state.
They apply defaults through the automatic stylesheet rather than inline model styles.
The model, DOM API, and React share the serializable `variant`, `layout`, and `text`
options. Only React accepts `endDecorator`.

Custom renderers should forward `model.ariaLabel` to `aria-label` when defined.
It supplies the full localized action for `text="brand"`. Otherwise, the visible
label provides the accessible name.

A `redirecting` client stays disabled during handoff. After failed navigation,
redirect return, or back/forward restoration, the host checks its authoritative
auth/session state. It calls `recover()` before an explicit fresh attempt. Recovery
preserves views, focus, and subscriptions. Updating configuration does not reset an
in-flight or redirecting client. See [state and recovery](recovery.md) for pending
abandonment and back/forward restoration.

`authPath` resolves from the mounted document's origin, never an HTML `base` tag.
The SDK accepts only same-origin HTTP(S) destinations without URL credentials or
fragments. The target app route must preserve its auth system's transaction and
CSRF protections. It must not blindly redirect using untrusted query parameters.

## Browser discovery

Use `[data-chatgpt-sign-in-button]` to find SDK-rendered DOM and React buttons.
Wait until the button is visible and enabled before clicking.

Custom renderers that use `bindSignInButton` must add the attribute themselves.

## React

```tsx
import { ChatGPTAuthProvider, ChatGPTSignInButton } from '@openai/auth-react';

export function SignInOptions() {
  return (
    <ChatGPTAuthProvider options={{ authPath: '/auth/chatgpt' }}>
      <header>
        <ChatGPTSignInButton />
      </header>
      <section>
        <ChatGPTSignInButton width="full" />
      </section>
    </ChatGPTAuthProvider>
  );
}
```

As in the DOM example, `/auth/chatgpt` is your application's sign-in route.
Use `options={{ adapter, onSignInComplete, onCancel, onError }}` for delegated auth.
Buttons use their nearest provider and cannot override its configuration.
Presentation and React event callbacks belong on buttons. Sign-in callbacks belong
inside the provider's `options` prop. Multiple buttons share the provider's attempt.

Supply exactly one of `options` or `client`. With `options`, the provider creates
its client after commit and destroys it on unmount. Committed `options` changes
replace configuration for later attempts without replacing an active attempt.

Use `client` to share an app-owned client with DOM buttons or other React roots:

```tsx
import { createChatGPTAuth } from '@openai/auth/client';
import { ChatGPTAuthProvider, ChatGPTSignInButton } from '@openai/auth-react';

import { chatgptAuth } from './chatgpt-auth';

const auth = createChatGPTAuth({ adapter: chatgptAuth });

<ChatGPTAuthProvider client={auth}>
  <ChatGPTSignInButton />
</ChatGPTAuthProvider>;
```

Keep that client stable for the intended app lifetime. On the server, isolate it
per app/request. Removing a button detaches its view. An injected provider's
cleanup removes only its own bindings and subscriptions; it does not destroy the
client or retire an attempt shared with other views. Its owner calls
`auth.destroy()` after all consumers finish. Replace injected configuration with
`auth.updateSignIn()`; do not also pass `options`.

`useChatGPTSignInState()` reads the provider's readonly interaction state.
`useChatGPTSignInRecovery()` returns a stable explicit recovery function. Neither
hook reports an app session. Both require a provider.
`useChatGPTSignInState()` returns `{ status: 'idle' }` during server rendering (SSR).
`idle` and `complete` are interaction outcomes, not authoritative session states.

React owns the actual `<button>` and its event handlers. `onClick` receives
`React.MouseEvent<HTMLButtonElement>`. `onFocus` and `onBlur` receive
`React.FocusEvent<HTMLButtonElement>`. `currentTarget` is the button during the
callback. `nativeEvent` exposes the browser event. Events propagate through the
React tree normally.

Calling `preventDefault()` synchronously in the button's
`onClick` prevents SDK initiation. `stopPropagation()` controls propagation without
cancelling sign-in. The consumer handler runs inside the client's duplicate guard.
If it synchronously unmounts the clicked button, the client abandons that activation.

`ChatGPTSignInButton` accepts the shared [presentation options](#presentation-options)
and an optional React-only `endDecorator: ReactNode`. Use it for non-interactive
decoration such as `<ChatGPTProfilePicture />`.
The slot matches the logo: 20 × 20px for standard buttons and 18 × 18px for compact buttons.
CSS centers the content and clips overflow. Larger content does not expand the slot.
Default minimum heights remain 44px for standard buttons and 36px for compact buttons.

The decoration's wrapper is
`aria-hidden` and `inert`, excluding it from the accessible name and interaction.

Keep links, buttons, and essential account information outside this slot. The
SDK owns the button's root element, logo, localized label, and pending state.
See the [React examples](../packages/react/README.md#button-variants) for each layout.

React Strict Mode replay recreates button bindings without initiating auth. Server
rendering emits the official button in a disabled state. Automatic stylesheet mode
includes styles. Hydration keeps that markup. It enables interaction after the
client binding is ready, subject to the disabled prop and shared pending state.

The React peer range is
`^18.0.0 || ^19.0.0`. The compatibility matrix covers 18.0.0, 18.3.1, and 19.3.0. The package
keeps React external and depends on the exact matching core version. Its two module
formats share only a private React context identity, never global auth state.

### React props and events

In addition to the shared presentation options, `ChatGPTSignInButton` accepts:

- `ref`: object or callback refs to the native button. Callback cleanup functions
  run on replacement or unmount. A callback with no cleanup receives `null` on detach.
- `aria-describedby`, `aria-details`, `aria-errormessage`, and `aria-controls`:
  a string, `null`, or `undefined`.
- `aria-invalid`: a boolean, `'true'`, `'false'`, `'grammar'`, `'spelling'`, `null`,
  or `undefined`.
- Lowercase `data-*` attributes: strings, finite numbers, booleans, `null`, or
  `undefined`. `null` and `undefined` omit the attribute.
- `endDecorator`: non-interactive React content in the fixed decoration slot.

Optional props accept explicit `undefined`. The SDK ignores unsupported props and
emits a console warning. These include `aria-label`, `aria-labelledby`, `role`,
`type`, `name`, and `children`. The SDK controls the action label, logo, and
busy/disabled state. Invalid supported values, a missing provider configuration,
or buttons/hooks outside a provider throw an error.

## Session observation

An adapter can expose an optional `session` capability alongside `signIn`.
The core client provides `getSessionSnapshot()`, `subscribeSession(listener)`, and
`refreshSession()`. React uses these same methods for profile display.

```ts
import { createChatGPTAuth } from '@openai/auth/client';
import { chatgptAuth } from './chatgpt-auth';

const auth = createChatGPTAuth({ adapter: chatgptAuth });
const renderSession = () => {
  const { status, profile } = auth.getSessionSnapshot();
  // Update your account UI from the app's verified session source.
};
const unsubscribe = auth.subscribeSession(renderSession);
renderSession();
await auth.refreshSession(); // Optional explicit read, also works without a subscriber.

// When the observer is no longer needed:
unsubscribe();
```

The stable, frozen snapshot has `{ status, profile }`:

| Status            | Meaning                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| `unavailable`     | No session source is configured.                                         |
| `loading`         | A source is configured, but no current result is available.              |
| `authenticated`   | The source reports a signed-in app session; profile can still be `null`. |
| `unauthenticated` | The source reports no signed-in app session.                             |
| `error`           | The source could not provide a valid session result.                     |

Construction does not read the source. The first subscriber starts observation.
While observed, the client reads again after successful sign-in, source change
notifications, page focus, and persisted page restoration. The last unsubscribe
cancels pending observation reads and removes source/browser listeners. Explicit
`refreshSession()` can read the source without subscribers.

The client cancels obsolete reads and ignores late results after source changes
or cleanup. Background focus/restoration reads retain the known profile until the
read finishes. Source notifications clear it immediately while the new session loads.
`refreshSession()` resolves after a read or cancellation. Source failures produce
`status: 'error'` and `profile: null`; they do not reject the promise or start a retry loop.
Read the snapshot before deciding whether a session check succeeded.

The app's existing auth system still verifies identity and owns its session.
`complete` alone never establishes a profile.

```ts
import type {
  ChatGPTAuthSession,
  ChatGPTAuthSessionSource,
  ChatGPTAuthSignInAdapter,
} from '@openai/auth';

// Your existing auth bridge implements these operations. Its backend verifies
// identity and returns only profile fields the user has consented to share.
declare function readVerifiedAppSession(signal: AbortSignal): Promise<ChatGPTAuthSession>;
declare function subscribeToAppSession(onChange: () => void): () => void;
declare const existingAdapter: ChatGPTAuthSignInAdapter;

const session: ChatGPTAuthSessionSource = {
  getSession: ({ signal }) => readVerifiedAppSession(signal),
  subscribe: subscribeToAppSession, // Optional. Notify on sign-out and account changes.
};
const chatgptAuth: ChatGPTAuthSignInAdapter = { ...existingAdapter, session };
```

`getSession({ signal })` returns one of:

```ts
import type { ChatGPTAuthSession } from '@openai/auth';

const withProfile: ChatGPTAuthSession = {
  status: 'authenticated',
  profile: { subject: 'user-id', name: 'Ada', picture: 'https://example.com/avatar.png' },
};
const withoutProfile: ChatGPTAuthSession = { status: 'authenticated', profile: null };
const signedOut: ChatGPTAuthSession = { status: 'unauthenticated' };
```

`ChatGPTAuthProfile` requires `subject`. The `name` and `picture` fields are optional.
A custom integration maps verified identity claims to this shape once in its
adapter/backend. This includes `sub` to `subject` where applicable. Pictures must be
absolute HTTP(S) URLs without URL credentials. An authenticated session can have
no profile or no picture.

If the source implements `subscribe`, it must notify subscribers about sign-out and account changes outside SDK sign-in.
Page focus and browser restoration also trigger session reads. Reads must not emit their
own change notification unconditionally.

## Automatic profile loading (React)

The provider subscribes to the core client's session source. Profile hooks and
components render its verified display claims.

```tsx
import { ChatGPTAuthProvider, ChatGPTProfilePicture, useChatGPTProfile } from '@openai/auth-react';

function Account() {
  const profile = useChatGPTProfile();
  return (
    <div>
      <ChatGPTProfilePicture size={40} />
      <span>{profile?.name ?? 'Account'}</span>
    </div>
  );
}

<ChatGPTAuthProvider options={{ adapter: chatgptAuth }}>
  <Account />
</ChatGPTAuthProvider>;
```

`useChatGPTProfile()` returns the current `ChatGPTAuthProfile` or `null` and
requires a provider. You do not need a profile prop or a separate session read. The hook returns `null`:

- During initial loading or SSR.
- When no source or profile is available.
- After sign-out.
- If reading the session fails.

That `null` value does not establish whether the user has a session.
A failed read does not cause an automatic retry loop.
This hook is independent of `useChatGPTSignInState()`, which continues to report
interaction outcomes only.

`ChatGPTProfilePicture` uses the same profile and reserves a square area.
Outside a button, an omitted or invalid `size` uses 20 pixels.
Inside a button, it matches the logo: 20 pixels for standard size and 18 pixels for compact size.
A valid explicit `size` keeps its requested dimensions, but the button slot clips content that exceeds its bounds.
The component displays a neutral silhouette while loading, when a picture is absent, or when the image fails.
The `fallback` prop supplies a custom React node.

The `className` and React `style` props customize the container. The `alt` prop
supplies an accessible description when needed. It defaults to `''`, which marks
the picture as decorative. Rendering the component never starts sign-in or requests consent.

Serve profile images through a trusted image host permitted by the app's `img-src`
policy. The browser requests the picture. The picture must be usable without an
SDK-managed bearer token.

You can use the picture as a sign-in button's `endDecorator`. It still reads the
app's consented session profile: it does not discover a pre-login ChatGPT browser
account, select an account, or change authentication behavior. The same neutral
fallback applies when the picture is unavailable.

See the [runnable local adapter](../examples/browser/src/local-auth.ts) for a
complete session source and [React consumer](../examples/browser/src/react.tsx)
for profile rendering. Both use explicitly simulated identity.

## Button styling

React buttons and DOM views accept `className` and
`style`. Both apply to the actual `<button>`. Automatic stylesheet mode is the
default. It needs no stylesheet import or link. The DOM renderer installs defaults once
per document or shadow root.

React 19 emits a hoisted, deduplicated style resource,
including during SSR. React 18 emits an ordinary scoped style element beside each
component, so repeated components can include identical CSS.

React 18 removes component-owned styles with their component. Other mounted
components retain their own styles. External stylesheet mode avoids inline SDK
styles on both versions. DOM buttons reuse only styles installed directly in the
document head or shadow root. Styles inside a disposable SSR subtree do not own
their presentation. A mixed SSR/DOM
page may therefore contain a persistent DOM stylesheet alongside React's server styles.

For a CSP that blocks inline styles, load `@openai/auth/styles.css` (DOM) or
`@openai/auth-react/styles.css` (React) as an external stylesheet. Set
`stylesheet="external"` on `ChatGPTAuthProvider`, or `stylesheet: 'external'` on
the DOM presentation. See [CSP setup](csp.md). The pure visual model and
interaction-only bindings do not load styles.

Use the supported `appearance`, `variant`, `size`, `width`, and `layout` presets.
Keep the SDK's logo, palette, typography, padding, and shape. The
[button branding contract](branding.md) defines permitted customization and
language/accessibility exceptions.

```tsx
<ChatGPTSignInButton
  appearance="dark"
  className="login-button"
  style={{ marginBlock: 8, maxWidth: '24rem' }}
/>
```

```css
.login-button {
  margin-inline: auto;
}
.login-button:focus-visible {
  outline: 3px solid currentColor;
  outline-offset: 3px;
}
```

`ChatGPTAuthSignInButtonStyle` is a React-independent type exported from
`@openai/auth/client`. Both renderers accept only width, margin, and placement
properties from the [layout allowlist](branding.md#place-the-button).
Numeric lengths become pixels. Unitless placement properties stay unitless.
Style values must be strings, finite numbers, or `undefined` in a plain object.

The SDK rejects all other keys, including colors, fonts, logo styling, CSS
shorthands such as `background` and `font`, and custom properties.
Malformed objects and unsupported properties produce `invalid_presentation` with
`param: 'style'`. DOM updates reject invalid styles before changing the view.
Diagnostics do not include supplied CSS values.

React replaces styles on each render. DOM updates patch presentation fields:

- `update({})` retains current styling.
- `update({ style: { marginTop: 4 } })` replaces all previous inline layout styles.
- `update({ className: undefined, style: undefined })` removes the class and inline layout styles.

The SDK snapshots style objects rather than retaining them by reference.
`className` remains an integration hook and supports layout classes. Use an
application-owned wrapper for other page layout. Host CSS remains capable of
changing the DOM. It must preserve branding, with explicit exceptions for user
accessibility styles and SDK-controlled language font fallbacks.
Auto appearance follows `prefers-color-scheme`, including before hydration.

Default selectors remain in the `openai-auth` cascade layer. Order that layer
before application layout layers. Do not use that precedence to replace brand
styles. Keyboard focus may use a stronger accessible outline. The SDK preserves
system colors in forced-color mode and supports text enlargement and wrapping.

The SDK continues to own `type="button"`, native disabled state, `aria-busy`,
`aria-disabled`, label text, and logo geometry. The `data-chatgpt-*` presentation
markers are also SDK-owned. Consumer styles cannot bypass the shared pending lock.
The caller controls rendering for `bindSignInButton()` and must follow the same
[branding contract](branding.md#custom-renderers) when displaying the ChatGPT mark.

## Presentation options

React and DOM buttons share these presentation options and generated locale catalogs:

- `variant`: `outlined` (default) or `contained`. `button` is a deprecated alias
  for `outlined`. `contained` removes the outline. The `appearance` option selects
  the palette separately.
- `layout`: `inline` (default) centers the logo and label as a group, including
  any React end decoration. `spread` places the logo at the leading edge and
  reserves equal side areas to center the label across the entire button.
  It does this even without a trailing decoration.
- `appearance`: `light`, `dark`, or `auto` (default).
- `size`: `standard` (default) or `compact`.
- `width`: `content` (default) or `full`.
- `text`: `continue` (default), `sign-in`, or `brand`. The first two use their
  localized labels. `brand` displays `ChatGPT` with the localized
  `Sign in with ChatGPT` as its accessible name.
- `locale`: an explicit BCP 47 language tag overrides the document language.
  Without `locale`, mounted buttons use `<html lang>` from their own document.
  The SDK tries an exact base tag, then the language and script, then the language.
  See [locale matching](localization.md#locale-matching-and-fallback) for the full order.
  It uses English if the document language does not identify a valid, supported locale.
  The SDK rejects malformed explicit tags. Valid but unsupported explicit tags select English.

  Buttons without an explicit `locale` follow changes to `<html lang>`.
  Set `locale` to `undefined` to restore this behavior.
  The SDK does not read browser language preferences.
  The model exposes the resolved label language as `model.lang` and its direction
  as `model.dir` and `model.style.direction`. DOM and React buttons render this language.

  Arabic, Persian, and Urdu use `rtl`. All other bundled catalogs use `ltr`.
  The host page's direction does not change the button's direction. Both renderers set `dir` explicitly, including
  for `text="brand"`.

  The icon stays first in markup and appears on the logical
  leading side. React end decoration appears on the trailing side. The SDK does
  not mirror either image.

  Without `locale`, React uses English during server rendering (SSR) and initial hydration.
  React uses the document language after the button mounts.
  Pass the same explicit locale on the server and client to render translated labels immediately.
  The pure `getChatGPTSignInButtonModel` does not read browser state.
  It defaults to English without `locale`.

- `className` and `style`: integration hooks and permitted root-button layout styles. See [branding](branding.md).
- `disabled`, `id`, `onClick`, `onFocus`, and `onBlur`. Events are native DOM events in
  the DOM API and synthetic events in React. The DOM API also accepts a string `data-testid`.
- React additionally accepts a real button `ref`, lowercase `data-*` attributes,
  `aria-describedby`, `aria-details`, `aria-errormessage`, `aria-controls`, and
  `aria-invalid`, plus a non-interactive `endDecorator` React node. The decoration
  occupies a 20 × 20px slot for standard buttons or an 18 × 18px slot for compact buttons.
  CSS clips content outside the slot. Its wrapper uses
  `aria-hidden` and `inert`. It has no core/DOM equivalent. See the
  [React package](../packages/react/README.md) for value types and examples.

```ts
auth.mountSignInButton(providerContainer, {
  variant: 'outlined',
  layout: 'spread',
  text: 'brand',
  width: 'full',
  locale: 'ar',
});
```

The SDK ignores unsupported React props and emits `console.warn`. These include
arbitrary labels, button children, and logo overrides. A provider without either `options` or `client`
throws, as do invalid values for supported options. Unknown options
passed directly to the DOM API or inside `options` cause an error.
Use the supported presentation options to preserve the mark and action label.
See [localization](localization.md) for languages, fallback, and RTL behavior, and
[accessibility](accessibility.md) for instructions, errors, and focus in your app.
