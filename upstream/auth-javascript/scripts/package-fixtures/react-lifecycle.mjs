import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { lifecycleTree } from './react-lifecycle-tree.mjs';

const harness = JSON.parse(readFileSync(new URL('./test-harness.json', import.meta.url), 'utf8'));
const { JSDOM } = await import(pathToFileURL(harness.jsdom).href);
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://consumer.example.test/',
  pretendToBeVisual: true,
});
const { document, MouseEvent } = dom.window;
for (const name of [
  'window',
  'document',
  'HTMLElement',
  'HTMLButtonElement',
  'MouseEvent',
  'Node',
]) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Import client modules only after installing the browser environment. This exercises layout effects.
const React = (await import('react')).default;
const { hydrateRoot } = await import('react-dom/client');
const act = React.act ?? (await import('react-dom/test-utils')).act;
const esm = await import('@openai/auth-react');
const require = createRequire(import.meta.url);
const cjs = require('@openai/auth-react');
const html = JSON.parse(readFileSync(new URL('./hydration.json', import.meta.url), 'utf8'));
const errors = [];
const originalError = console.error;
console.error = (...args) => errors.push(args.map(String).join(' '));

try {
  for (const [index, [Provider, Button, Picture, sdk]] of [
    [esm.ChatGPTAuthProvider, esm.ChatGPTSignInButton, cjs.ChatGPTProfilePicture, cjs],
    [esm.ChatGPTAuthProvider, cjs.ChatGPTSignInButton, esm.ChatGPTProfilePicture, cjs],
    [cjs.ChatGPTAuthProvider, esm.ChatGPTSignInButton, cjs.ChatGPTProfilePicture, esm],
    [cjs.ChatGPTAuthProvider, cjs.ChatGPTSignInButton, esm.ChatGPTProfilePicture, esm],
  ].entries()) {
    const container = document.createElement('div');
    container.innerHTML = html[index];
    document.body.append(container);
    const serverButton = container.querySelector('#primary');
    assert.equal(serverButton.disabled, true);
    let attempts = 0;
    let resolveAttempt;
    const subscriptions = new Set();
    const adapter = {
      signIn() {
        attempts++;
        return new Promise((resolve) => {
          resolveAttempt = resolve;
        });
      },
      session: {
        async getSession() {
          return { status: 'authenticated', profile: { subject: 'verified-consumer' } };
        },
        subscribe(listener) {
          subscriptions.add(listener);
          return () => subscriptions.delete(listener);
        },
      },
    };
    const objectRef = React.createRef();
    const recoverableErrors = [];
    let root;
    await act(async () => {
      root = hydrateRoot(
        container,
        lifecycleTree(React, Provider, Button, Picture, sdk, { adapter, buttonRef: objectRef }),
        { onRecoverableError: (error) => recoverableErrors.push(error) },
      );
    });
    const button = container.querySelector('#primary');
    assert.equal(button, serverButton, 'hydration must preserve the server-rendered button');
    assert.equal(objectRef.current, button);
    assert.equal(button.disabled, false);
    assert.equal(subscriptions.size, 1, 'Strict Mode must retain only the active subscription');
    assert.equal(attempts, 0, 'mounting/hydration must not initiate authentication');
    assert.equal(container.querySelector('output').textContent, 'idle:verified-consumer');
    assert.deepEqual(recoverableErrors, []);

    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      container
        .querySelector('#secondary')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    assert.equal(attempts, 1, 'both installed-format views must share the pending guard');
    assert.equal(button.disabled, true);
    await act(async () => {
      resolveAttempt({ status: 'complete' });
    });
    assert.equal(button.disabled, false);
    assert.equal(container.querySelector('output').textContent, 'complete:verified-consumer');

    let attached = 0;
    let cleaned = 0;
    let nullCalls = 0;
    const callbackRef = (element) => {
      if (element === null) {
        nullCalls++;
        return;
      }
      assert.equal(element, button);
      attached++;
      return () => {
        cleaned++;
      };
    };
    await act(async () => {
      root.render(
        lifecycleTree(React, Provider, Button, Picture, sdk, { adapter, buttonRef: callbackRef }),
      );
    });
    assert.equal(objectRef.current, null, 'replacing a ref must detach the previous object ref');
    assert(attached > 0);
    assert.equal(attached - cleaned, 1, 'one callback ref attachment must remain live');

    // Unmount with external work pending: local cleanup must suppress its late result.
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    assert.equal(attempts, 2);
    await act(async () => {
      root.unmount();
    });
    assert.equal(cleaned, attached, 'each callback-ref cleanup must run exactly once');
    assert.equal(nullCalls, 0, 'a cleanup-returning ref must not also receive null');
    assert.equal(subscriptions.size, 0);
    await act(async () => {
      resolveAttempt({ status: 'complete' });
    });
    assert.equal(container.childNodes.length, 0);
    container.remove();
  }
  assert.deepEqual(
    errors,
    [],
    'packed consumers must hydrate and manage refs without React warnings',
  );
} finally {
  console.error = originalError;
  dom.window.close();
}
