# Accessibility

The SDK renders native buttons with keyboard activation, localized accessible
names, disabled behavior, and `aria-busy` during sign-in. The SDK hides the ChatGPT
mark and button decorations from assistive technology to avoid duplicate announcements.

Your application supplies the surrounding experience: instructions, error and
session announcements, navigation, and focus after authentication. Test these
together in your application, including with user accessibility styles. Preserve
the [button branding contract](branding.md) when applying partner layout styles.

## Button labels and supporting text

Use `text="continue"` for “Continue with ChatGPT” or `text="sign-in"` for “Sign in
with ChatGPT”. The `locale` option selects both the visible label and its language
and direction. With `text="brand"`, the visible text is “ChatGPT” and the accessible
name remains the full localized “Sign in with ChatGPT” action. See
[localization](localization.md) for available languages and fallback behavior.

In React, associate additional instructions with `aria-describedby`:

```tsx
import { ChatGPTAuthProvider, ChatGPTSignInButton } from '@openai/auth-react';

export function SignIn() {
  return (
    <ChatGPTAuthProvider options={{ authPath: '/auth/chatgpt' }}>
      <ChatGPTSignInButton text="sign-in" aria-describedby="sign-in-help" />
      <p id="sign-in-help">You’ll return here after signing in with ChatGPT.</p>
    </ChatGPTAuthProvider>
  );
}
```

`/auth/chatgpt` must be your application's sign-in initiation route. The SDK does
not implement that route. Keep supporting text accurate for your authentication
flow. A popup and a full-page redirect may need different instructions.

The SDK owns the button's role, accessible name, and busy/disabled state. Add
context through surrounding text and the supported ARIA relationship props rather
than trying to replace those attributes. Use `disabled` when your application
needs to prevent an attempt for a reason outside the SDK's current interaction.

## Profile pictures and decorations

`ChatGPTProfilePicture` is decorative by default. Leave `alt` empty when the
interface already displays the account's name beside the picture. Supply a short description
only when the image conveys information that is otherwise missing:

```tsx
import { ChatGPTProfilePicture } from '@openai/auth-react';

// Render inside ChatGPTAuthProvider, configured with your app's session adapter.
<ChatGPTProfilePicture size={48} alt="Current account" />;
```

The accessible name stays the same while the image loads or a fallback appears.
The SDK hides custom `fallback` content from assistive technology. Put important
account information outside the picture component. Neither a picture nor its
fallback establishes whether the user has an authenticated session.

`endDecorator` on `ChatGPTSignInButton` is also decorative and non-interactive.
Avoid links, buttons, or information that a user must read inside it.

## Errors, progress, and focus

Display a concise, actionable message when your adapter reports an error or
cancellation. Use an appropriate live region, such as `role="status"`, for changes
that users need to hear without moving focus. Localize these application messages
yourself. The SDK's button catalog does not translate the rest of your interface.

After authentication, read your application's session before announcing a signed-in
state. The SDK's `complete` interaction state means the adapter finished, not that
the SDK verified an identity. Move focus to the next useful part of your page after
a redirect, popup, or error recovery. See [interaction recovery](recovery.md) for
the state model and handling a return to an existing page.

## User font and display settings

The SDK uses relative label sizes, unitless line heights, and wrapping labels.
Buttons can grow vertically when users enlarge text or change text spacing.
The SDK supplies local language font fallbacks and does not download fonts.
Forced-color mode keeps system button, text, and disabled colors. The logo follows
the text color, and keyboard focus remains visible.

User font preferences and accessibility styles may override brand defaults.
Do not suppress these settings to enforce partner branding rules.

## Check the integrated experience

- **Keyboard:** Tab and Shift+Tab follow a logical order. Focus is visible. Enter
  and Space start one attempt. Users can reach retry controls after an error.
- **Screen readers:** Each button has one understandable name. Decorative images
  are silent, and progress, errors, and session changes are understandable.
- **Zoom and layout:** At 200% text enlargement and 400% browser zoom, labels remain
  readable and controls usable. Check narrow viewports, long labels, and RTL pages.
- **Colors:** Check text, boundaries, and focus indicators against your actual
  backgrounds in light, dark, and forced-colors modes. Recheck contrast after
  changing CSS or fallback content.
- **Touch and speech:** Controls have sufficient size and spacing. Users can activate
  controls by their visible names. Controls do not require hovering.

Run an automated accessibility scan in your application. Also test the browsers,
devices, and assistive technologies your users rely on. The SDK's automated checks
cover its fixtures. They do not establish WCAG conformance or accessibility of your
complete sign-in flow. Safari and iOS testing requires those actual environments,
not only Playwright WebKit.

For SDK test coverage and contribution guidance, see the
[contributor accessibility checks](contributing.md#test-accessibility).
