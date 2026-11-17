import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import {
  ChatGPTAuthProvider,
  ChatGPTProfilePicture,
  ChatGPTSignInButton,
} from '@openai/auth-react';
const require = createRequire(import.meta.url);
const core = readFileSync(require.resolve('@openai/auth/styles.css'), 'utf8');
const react = readFileSync(require.resolve('@openai/auth-react/styles.css'), 'utf8');
assert.match(core, /@layer openai-auth/);
assert.match(core, /data-chatgpt-sign-in-button/);
assert(react.startsWith(core));
assert.match(react, /data-chatgpt-profile-picture-sizer/);
const markup = renderToString(
  createElement(
    ChatGPTAuthProvider,
    {
      options: { authPath: '/auth/start' },
      stylesheet: 'external',
    },
    createElement(ChatGPTSignInButton),
    createElement(ChatGPTProfilePicture, { size: 48 }),
  ),
);
assert.doesNotMatch(markup, /<style\b|\sstyle=/);
assert.match(markup, /width="48" height="48"/);
