# Button branding

Use the SDK's light and dark button presentations. Keep the ChatGPT
logo, colors, typeface, and proportions supplied by the SDK. Do not recolor,
replace, distort, or hide the logo. Do not apply a partner typeface to the label.
See the [OpenAI brand guidance](https://openai.com/brand/).

## Choose a presentation

Use these presets instead of custom brand styles:

| Option       | Supported customization                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------- |
| `appearance` | `light`, `dark`, or `auto`. `auto` chooses between the two palettes using the user's color scheme. |
| `variant`    | `outlined` or `contained`.                                                                         |
| `size`       | `standard` or `compact`.                                                                           |
| `width`      | `content` or `full`.                                                                               |
| `layout`     | `inline` or `spread`.                                                                              |
| `text`       | `continue`, `sign-in`, or `brand`, with the SDK's localized accessible name.                       |
| `locale`     | A supported label language, its direction, and SDK-controlled glyph fallbacks.                     |

```tsx
<ChatGPTSignInButton
  appearance="dark"
  variant="contained"
  width="full"
  className="login-button"
  style={{ marginBlock: 8, maxWidth: '24rem' }}
/>
```

The DOM APIs accept the same presentation options and layout styles.
The presets preserve logo geometry. RTL layouts move the logo to the logical
leading side without mirroring it.

## Place the button

The `style` object accepts only these layout properties:

- Width: `width`, `minWidth`, `maxWidth`, `inlineSize`, `minInlineSize`, and `maxInlineSize`.
- Margins: `margin`, `marginTop`, `marginRight`, `marginBottom`, `marginLeft`,
  `marginBlock`, `marginBlockStart`, `marginBlockEnd`, `marginInline`,
  `marginInlineStart`, and `marginInlineEnd`.
- Placement: `alignSelf`, `justifySelf`, `flexGrow`, `flexShrink`, `flexBasis`, `order`, and `verticalAlign`.

Use an application-owned wrapper for other page layout. Use `className` as an
integration hook or for the same layout properties. Keep rules that target the
button's logo, palette, typography, padding, and shape out of partner CSS.
Accessible focus indicators may be strengthened without changing the button's branding.

TypeScript checks inline object literals. Both renderers also check every
style key at runtime, including JavaScript inputs. Unsupported keys produce
`invalid_presentation` with `param: 'style'`. DOM updates reject the entire patch
before changing the button or its callbacks. The SDK rejects custom properties,
including its internal `--chatgpt-*` variables, and CSS shorthands such as `font`
and `background`. Style diagnostics do not include supplied values.

The SDK runs in the application's document. Host stylesheets can still override
CSS. The supported contract does not make the DOM tamper-proof or inspect
computed styles. Keep application resets and broad button selectors from changing
SDK branding. User accessibility styles are an explicit exception.

## Language and accessibility exceptions

The default typeface remains Arial with Helvetica and generic sans-serif fallbacks.
The SDK adds local font fallbacks for scripts that need other glyphs. It selects
these stacks from the resolved label language, including during server rendering.
The SDK does not download or bundle fonts. The final installed glyph font depends
on the device.

User font preferences, text spacing, text enlargement, browser zoom, and
forced-color settings take precedence over brand defaults. The label uses
relative font sizes and a unitless line height. Buttons wrap long labels and grow
vertically instead of using a fixed height. Forced-color mode uses system button,
text, and disabled colors. The logo follows the accessible text color.

Do not disable forced-color adjustment or block user styles to enforce branding.
Check narrow layouts, translated labels, RTL, and keyboard focus in your app.
See [accessibility](accessibility.md) for integration checks.

## Place the button in your layout

Remove color, background, font, padding, radius, opacity, icon, and custom-property
overrides from the branded button. Choose the SDK presets for its appearance.
Move page spacing to supported margins or an application-owned wrapper:

```tsx
<div className="sign-in-placement">
  <ChatGPTSignInButton appearance="light" width="full" />
</div>
```

For strict CSP, put permitted layout styles in an external stylesheet and use
[external stylesheet mode](csp.md). The `style` prop still produces inline CSS.

## Custom renderers

`getChatGPTSignInButtonModel()` supplies the SDK's label, typography, palette, and
logo geometry. Preserve these together, including the localized accessible name,
`lang`, and `dir`. Honor user accessibility settings in the custom renderer.

`bindSignInButton()` only binds authentication interaction. It does not approve
custom branding. A custom renderer that displays the ChatGPT mark must follow this
same branding contract and OpenAI's brand guidance.

Profile pictures have a separate styling API. These restrictions apply to the
branded sign-in button, not to standalone `ChatGPTProfilePicture` containers.
