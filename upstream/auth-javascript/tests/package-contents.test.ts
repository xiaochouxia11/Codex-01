// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { assertPackageSources, inspectPackedPackage } from '../scripts/package-contents.ts';

const temporary: string[] = [];
const license = 'Example package license text.\n';
const notice = 'Third-party library attribution and license text.\n';
const sourcePaths = ['package.json', 'packages/core/package.json', 'packages/react/package.json'];

function workspaceFixture() {
  const root = mkdtempSync(join(tmpdir(), 'sdk-package-test-'));
  temporary.push(root);
  writeFileSync(join(root, 'package.json'), JSON.stringify({ private: true }));
  for (const name of ['core', 'react']) {
    const directory = join(root, 'packages', name);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({
        name: name === 'core' ? '@openai/auth' : '@openai/auth-react',
        publishConfig: { access: 'public' },
        version: '0.1.0',
        license: 'SEE LICENSE IN LICENSE',
        ...(name === 'react' ? { dependencies: { '@openai/auth': 'workspace:*' } } : {}),
      }),
    );
  }
  return root;
}

function change(root: string, path: string, changes: Record<string, unknown>) {
  const file = join(root, path, 'package.json');
  writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), ...changes }));
}

afterEach(() => {
  for (const root of temporary.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('package source guards', () => {
  it('accepts public SDK packages with matching versions in a private workspace', () => {
    expect(() => assertPackageSources(workspaceFixture(), sourcePaths)).not.toThrow();
  });
  it.each([false, undefined, 'true'])('rejects an example with private=%j', (value) => {
    const root = workspaceFixture();
    mkdirSync(join(root, 'examples/extra'), { recursive: true });
    writeFileSync(join(root, 'examples/extra/package.json'), JSON.stringify({ private: value }));
    expect(() =>
      assertPackageSources(root, [...sourcePaths, 'examples/extra/package.json']),
    ).toThrow(/private must be exactly true/);
  });
  it.each(sourcePaths)('rejects a missing required manifest: %s', (path) => {
    expect(() =>
      assertPackageSources(
        workspaceFixture(),
        sourcePaths.filter((p) => p !== path),
      ),
    ).toThrow(/required source manifest/);
  });
  it('keeps the workspace root private', () => {
    const root = workspaceFixture();
    change(root, '.', { private: false });
    expect(() => assertPackageSources(root, sourcePaths)).toThrow(/private must be exactly true/);
  });
  it.each(['packages/core', 'packages/react'])('rejects private SDK package %s', (path) => {
    const root = workspaceFixture();
    change(root, path, { private: true });
    expect(() => assertPackageSources(root, sourcePaths)).toThrow(/must not be private/);
  });
  it.each([undefined, {}, { access: 'restricted' }])(
    'rejects missing or restricted SDK publication access: %j',
    (publishConfig) => {
      const root = workspaceFixture();
      change(root, 'packages/core', { publishConfig });
      expect(() => assertPackageSources(root, sourcePaths)).toThrow(/public publish access/);
    },
  );
  it.each(['prepack', 'prepare', 'postpack'])('rejects %s hooks before packing', (hook) => {
    const root = workspaceFixture();
    change(root, 'packages/core', { scripts: { [hook]: 'node pack-helper.mjs' } });
    expect(() => assertPackageSources(root, sourcePaths)).toThrow(/lifecycle hooks/);
  });
  it.each(['', 'latest', '1.2', '01.2.3', '1.2.3-01'])('rejects invalid version %j', (version) => {
    const root = workspaceFixture();
    change(root, 'packages/core', { version });
    expect(() => assertPackageSources(root, sourcePaths)).toThrow(/valid version/);
  });
  it('requires the package identities and matching versions', () => {
    const root = workspaceFixture();
    change(root, 'packages/react', { name: '@openai/auth' });
    expect(() => assertPackageSources(root, sourcePaths)).toThrow(/expected package name/);
    change(root, 'packages/react', { name: '@openai/auth-react', version: '0.2.0' });
    expect(() => assertPackageSources(root, sourcePaths)).toThrow(/same version/);
  });
  it('requires a matching core dependency', () => {
    const root = workspaceFixture();
    change(root, 'packages/react', { dependencies: { '@openai/auth': '^0.1.0' } });
    expect(() => assertPackageSources(root, sourcePaths)).toThrow(/matching core package/);
  });
  it('rejects malformed package metadata', () => {
    const root = workspaceFixture();
    writeFileSync(join(root, 'packages/core/package.json'), 'null');
    expect(() => assertPackageSources(root, sourcePaths)).toThrow(/manifest object/);
  });
});

function archiveFixture(
  extra?: (root: string) => void,
  name: '@openai/auth' | '@openai/auth-react' = '@openai/auth',
) {
  const root = workspaceFixture();
  const directory = join(root, 'package');
  mkdirSync(join(directory, 'dist'), { recursive: true });
  const manifest = {
    name,
    publishConfig: { access: 'public' },
    version: '0.1.0',
    license: 'SEE LICENSE IN LICENSE',
    exports: { '.': './dist/index.mjs' },
    ...(name === '@openai/auth-react' ? { dependencies: { '@openai/auth': 'workspace:*' } } : {}),
  };
  writeFileSync(join(directory, 'package.json'), JSON.stringify(manifest));
  writeFileSync(join(directory, 'LICENSE'), license);
  writeFileSync(join(directory, 'NOTICE'), notice);
  writeFileSync(join(directory, 'README.md'), 'Test package');
  writeFileSync(join(directory, 'dist/index.mjs'), 'export {};');
  extra?.(directory);
  const tarball = join(root, 'package.tgz');
  execFileSync('tar', ['-czf', tarball, 'package'], { cwd: root });
  return { tarball, manifest };
}

// Write exact archive headers to exercise paths and links without extracting them.
function archiveHeaders(tarball: string, entries: { path: string; type?: string }[]) {
  const headers = entries.map(({ path, type = '0' }) => {
    const header = Buffer.alloc(512);
    header.write(path, 0, 100);
    header.write('0000644\0', 100, 8);
    header.write('0000000\0', 108, 8);
    header.write('0000000\0', 116, 8);
    header.write('00000000000\0', 124, 12);
    header.write('00000000000\0', 136, 12);
    header.write('        ', 148, 8);
    header.write(type, 156, 1);
    header.write('ustar\0', 257, 6);
    header.write('00', 263, 2);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8);
    return header;
  });
  writeFileSync(tarball, gzipSync(Buffer.concat([...headers, Buffer.alloc(1024)])));
}

describe('packed package contents', () => {
  it('lists package files after checking exports and license contents', () => {
    const { tarball, manifest } = archiveFixture();
    expect(inspectPackedPackage(tarball, manifest, license, notice)).toEqual([
      'LICENSE',
      'NOTICE',
      'README.md',
      'dist/index.mjs',
      'package.json',
    ]);
  });
  it.each(['.env', 'dist/.env', 'dist/index.mjs.map', 'credentials.json'])(
    'refuses unexpected sensitive/source contents: %s',
    (path) => {
      const { tarball, manifest } = archiveFixture((directory) =>
        writeFileSync(join(directory, path), 'test'),
      );
      expect(() => inspectPackedPackage(tarball, manifest, license, notice)).toThrow();
    },
  );
  it('rejects symlinks even when their filename looks like a supported module', () => {
    const { tarball, manifest } = archiveFixture((directory) =>
      symlinkSync('/etc/passwd', join(directory, 'dist/linked.mjs')),
    );
    expect(() => inspectPackedPackage(tarball, manifest, license, notice)).toThrow(/never links/);
  });
  it('rejects hard links', () => {
    const { tarball, manifest } = archiveFixture();
    archiveHeaders(tarball, [{ path: 'package/dist/linked.mjs', type: '1' }]);
    expect(() => inspectPackedPackage(tarball, manifest, license, notice)).toThrow(/never links/);
  });
  it.each([
    '../package/dist/index.mjs',
    '/package/dist/index.mjs',
    'package/../dist/index.mjs',
    'package//dist/index.mjs',
    'package/dist/.hidden.mjs',
    'package/dist/back\\slash.mjs',
  ])('rejects unsafe archive paths: %s', (path) => {
    const { tarball, manifest } = archiveFixture();
    archiveHeaders(tarball, [{ path }]);
    expect(() => inspectPackedPackage(tarball, manifest, license, notice)).toThrow(/unsafe/);
  });
  it('rejects duplicate paths', () => {
    const { tarball, manifest } = archiveFixture();
    archiveHeaders(tarball, [{ path: 'package/README.md' }, { path: 'package/README.md' }]);
    expect(() => inspectPackedPackage(tarball, manifest, license, notice)).toThrow(/duplicate/);
  });
  it('rejects a missing export target', () => {
    const { tarball, manifest } = archiveFixture((directory) =>
      rmSync(join(directory, 'dist/index.mjs')),
    );
    expect(() => inspectPackedPackage(tarball, manifest, license, notice)).toThrow(/export/);
  });
  it('rejects a packed manifest that makes an SDK package private', () => {
    const { tarball, manifest } = archiveFixture((directory) =>
      change(directory, '.', { private: true }),
    );
    expect(() => inspectPackedPackage(tarball, manifest, license, notice)).toThrow(
      /source package metadata/,
    );
  });
  it.each([
    { name: '@openai/other-package' },
    { version: '0.2.0' },
    { license: 'MIT' },
    { publishConfig: { access: 'restricted' } },
    { exports: { '.': './dist/other.mjs' } },
  ])('rejects altered package metadata: %j', (changes) => {
    const { tarball, manifest } = archiveFixture((directory) => change(directory, '.', changes));
    expect(() => inspectPackedPackage(tarball, manifest, license, notice)).toThrow(
      /source package metadata/,
    );
  });
  describe.each(['dependencies', 'optionalDependencies', 'peerDependencies'])(
    'packed %s',
    (field) => {
      it.each(['workspace:*', 'file:../../core', 'link:../../core'])(
        'rejects an unresolved local dependency: %s',
        (range) => {
          const { tarball, manifest } = archiveFixture((directory) =>
            change(directory, '.', { [field]: { example: range } }),
          );
          expect(() => inspectPackedPackage(tarball, manifest, license, notice)).toThrow(
            /local workspace/,
          );
        },
      );
    },
  );
  it('accepts React when packing resolves its workspace dependency to the exact core version', () => {
    const { tarball, manifest } = archiveFixture(
      (directory) => change(directory, '.', { dependencies: { '@openai/auth': '0.1.0' } }),
      '@openai/auth-react',
    );
    expect(manifest.dependencies).toEqual({ '@openai/auth': 'workspace:*' });
    expect(inspectPackedPackage(tarball, manifest, license, notice)).toEqual([
      'LICENSE',
      'NOTICE',
      'README.md',
      'dist/index.mjs',
      'package.json',
    ]);
  });
  it.each([
    { label: 'no dependencies field', dependencies: undefined },
    { label: 'no core dependency', dependencies: {} },
    ...['^0.1.0', '~0.1.0', '>=0.1.0', '*', '0.2.0', ''].map((range) => ({
      label: `core version ${JSON.stringify(range)}`,
      dependencies: { '@openai/auth': range },
    })),
  ])('rejects packed React with $label', ({ dependencies }) => {
    const { tarball, manifest } = archiveFixture(
      (directory) => change(directory, '.', { dependencies }),
      '@openai/auth-react',
    );
    expect(() => inspectPackedPackage(tarball, manifest, license, notice)).toThrow(
      /exact matching core package/,
    );
  });
  it('rejects license substitution', () => {
    const { tarball, manifest } = archiveFixture();
    expect(() => inspectPackedPackage(tarball, manifest, 'Different license', notice)).toThrow(
      /LICENSE/,
    );
  });
  it('rejects a missing notice', () => {
    const { tarball, manifest } = archiveFixture((directory) => rmSync(join(directory, 'NOTICE')));
    expect(() => inspectPackedPackage(tarball, manifest, license, notice)).toThrow(
      /missing NOTICE/,
    );
  });
  it.each(['', ' \n ', 'Changed copyright holder or license text.'])(
    'rejects an empty or substituted notice: %j',
    (packedNotice) => {
      const { tarball, manifest } = archiveFixture((directory) =>
        writeFileSync(join(directory, 'NOTICE'), packedNotice),
      );
      expect(() => inspectPackedPackage(tarball, manifest, license, notice)).toThrow(
        /Packed NOTICE/,
      );
    },
  );
  it('rejects a blank source notice even when the packed notice matches', () => {
    const { tarball, manifest } = archiveFixture((directory) =>
      writeFileSync(join(directory, 'NOTICE'), ' \n '),
    );
    expect(() => inspectPackedPackage(tarball, manifest, license, ' \n ')).toThrow(/Packed NOTICE/);
  });
});
