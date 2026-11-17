import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { buttonMessagesByLocale } from '../packages/core/src/client/localization/catalogs.ts';

import { assertPackageSources, inspectPackedPackage } from './package-contents.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
if (process.argv.length !== 2) {
  throw new Error('Usage: node scripts/check-packages.mjs');
}
const temporary = mkdtempSync(join(tmpdir(), 'openai-auth-packages-'));
const packages = [
  { directory: 'core', name: '@openai/auth', entrypoints: ['@openai/auth', '@openai/auth/client'] },
  { directory: 'react', name: '@openai/auth-react', entrypoints: ['@openai/auth-react'] },
];
const versions = [
  {
    name: 'react18-min',
    manifest: 'tests/react-versions/react18-min/package.json',
    runtime: '18.0.0',
  },
  { name: 'react18', manifest: 'tests/react-versions/react18/package.json', runtime: '18.3.1' },
  { name: 'react19', manifest: 'package.json', runtime: '19.3.0' },
];
const readJSON = (file) => JSON.parse(readFileSync(file, 'utf8'));
const require = createRequire(import.meta.url);
const fixtures = join(root, 'scripts/package-fixtures');
const run = (command, args, cwd = temporary) =>
  execFileSync(command, args, { cwd, stdio: 'inherit' });
const runFixture = (name, consumer) => {
  const destination = join(consumer, name);
  cpSync(join(fixtures, name), destination);
  run(process.execPath, [destination], consumer);
};
const packedDependencies = new Map();
const packInstalledPackage = (manifest) => {
  const metadata = readJSON(manifest);
  const key = `${metadata.name}@${metadata.version}`;
  if (!packedDependencies.has(key)) {
    // Pack an isolated copy so npm's dependency-tree traversal cannot follow
    // the surrounding pnpm installation. Keep the installed package bytes.
    // packDependencyTree packages dependencies separately below.
    const source = dirname(manifest);
    const staging = join(temporary, `dependency-${packedDependencies.size}`);
    cpSync(source, staging, {
      recursive: true,
      filter: (file) => file !== join(source, 'node_modules'),
    });
    const packed = JSON.parse(
      execFileSync(
        'npm',
        ['pack', staging, '--ignore-scripts', '--json', '--pack-destination', temporary],
        { cwd: temporary, encoding: 'utf8' },
      ),
    );
    packedDependencies.set(key, join(temporary, packed[0].filename));
  }
  return packedDependencies.get(key);
};

// Package actual installed dependencies, including React 18's loose-envify/js-tokens
// and its type dependencies. npm resolves these normal tarballs without network access.
function packDependencyTree(manifest, tarballs = new Set()) {
  const tarball = packInstalledPackage(manifest);
  if (tarballs.has(tarball)) {
    return tarballs;
  }
  tarballs.add(tarball);
  const localRequire = createRequire(manifest);
  for (const dependency of Object.keys(readJSON(manifest).dependencies ?? {})) {
    packDependencyTree(localRequire.resolve(`${dependency}/package.json`), tarballs);
  }
  return tarballs;
}

function installConsumer(name, tarballs) {
  const consumer = join(temporary, name);
  mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  run(
    'npm',
    [
      'install',
      '--offline',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      ...tarballs,
    ],
    consumer,
  );
  return consumer;
}

function checkMetadata(consumer) {
  const packageVersions = new Set();
  for (const { directory, name } of packages) {
    const source = readJSON(join(root, 'packages', directory, 'package.json'));
    const installed = join(consumer, 'node_modules', name);
    const packed = readJSON(join(installed, 'package.json'));
    assert.equal(packed.name, name);
    assert.equal(packed.version, source.version);
    assert.deepEqual(packed.exports, source.exports);
    packageVersions.add(packed.version);

    const contents = readdirSync(installed);
    for (const required of ['dist', 'README.md', 'LICENSE', 'NOTICE']) {
      assert(contents.includes(required), `${name} is missing ${required}`);
    }
    for (const file of contents) {
      assert(
        ['dist', 'package.json', 'README.md', 'LICENSE', 'NOTICE', 'CHANGELOG.md'].includes(file),
        `${name} contains an unexpected packaged file: ${file}`,
      );
    }
    for (const file of ['LICENSE', 'NOTICE']) {
      const expected = readFileSync(join(root, 'packages', directory, file), 'utf8');
      assert(expected.trim(), `${name}: source ${file} must not be empty`);
      assert.equal(
        readFileSync(join(installed, file), 'utf8'),
        expected,
        `${name}: installed ${file} must match the source exactly`,
      );
    }
    // Relative package README links must resolve inside the installed tarball.
    const readme = readFileSync(join(installed, 'README.md'), 'utf8');
    for (const [, target] of readme.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      if (/^(?:https?:\/\/|#)/.test(target)) {
        continue;
      }
      const path = resolve(installed, target.split(/[?#]/)[0]);
      assert(
        path.startsWith(`${installed}${sep}`),
        `${name}: README link escapes package: ${target}`,
      );
      assert(existsSync(path), `${name}: README link is not shipped: ${target}`);
    }
    for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [dependency, range] of Object.entries(packed[field] ?? {})) {
        assert(
          !/^(workspace:|file:|link:)/.test(range),
          `${name}: unpacked dependency ${dependency}`,
        );
      }
    }
  }
  assert.equal(packageVersions.size, 1, 'All auth packages must have the same version');
}

function checkDeclarations(consumer, entrypoints) {
  const compilerOptions = {
    noEmit: true,
    strict: true,
    types: [],
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
  };
  const consumers = ['mts', 'cts'].map((extension) => {
    const file = join(consumer, `consumer.${extension}`);
    cpSync(join(fixtures, 'consumer.ts'), file);
    for (const name of entrypoints) {
      const mode = extension === 'mts' ? ts.ModuleKind.ESNext : ts.ModuleKind.CommonJS;
      const { resolvedModule } = ts.resolveModuleName(
        name,
        file,
        compilerOptions,
        ts.sys,
        undefined,
        undefined,
        mode,
      );
      assert(
        resolvedModule?.resolvedFileName.endsWith(`.d.${extension}`),
        `${name}: missing ${extension} declarations`,
      );
    }
    return file;
  });
  for (const exactOptionalPropertyTypes of [false, true]) {
    const diagnostics = ts.getPreEmitDiagnostics(
      ts.createProgram(consumers, { ...compilerOptions, exactOptionalPropertyTypes }),
    );
    assert.equal(
      diagnostics.length,
      0,
      `exactOptionalPropertyTypes=${exactOptionalPropertyTypes}\n` +
        ts.formatDiagnosticsWithColorAndContext(diagnostics, {
          getCanonicalFileName: (file) => file,
          getCurrentDirectory: () => consumer,
          getNewLine: () => '\n',
        }),
    );
  }
}

try {
  assertPackageSources(root);
  const sdkTarballs = packages.map(({ directory }) => {
    const source = join(root, 'packages', directory);
    const manifest = readJSON(join(source, 'package.json'));
    const tarball = join(temporary, `${directory}.tgz`);
    run('pnpm', ['pack', '--out', tarball], source);
    inspectPackedPackage(
      tarball,
      manifest,
      readFileSync(join(source, 'LICENSE'), 'utf8'),
      readFileSync(join(source, 'NOTICE'), 'utf8'),
    );
    return tarball;
  });
  const styleTypes = packInstalledPackage(
    createRequire(join(root, 'packages/core/package.json')).resolve('csstype/package.json'),
  );
  runFixture('core-only.mjs', installConsumer('core-only', [sdkTarballs[0], styleTypes]));
  const entrypoints = packages.flatMap(({ entrypoints }) => entrypoints);
  for (const version of versions) {
    const versionRequire = createRequire(join(root, version.manifest));
    const tarballs = new Set([...sdkTarballs, styleTypes]);
    for (const name of ['react', 'react-dom', '@types/react', '@types/react-dom']) {
      packDependencyTree(versionRequire.resolve(`${name}/package.json`), tarballs);
    }
    const consumer = installConsumer(version.name, [...tarballs]);
    const consumerRequire = createRequire(join(consumer, 'package.json'));
    assert.equal(consumerRequire('react/package.json').version, version.runtime);
    assert.equal(consumerRequire('react-dom/package.json').version, version.runtime);
    assert.equal(
      consumerRequire('@types/react/package.json').version.split('.')[0],
      version.runtime.split('.')[0],
    );
    // react-dom and the SDK must resolve the consumer's single React installation.
    for (const dependency of ['react-dom', '@openai/auth-react']) {
      assert.equal(
        createRequire(join(consumer, 'node_modules', dependency, 'package.json')).resolve('react'),
        consumerRequire.resolve('react'),
      );
    }
    writeFileSync(join(consumer, 'entrypoints.json'), JSON.stringify(entrypoints));
    writeFileSync(join(consumer, 'localization.json'), JSON.stringify(buttonMessagesByLocale));
    // jsdom is only the test harness. React, react-dom, and SDK imports stay in the consumer.
    writeFileSync(
      join(consumer, 'test-harness.json'),
      JSON.stringify({ jsdom: require.resolve('jsdom') }),
    );
    cpSync(join(fixtures, 'react-lifecycle-tree.mjs'), join(consumer, 'react-lifecycle-tree.mjs'));
    checkMetadata(consumer);
    for (const fixture of [
      'entrypoints.mjs',
      'entrypoints.cjs',
      'react-ssr.mjs',
      'react-lifecycle.mjs',
      'styles.mjs',
    ]) {
      runFixture(fixture, consumer);
    }
    checkDeclarations(consumer, entrypoints);
    console.log(
      `React ${version.runtime}: packed ESM/CommonJS, SSR, hydration, refs, and declarations passed.`,
    );
  }
  console.log('Packed packages passed all React 18/19 consumer checks.');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
