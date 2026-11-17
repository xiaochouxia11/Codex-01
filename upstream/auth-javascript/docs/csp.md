# Content Security Policy

Use `stylesheet="external"` when your application blocks inline styles. Load the
SDK's CSS as an external stylesheet. Then set this option on your React provider
or DOM buttons. The SDK does not inject `<style>` elements during server or client
rendering. Its styles do not require `unsafe-inline` or a style nonce in this mode.

## Load the CSS

Choose the stylesheet for your integration:

| Integration                        | CSS export                      |
| ---------------------------------- | ------------------------------- |
| DOM buttons                        | `@openai/auth/styles.css`       |
| React buttons and profile pictures | `@openai/auth-react/styles.css` |

Import the file through a build pipeline that emits an external CSS asset:

```ts
import '@openai/auth-react/styles.css';
```

Alternatively, copy the exported CSS file from the installed package to your
application's static assets. Link it from the HTML head:

```html
<link rel="stylesheet" href="/assets/openai-auth.css" />
```

Use the CSS from the same SDK version as your JavaScript. Include the link in
server-rendered HTML so the browser styles controls before hydration. Some development
bundlers turn CSS imports into inline `<style>` elements. Configure your bundler
to serve external CSS when testing with your enforced policy.

## React

Set `stylesheet` on the provider to apply it to all of that provider's buttons and
profile pictures. This example accepts your application's existing auth adapter:

```tsx
import type { ChatGPTAuthSignInAdapter } from '@openai/auth';
import {
  ChatGPTAuthProvider,
  ChatGPTSignInButton,
  ChatGPTProfilePicture,
} from '@openai/auth-react';
import '@openai/auth-react/styles.css';

export function SignInPanel({ appAuth }: { appAuth: ChatGPTAuthSignInAdapter }) {
  return (
    <ChatGPTAuthProvider options={{ adapter: appAuth }} stylesheet="external">
      <ChatGPTSignInButton className="login-button" />
      <ChatGPTProfilePicture size={48} alt="Current account" />
    </ChatGPTAuthProvider>
  );
}
```

Use the same stylesheet setting on the server and client. A nested provider has
its own setting. Numeric profile `size` values work without an inline style
attribute, including while the picture loads or the component displays a fallback. Profile
pictures require an adapter with a session source. See the
[React API](api.md) for details.

External mode works with React 18 and 19. React 18 also requires this mode with
`require-trusted-types-for 'script'`. Automatic styling in React 18 uses a static
HTML insertion that Trusted Types enforcement blocks. The SDK does not
create a Trusted Types policy or change your application's enforcement.

## DOM

```ts
import { createChatGPTAuth } from '@openai/auth/client';
import '@openai/auth/styles.css';

const container = document.querySelector<HTMLElement>('#chatgpt-sign-in');
if (!container) throw new Error('Missing sign-in container');

const auth = createChatGPTAuth({ authPath: '/auth/chatgpt' });
const button = auth.mountSignInButton(container, {
  stylesheet: 'external',
  className: 'login-button',
});
```

`/auth/chatgpt` is your application's sign-in initiation route. When mounting
multiple buttons through one client, pass `stylesheet: 'external'` to each
`auth.mountSignInButton()` call as well.

This option affects SDK-rendered controls. The pure button model and interaction
bindings do not load CSS. If you build your own renderer, include the styles your
renderer needs.

Configure external mode from the first render. Switching an existing control to
external mode does not remove styles already installed by other controls using
automatic styling.

## Shadow DOM

Document styles do not cross shadow DOM boundaries. Load the exported CSS inside
each shadow root that contains an SDK control. For example, use a same-origin
`<link rel="stylesheet">` child. The SDK does not insert that link for you.

## Adapt your policy

For an application that serves scripts, styles, and images from its own origin,
use this policy as a starting point:

```text
default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self'; object-src 'none'; base-uri 'none'
```

Adapt the directives to your application's scripts, API connections, and allowed
profile image hosts. In particular, `img-src 'self'` blocks pictures from another
origin. The browser loads the profile URL supplied by your session adapter. The
SDK does not proxy it through your application.

Use `className` and external CSS for permitted button layout styles. Preserve the
[branding contract](branding.md), including its language and accessibility exceptions.
The `style` prop still
creates ordinary inline styles, and server rendering serializes them into style
attributes. A policy with `style-src-attr 'none'` blocks those attributes. External
mode does not convert inline overrides, custom fallback content, or button
decorations into external CSS.

Test the built application with CSP enforced. Include its initial server-rendered
page, hydration, sign-in, profile loading, and custom styles. Inspect browser CSP
violations to catch inline CSS introduced by your framework or bundler.
