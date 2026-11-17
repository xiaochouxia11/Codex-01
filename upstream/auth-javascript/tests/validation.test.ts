import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTAuthError } from '@openai/auth';
import { createChatGPTAuth, getChatGPTSignInButtonModel } from '@openai/auth/client';

const secret = 'private-value-DoNotInclude-927';
const adapter = { signIn: async () => ({ status: 'complete' as const }) };

function rejected(run: () => unknown): ChatGPTAuthError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ChatGPTAuthError);
    const result = error as ChatGPTAuthError;
    expect(result.retryable).toBe(false);
    expect(result.message).toContain('Expected');
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.message).not.toContain(secret);
    expect(result.cause).toBeUndefined();
    return result;
  }
  throw new Error('Expected validation to reject the invalid input.');
}

afterEach(() => document.body.replaceChildren());

describe('actionable configuration diagnostics', () => {
  it.each([
    {
      name: 'missing binding',
      value: {},
      param: 'options',
      expected: 'exactly one of authPath or adapter',
    },
    {
      name: 'both bindings',
      value: { authPath: '/start', adapter },
      param: 'options',
      expected: 'exactly one of authPath or adapter',
    },
    { name: 'empty route', value: { authPath: '' }, param: 'authPath', expected: 'non-empty' },
    {
      name: 'non-string route',
      value: { authPath: { secret } },
      param: 'authPath',
      expected: 'route string',
    },
    {
      name: 'invalid adapter',
      value: { adapter: secret },
      param: 'adapter',
      expected: 'object with a signIn() method',
    },
    {
      name: 'missing adapter method',
      value: { adapter: {} },
      param: 'adapter.signIn',
      expected: 'Promise',
    },
    {
      name: 'bad callback type',
      value: { adapter, onError: secret },
      param: 'onError',
      expected: 'callback function or undefined',
    },
    {
      name: 'navigation completion callback',
      value: { authPath: '/start', onSignInComplete: () => undefined },
      param: 'onSignInComplete',
      expected: 'only with an adapter binding',
    },
    {
      name: 'navigation cancel callback',
      value: { authPath: '/start', onCancel: () => undefined },
      param: 'onCancel',
      expected: 'only with an adapter binding',
    },
  ])('$name identifies its parameter and required contract', ({ value, param, expected }) => {
    const error = rejected(() => createChatGPTAuth(value as never));
    expect(error.code).toBe('invalid_configuration');
    expect(error.param).toBe(param);
    expect(error.message).toContain(expected);
  });

  it.each([
    { route: `javascript:${secret}`, expected: 'HTTP(S)' },
    { route: `https://user:${secret}@app.example.test/start`, expected: 'without URL credentials' },
    { route: `/start#${secret}`, expected: 'without a fragment' },
    { route: `https://other.example.test/start?token=${secret}`, expected: 'same origin' },
  ])('rejects routes without echoing their contents ($expected)', ({ route, expected }) => {
    const error = rejected(() =>
      createChatGPTAuth({ authPath: route }).mountSignInButton(document.createElement('div')),
    );
    expect(error.param).toBe('authPath');
    expect(error.message).toContain(expected);
    expect(error.message).not.toContain(route);
  });

  it('points out a misspelled key without copying its value', () => {
    const error = rejected(() => createChatGPTAuth({ adapter, authPth: secret } as never));
    expect(error.param).toBe('authPth');
    expect(error.message).toContain('supported fields: authPath, adapter');
  });

  it.each([`https://example.test/?token=${secret}`, Symbol(secret), `${secret} `.repeat(5)])(
    'redacts unsafe unknown property names',
    (key) => {
      const error = rejected(() => createChatGPTAuth({ adapter, [key]: true } as never));
      expect(error.param).toBe('options');
      expect(error.message).toContain('supported fields');
    },
  );

  it('sanitizes exceptions from option getters even when they throw an SDK error', () => {
    const options = Object.defineProperty({}, 'authPath', {
      get() {
        throw new ChatGPTAuthError({ code: secret, message: secret, retryable: true });
      },
    });
    const error = rejected(() => createChatGPTAuth(options as never));
    expect(error.code).toBe('invalid_configuration');
    expect(error.param).toBe('authPath');
    expect(error.message).toContain('readable property value');
  });

  it('sanitizes exceptions while enumerating options', () => {
    const options = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error(secret);
        },
      },
    );
    const error = rejected(() => createChatGPTAuth(options as never));
    expect(error.param).toBe('options');
    expect(error.message).toContain('readable own properties');
  });

  it('reports unreadable revoked proxies as validation failures', () => {
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    expect(rejected(() => createChatGPTAuth(proxy as never)).param).toBe('options');
    expect(rejected(() => createChatGPTAuth({ adapter: proxy } as never)).param).toBe(
      'adapter.signIn',
    );
  });

  it('sanitizes adapter method getters and preserves the method receiver', async () => {
    const unsafeAdapter = Object.defineProperty({}, 'signIn', {
      get() {
        throw new Error(secret);
      },
    });
    expect(rejected(() => createChatGPTAuth({ adapter: unsafeAdapter } as never)).param).toBe(
      'adapter.signIn',
    );
    const receiver = {
      value: 'complete' as const,
      async signIn() {
        return { status: this.value };
      },
    };
    const onSignInComplete = vi.fn();
    const host = document.createElement('div');
    const handle = createChatGPTAuth({ adapter: receiver, onSignInComplete });
    handle.mountSignInButton(host);
    host.querySelector('button')!.click();
    await Promise.resolve();
    expect(onSignInComplete).toHaveBeenCalledTimes(1);
    await handle.destroy();
  });

  it('sanitizes a callable adapter whose metadata getter throws while binding', () => {
    const signIn = Object.defineProperty(async () => ({ status: 'complete' }), 'name', {
      get() {
        throw new Error(secret);
      },
    });
    const error = rejected(() => createChatGPTAuth({ adapter: { signIn } } as never));
    expect(error.param).toBe('adapter.signIn');
    expect(error.message).toContain('callable signIn() method');
  });
});

describe('actionable presentation diagnostics', () => {
  it.each([
    { value: { appearance: secret }, param: 'appearance', expected: '"light", "dark", "auto"' },
    { value: { size: secret }, param: 'size', expected: '"standard", "compact"' },
    { value: { disabled: secret }, param: 'disabled', expected: 'boolean or undefined' },
    { value: { id: { secret } }, param: 'id', expected: 'string or undefined' },
    { value: { onClick: secret }, param: 'onClick', expected: 'callback function or undefined' },
  ])('$param identifies its expected type or values', ({ value, param, expected }) => {
    const error = rejected(() =>
      createChatGPTAuth({ adapter }).mountSignInButton(
        document.createElement('div'),
        value as never,
      ),
    );
    expect(error.code).toBe('invalid_presentation');
    expect(error.param).toBe(param);
    expect(error.message).toContain(expected);
  });

  it('reports invalid visual state fields', () => {
    const error = rejected(() => getChatGPTSignInButtonModel({}, { busy: secret } as never));
    expect(error.param).toBe('busy');
    expect(error.message).toContain('boolean or undefined');
  });

  it('keeps the prior valid presentation after rejecting an update', async () => {
    const host = document.createElement('div');
    const auth = createChatGPTAuth({ adapter });
    const handle = auth.mountSignInButton(host, { disabled: true });
    const button = host.querySelector('button')!;
    rejected(() => handle.update({ disabled: secret } as never));
    expect(button.disabled).toBe(true);
    handle.update({ disabled: undefined });
    expect(button.disabled).toBe(false);
    await handle.destroy();
  });

  it('exposes client state subscriptions and recovery while suppressing abandoned outcomes', async () => {
    let resolve!: (result: { status: 'complete' }) => void;
    const pending = new Promise<{ status: 'complete' }>((complete) => {
      resolve = complete;
    });
    const onSignInComplete = vi.fn();
    const host = document.createElement('div');
    const handle = createChatGPTAuth({ adapter: { signIn: () => pending }, onSignInComplete });
    handle.mountSignInButton(host);
    const states: string[] = [];
    const unsubscribe = handle.subscribe(() => states.push(handle.getSnapshot().state.status));
    expect(handle.getSnapshot().state.status).toBe('idle');
    host.querySelector('button')!.click();
    expect(handle.getSnapshot().state.status).toBe('pending');
    expect(() => handle.recover()).toThrowError(
      expect.objectContaining({ code: 'interaction_pending' }),
    );
    handle.recover({ abandonPending: true });
    expect(handle.getSnapshot().state.status).toBe('idle');
    expect(states).toContain('pending');
    expect(states.at(-1)).toBe('idle');
    resolve({ status: 'complete' });
    await Promise.resolve();
    expect(onSignInComplete).not.toHaveBeenCalled();
    unsubscribe();
    await handle.destroy();
  });
});
