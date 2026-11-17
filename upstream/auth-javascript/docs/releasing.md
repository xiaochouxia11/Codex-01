# Releasing the SDK

This guide covers stable releases of `@openai/auth` and `@openai/auth-react` from
`openai/auth-javascript`. Both packages use the same version. The React archive
must depend on that exact core version.

## Prepare the version

Use the Node.js and pnpm versions specified by `.nvmrc` and `package.json`.
Follow [Contributing](contributing.md) to install dependencies and browser binaries.

For changes with pending Changesets, prepare a version PR:

```sh
pnpm version:packages
pnpm install --lockfile-only
```

Review both package versions, generated changelogs, dependency ranges, and lockfile.
Merge the version PR after its required checks and reviews pass. For an initial
release, use the reviewed package versions without adding an artificial version bump.

Use a clean checkout of the release commit on `main`. Check that required CI
passed for that exact commit. Run the release checks from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm playground:build
pnpm check:distribution
git status --short
```

Resolve unexpected source changes before packing. Review the distribution inventory
and notices when dependencies or emitted code change. CI and package tests use
synthetic identities. They do not establish a working production authentication flow.

## Pack and inspect the release

Keep these variables in the same shell for the remaining commands:

```sh
test -z "$(git status --porcelain)"
SDK_RELEASE_VERSION=$(node -p "require('./packages/core/package.json').version")
SDK_RELEASE_SHA=$(git rev-parse HEAD)
SDK_RELEASE_DIR="$PWD/artifacts/release-$SDK_RELEASE_VERSION"
mkdir -p "$SDK_RELEASE_DIR"

pnpm --dir packages/core pack --out "$SDK_RELEASE_DIR/openai-auth-$SDK_RELEASE_VERSION.tgz"
pnpm --dir packages/react pack --out "$SDK_RELEASE_DIR/openai-auth-react-$SDK_RELEASE_VERSION.tgz"
```

Use pnpm to pack workspace dependencies into registry-compatible versions.
`pnpm check:packages` checks its own temporary archives. Inspect the actual release
archives with the same source and archive guards:

```sh
node --input-type=module - "$SDK_RELEASE_DIR" "$SDK_RELEASE_SHA" <<'NODE'
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertPackageSources, inspectPackedPackage } from './scripts/package-contents.ts';

assertPackageSources(process.cwd());
const packages = [];
for (const directory of ['core', 'react']) {
  const source = join('packages', directory);
  const manifest = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'));
  const filename = `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`;
  const archive = join(process.argv[2], filename);
  inspectPackedPackage(
    archive,
    manifest,
    readFileSync(join(source, 'LICENSE'), 'utf8'),
    readFileSync(join(source, 'NOTICE'), 'utf8'),
  );
  const bytes = readFileSync(archive);
  packages.push({
    name: manifest.name,
    version: manifest.version,
    filename,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
  });
}
writeFileSync(
  join(process.argv[2], 'release.json'),
  `${JSON.stringify({ sourceCommit: process.argv[3], packages }, null, 2)}\n`,
);
NODE
```

Review both archive file lists, manifests, READMEs, licenses, and notices. Retain the
archives, `release.json`, check results, and distribution inventory together.
Publish these inspected archives. If source or package bytes change, repeat validation
and packing before publication.

## Publish the package pair

Check publication authorization, npm scope access, and the intended version.
For the first publication of a package, an authorized maintainer uses token-based
npm authentication. Keep credentials in the approved credential store or runner secret
store. Never include token values in source, command history, logs, or release records.

Use the public npm registry explicitly. Check whether each version already exists:

```sh
npm whoami --registry https://registry.npmjs.org/
npm view "@openai/auth@$SDK_RELEASE_VERSION" version dist.integrity --json --registry https://registry.npmjs.org/
npm view "@openai/auth-react@$SDK_RELEASE_VERSION" version dist.integrity --json --registry https://registry.npmjs.org/
```

An authentication or network error does not establish that a version is absent.
If a version exists, compare its integrity with `release.json`. Do not overwrite
an existing version. Investigate an integrity mismatch before continuing.

The commands below publish stable releases to `latest`. Use a separately approved
dist-tag for prereleases. Publish core first:

```sh
npm publish "$SDK_RELEASE_DIR/openai-auth-$SDK_RELEASE_VERSION.tgz" --access public --tag latest --ignore-scripts --registry https://registry.npmjs.org/
```

Check that the core version is visible and its `dist.integrity` matches the
recorded integrity. Then publish React:

```sh
npm publish "$SDK_RELEASE_DIR/openai-auth-react-$SDK_RELEASE_VERSION.tgz" --access public --tag latest --ignore-scripts --registry https://registry.npmjs.org/
```

If publication stops after one package, inspect both registry versions. Retry only
the missing package with its retained archive after checking the existing package.
Do not rebuild, change versions, or announce completion during this recovery.

## Check and record the release

Compare both registry versions and `dist.integrity` values with `release.json`.
Check that both packages' `latest` tags point to the intended stable version:

```sh
npm view "@openai/auth@$SDK_RELEASE_VERSION" version dist.integrity --json --registry https://registry.npmjs.org/
npm view "@openai/auth-react@$SDK_RELEASE_VERSION" version dist.integrity --json --registry https://registry.npmjs.org/
npm view @openai/auth dist-tags --json --registry https://registry.npmjs.org/
npm view @openai/auth-react dist-tags --json --registry https://registry.npmjs.org/
```

Install the exact registry versions in a fresh application outside this workspace.
Check imports and the intended application integration. Use registry packages,
without local archives, workspace links, or dependency overrides.

After both packages pass verification, create Changesets-compatible tags at
`SDK_RELEASE_SHA`: `@openai/auth@<version>` and `@openai/auth-react@<version>`.
Push only those tags. If a tag exists, check its commit instead of replacing it.
Create release notes that identify both packages, versions, changes, and migration steps.
Retain the source commit, archive hashes, and registry verification results.

## Automate subsequent releases

Keep Changesets for versioning and release PRs. Configure the GitHub release bot
separately from npm publication access. Use [Changesets automation](https://changesets.dev/guide/automating)
for version-PR setup and [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
for OIDC configuration.

Configure a trusted publisher for each npm package after it exists. Bind each
publisher to `openai/auth-javascript`, the exact workflow filename, and the protected
release environment. Use a supported GitHub-hosted runner and OIDC-capable npm.
Grant `id-token: write` only to the publishing job.

The workflow must check the reviewed release commit and publish its inspected
artifacts after required checks pass. Keep package installation and builds separate
from the job that holds publication permissions. Preserve the package order,
integrity checks, and partial-release recovery described above.
