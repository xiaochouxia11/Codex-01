# Support

For help integrating Sign in with ChatGPT, start with the
[integration guide](docs/getting-started.md), [API reference](docs/api.md), and
[examples](examples/browser/README.md).

## SDK bugs and integration questions

Use the
[issue tracker](https://github.com/openai/auth-javascript/issues)
for SDK bugs and documentation questions that contain no sensitive data. Include:

- The package version or source commit.
- Your browser, React, and framework versions, where applicable.
- Whether you use `authPath` navigation or an adapter.
- The expected behavior, actual behavior, and a minimal reproduction.

The [browser examples](examples/browser/README.md) can help isolate UI behavior
from your authentication integration. The examples simulate sessions. They do not
verify a real identity.

Remove credentials, tokens, session cookies, and personal data from reports and
screenshots. For suspected vulnerabilities, use the private reporting route in
[SECURITY.md](SECURITY.md).

## Authentication and account issues

The SDK displays sign-in controls and coordinates interaction. Your authentication
system verifies identity, handles callbacks and tokens, and creates the application
session. For callback, cookie, or session problems, consult your authentication
framework's documentation and the team that maintains your application. The
[Auth.js example](examples/authjs/README.md) demonstrates one complete integration.

For OpenAI account, login, billing, or API service questions, use the
[OpenAI Help Center](https://help.openai.com/) and its
[contact instructions](https://help.openai.com/en/articles/6614161-how-can-i-contact-support).
Check [OpenAI service status](https://status.openai.com/) for service incidents.
