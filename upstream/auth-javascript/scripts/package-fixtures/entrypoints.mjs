import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as client from '@openai/auth/client';
const { createChatGPTAuth, getChatGPTSignInButtonModel } = client;

const entrypoints = JSON.parse(
  readFileSync(new URL('./entrypoints.json', import.meta.url), 'utf8'),
);
for (const name of entrypoints) {
  assert(import.meta.resolve(name).endsWith('.mjs'), `${name}: expected ESM output`);
  await import(name);
}
const catalogs = JSON.parse(readFileSync(new URL('./localization.json', import.meta.url), 'utf8'));
for (const [locale, messages] of Object.entries(catalogs)) {
  for (const [text, label] of Object.entries(messages)) {
    const model = getChatGPTSignInButtonModel({ locale, text });
    assert.equal(model.label, label);
    assert.equal(model.lang, locale);
    assert.equal(model.dir, ['ar', 'fa', 'ur'].includes(locale) ? 'rtl' : 'ltr');
    assert.equal(model.style.direction, model.dir);
  }
}

assert.deepEqual(Object.keys(client).sort(), ['createChatGPTAuth', 'getChatGPTSignInButtonModel']);
const auth = createChatGPTAuth({ authPath: '/auth/chatgpt' });
assert.equal(auth.getSnapshot().state.status, 'idle');
assert.deepEqual(auth.getSessionSnapshot(), { status: 'unavailable', profile: null });
void auth.destroy();
