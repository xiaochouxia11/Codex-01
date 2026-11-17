import { describe, expect, it } from 'vitest';
import { ChatGPTAuthError } from '@openai/auth';

describe('portable SDK errors', () => {
  it('serializes only explicit safe fields, excluding the exception cause and stack', () => {
    const info = { code: 'example', message: 'Safe message', retryable: false };
    const error = new ChatGPTAuthError(info, { cause: new Error('sensitive-original-error') });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ChatGPTAuthError');
    expect(JSON.parse(JSON.stringify(error))).toEqual(info);
    expect(JSON.stringify(error)).not.toContain('sensitive-original-error');
    expect(error.toJSON()).not.toHaveProperty('stack');
  });

  it('retains explicitly provided diagnostic values without dropping falsy values', () => {
    const info = {
      code: 'example',
      message: '',
      retryable: false,
      status: 0,
      requestId: '',
      param: '',
    };
    expect(new ChatGPTAuthError(info).toJSON()).toEqual(info);
  });
});
