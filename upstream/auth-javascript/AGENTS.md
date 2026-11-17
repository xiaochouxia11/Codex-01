# Repository guide

This SDK provides Sign in with ChatGPT UI and interaction state. The application
owns credential verification, authorization, tokens, and authenticated sessions.

## Set up and check changes

Run commands from the repository root. Use the Node.js version in `.nvmrc` and
the pnpm version in `package.json`. Use pnpm for workspace dependencies.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium firefox webkit
pnpm check
```

Use focused checks while editing. Run `pnpm check` before submitting code changes.
It covers formatting, localization, lint, builds, types, unit tests, package
consumers, Auth.js protocol tests, and the browser matrix.

For documentation changes, run `pnpm format:check`. Check local links and compare
documented commands against the scripts. Run `pnpm playground:build` when changing
the playground. See [Contributing](docs/contributing.md) for focused commands.

Run `pnpm build` before package or browser checks. Browser fixtures use synthetic
identities and loopback routes. Set `SIWC_TEST_PORT` to an available port if another
process uses the default port. Do not stop another task's server.

## Code ownership and contracts

- `packages/core/` owns the client, DOM bindings, interaction state, and session
  observation. Keep core independent of React.
- `packages/react/` owns React components and hooks. A provider destroys a client
  that it creates. The application owns an injected client.
- `shared/` owns styles and presentation rules used by both renderers.
- `examples/` owns example authentication and session implementations. SDK
  packages must not import example code.
- `tests/` and `scripts/package-fixtures/` check public behavior and installed
  package consumers.

Keep public entry points limited to re-exports. Put implementation, types, and
helpers next to their owner. Preserve ESM and CommonJS behavior, the shared React
context, and CSS resource identities.

Rendering must not change live authentication state. Active attempts retain their
original configuration. An SDK `complete` event describes interaction completion.
Read the application's session source to determine whether the user is signed in.
Follow the [API contracts](docs/api.md), [recovery rules](docs/recovery.md), and
[branding constraints](docs/branding.md).

## Generated files and package metadata

Edit localization sources in `localization/messages.json` and
`localization/locales/`. Run `pnpm i18n:extract`, `pnpm i18n:compile`, and
`pnpm i18n:check`. Commit source changes with the generated catalog. Do not edit
`packages/core/src/client/localization/catalogs.ts` by hand.

Generate package output with `pnpm build`. Do not commit `dist/`, package archives,
test output, or local credentials. Keep root and package notices consistent with
copied source, dependencies, and emitted code.

The two SDK packages share a version and public npm access. Keep the workspace
root, examples, playground, and test workspaces private. Preserve the package
allowlist, exact core dependency in packed React, and license/notice checks.

Add a [Changeset](.changeset/README.md) for package behavior, API, or integration
changes. Documentation changes usually need no version bump. Add regression tests
that exercise changed behavior. Keep unrelated local edits intact.

## Releases and sensitive information

Follow [Releasing](docs/releasing.md) for versioning, archive checks, publication,
and registry verification. Package publication, release tags, and repository
access changes require explicit task authorization.

Keep tokens, cookies, personal data, internal addresses, and local machine paths
out of source, fixtures, screenshots, and shared logs. Use synthetic identities.
Follow [Security reporting](SECURITY.md) for vulnerabilities.
