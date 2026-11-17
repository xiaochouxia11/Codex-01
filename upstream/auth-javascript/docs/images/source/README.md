# Documentation image source

These pages render the built SDK components used in the documentation screenshots.
They use synthetic profile data and the SDK's neutral fallback.
They do not connect to an identity provider or perform sign-in.

Complete the [repository setup](../../contributing.md#set-up-the-workspace).
Run these commands from the repository root. Build the packages first. Then start the local gallery:

```sh
pnpm build
pnpm exec vite --force --config docs/images/source/vite.config.ts --host 127.0.0.1 --port 4397 --strictPort
```

The `--force` option refreshes the cached SDK build.

Open the [button gallery](http://127.0.0.1:4397/docs/images/source/) or the
[localization gallery](http://127.0.0.1:4397/docs/images/source/?localization).
The gallery uses the SDK's current button styles and translated labels directly.

In another terminal, capture the pages using an installed Chrome browser:

```sh
pnpm exec playwright screenshot --channel chrome --viewport-size '1200,539' --wait-for-selector 'button:not([disabled])' http://127.0.0.1:4397/docs/images/source/ docs/images/button-gallery.png
pnpm exec playwright screenshot --channel chrome --viewport-size '1200,238' --wait-for-selector 'button:not([disabled])' 'http://127.0.0.1:4397/docs/images/source/?localization' docs/images/localization-gallery.png
```

Inspect both images after capture. Check each item:

- Every button appears.
- Each outlined button has a visible border against a matching surface.
- Each contained button fill contrasts with its surrounding surface.
- Labels fit.
- Each appearance, variant, and layout label identifies the prop and its value.
- Arabic places the logo on the right.
- The profile decoration appears on the opposite side from the logo.

Font rendering can vary between platforms.

Keep gallery labels concise. Put explanations in the Markdown guides.
