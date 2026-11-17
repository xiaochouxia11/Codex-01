# Getting started

This guide adds Sign in with ChatGPT UI to an application that has an authentication
backend or framework. Choose `@openai/auth-react` for React, or `@openai/auth` for
plain JavaScript and other UI frameworks.

The button starts your app's authentication flow. OpenAI authenticates the user.
Your backend verifies the callback and tokens before creating the application session.

## Before you start

Follow [Request a client ID](https://developers.openai.com/siwc/request-client-id)
to register your application. Installing the SDK does not create a client registration.

For a working sign-in flow, you need:

- An OpenAI OAuth client available to your application, with the callback URL and
  permissions required by your auth integration.
- A backend or auth framework that starts authentication, verifies the callback,
  and creates your application's session.
- Either a same-origin GET route that starts that flow, or a browser auth client
  that you can call from a button click.

If you are starting without an auth integration, follow the
[Next.js/Auth.js example](../examples/authjs/README.md). It explains how to connect a
registered client to an application session. If you only want to explore the UI,
the [browser examples](../examples/browser/README.md) work without credentials and
simulate sign-in locally.

## Install the SDK

Run the appropriate command from your application's directory:

```sh
# Plain JavaScript or another non-React UI:
npm install @openai/auth

# React:
npm install @openai/auth @openai/auth-react
```

Use matching versions of both packages. Your React app supplies React 18 or 19
and a matching renderer such as React DOM. The core package does not require React.

To test changes to the SDK itself, follow the
[local package instructions](contributing.md#build-local-packages).

## Connect an authentication route

Use `authPath` if your app has a GET route that starts sign-in. The examples in this section
use `/auth/chatgpt`. Replace it with your actual route.

### React

```tsx
import { ChatGPTAuthProvider, ChatGPTSignInButton } from '@openai/auth-react';

export function SignIn() {
  return (
    <ChatGPTAuthProvider options={{ authPath: '/auth/chatgpt' }}>
      <ChatGPTSignInButton />
    </ChatGPTAuthProvider>
  );
}
```

Buttons in the same provider share sign-in state, preventing duplicate attempts.
Render this view in your framework's client component boundary when required.

### DOM

Add `<div id="sign-in"></div>` to your HTML. Then run:

```ts
import { createChatGPTAuth } from '@openai/auth/client';

const auth = createChatGPTAuth({ authPath: '/auth/chatgpt' });
const button = auth.mountSignInButton(document.getElementById('sign-in')!);

// To remove this button: await button.destroy();
// When the client is no longer needed: await auth.destroy();
```

`authPath` points to your application, not directly to an OpenAI authorization
endpoint. It must resolve to the same origin and cannot contain URL credentials
or a fragment. Your route is responsible for its normal transaction and CSRF
protections. Navigation does not emit SDK completion or cancellation callbacks.
Read the app session when the user returns.

## Connect an auth client

Use `adapter` when your framework provides a JavaScript sign-in function. An adapter
implements `signIn()` and returns a promise with one of these outcomes:

| Result                      | Meaning                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `{ status: 'complete' }`    | Your auth client reports that the interaction completed. Read your app session for the signed-in state. |
| `{ status: 'cancelled' }`   | The user cancelled the interaction.                                                                     |
| `{ status: 'redirecting' }` | Your auth client started a redirect. The page may unload.                                               |

For example, in an application already configured with Auth.js v4 and a provider
whose ID is `openai`:

```ts
import type { ChatGPTAuthSignInAdapter } from '@openai/auth';
import { signIn } from 'next-auth/react';

export const chatgptAuth: ChatGPTAuthSignInAdapter = {
  async signIn() {
    await signIn('openai', { callbackUrl: '/' });
    return { status: 'redirecting' };
  },
};
```

Pass that adapter as `options={{ adapter: chatgptAuth }}` to the React provider, or
as `{ adapter: chatgptAuth }` to `createChatGPTAuth`. Supply exactly one of
`adapter` and `authPath`. The [complete Auth.js example](../examples/authjs/README.md)
includes the provider, callback route, session mapping, and optional profile source.

For a popup-based auth client, start the popup synchronously inside `signIn()`
before any `await`. This preserves the user's click activation. Map only
explicit client outcomes. Closing a popup or leaving the page does not prove a
successful sign-in. Keep tokens and raw provider errors out of adapter results.

## Add profiles, styling, and state

- **Profiles:** Add an optional `adapter.session` source to read verified profile
  data from your app session. Observe it with the core client's `subscribeSession()`
  and `getSessionSnapshot()`, or use `ChatGPTProfilePicture` and `useChatGPTProfile()` in React. See [profile integration](api.md#automatic-profile-loading-react).
  `authPath` alone does not provide a profile source.
- **Styles:** Defaults load automatically. Use [external stylesheet mode](csp.md)
  if your Content Security Policy blocks inline styles. Also use this mode for
  React 18 with Trusted Types enforcement.
- **Language:** Set `locale` on the button. Use the same locale on the server and
  client. See [supported languages and fallback](localization.md).
- **Progress and retry:** Read interaction state, display errors in your app, and
  reconcile the session before resetting an attempt. See [state and recovery](recovery.md).

An interaction state such as `idle` or `complete` is separate from your app's
authenticated session. Profile hooks are for display. Server-side authorization
must use your auth system.

## Compatibility

| Area              | Current compatibility                                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React             | React 18 and 19 (`^18.0.0 \|\| ^19.0.0`), with matching renderer versions. Package/browser checks cover 18.0.0, 18.3.1, and 19.3.0.                        |
| Module formats    | ESM and CommonJS, with TypeScript declarations. JavaScript output targets ES2022.                                                                          |
| Browser UI        | Automated UI coverage in desktop Chromium, Firefox, and WebKit. Actual Safari, mobile browsers, and WebViews are not covered by that matrix.               |
| Framework example | Next.js 16.4.2 Pages Router with next-auth 4.24.15 and React 19.3.0. Auth.js v5 and other framework/router combinations need their own integration checks. |

The repository's development toolchain builds the SDK and examples. Its versions
are not minimum Node requirements for a browser-only application. Test your
own authentication flow and CSP in the browsers you intend to support.

Continue with the [DOM guide](../packages/core/README.md),
[React guide](../packages/react/README.md), or [API reference](api.md).
