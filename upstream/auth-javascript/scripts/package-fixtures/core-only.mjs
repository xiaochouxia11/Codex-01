import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { createChatGPTAuth } from '@openai/auth/client';
import { ChatGPTAuthError } from '@openai/auth';
const require = createRequire(import.meta.url);
assert.throws(() => require.resolve('react'), { code: 'MODULE_NOT_FOUND' });
assert.throws(() => require.resolve('jose'), { code: 'MODULE_NOT_FOUND' });
assert.equal(typeof require.resolve('csstype/package.json'), 'string');
assert.equal(
  new ChatGPTAuthError({ code: 'probe', message: 'safe', retryable: false }).toJSON().code,
  'probe',
);
const auth = createChatGPTAuth({ authPath: '/auth/chatgpt' });
await auth.destroy();
