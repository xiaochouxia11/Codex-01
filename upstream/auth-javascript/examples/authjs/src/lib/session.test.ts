import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toSdkSession } from './session.ts';

const expires = '2099-01-01T00:00:00.000Z';

test('maps only consented display fields from the app session', () => {
  assert.deepEqual(
    toSdkSession({
      expires,
      user: {
        id: '["https://auth.openai.com","registered-client","verified-subject"]',
        name: 'Example user',
        image: 'https://images.example.test/avatar.png',
        email: 'person@example.test',
        access_token: 'must-not-be-exposed',
      },
      access_token: 'must-not-be-exposed',
      id_token: 'must-not-be-exposed',
    }),
    {
      status: 'authenticated',
      profile: {
        subject: '["https://auth.openai.com","registered-client","verified-subject"]',
        name: 'Example user',
        picture: 'https://images.example.test/avatar.png',
      },
    },
  );
});

test('treats absent and expired app sessions as signed out', () => {
  for (const value of [null, {}, { expires: '2000-01-01', user: { id: 'previous' } }]) {
    assert.deepEqual(toSdkSession(value), { status: 'unauthenticated' });
  }
});

test('does not turn malformed session reads into authenticated profiles', () => {
  for (const value of [
    undefined,
    [],
    false,
    { expires: 'invalid' },
    { expires },
    { expires, user: {} },
  ]) {
    assert.throws(() => toSdkSession(value), /Invalid application session/);
  }
});

test('keeps the verified subject when optional image claims are unavailable or unsafe', () => {
  for (const image of [
    undefined,
    null,
    '/relative.png',
    'javascript:alert(1)',
    'http://images.example.test/a.png',
    'https://user:password@images.example.test/a.png',
  ]) {
    assert.deepEqual(toSdkSession({ expires, user: { id: 'verified-subject', image } }), {
      status: 'authenticated',
      profile: { subject: 'verified-subject' },
    });
  }
});
