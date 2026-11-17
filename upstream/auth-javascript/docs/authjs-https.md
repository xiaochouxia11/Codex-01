# Deploy the Auth.js example over HTTPS

Use this guide to deploy the [Next.js/Auth.js example](../examples/authjs/README.md)
behind an HTTPS endpoint. Then check sign-in in your application environment.
You need:

- Access to the example source.
- A host with a trusted TLS certificate.
- A Sign in with ChatGPT registration that can use your application callback.

## Configure the client and environment

Choose your application's canonical origin, for example `https://app.example.com`.
Configure this exact callback on your client registration:

```text
https://app.example.com/api/auth/callback/openai
```

Replace the example host with your own. The callback must be active for your
client, and the account you use to test must be eligible for that client. Each
application environment should use its own matching origin, callback, and client
configuration.

Set these values on the server through your deployment's secret manager:

| Setting                             | Value                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `NEXTAUTH_URL`                      | Your canonical HTTPS origin, with no path, query, or fragment.             |
| `NEXTAUTH_SECRET`                   | A stable, environment-specific random secret of at least 32 characters.    |
| `OPENAI_ISSUER`                     | The exact HTTPS issuer for your client registration.                       |
| `OPENAI_CLIENT_ID`                  | Your registered client ID.                                                 |
| `OPENAI_TOKEN_ENDPOINT_AUTH_METHOD` | The registration's `none` or `client_secret_basic` method.                 |
| `OPENAI_CLIENT_SECRET`              | Empty for `none`. The server-side client secret for `client_secret_basic`. |

Keep credentials out of source control, browser variables, command arguments, build
output, and request logs. The application-session secret and OAuth client secret
serve different purposes. Do not substitute one for the other.

## Build and start

For an application prepared using the [independent-app setup](../examples/authjs/README.md#create-an-independent-app),
run these commands from the app directory:

```sh
npm run build
npm start
```

To use the repository example instead, complete the
[repository dependency setup](contributing.md#set-up-the-workspace). Then run
these commands from the repository root:

```sh
pnpm build
pnpm example:authjs:build
pnpm --filter @openai/auth-authjs-example start
```

The supplied start script binds to `127.0.0.1:4322`. Put an HTTPS reverse proxy on
the same host in front of it. If your platform requires a different bind address,
adapt the start command to the platform's private network. Keep the upstream
application accessible only through the intended ingress.

## Configure the proxy and cookies

Your proxy must:

- Preserve the canonical application host. Replace incoming forwarded
  host/protocol headers with values the proxy verified.
- Disable caching for `/api/auth/*`. Preserve every `Set-Cookie` header.
- Preserve callback query parameters, cookie domains, and cookie paths.
- Allow the browser to return to the callback, including through any access
  controls on a private preview.

The app needs outbound HTTPS access to the issuer's discovery, token, and signing-key
endpoints. Keep TLS verification enabled.

With an HTTPS `NEXTAUTH_URL`, the pinned NextAuth.js version selects secure cookie
defaults, including `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, and the appropriate
`__Secure-` or `__Host-` prefixes. Preserve those defaults rather than adding custom
cookie overrides to bypass deployment problems.

## Check the deployed integration

Use your intended browser and client configuration. Inspect cookie names and
attributes without recording their values, tokens, authorization codes, or secrets.

1. Sign in through the SDK button. Return through the registered callback.
   Check that the application session and profile survive a reload.
2. Check that auth cookies have the secure attributes above.
   Check that the app clears transaction cookies after the callback.
   Check that session responses are not cached.
   Check that JavaScript cannot read HttpOnly auth cookies.
3. Check that browsers do not send secure auth cookies to an HTTP endpoint on the same host.
   Check this before any HTTPS redirect. Loopback behavior alone cannot establish
   this for your deployed hostname.
4. Cancel authorization. Check that you can retry without a new session.
   Sign out. Reload. Sign in as another test user. Check that the displayed identity changes.
5. Check that requests with missing or invalid CSRF tokens cannot sign in or sign out a user.
   Check that external return URLs and spoofed forwarded headers cannot change
   the canonical callback or weaken cookie settings.
6. Test the session expiry and account access rules your app intends to enforce.
   The example's one-hour lifetime is renewable. Changing the configuration does
   not invalidate previously issued sessions.
7. For a confidential client, check that incorrect credentials fail without creating
   a session. Restore the correct secret. Check that sign-in succeeds.

Repeat these checks after changing the provider configuration, framework version,
or deployment topology. Test the browsers and devices your own application
supports. The example provides an integration starting point. Your application's
account provisioning, authorization, session revocation, and grant-revocation
behavior must match your product's requirements.
