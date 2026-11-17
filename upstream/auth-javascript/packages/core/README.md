# @openai/auth

Add Sign in with ChatGPT buttons to a JavaScript application without React. The
package provides DOM buttons, shared interaction state, and TypeScript contracts
for connecting your authentication system.

Use `@openai/auth/client` to mount buttons in the browser. Import portable types
and `ChatGPTAuthError` from `@openai/auth`. Both entry points support ESM and CommonJS.
For React components, use [`@openai/auth-react`](https://github.com/openai/auth-javascript/blob/main/packages/react/README.md).

![Light and dark Sign in with ChatGPT buttons in outlined and contained variants.](https://github.com/openai/auth-javascript/blob/main/docs/images/button-gallery.png?raw=true)

Both packages share button styles. The profile components shown above
are available in `@openai/auth-react`.

## Install

```sh
npm install @openai/auth
```

This package does not require React. See the
[getting-started guide](https://github.com/openai/auth-javascript/blob/main/docs/getting-started.md)
for authentication setup.

## Mount a sign-in button

Add a container to your page:

```html
<div id="sign-in"></div>
<p id="sign-in-error" role="alert"></p>
```

Mount the button after the elements exist:

```ts
import { createChatGPTAuth } from '@openai/auth/client';

const auth = createChatGPTAuth({
  authPath: '/auth/chatgpt',
  onError: () => {
    document.getElementById('sign-in-error')!.textContent =
      'Unable to start sign-in. Please try again.';
  },
});

const button = auth.mountSignInButton(document.getElementById('sign-in')!, { width: 'full' });

// To remove this button: await button.destroy();
// When the client is no longer needed: await auth.destroy();
```

`/auth/chatgpt` must be a same-origin GET route in **your application** that starts
sign-in. Replace it with your real route. The SDK does not register OAuth clients,
create the route, verify tokens, or establish an application session. Your backend
or auth framework owns those operations.

If your auth client starts sign-in through JavaScript, pass `adapter` instead of
`authPath`. The [adapter guide](https://github.com/openai/auth-javascript/blob/main/docs/getting-started.md#connect-an-auth-client)
explains how to map its outcomes. An SDK `complete` result describes the interaction.
Read your application's session to determine whether the user is signed in.

Try the [runnable browser example](https://github.com/openai/auth-javascript/blob/main/examples/browser/README.md)
for navigation, popups, progress, and retry behavior with a simulated local session.

## Customize the button

Default styles load automatically. Choose a supported appearance and layout.
Use `className` and `style` for placement and width only:

```ts
button.update({
  appearance: 'dark',
  variant: 'contained',
  layout: 'spread',
  text: 'sign-in',
  className: 'login-button',
  style: { marginBlock: 8, maxWidth: '24rem' },
});
```

Updates are patches: omitted fields keep their values. A supplied `style` object
replaces all previous inline overrides. `undefined` removes a customization:

```ts
button.update({ className: undefined, style: undefined });
```

Keep the SDK's logo, light/dark palette, typography, and shape. Both renderers
reject unsupported inline style keys, including fonts, colors, and custom properties.
Host CSS must follow the same rules. Language font fallbacks and user accessibility
settings remain supported. See the [branding contract](https://github.com/openai/auth-javascript/blob/main/docs/branding.md).
For a Content Security Policy that blocks inline styles,
load `@openai/auth/styles.css` and set `stylesheet: 'external'` when mounting.
See [CSP setup](https://github.com/openai/auth-javascript/blob/main/docs/csp.md).

The [presentation reference](https://github.com/openai/auth-javascript/blob/main/docs/api.md#presentation-options)
covers all options, including language, right-to-left layout, sizes, and accessible labels.

## Observe progress and allow another attempt

```ts
const unsubscribe = auth.subscribe(() => {
  const { state } = auth.getSnapshot();
  console.info('Sign-in interaction:', state.status);
});

// Stop this observer when you no longer need it: unsubscribe();
```

To allow another attempt:

1. Check your app's session.
2. Reconcile any external sign-in operation.
3. Call `auth.recover()` to return the interaction to `idle`.

Recovery preserves the mounted button and subscriptions. Recovery of a pending attempt requires an
explicit option and does not cancel external authentication. Follow the
[recovery guide](https://github.com/openai/auth-javascript/blob/main/docs/recovery.md).

Mount multiple buttons on the same client to share one attempt. Removing a button
leaves the client and its active attempt available to the other views. Destroying
the client removes every view and subscription. Framework authors can also bind
an existing button or use the visual model.

## Observe the app session

An adapter can provide a `session` source that reads your app's verified session.
The core client exposes this state without React:

```ts
import { createChatGPTAuth } from '@openai/auth/client';
import { chatgptAuth } from './chatgpt-auth'; // Your adapter with a session source.

const auth = createChatGPTAuth({ adapter: chatgptAuth });
const unsubscribe = auth.subscribeSession(() => {
  const { status, profile } = auth.getSessionSnapshot();
  console.info('App session:', status, profile?.name);
});

await auth.refreshSession(); // Optional explicit refresh.
// When finished: unsubscribe(); await auth.destroy();
```

The first subscriber starts the session read. The last unsubscribe stops observation.
Snapshots distinguish unavailable, loading, authenticated, unauthenticated, and error
states. Your auth system still owns identity verification, credentials, and the session.
See the [session API](https://github.com/openai/auth-javascript/blob/main/docs/api.md#session-observation).

## Learn more

- [Getting started](https://github.com/openai/auth-javascript/blob/main/docs/getting-started.md)
- [API reference](https://github.com/openai/auth-javascript/blob/main/docs/api.md)
- [Accessibility](https://github.com/openai/auth-javascript/blob/main/docs/accessibility.md)
- [Support](https://github.com/openai/auth-javascript/blob/main/SUPPORT.md) · [Security reporting](https://github.com/openai/auth-javascript/blob/main/SECURITY.md)
- [Apache License 2.0](LICENSE)
- [Third-party licenses and attribution](NOTICE)
