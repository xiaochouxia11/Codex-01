import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const packageNames = { 'packages/core': '@openai/auth', 'packages/react': '@openai/auth-react' };

interface Manifest {
  name?: string;
  version?: string;
  private?: boolean;
  publishConfig?: { access?: string };
  license?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  exports?: Record<string, unknown>;
  scripts?: Record<string, string>;
}

function readManifest(path: string): Manifest {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path}: a package manifest object is required.`);
  }
  return value as Manifest;
}

function validVersion(version: unknown): version is string {
  if (typeof version !== 'string') {
    return false;
  }
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(
      version,
    );
  return Boolean(
    match &&
    match.slice(1, 4).every((part) => Number.isSafeInteger(Number(part))) &&
    (!match[4] || match[4].split('.').every((part) => !/^0\d+$/.test(part))),
  );
}

function assertMetadata(manifest: Manifest) {
  if (
    !Object.values(packageNames).includes(manifest.name ?? '') ||
    !validVersion(manifest.version) ||
    typeof manifest.license !== 'string' ||
    !manifest.license.trim()
  ) {
    throw new Error('SDK packages require their expected name, a valid version, and a license.');
  }
  if (
    (manifest.private !== undefined && manifest.private !== false) ||
    manifest.publishConfig?.access !== 'public'
  ) {
    throw new Error('SDK packages require public publish access and must not be private.');
  }
}

/** Check source guards before a package manager can execute pack lifecycle hooks. */
export function assertPackageSources(root: string, paths?: string[]): void {
  const manifests =
    paths ??
    execFileSync('git', ['ls-files', '-z', '--', 'package.json', '**/package.json'], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean);
  for (const path of [
    'package.json',
    ...Object.keys(packageNames).map((p) => `${p}/package.json`),
  ]) {
    if (!manifests.includes(path)) {
      throw new Error(`${path}: required source manifest is missing.`);
    }
  }
  const sdk = new Map<string, Manifest>();
  for (const path of manifests) {
    const manifest = readManifest(join(root, path));
    const expected = packageNames[dirname(path) as keyof typeof packageNames];
    if (!expected) {
      if (manifest.private !== true) {
        throw new Error(`${path}: private must be exactly true.`);
      }
      continue;
    }
    assertMetadata(manifest);
    if (manifest.name !== expected) {
      throw new Error(`${path}: expected package name ${expected}.`);
    }
    if (
      ['prepack', 'prepare', 'postpack'].some((hook) => Object.hasOwn(manifest.scripts ?? {}, hook))
    ) {
      throw new Error(`${path}: package packing must not execute lifecycle hooks.`);
    }
    sdk.set(expected, manifest);
  }
  const core = sdk.get('@openai/auth')!;
  const react = sdk.get('@openai/auth-react')!;
  if (core.version !== react.version) {
    throw new Error('Both SDK packages must use the same version.');
  }
  if (!['workspace:*', core.version].includes(react.dependencies?.['@openai/auth'])) {
    throw new Error('React must depend on the matching core package.');
  }
}

/** Inspect the archive bytes before a consumer installs them. */
export function inspectPackedPackage(
  tarball: string,
  expected: Manifest,
  license: string,
  notice: string,
) {
  assertMetadata(expected);
  const tar = (args: string[]) =>
    execFileSync('tar', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const entries = tar(['-tzf', tarball]).trim().split('\n');
  const types = tar(['-tvzf', tarball])
    .trim()
    .split('\n')
    .map((line) => line[0]);
  if (entries.length !== types.length || types.some((type) => type !== '-' && type !== 'd')) {
    throw new Error('Tarball must contain only ordinary files and directories, never links.');
  }
  const files: string[] = [];
  const seen = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    const parts = entry.replace(/\/$/, '').split('/');
    const path = parts.join('/');
    if (
      parts[0] !== 'package' ||
      parts.some((part) => !part || part.startsWith('.')) ||
      Array.from(entry).some(
        (character) =>
          character === '\\' || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ) ||
      seen.has(path)
    ) {
      throw new Error('Tarball contains an unsafe or duplicate path.');
    }
    seen.add(path);
    const relative = parts.slice(1).join('/');
    if (types[index] === 'd') {
      if (relative !== '' && relative !== 'dist' && !relative.startsWith('dist/')) {
        throw new Error('Tarball contains an unexpected directory.');
      }
      continue;
    }
    if (
      !['package.json', 'README.md', 'LICENSE', 'NOTICE', 'CHANGELOG.md'].includes(relative) &&
      !/^dist\/(?:[^/.][^/]*\/)*[^/.][^/]*\.(?:mjs|cjs|css|mts|cts)$/.test(relative)
    ) {
      throw new Error('Tarball contains a file outside the distribution allowlist.');
    }
    files.push(relative);
  }
  for (const required of ['package.json', 'README.md', 'LICENSE', 'NOTICE']) {
    if (!files.includes(required)) {
      throw new Error(`Tarball is missing ${required}.`);
    }
  }
  const packed = JSON.parse(tar(['-xOzf', tarball, 'package/package.json'])) as Manifest | null;
  if (
    !packed ||
    packed.private !== expected.private ||
    !isDeepStrictEqual(packed.publishConfig, expected.publishConfig) ||
    packed.name !== expected.name ||
    packed.version !== expected.version ||
    packed.license !== expected.license ||
    !isDeepStrictEqual(packed.exports, expected.exports)
  ) {
    throw new Error('Packed manifest does not preserve the source package metadata.');
  }
  if (!license.trim() || tar(['-xOzf', tarball, 'package/LICENSE']) !== license) {
    throw new Error('Packed LICENSE must match the source license exactly.');
  }
  if (!notice.trim() || tar(['-xOzf', tarball, 'package/NOTICE']) !== notice) {
    throw new Error('Packed NOTICE must match the source notice exactly.');
  }
  const exports = (value: unknown): string[] =>
    typeof value === 'string'
      ? [value]
      : value && typeof value === 'object'
        ? Object.values(value).flatMap(exports)
        : [];
  const targets = exports(packed.exports);
  if (
    targets.length === 0 ||
    targets.some((target) => !target.startsWith('./dist/') || !files.includes(target.slice(2)))
  ) {
    throw new Error('Every declared package export must exist in the tarball.');
  }
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies'] as const) {
    for (const range of Object.values(packed[field] ?? {})) {
      if (typeof range !== 'string' || /^(?:workspace:|file:|link:)/.test(range)) {
        throw new Error('Packed dependencies must not reference the local workspace.');
      }
    }
  }
  if (
    packed.name === '@openai/auth-react' &&
    packed.dependencies?.['@openai/auth'] !== expected.version
  ) {
    throw new Error('Packed React must depend on the exact matching core package.');
  }
  return files.sort();
}
