import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sdkDirectories = ['packages/core', 'packages/react'];
const manifests = await Promise.all(
  sdkDirectories.map((directory) => readJson(join(root, directory, 'package.json'))),
);

async function licenses(filters) {
  const groups = JSON.parse(
    execFileSync('pnpm', [...filters, 'licenses', 'list', '--prod', '--json'], {
      cwd: root,
      encoding: 'utf8',
    }),
  );
  const entries = new Map();
  for (const group of Object.values(groups)) {
    for (const dependency of group) {
      for (const path of dependency.paths) {
        const manifest = await readJson(join(path, 'package.json'));
        const licenseFiles = [];
        for (const file of (await readdir(path, { withFileTypes: true })).sort((a, b) =>
          a.name.localeCompare(b.name),
        )) {
          if (file.isFile() && /^(licen[cs]e|copying|notice)([.-]|$)/i.test(file.name)) {
            licenseFiles.push({
              file: file.name,
              sha256: sha256(await readFile(join(path, file.name))),
            });
          }
        }
        const entry = {
          name: manifest.name,
          version: manifest.version,
          declaredLicense: manifest.license ?? null,
          licenseFiles,
        };
        entries.set(`${entry.name}@${entry.version}`, entry);
      }
    }
  }
  return [...entries.values()].sort((a, b) =>
    `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`),
  );
}

const sdkDependencies = await licenses([
  '--filter',
  '@openai/auth',
  '--filter',
  '@openai/auth-react',
]);
const workspaceProductionDependencies = await licenses(['--recursive']);
const missingLicenseEvidence = workspaceProductionDependencies
  .filter((entry) => !entry.declaredLicense || entry.licenseFiles.length === 0)
  .map(({ name, version }) => `${name}@${version}`);
const catalogs = (await readdir(join(root, 'localization/locales')))
  .filter((file) => file.endsWith('.json'))
  .sort();
const assets = [
  ['packages/core/src/client/brand.ts', 'Embedded ChatGPT mark'],
  [
    'packages/react/src/components/ChatGPTProfilePicture/ChatGPTProfilePicture.tsx',
    'Inline SVG for the neutral profile fallback',
  ],
  ['packages/core/src/client/localization/catalogs.ts', 'Bundled sign-in button translations'],
  ['localization/messages.json', 'Localization source strings'],
  ['localization/config.json', 'Supported localization catalogs'],
  ...catalogs.map((file) => [
    `localization/locales/${file}`,
    `Source catalog for ${file.slice(0, -5)}`,
  ]),
  ['examples/browser/public/demo/profile-picture.svg', 'Local illustration for the example only'],
];
const report = {
  schemaVersion: 1,
  sourceCommit: git('rev-parse', 'HEAD'),
  sourceDirty: git('status', '--porcelain') !== '',
  lockfileSha256: sha256(await readFile(join(root, 'pnpm-lock.yaml'))),
  buildConfigSha256: sha256(await readFile(join(root, 'tsdown.config.ts'))),
  scope: {
    sdkDependencies: 'Installed production and peer dependency closure for the two SDK packages',
    workspaceProductionDependencies:
      'Installed production and peer closure across examples, playground, and test workspaces; not all are distributed in SDK tarballs',
    exclusions: [
      'Build/test-only dependencies and package-manager toolchain',
      'Consumer-supplied assets, remote profile photos, and service terms',
    ],
    interpretation:
      'Declared licenses and installed license-file hashes are review inputs, not legal approval or a bundled-code analysis. Inspect build configuration and actual packed contents separately.',
  },
  sdkManifests: manifests.map(({ name, version, license, dependencies, peerDependencies }) => ({
    name,
    version,
    license,
    dependencies: dependencies ?? {},
    peerDependencies: peerDependencies ?? {},
  })),
  sdkDependencies,
  workspaceProductionDependencies,
  missingLicenseEvidence,
  noticeFiles: await Promise.all(
    ['NOTICE', 'packages/core/NOTICE', 'packages/react/NOTICE'].map(async (path) => ({
      path,
      sha256: sha256(await readFile(join(root, path))),
    })),
  ),
  assets: await Promise.all(
    assets.map(async ([path, description]) => ({
      path,
      description,
      sha256: sha256(await readFile(join(root, path))),
    })),
  ),
};
await mkdir(join(root, 'artifacts'), { recursive: true });
await writeFile(
  join(root, 'artifacts/distribution-inventory.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.info(
  JSON.stringify({
    inventory: 'artifacts/distribution-inventory.json',
    sdkDependencyCount: sdkDependencies.length,
    workspaceProductionDependencyCount: workspaceProductionDependencies.length,
    missingLicenseEvidence,
  }),
);
