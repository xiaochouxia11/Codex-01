const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const client = require('@openai/auth/client');
const { createChatGPTAuth, getChatGPTSignInButtonModel } = client;

const entrypoints = JSON.parse(readFileSync(join(__dirname, 'entrypoints.json'), 'utf8'));
for (const name of entrypoints) {
  assert(require.resolve(name).endsWith('.cjs'), `${name}: expected CommonJS output`);
  require(name);
}
const catalogs = JSON.parse(readFileSync(join(__dirname, 'localization.json'), 'utf8'));
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
