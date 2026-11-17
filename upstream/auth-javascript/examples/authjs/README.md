# Next.js and Auth.js example

Add a Sign in with ChatGPT button to a Next.js application using Auth.js for
sign-in and sessions. This example connects the SDK's React components to a real
OpenID Connect flow and displays the profile from the resulting application session.

It uses **Next.js 16.4.2 Pages Router, NextAuth.js 4.24.15, and React 19.3.0**.
The provider configuration uses the NextAuth.js v4 API. For App Router or Auth.js
v5, adapt that configuration to the framework's API.

## Before you start

You need a Sign in with ChatGPT client registration that your test account can use.
Obtain the client ID, issuer, allowed callback URLs, and token-endpoint authentication
method for that registration. A confidential client also needs a client secret.
The SDK does not create a client registration or grant access to Sign in with
ChatGPT. See the [website integration guide](https://developers.openai.com/siwc/website)
for service setup. If you do not have a client, follow
[Request a client ID](https://developers.openai.com/siwc/request-client-id).

For the local example, configure this exact callback:

```text
http://127.0.0.1:4322/api/auth/callback/openai
```

`localhost` and `127.0.0.1` are different hosts. The callback must already be active
for your client before sign-in can work. If your client cannot use a loopback
callback, use the [HTTPS deployment guide](../../docs/authjs-https.md).

## Run the example

For an independent app, use the [copy instructions below](#create-an-independent-app).
To run this source checkout, complete the [repository dependency setup](../../docs/contributing.md#set-up-the-workspace).
Run these commands from the repository root:

```sh
pnpm build
cp examples/authjs/.env.example examples/authjs/.env.local
```

Configure `examples/authjs/.env.local`:

| Setting                             | Value                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `NEXTAUTH_URL`                      | `http://127.0.0.1:4322` for local development.                                        |
| `NEXTAUTH_SECRET`                   | A random application-session secret of at least 32 characters.                        |
| `OPENAI_CLIENT_ID`                  | Your registered client ID.                                                            |
| `OPENAI_ISSUER`                     | The exact HTTPS issuer for your client registration.                                  |
| `OPENAI_TOKEN_ENDPOINT_AUTH_METHOD` | The registered method: `none` or `client_secret_basic`.                               |
| `OPENAI_CLIENT_SECRET`              | Leave empty for `none`. Use your server-side client secret for `client_secret_basic`. |

The [production OIDC configuration](https://developers.openai.com/siwc/website#before-you-begin)
uses `https://auth.openai.com` as its issuer. Use that issuer only with a production
client. Otherwise, use the issuer supplied for your client environment. Auth.js discovers
the authorization, token, and signing-key endpoints from the issuer.

`NEXTAUTH_SECRET` secures your application session. It is separate from
`OPENAI_CLIENT_SECRET`. To generate a local application secret, run
`openssl rand -base64 32`. Copy the result to `.env.local`. Keep the file untracked.
Do not use a `NEXT_PUBLIC_` prefix for these settings.

Start the app:

```sh
pnpm example:authjs
```

1. Open <http://127.0.0.1:4322>.
2. Select **Continue with ChatGPT**.
3. Complete sign-in.
4. Reload the page to check that the session persists.

After the callback, the app reads its session and displays the available profile
fields. Use **Sign out of this app** to clear the application session. This does
not sign you out of ChatGPT.

## Create an independent app

To create an application outside the SDK workspace:

1. Create a new application directory outside the SDK workspace.
2. Copy `package.json`, `next.config.mjs`, `next-env.d.ts`, `tsconfig.json`,
   `.gitignore`, `.env.example`, and the `src` directory from `examples/authjs`.
   Exclude `*.test.ts` files. Do not copy `.env.local`, `node_modules`, `dist`, or
   other build output.
3. Remove both `workspace:*` SDK dependencies from the copied `package.json`.

   Preserve the other dependencies and their versions. Remove the copied `test`
   script, which refers to the repository's test suite. Keep the application
   package private.

4. Install the SDK packages and check the independent app:

   ```sh
   npm install @openai/auth @openai/auth-react
   npm run typecheck
   npm run build
   cp .env.example .env.local
   ```

5. Supply your own client configuration in `.env.local`, as described in the
   [configuration above](#run-the-example). Then run `npm run dev`.
   The supplied script serves <http://127.0.0.1:4322>.

Typechecking and building need no live credentials. Sign-in requires a registered
client, its exact active callback, and an eligible account. Client registration and
service access are separate from installing the UI packages.

Keep the application stylesheet import in `src/pages/_app.tsx`. SDK styles install automatically.
If your Content Security Policy restricts inline styles, follow the
[CSP guide](../../docs/csp.md). For an existing Next.js app, copy only the integration files
listed [below](#what-to-copy-into-an-existing-app). Adapt them to your existing routes and session model.

Use the [HTTPS deployment guide](../../docs/authjs-https.md) before deploying the app.

## How the integration works

1. `ChatGPTSignInButton` calls the adapter's `signIn` method.
2. The adapter calls Auth.js `signIn('openai')`. Auth.js handles the redirect,
   callback validation, state, PKCE, nonce, and application cookies.
3. When the user returns to the app, the SDK reads `/api/auth/session` through
   `adapter.session`. The SDK displays the profile from your application.

Connect the React components to the adapter:

```tsx
import { ChatGPTAuthProvider, ChatGPTSignInButton } from '@openai/auth-react';
import { chatgptAuth } from './lib/chatgpt-auth';

export function SignIn() {
  return (
    <ChatGPTAuthProvider options={{ adapter: chatgptAuth }}>
      <ChatGPTSignInButton />
    </ChatGPTAuthProvider>
  );
}
```

The `chatgptAuth` import is the adapter from this example. It connects the UI to
Auth.js and includes the application session source. The SDK never receives OAuth
tokens. Its `redirecting` interaction state means the adapter requested navigation.
The application session determines whether the user is signed in.

## What to copy into an existing app

| File                                                                         | Purpose                                                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [`src/lib/auth.ts`](src/lib/auth.ts)                                         | Server-only OIDC provider, requested scopes, identity mapping, and session callbacks. |
| [`src/pages/api/auth/[...nextauth].ts`](src/pages/api/auth/[...nextauth].ts) | Pages Router handler for Auth.js routes.                                              |
| [`src/lib/chatgpt-auth.ts`](src/lib/chatgpt-auth.ts)                         | SDK adapter that starts Auth.js sign-in.                                              |
| [`src/lib/app-session.ts`](src/lib/app-session.ts)                           | Abortable session reads and change notifications.                                     |
| [`src/lib/session.ts`](src/lib/session.ts)                                   | Mapping from the application session to `ChatGPTAuthSession`.                         |
| [`src/pages/index.tsx`](src/pages/index.tsx)                                 | Sign-in, profile display, recovery, and application sign-out.                         |

Keep the handler's `/api/auth/_log` guard to prevent anonymous client messages from entering server logs.

When you copy these files into an existing TypeScript app, choose one option:

- Keep the example's `allowImportingTsExtensions: true` compiler option with `noEmit: true`.
- Change the `./session.ts` import in `app-session.ts` to `./session` for your app's bundler.

Preserve the application stylesheet import in `src/pages/_app.tsx`. SDK component
styles install automatically. If your app restricts inline styles, use the
[external stylesheet configuration](../../docs/csp.md).

The provider requests `openid profile email`. Auth.js verifies the ID token. The
example copies only the scoped user ID, optional name, and optional picture into
the application session. It does not retain access, refresh, or ID tokens in that
session. Names and pictures may be unavailable. Keep the profile fallback.

Use your own account model when adapting this example. Its user ID combines the
verified issuer, client ID, and subject. Map that external identity to your
application's account. Apply your provisioning and authorization rules. Require
proof before you link an existing account. Do not use an email address or the
presence of a profile picture as authorization. Protected server routes should
check [`getServerSession`](https://next-auth.js.org/configuration/nextjs) with the
same auth options. These routes should enforce the application's access rules.

## Session behavior

The example sets both `session.maxAge` and `jwt.maxAge` to one hour. Session reads
can renew that lifetime, so this is not an absolute one-hour sign-in limit. Changing
these options does not shorten previously issued tokens. Define an appropriate
session expiry, revocation, and migration policy for your application.

Sign-out uses a full-page redirect, after which the SDK reads the cleared session.
If you implement sign-out or account switching without navigation, notify the
session source so the SDK reloads the profile. See `app-session.ts`. If you rely only
on focus events, the previous account can remain visible until the next refresh.
Application sign-out does not revoke the user's OpenAI grant. Revoking that grant requires a separate operation.

If the browser's Back action restores a pending redirect, select **Check session
and enable sign-in again**. The example checks the session before it recovers the
interaction. If that check fails, it keeps the interaction locked and offers a
retry. Learn more about [recovery](../../docs/recovery.md) before changing this behavior.

## Troubleshooting

| Symptom                                        | Check                                                                                                                                    |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in stops before the consent page          | Check the issuer, client ID, exact active callback, and your account's eligibility for the client.                                       |
| The callback fails                             | Match `OPENAI_TOKEN_ENDPOINT_AUTH_METHOD` to the registration. Use a secret only for `client_secret_basic`.                              |
| A public client fails configuration validation | Leave `OPENAI_CLIENT_SECRET` empty when the registered method is `none`.                                                                 |
| The profile is unavailable                     | Check `/api/auth/session` through your app. A completed interaction alone does not establish a session, and profile fields are optional. |
| Deployed sessions do not persist               | Check the canonical HTTPS `NEXTAUTH_URL`, proxy behavior, and cookie settings in the [deployment guide](../../docs/authjs-https.md).     |

Keep secrets, callback codes, tokens, and cookie values out of logs and bug reports.

## Check your integration

These checks need no client credentials. The tests require `openssl` on `PATH`:

```sh
pnpm --filter @openai/auth-authjs-example typecheck
pnpm test:authjs
pnpm example:authjs:build
```

The suite uses a local synthetic OIDC issuer to test token and transaction
validation, session handling, and failure paths. It does not sign in to OpenAI.
Before deployment, test your integration with your own registered client and
intended browsers. Test each of these behaviors:

- Successful sign-in.
- Cancellation.
- Reload.
- Sign-out.
- Account switching.
- Session expiry.

Follow the [HTTPS checklist](../../docs/authjs-https.md) for deployment-specific checks.
