# @openai/auth-react

Add Sign in with ChatGPT buttons and profile pictures to a React application.
The package connects your auth integration to React components and hooks, with
shared sign-in state, localized labels, and server-rendered button markup.

The package supports React 18 and 19. Your application supplies React and a matching
renderer such as React DOM. For plain JavaScript, use
[`@openai/auth`](https://github.com/openai/auth-javascript/blob/main/packages/core/README.md).

![Light and dark Sign in with ChatGPT buttons in outlined and contained variants.](https://github.com/openai/auth-javascript/blob/main/docs/images/button-gallery.png?raw=true)

## Install

```sh
npm install @openai/auth @openai/auth-react
```

Use matching versions of both SDK packages. Your application supplies React 18 or 19
and a matching renderer such as React DOM. See the
[getting-started guide](https://github.com/openai/auth-javascript/blob/main/docs/getting-started.md)
for authentication setup.

## Add a sign-in button

```tsx
import { ChatGPTAuthProvider, ChatGPTSignInButton } from '@openai/auth-react';

export function SignIn() {
  return (
    <ChatGPTAuthProvider options={{ authPath: '/auth/chatgpt' }}>
      <ChatGPTSignInButton width="full" />
    </ChatGPTAuthProvider>
  );
}
```

`/auth/chatgpt` must be a same-origin GET route in **your application** that starts
sign-in. Replace it with your real route. Register an OAuth client for your application
before connecting this route. Your backend or auth framework verifies the callback and tokens, then creates the application session.

If your auth framework uses a JavaScript function to start authentication, use
`options={{ adapter: chatgptAuth }}` instead. The
[adapter guide](https://github.com/openai/auth-javascript/blob/main/docs/getting-started.md#connect-an-auth-client)
and [Next.js/Auth.js example](https://github.com/openai/auth-javascript/blob/main/examples/authjs/README.md)
explain how to build that integration.

Buttons inside one provider share an attempt, so clicking another button cannot
start duplicate work. Render the provider inside your framework's client boundary
when required. Server rendering produces a styled button that stays disabled
until its client binding is ready.

## Use an existing core client

Use `client` when your app already has a client shared with other views:

```tsx
import { createChatGPTAuth } from '@openai/auth/client';
import { ChatGPTAuthProvider, ChatGPTSignInButton } from '@openai/auth-react';

const auth = createChatGPTAuth({ authPath: '/auth/chatgpt' });

export function SignIn() {
  return (
    <ChatGPTAuthProvider client={auth}>
      <ChatGPTSignInButton />
    </ChatGPTAuthProvider>
  );
}
```

Create the client once for the app's intended lifetime. In SSR applications, keep
clients isolated per app/request. Creation does not start auth or session reads.

Supply exactly one of `options` or `client`. With `options`, the provider creates
and destroys its client. With `client`, it removes only its own bindings and
subscriptions on unmount. The app calls `auth.destroy()` after all consumers finish.
React and DOM buttons attached to that client share one attempt and session source.

## Button variants

Choose the surface, layout, and label independently:

| Prop         | Values                         | Default    |
| ------------ | ------------------------------ | ---------- |
| `variant`    | `outlined`, `contained`        | `outlined` |
| `layout`     | `inline`, `spread`             | `inline`   |
| `text`       | `continue`, `sign-in`, `brand` | `continue` |
| `appearance` | `light`, `dark`, `auto`        | `auto`     |
| `size`       | `standard`, `compact`          | `standard` |
| `width`      | `content`, `full`              | `content`  |

Render these buttons inside a provider:

```tsx
<>
  <ChatGPTSignInButton width="full" />
  <ChatGPTSignInButton variant="contained" appearance="dark" text="sign-in" />
  <ChatGPTSignInButton layout="spread" text="brand" width="full" />
</>
```

`inline` centers the logo and label together. `spread` places the logo at the
leading edge while keeping the label centered across the button. `text="brand"`
displays `ChatGPT` with the full localized action as its accessible name.
`variant="button"` is a deprecated alias for `outlined`.

Set `locale` to choose the label language. See
[localization](https://github.com/openai/auth-javascript/blob/main/docs/localization.md)
for available languages and locale matching. Arabic, Persian, and Urdu use right-to-left layout,
with the logo on the leading side. The SDK does not mirror the logo or end decoration.

Without `locale`, the mounted button uses `<html lang>` from its own document.
It uses English if the document language does not identify a valid, supported locale.
The button follows changes to `<html lang>`.
An explicit `locale` overrides the document language.
Remove `locale` to use the document language again.
The SDK does not read browser language preferences.

Without `locale`, React uses English during server rendering (SSR) and initial hydration.
It uses the document language after the button mounts.
Pass the same explicit locale on the server and client to render translated labels immediately.

## Display the signed-in profile

Add a `session` source to your adapter. Then render profile UI inside its provider:

```tsx
import {
  ChatGPTAuthProvider,
  ChatGPTProfilePicture,
  ChatGPTSignInButton,
  useChatGPTProfile,
} from '@openai/auth-react';
import { chatgptAuth } from './chatgpt-auth';

function Account() {
  const profile = useChatGPTProfile();
  return (
    <>
      <ChatGPTProfilePicture size={40} />
      <span>{profile?.name ?? 'Account'}</span>
      <ChatGPTSignInButton />
    </>
  );
}

export function App() {
  return (
    <ChatGPTAuthProvider options={{ adapter: chatgptAuth }}>
      <Account />
    </ChatGPTAuthProvider>
  );
}
```

`chatgptAuth` is your application's adapter, not an SDK export. Its
`session.getSession({ signal })` reads your verified app session and returns
`{ status: 'authenticated', profile }` or `{ status: 'unauthenticated' }`.
The optional profile has `{ subject, name?, picture? }`. Follow the
[session-source contract](https://github.com/openai/auth-javascript/blob/main/docs/api.md#automatic-profile-loading-react),
or adapt the [Auth.js implementation](https://github.com/openai/auth-javascript/blob/main/examples/authjs/src/lib/chatgpt-auth.ts).

The provider observes the core client, which refreshes the profile on subscription,
successful sign-in, source change notifications, and page focus/restoration. `useChatGPTProfile()` returns `null`
when loading, when a profile is unavailable, or when the read fails. Use the core client's `getSessionSnapshot()` to distinguish those display states.
Your auth framework remains responsible for authorization.

`ChatGPTProfilePicture` displays a neutral fallback while an image is loading,
missing, or unavailable. Its empty default `alt` makes it decorative beside a
visible account name. Supply meaningful `alt` text if the image identifies the
account on its own. The component displays an existing session profile. It does
not discover a ChatGPT account before sign-in.

To add a decorative profile picture inside the button:

```tsx
<ChatGPTSignInButton layout="spread" width="full" endDecorator={<ChatGPTProfilePicture />} />
```

The decoration matches the logo size: 20 × 20px for standard buttons and 18 × 18px for compact buttons.
An omitted or invalid profile `size` uses those dimensions inside the button and 20px outside it.
An explicit valid `size` keeps its requested dimensions. CSS clips content that exceeds the slot.
Default minimum heights remain 44px for standard buttons and 36px for compact buttons.

The wrapper hides the decoration from assistive technology and prevents focus and interaction.
Keep essential account text, links, and controls outside the button.

The profile component still supports `className` and `style` overrides.

## Styles and events

Default styles load automatically. Choose the SDK presets. Use `className` and
`style` for placement and width only:

```tsx
<ChatGPTSignInButton appearance="dark" width="full" style={{ marginBlock: 8 }} />
```

Keep the SDK's logo, light/dark palette, typography, and shape. The SDK rejects
unsupported inline style keys, including fonts, colors, and custom properties.
Host CSS must follow the same rules. Language font fallbacks and user accessibility
settings remain supported. See the [branding contract](https://github.com/openai/auth-javascript/blob/main/docs/branding.md).
For strict CSP, load `@openai/auth-react/styles.css` and set
`stylesheet="external"` on the provider. React 18 with Trusted Types enforcement
also needs external stylesheet mode. See [CSP setup](https://github.com/openai/auth-javascript/blob/main/docs/csp.md).

`onClick`, `onFocus`, and `onBlur` receive React synthetic events. Calling
`preventDefault()` synchronously in `onClick` stops sign-in. The SDK controls the
button's action label, logo, disabled state, and busy state. Use the supported
accessibility props to associate help or errors. See the
[React API reference](https://github.com/openai/auth-javascript/blob/main/docs/api.md#react)
for refs, attributes, events, and lifecycle details.

## Progress, errors, and retry

Use `useChatGPTSignInState()` inside the provider to display interaction progress.
Handle `onError` in the provider's `options` configuration for application error UI.
To allow another attempt without remounting buttons:

1. Check the app session.
2. Reconcile any external operation.
3. Call the recovery function returned by `useChatGPTSignInRecovery()`.

The [state and recovery guide](https://github.com/openai/auth-javascript/blob/main/docs/recovery.md)
has complete recipes.

Interaction state is separate from the authenticated session. `idle` does not
mean signed out. `complete` does not establish a session. Removing a component
or resetting its interaction state does not cancel external authentication.

## Learn more

- [API reference](https://github.com/openai/auth-javascript/blob/main/docs/api.md)
- [Runnable browser examples](https://github.com/openai/auth-javascript/blob/main/examples/browser/README.md)
- [Accessibility](https://github.com/openai/auth-javascript/blob/main/docs/accessibility.md)
- [Support](https://github.com/openai/auth-javascript/blob/main/SUPPORT.md) · [Security reporting](https://github.com/openai/auth-javascript/blob/main/SECURITY.md)
- [Apache License 2.0](LICENSE)
- [Third-party licenses and attribution](NOTICE)
