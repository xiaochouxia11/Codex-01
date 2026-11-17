import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

import { assertPackageSources, inspectPackedPackage } from './package-contents.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
if (process.argv.length !== 2) {
  throw new Error('Usage: node scripts/check-authjs-consumer.mjs');
}
const example = join(root, 'examples/authjs');
const artifacts = join(root, 'artifacts/authjs-consumer');
const temporary = mkdtempSync(join(tmpdir(), 'openai-auth-authjs-consumer-'));
const consumer = join(temporary, 'app');
const readJSON = (file) => JSON.parse(readFileSync(file, 'utf8'));
const within = (parent, file) => {
  const path = relative(realpathSync(parent), realpathSync(file));
  return path !== '..' && !path.startsWith(`..${sep}`) && !path.startsWith(sep);
};
const environment = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) => !/^(?:NEXTAUTH_|OPENAI_|AUTH_|NODE_OPTIONS$|NODE_PATH$|NODE_ENV$)/.test(key),
  ),
);
environment.NEXT_TELEMETRY_DISABLED = '1';
const run = (command, args, cwd = consumer) =>
  execFileSync(command, args, { cwd, env: environment, stdio: 'inherit' });
const packages = [
  { directory: 'core', name: '@openai/auth' },
  { directory: 'react', name: '@openai/auth-react' },
];
let server;

async function stopServer() {
  if (!server || server.exitCode !== null || server.signalCode !== null) {
    return;
  }
  const exited = once(server, 'exit');
  server.kill('SIGTERM');
  const stopped = await Promise.race([exited.then(() => true), setTimeout(5000, false)]);
  if (!stopped) {
    server.kill('SIGKILL');
    await exited;
  }
  server = undefined;
}

async function checkBrowser(origin) {
  // Playwright belongs to this repository's test harness only. The browser loads
  // the independently installed app. It cannot resolve workspace dependencies.
  const browser = await chromium.launch();
  let context;
  try {
    context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const unexpectedRequests = [];
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) {
        unexpectedRequests.push(`${url.origin}${url.pathname}`);
        await route.abort();
        return;
      }
      await route.continue();
    });
    const page = await context.newPage();
    const pageErrors = [];
    const hydrationErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (/hydration|hydrating|server rendered|Minified React error/i.test(message.text())) {
        hydrationErrors.push(message.text());
      }
    });
    const sessionResponse = page.waitForResponse(
      (response) => response.url() === `${origin}/api/auth/session`,
      { timeout: 15_000 },
    );
    const [, session] = await Promise.all([
      page.goto(origin, { waitUntil: 'load' }),
      sessionResponse,
    ]);
    assert.equal(session.status(), 200);
    assert.deepEqual(await session.json(), {});
    const button = page.getByRole('button', { name: 'Continue with ChatGPT', exact: true });
    // SSR disables this control. The provider enables it after hydration and registration.
    await expect(button).toBeEnabled();
    await expect(page.getByRole('status')).toHaveText('Sign-in interaction: idle');
    await expect(page.getByText('Profile unavailable', { exact: true })).toBeVisible();
    await expect(button).toHaveCSS('min-height', '44px');
    await expect(button.locator('svg')).toHaveCSS('width', '20px');
    await expect(button.locator('svg')).toHaveCSS('height', '20px');
    await button.focus();
    await expect(button).toBeFocused();
    assert.deepEqual(unexpectedRequests, [], 'The clean consumer attempted an external request');
    assert.deepEqual(pageErrors, [], 'The clean consumer had a browser runtime error');
    assert.deepEqual(hydrationErrors, [], 'The clean consumer had a React hydration error');
    mkdirSync(artifacts, { recursive: true });
    await page.screenshot({ path: join(artifacts, 'signed-out.png'), fullPage: true });
    return {
      engine: 'chromium',
      version: browser.version(),
      anonymousSessionRead: true,
      hydratedButton: true,
      profileFallback: true,
      sdkStyles: true,
      pageErrors: 0,
      hydrationErrors: 0,
      externalRequests: 0,
    };
  } finally {
    try {
      await context?.close();
    } finally {
      await browser.close();
    }
  }
}

async function checkProductionServer(requireConsumer) {
  const portReservation = createServer();
  portReservation.listen(0, '127.0.0.1');
  await once(portReservation, 'listening');
  const port = portReservation.address().port;
  await new Promise((resolve, reject) =>
    portReservation.close((error) => (error ? reject(error) : resolve())),
  );
  const origin = `http://127.0.0.1:${port}`;
  // These synthetic values never initiate discovery or contact an identity provider.
  const applicationOrigin = 'https://consumer.example.test';
  server = spawn(
    process.execPath,
    [
      requireConsumer.resolve('next/dist/bin/next'),
      'start',
      '--hostname',
      '127.0.0.1',
      '--port',
      String(port),
    ],
    {
      cwd: consumer,
      env: {
        ...environment,
        NEXTAUTH_URL: applicationOrigin,
        NEXTAUTH_SECRET: randomBytes(32).toString('hex'),
        OPENAI_CLIENT_ID: 'clean-consumer-not-registered',
        OPENAI_ISSUER: 'https://issuer.example.test',
        OPENAI_TOKEN_ENDPOINT_AUTH_METHOD: 'none',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  const clientLogMarker = `anonymous-client-log-${randomBytes(16).toString('hex')}`;
  let clientLogEmitted = false;
  let startupError;
  server.on('error', (error) => {
    startupError = error;
  });
  for (const stream of [server.stdout, server.stderr]) {
    stream.on('data', (chunk) => {
      output = (output + chunk.toString()).slice(-16_000);
      clientLogEmitted ||= output.includes(clientLogMarker);
    });
  }
  let response;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (startupError || server.exitCode !== null || server.signalCode !== null) {
      throw new Error(`Clean consumer failed to start: ${startupError ?? output}`);
    }
    try {
      response = await fetch(origin, { signal: AbortSignal.timeout(1000) });
      break;
    } catch {
      await setTimeout(200);
    }
  }
  assert(response?.ok, `Clean consumer page did not become ready: ${output}`);
  const html = await response.text();
  assert(html.includes('Sign in with ChatGPT'), 'The production page is missing the SDK example');
  const assets = [
    ...new Set(
      [...html.matchAll(/(?:href|src)="(\/_next\/static\/[^"<>]+)"/g)].map((match) => match[1]),
    ),
  ];
  assert(
    assets.some((asset) => asset.endsWith('.css')),
    'The page did not include built CSS',
  );
  assert(
    assets.some((asset) => asset.endsWith('.js')),
    'The page did not include built JavaScript',
  );
  for (const asset of assets) {
    const result = await fetch(`${origin}${asset}`, { signal: AbortSignal.timeout(5000) });
    assert(result.ok, `The production page has an unavailable asset: ${asset}`);
    await result.arrayBuffer();
  }
  const session = await fetch(`${origin}/api/auth/session`, { signal: AbortSignal.timeout(5000) });
  assert.equal(session.status, 200);
  assert.deepEqual(await session.json(), {}, 'An unconfigured consumer must start signed out');
  const providers = await fetch(`${origin}/api/auth/providers`, {
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(providers.status, 200);
  assert.deepEqual(await providers.json(), {
    openai: {
      id: 'openai',
      name: 'ChatGPT',
      type: 'oauth',
      signinUrl: `${applicationOrigin}/api/auth/signin/openai`,
      callbackUrl: `${applicationOrigin}/api/auth/callback/openai`,
    },
  });
  // Anonymous client input must never become an apparent server diagnostic.
  // Exercise Next.js routing and body parsing in the independently installed app.
  for (const path of ['_log', '_log/extra']) {
    const logUrl = `${origin}/api/auth/${path}`;
    const get = await fetch(logUrl, { signal: AbortSignal.timeout(5000) });
    assert.equal(get.status, 404, 'The client log route must be unavailable');
    await get.text();
    for (const level of ['error', 'warn', 'debug']) {
      const payload = { level, code: `${clientLogMarker}\nFORGED_SERVER_ERROR` };
      for (const json of [false, true]) {
        const result = await fetch(logUrl, {
          method: 'POST',
          headers: {
            'content-type': json ? 'application/json' : 'application/x-www-form-urlencoded',
          },
          body: json ? JSON.stringify(payload) : new URLSearchParams(payload),
          signal: AbortSignal.timeout(5000),
        });
        assert.equal(result.status, 404, 'Anonymous client log forwarding must be rejected');
        assert.equal(result.headers.get('set-cookie'), null);
        await result.text();
      }
    }
  }
  const browser = await checkBrowser(origin);
  await stopServer();
  assert.equal(clientLogEmitted, false, 'Anonymous client input appeared in server logs');
  return {
    page: true,
    assets: assets.length,
    signedOutSession: true,
    providerRoute: true,
    clientLogForwardingBlocked: true,
    browser,
  };
}

try {
  // A failed rerun must not leave a previous success looking current.
  for (const file of ['result.json', 'signed-out.png']) {
    rmSync(join(artifacts, file), { force: true });
  }
  // No ambient workspace or parent node_modules may supply a missing dependency.
  for (let directory = temporary; ; directory = dirname(directory)) {
    for (const file of ['node_modules', 'pnpm-workspace.yaml', 'package.json']) {
      assert(
        !existsSync(join(directory, file)),
        `The consumer has ambient ${file} in ${directory}`,
      );
    }
    if (dirname(directory) === directory) {
      break;
    }
  }
  mkdirSync(consumer);
  const manifest = readJSON(join(example, 'package.json'));
  assert.equal(manifest.private, true, 'The example must stay private');
  // Copy only application files. Do not read .env.local, workspace tests, build output,
  // or node_modules from the example installation.
  for (const file of [
    'next.config.mjs',
    'next-env.d.ts',
    'tsconfig.json',
    '.gitignore',
    '.env.example',
  ]) {
    cpSync(join(example, file), join(consumer, file));
  }
  cpSync(join(example, 'src'), join(consumer, 'src'), {
    recursive: true,
    filter: (file) => !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file),
  });
  delete manifest.scripts.test;
  assertPackageSources(root);
  const tarballs = [];
  for (const { directory, name } of packages) {
    const source = join(root, 'packages', directory);
    const sourceManifest = readJSON(join(source, 'package.json'));
    const tarball = join(temporary, `${directory}.tgz`);
    run('pnpm', ['pack', '--out', tarball], source);
    inspectPackedPackage(
      tarball,
      sourceManifest,
      readFileSync(join(source, 'LICENSE'), 'utf8'),
      readFileSync(join(source, 'NOTICE'), 'utf8'),
    );
    manifest.dependencies[name] = `file:../${directory}.tgz`;
    tarballs.push({
      name,
      sha256: createHash('sha256').update(readFileSync(tarball)).digest('hex'),
    });
  }
  writeFileSync(join(consumer, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  // npm installs a normal dependency tree from the package manifests, not links
  // to the workspace installation. Lifecycle scripts are unnecessary for this app.
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund']);
  const requireConsumer = createRequire(join(consumer, 'package.json'));
  const installedVersions = {};
  for (const { directory, name } of packages) {
    const installedDirectory = join(consumer, 'node_modules', name);
    assert(within(consumer, installedDirectory), `${name} resolves outside the clean consumer`);
    const installed = readJSON(join(installedDirectory, 'package.json'));
    const source = readJSON(join(root, 'packages', directory, 'package.json'));
    assert.equal(installed.version, source.version);
    assert.equal(installed.private, source.private);
    assert.equal(installed.license, source.license);
    assert.deepEqual(installed.exports, source.exports);
    for (const range of Object.values(installed.dependencies ?? {})) {
      assert(!/^(?:workspace:|file:|link:)/.test(range), `${name} retains a local dependency`);
    }
    installedVersions[name] = installed.version;
  }
  assert.equal(installedVersions['@openai/auth'], installedVersions['@openai/auth-react']);
  assert.equal(
    readJSON(join(consumer, 'node_modules/@openai/auth-react/package.json')).dependencies[
      '@openai/auth'
    ],
    installedVersions['@openai/auth'],
    'The packed React package must require the exact core SDK version',
  );
  const requireReactSdk = createRequire(
    join(consumer, 'node_modules/@openai/auth-react/package.json'),
  );
  assert.equal(requireReactSdk.resolve('@openai/auth'), requireConsumer.resolve('@openai/auth'));
  for (const name of ['react-dom', '@openai/auth-react']) {
    const dependencyRequire = createRequire(join(consumer, 'node_modules', name, 'package.json'));
    assert.equal(dependencyRequire.resolve('react'), requireConsumer.resolve('react'));
  }
  for (const name of ['next', 'next-auth', 'react', 'react-dom', 'typescript']) {
    const installed = join(consumer, 'node_modules', name, 'package.json');
    assert(within(consumer, installed), `${name} resolves outside the clean consumer`);
    assert(
      within(consumer, requireConsumer.resolve(name)),
      `${name} imports outside the clean consumer`,
    );
    installedVersions[name] = readJSON(installed).version;
    assert.equal(
      installedVersions[name],
      manifest.dependencies[name] ?? manifest.devDependencies[name],
    );
  }
  run('npm', ['run', 'typecheck']);
  run('npm', ['run', 'build']);
  const runtime = await checkProductionServer(requireConsumer);
  const report = {
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    sourceDirty: Boolean(
      execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
    ),
    node: process.version,
    completedAt: new Date().toISOString(),
    install: 'npm install --ignore-scripts --no-audit --no-fund',
    packageLockSha256: createHash('sha256')
      .update(readFileSync(join(consumer, 'package-lock.json')))
      .digest('hex'),
    isolatedFromWorkspace: true,
    noLiveCredentials: true,
    installedVersions,
    tarballs,
    runtime,
    limitations: ['No live OAuth or registration', 'No HTTPS deployment or cookie validation'],
  };
  mkdirSync(artifacts, { recursive: true });
  writeFileSync(join(artifacts, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.info(
    'Clean Auth.js consumer: independent install, types, production build, routes, and browser hydration/styles passed.',
  );
} finally {
  await stopServer();
  rmSync(temporary, { recursive: true, force: true });
}
