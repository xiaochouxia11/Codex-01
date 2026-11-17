# Security

## Report a vulnerability

Report suspected vulnerabilities privately using the channels and scope in
[OpenAI's Coordinated Vulnerability Disclosure Policy](https://openai.com/policies/coordinated-vulnerability-disclosure-policy/).
Follow that policy's testing and disclosure requirements. This repository does
not expand the reporting program's scope or establish bounty eligibility.

Include the affected SDK package and version, relevant configuration,
security impact, and a minimal reproduction. For builds from source, include the commit.
If you cannot identify the affected component, describe the SDK behavior.
Also identify the authentication framework or service involved.

Do not put exploit details, access tokens, session cookies, client secrets, or
personal data in an issue. For ordinary integration questions or account problems,
see [support](SUPPORT.md).

## Integration responsibilities

The SDK manages sign-in UI and can display profile information supplied by your
application. Your authentication system must verify identity, handle tokens,
authorize requests, and manage session expiry and revocation. An SDK completion
event does not prove that a user has an authenticated session. Enforce authorization
on your server.

The [browser examples](examples/browser/README.md) use simulated sessions and are
not an authentication service. The [Auth.js example](examples/authjs/README.md)
demonstrates identity verification with a registered OAuth client. Adapt its session
policy to your application's requirements. Signing out of the application does
not necessarily revoke a provider grant.

Use the [integration guide](docs/getting-started.md) to understand these boundaries.
Use the [CSP guide](docs/csp.md) to configure styles and profile images for your
application's security policy.
