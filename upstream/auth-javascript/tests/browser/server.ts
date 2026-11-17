import { readFile, realpath } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, version as serverReactVersion } from 'react';
import { version as serverReactDOMVersion } from 'react-dom';
import { renderToString } from 'react-dom/server';
import { bundleBrowserEntries } from './browser-bundle.ts';
import { respond, serveLoopback } from './http.ts';
import { reactSelection, reactVersion, reactDOMVersion } from './react-runtime.ts';

if (serverReactVersion !== reactVersion || serverReactDOMVersion !== reactDOMVersion) {
  throw new Error(
    `Expected React ${reactVersion}/React DOM ${reactDOMVersion}; server loaded ${serverReactVersion}/${serverReactDOMVersion}. Start with register-react-runtime.ts preloaded.`,
  );
}

const directory = dirname(fileURLToPath(import.meta.url));
const distribution = await realpath(resolve(directory, '../../packages/core/dist'));
const distributionPrefix = '/packages/core/dist/';
const types = new Map([
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
]);
const modules = await bundleBrowserEntries(
  {
    'csp-fixture': resolve(directory, 'csp-fixture.tsx'),
    'react-fixture': resolve(directory, 'react-fixture.tsx'),
    'profile-fixture': resolve(directory, 'profile-fixture.tsx'),
    'style-fixture': resolve(directory, 'style-fixture.tsx'),
    'localization-fixture': resolve(directory, 'localization-fixture.tsx'),
    'variants-fixture': resolve(directory, 'variants-fixture.tsx'),
  },
  '/react-modules',
);

serveLoopback(async (url) => {
  if (url.pathname === '/health') {
    return respond(
      JSON.stringify({
        selection: reactSelection,
        reactVersion: serverReactVersion,
        reactDOMVersion: serverReactDOMVersion,
      }),
      'application/json',
    );
  }
  if (url.pathname === '/popup') {
    return respond(
      '<!doctype html><title>Adapter popup</title><h1>Adapter popup</h1>',
      'text/html; charset=utf-8',
    );
  }
  if (url.pathname === '/') {
    return respond(await readFile(resolve(directory, 'fixture.html')), 'text/html; charset=utf-8');
  }
  if (url.pathname === '/react') {
    return respond(
      await readFile(resolve(directory, 'react-fixture.html')),
      'text/html; charset=utf-8',
    );
  }
  if (url.pathname === '/profile') {
    return respond(
      await readFile(resolve(directory, 'profile-fixture.html')),
      'text/html; charset=utf-8',
    );
  }
  if (url.pathname === '/profile-picture.svg') {
    return respond(
      await readFile(resolve(directory, '../../examples/browser/public/demo/profile-picture.svg')),
      'image/svg+xml',
    );
  }
  if (url.pathname === '/localization') {
    return respond(
      await readFile(resolve(directory, 'localization-fixture.html')),
      'text/html; charset=utf-8',
    );
  }
  if (url.pathname === '/variants') {
    return respond(
      await readFile(resolve(directory, 'variants-fixture.html')),
      'text/html; charset=utf-8',
    );
  }
  if (url.pathname === '/packages/react/dist/styles.css') {
    return respond(
      await readFile(resolve(directory, '../../packages/react/dist/styles.css')),
      'text/css; charset=utf-8',
    );
  }
  if (url.pathname === '/csp') {
    const { ChatGPTAuthProvider, ChatGPTSignInButton, ChatGPTProfilePicture } = (await import(
      new URL('../../packages/react/dist/index.mjs', import.meta.url).href
    )) as typeof import('@openai/auth-react');
    const markup = renderToString(
      createElement(
        ChatGPTAuthProvider,
        { options: { authPath: '/auth/start' }, stylesheet: 'external' },
        createElement(ChatGPTSignInButton, { id: 'csp-react' }),
        createElement(ChatGPTSignInButton, { id: 'csp-react-secondary' }),
        createElement(ChatGPTProfilePicture, { size: 48, alt: 'CSP account' }),
      ),
    );
    const response = respond(
      `<!doctype html><html><head><title>CSP consumer</title>
      <link rel="stylesheet" href="/packages/react/dist/styles.css"></head><body>
      <div id="csp-react-root">${markup}</div><div id="csp-dom"></div><div id="csp-shadow"></div>
      <script type="module" src="/react-modules/csp-fixture.mjs"></script></body></html>`,
      'text/html; charset=utf-8',
    );
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self'; object-src 'none'; base-uri 'none'; require-trusted-types-for 'script'",
    );
    return response;
  }
  if (url.pathname === '/styles') {
    let html = '';
    if (url.searchParams.has('hydrate')) {
      // Runtime import deliberately tests the built entry. Typechecking uses source aliases.
      const { ChatGPTAuthProvider, ChatGPTSignInButton } = (await import(
        new URL('../../packages/react/dist/index.mjs', import.meta.url).href
      )) as typeof import('@openai/auth-react');
      html = renderToString(
        createElement(
          ChatGPTAuthProvider,
          { options: { authPath: '/auth/start' } },
          ...['primary', 'secondary'].map((name) =>
            createElement(
              'div',
              { className: 'button-slot', key: name },
              createElement(ChatGPTSignInButton, { id: `react-style-${name}` }),
            ),
          ),
        ),
      );
    }
    const page = await readFile(resolve(directory, 'style-fixture.html'), 'utf8');
    return respond(
      page.replace('__REACT_STYLE_HTML__', () => html),
      'text/html; charset=utf-8',
    );
  }
  const module = modules.get(url.pathname);
  if (module !== undefined) {
    return respond(module, 'text/javascript; charset=utf-8');
  }
  if (url.pathname === '/auth/start') {
    return respond(
      '<!doctype html><title>Auth route</title><h1>Auth route reached with GET</h1>',
      'text/html; charset=utf-8',
    );
  }
  if (url.pathname.startsWith(distributionPrefix)) {
    const file = await realpath(
      resolve(distribution, decodeURIComponent(url.pathname.slice(distributionPrefix.length))),
    );
    const type = types.get(extname(file));
    if (file.startsWith(`${distribution}${sep}`) && type) {
      return respond(await readFile(file), type);
    }
  }
  return respond('Not found', 'text/plain', 404);
});
