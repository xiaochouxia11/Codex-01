# Contributing

This guide describes work on the SDK. To use it in an application, start with
[Getting started](getting-started.md). See [LICENSE](../LICENSE) and
[NOTICE](../NOTICE) for distribution terms.

## Set up the workspace

Install Node.js 24.19.0 and pnpm 11.25.0. Run commands from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium firefox webkit
pnpm check
```

Use pnpm for workspace dependencies and development scripts. Consumer examples
use npm in separate applications. The workspace requires dependency releases to be
at least seven days old. It restricts install-time build scripts.

`pnpm check` runs formatting, catalog checks, lint, builds, type checks, and tests.
It also checks installed package consumers, the Auth.js consumer, the browser
matrix, and both example builds. CI uses the same command.

Use focused checks while developing:

```sh
pnpm format:check
pnpm lint
pnpm build
pnpm typecheck
pnpm test
pnpm test:authjs
pnpm check:packages # Run after building.
pnpm check:authjs-consumer # Run after building.
pnpm test:browser # Run after building. Uses loopback port 4318.
SIWC_TEST_REACT=18.0 pnpm test:browser:single
pnpm playground:build
```

Package checks install local archives into isolated consumers. They cover core
without React, React 18.0.0, 18.3.1, and 19.3.0, ESM, CommonJS, and TypeScript declarations.
Browser checks use matching React and React DOM versions with Chromium, Firefox,
and WebKit. `SIWC_TEST_REACT` accepts `18.0`, `18`, or `19` for a single run.

The browser fixtures use synthetic identities and local routes. They do not check
OpenAI sessions. Screenshots and traces go to ignored `test-results/`.
The Auth.js protocol tests use a synthetic OIDC issuer and require `openssl` on `PATH`.
They do not require a registered client.

Run `pnpm examples` for the [browser examples](../examples/browser/README.md), or
`pnpm playground` for the [UI playground](playground.md).

## Build local packages

After workspace setup, build both packages and create matching archives:

```sh
pnpm build
mkdir -p artifacts/packages
SDK_ARTIFACTS="$PWD/artifacts/packages"
pnpm --dir packages/core pack --out "$SDK_ARTIFACTS/openai-auth-0.1.0.tgz"
pnpm --dir packages/react pack --out "$SDK_ARTIFACTS/openai-auth-react-0.1.0.tgz"
```

To test the local SDK changes in another app, install the archives from that app's directory:

```sh
SDK_ARTIFACTS=/absolute/path/to/sdk/artifacts/packages

# Plain JavaScript or another non-React UI:
npm install "$SDK_ARTIFACTS/openai-auth-0.1.0.tgz"

# React:
npm install "$SDK_ARTIFACTS/openai-auth-0.1.0.tgz" "$SDK_ARTIFACTS/openai-auth-react-0.1.0.tgz"
```

Use filenames that match the package versions in your checkout. Install both archives
together in a React app to satisfy its exact core dependency locally. Make the archives
available at the same paths in your app's build environment.

`pnpm check:packages` builds its own isolated consumers from package archives.
The archive checks enforce safe paths, expected contents, export targets, matching
versions, and exact license/notice text. Package checks also require README links
to resolve within the installed archive.

Both SDK packages use public npm access. The workspace root, examples, playground,
and test workspaces remain private because they are development applications.

## Code organization

- `packages/core/` owns the client factory, DOM bindings, interaction state, and
  session observation. The application's authentication system remains authoritative.
- `packages/react/` binds React components and hooks to the core client. A provider
  destroys its own client but leaves an injected client with its application owner.
- `shared/` holds button styles, typography, and presentation constraints for both renderers.
- `tests/` contains unit and browser regression tests. `scripts/package-fixtures/`
  contains installed-package runtime and declaration fixtures.
- `examples/` contains application authentication and session code. SDK packages
  must not depend on example implementations.

Keep package entry points limited to public re-exports. Keep implementation,
types, and helpers next to their owner. Preserve the shared ESM/CJS React context
and CSS resource identities when changing builds or style installation.

Rendering must not update live authentication state. Active attempts retain their
original configuration. Follow the [API contracts](api.md),
[recovery rules](recovery.md), and [branding constraints](branding.md).

## Test accessibility

Run the focused browser suite after building:

```sh
pnpm build
pnpm test:browser accessibility.spec.ts
# Select another available loopback port if needed.
SIWC_TEST_PORT=14318 pnpm test:browser accessibility.spec.ts
```

The suite scans local fixtures with axe and fails on reported violations.
It covers button states, visual variants, localized names, and profile fallbacks.
Reports go to ignored `artifacts/accessibility/`, organized by React runtime,
browser, test, and state. The Playwright results include those reports.

Other browser tests check keyboard use, focus, text enlargement, forced colors,
SSR, and CSP. Incomplete axe checks need human assessment. Automated checks do not
establish WCAG conformance or assistive-technology usability.

Review changes in a representative application with its actual authentication
flow. Check keyboard focus, announced names and states, errors, zoom, contrast,
and touch targets. Test the intended browsers and assistive technologies.
Playwright WebKit does not replace Safari or iOS testing. See the
[application accessibility guide](accessibility.md) for the complete checklist.

## Maintain localization

`localization/messages.json` contains English text, stable message IDs, and translator notes.
`localization/config.json` lists the expected locales. The checked-in catalogs live
in `localization/locales/`. The generated runtime file is
`packages/core/src/client/localization/catalogs.ts`.

To change source text or translations:

1. Edit the source messages or the appropriate checked-in locale catalog.
2. Review affected translations. Reuse an ID only when its meaning remains the same.
3. Extract, compile, and check the catalogs:

   ```sh
   pnpm i18n:extract
   pnpm i18n:compile
   pnpm i18n:check
   pnpm test -- tests/localization-pipeline.test.ts
   ```

4. Review the generated diff. Commit source and generated files together.
5. Check translated labels and direction in both renderers:

   ```sh
   pnpm build
   pnpm test:browser localization.spec.ts
   pnpm check:packages
   ```

These commands use local files and need no translation service or credentials.
Validation requires every configured catalog and exact message IDs. Labels must be
complete, safe literal text. Markup, interpolation, control characters, and line
breaks are not supported. Compilation produces deterministic output.

Check accessible labels, leading logo placement, SSR, and locale changes during a
pending attempt. Catalog validation does not establish translation quality.
See [localization](localization.md) for locale matching and layout behavior.

## Update documentation images

Keep screenshot source in `docs/images/source/`. Follow the
[gallery instructions](images/source/README.md) to render the built SDK and capture
both images. Use synthetic profiles and neutral fallback images.
Inspect labels, layout, direction, and image metadata before committing the result.
Do not include account data, credentials, or internal addresses.

## Maintain third-party notices

The root [NOTICE](../NOTICE) identifies third-party material in the SDK and direct
libraries used by the examples and playground. Each package has a self-contained notice:

- [Core NOTICE](../packages/core/NOTICE): React DOM's adapted CSS property list and `csstype`.
- [React NOTICE](../packages/react/NOTICE): the external React peer and emitted Rolldown helpers.

Check `pnpm-lock.yaml`, copied source, and emitted code when dependencies or builds change.
The current attribution sources are:

| Material                  | Source                  | License evidence                                                                                                                                     |
| ------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `csstype`                 | 3.2.3                   | Installed `LICENSE`                                                                                                                                  |
| React and React DOM       | 19.3.0                  | Installed `LICENSE` files                                                                                                                            |
| Adapted unitless CSS list | React `v19.3.0`         | [Upstream source](https://github.com/facebook/react/blob/v19.3.0/packages/react-dom-bindings/src/shared/isUnitlessNumber.js) and React's MIT license |
| Rolldown helpers          | 1.2.12                  | Installed `LICENSE` and `THIRD-PARTY-LICENSE`, including Rollup and esbuild notices                                                                  |
| Next.js                   | 16.4.2                  | Installed `license.md`                                                                                                                               |
| NextAuth.js               | 4.24.15                 | [ISC license at its release commit](https://github.com/nextauthjs/next-auth/blob/d857eec560fb99c8b18d3b22a2693b849a62d1c3/LICENSE)                   |
| `jose`                    | 4.15.9, through Auth.js | Installed `LICENSE.md`                                                                                                                               |

The installed NextAuth.js package omits its license file. Its notice uses the
matching upstream release text, including both copyright holders.
The React notice records the default installed version. The supported React 18/19
peer dependencies also retain their own license files.

The core renderer includes adapted React DOM code even though React is not a
runtime dependency. The React CommonJS build includes Rolldown runtime helpers.
Development tools can contribute code to shipped output.

When the inventory changes:

1. Inspect emitted JavaScript and declarations for third-party material.
2. Copy applicable copyright and license text without rewriting it.
3. Update the root notice and each affected package notice.
4. Run `pnpm build`, `pnpm check:packages`, and `pnpm check:distribution`.
5. Inspect the resulting package contents and distribution inventory.

Package checks compare archived LICENSE and NOTICE files with their source bytes.
The distribution inventory records notice hashes and dependency evidence.
The root notice does not cover every transitive dependency in a compiled example
or server. Inspect those complete outputs and retain all applicable notices when distributing them.

## Prepare a change

Keep changes focused. Add a minimal reproduction for a bug and tests that exercise
its public behavior. Run the relevant checks above. Run `pnpm check` before submitting
code changes. State any checks you could not run.

For package behavior or API changes, add a [Changeset](../.changeset/README.md)
with a user-facing summary. Documentation-only changes usually need no version bump.
The packages share a version. `pnpm version:packages` applies pending Changesets
when preparing a version update. Follow [Releasing](releasing.md) to validate,
publish, and verify the package pair.

Keep credentials, tokens, cookies, and personal data out of source, fixtures,
logs, and screenshots. Use [security reporting](../SECURITY.md) for vulnerabilities
and [support](../SUPPORT.md) for integration questions.
