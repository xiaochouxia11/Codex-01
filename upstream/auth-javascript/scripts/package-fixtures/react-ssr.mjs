import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import * as esm from '@openai/auth-react';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { lifecycleTree } from './react-lifecycle-tree.mjs';
const require = createRequire(import.meta.url);
// Installed browser consumers do not include server-side authentication dependencies.
assert.throws(() => require.resolve('jose'), { code: 'MODULE_NOT_FOUND' });
const cjs = require('@openai/auth-react');
const catalogs = JSON.parse(readFileSync(new URL('./localization.json', import.meta.url), 'utf8'));
const isReact18 = React.version.startsWith('18.');
const styleAttribute = isReact18 ? 'data-chatgpt-style' : 'data-href';
import { createChatGPTAuth } from '@openai/auth/client';
for (const [Provider, Button] of [
  [esm.ChatGPTAuthProvider, esm.ChatGPTSignInButton],
  [esm.ChatGPTAuthProvider, cjs.ChatGPTSignInButton],
  [cjs.ChatGPTAuthProvider, esm.ChatGPTSignInButton],
  [cjs.ChatGPTAuthProvider, cjs.ChatGPTSignInButton],
]) {
  const html = renderToString(
    React.createElement(
      Provider,
      { options: { authPath: '/auth/chatgpt' } },
      React.createElement(Button, {
        className: 'custom-login',
        style: { marginTop: 12, width: 250, flexGrow: 2 },
      }),
    ),
  );
  assert.match(html, new RegExp(`<style[^>]+${styleAttribute}="openai-auth-button-v3"`));
  assert.match(html, /@layer openai-auth/);
  assert.doesNotMatch(html.match(/<style\b[^>]*>([\s\S]*?)<\/style>/)[1], /&(?:quot|gt|lt);/);
  assert.equal(
    (html.match(new RegExp(`${styleAttribute}="openai-auth-button-v3"`, 'g')) || []).length,
    1,
  );
  if (isReact18) {
    assert.doesNotMatch(html, /data-href="openai-auth-button-v3"/);
  }
  assert.equal((html.match(/<button\b/g) || []).length, 1);
  const openingTag = html.match(/<button[^>]*>/)[0];
  assert.match(openingTag, /class="custom-login"/);
  assert.match(openingTag, /margin-top:12px/);
  assert.match(openingTag, /width:250px/);
  assert.match(openingTag, /\stype="button"/);
  assert.match(openingTag, /\sdisabled(?:="")?(?:\s|>)/);
  assert.match(html, /<svg\b/);
  assert.match(html, /Continue with ChatGPT/);
  for (const [locale, messages] of Object.entries(catalogs)) {
    for (const [text, label] of Object.entries(messages)) {
      const localized = renderToString(
        React.createElement(
          Provider,
          { options: { authPath: '/auth/chatgpt' } },
          React.createElement(Button, { locale, text }),
        ),
      );
      assert(localized.includes(`lang="${locale}"`));
      assert(localized.includes(`dir="${['ar', 'fa', 'ur'].includes(locale) ? 'rtl' : 'ltr'}"`));
      const escapedLabel = renderToString(React.createElement('span', null, label)).slice(6, -7);
      assert(localized.includes(escapedLabel));
    }
  }
}
for (const Provider of [esm.ChatGPTAuthProvider, cjs.ChatGPTAuthProvider]) {
  for (const Picture of [esm.ChatGPTProfilePicture, cjs.ChatGPTProfilePicture]) {
    for (const useProfile of [esm.useChatGPTProfile, cjs.useChatGPTProfile]) {
      assert.equal(typeof Picture, 'function');
      assert.equal(typeof useProfile, 'function');
      let reads = 0;
      let subscriptions = 0;
      let attempts = 0;
      const adapter = {
        async signIn() {
          attempts++;
          return { status: 'complete' };
        },
        session: {
          async getSession() {
            reads++;
            return {
              status: 'authenticated',
              profile: { subject: 'one', picture: 'https://images.example/account.png' },
            };
          },
          subscribe() {
            subscriptions++;
            return () => {};
          },
        },
      };
      function ProfileObserver() {
        assert.equal(useProfile(), null);
        return null;
      }
      const html = renderToString(
        React.createElement(
          Provider,
          { options: { adapter } },
          React.createElement(Picture, { alt: 'Account picture' }),
          React.createElement(Picture, {
            size: 48,
            className: 'custom-picture',
            style: { borderRadius: 8 },
            fallback: React.createElement('span', null, 'Custom fallback'),
          }),
          React.createElement(ProfileObserver),
        ),
      );
      assert.equal(
        (html.match(new RegExp(`${styleAttribute}="openai-auth-profile-picture-v4"`, 'g')) || [])
          .length,
        isReact18 ? 2 : 1,
      );
      if (isReact18) {
        assert.doesNotMatch(html, /data-href="openai-auth-profile-picture-v4"/);
      }
      assert.equal((html.match(/data-chatgpt-profile-picture=""/g) || []).length, 2);
      assert.equal((html.match(/data-chatgpt-profile-picture-fallback=""/g) || []).length, 2);
      assert.match(html, /@layer openai-auth/);
      for (const [, css] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) {
        assert.doesNotMatch(css, /&(?:quot|gt|lt);/);
      }
      assert.match(html, /role="img" aria-label="Account picture"/);
      assert.match(html, /class="custom-picture"/);
      assert.match(html, /width="48" height="48"/);
      assert.match(html, /border-radius:8px/);
      assert.match(html, /Custom fallback/);
      assert.match(html, /<svg\b/);
      assert.doesNotMatch(html, /<img\b/);
      assert.equal(reads, 0);
      assert.equal(subscriptions, 0);
      assert.equal(attempts, 0);
    }
  }
}
const auth = createChatGPTAuth({ authPath: '/auth/chatgpt' });
await auth.destroy();

// Persist real server output for the separate browser-environment process.
const hydration = [
  [esm.ChatGPTAuthProvider, esm.ChatGPTSignInButton, cjs.ChatGPTProfilePicture, cjs],
  [esm.ChatGPTAuthProvider, cjs.ChatGPTSignInButton, esm.ChatGPTProfilePicture, cjs],
  [cjs.ChatGPTAuthProvider, esm.ChatGPTSignInButton, cjs.ChatGPTProfilePicture, esm],
  [cjs.ChatGPTAuthProvider, cjs.ChatGPTSignInButton, esm.ChatGPTProfilePicture, esm],
].map(([Provider, Button, Picture, sdk]) =>
  renderToString(
    lifecycleTree(React, Provider, Button, Picture, sdk, {
      adapter: {
        async signIn() {
          throw new Error('SSR must not initiate authentication');
        },
      },
      buttonRef: React.createRef(),
    }),
  ),
);
writeFileSync(new URL('./hydration.json', import.meta.url), JSON.stringify(hydration));
