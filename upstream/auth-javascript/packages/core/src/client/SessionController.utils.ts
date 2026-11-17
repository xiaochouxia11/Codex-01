import type { ChatGPTAuthProfile, ChatGPTAuthSessionSource } from '../types.js';
import { ChatGPTAuthError } from '../ChatGPTAuthError.js';
import type { ChatGPTAuthSessionSnapshot } from './types.js';

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function sessionSource(adapter: object): ChatGPTAuthSessionSource | undefined {
  try {
    const source: unknown = Reflect.get(adapter, 'session');
    if (source === undefined) {
      return undefined;
    }
    if (
      record(source) &&
      typeof source.getSession === 'function' &&
      (source.subscribe === undefined || typeof source.subscribe === 'function')
    ) {
      return source as unknown as ChatGPTAuthSessionSource;
    }
  } catch {
    // Do not expose application objects or getter errors in configuration errors.
  }
  throw new ChatGPTAuthError({
    code: 'invalid_configuration',
    param: 'adapter.session',
    message: 'adapter.session requires a getSession() method and an optional subscribe() method.',
    retryable: false,
  });
}

/** Copy only display claims. The client never publishes application credentials. */
export function readSession(value: unknown): ChatGPTAuthSessionSnapshot {
  if (!record(value)) {
    throw new Error('Invalid session');
  }
  if (value.status === 'unauthenticated') {
    return { status: 'unauthenticated', profile: null };
  }
  if (value.status !== 'authenticated') {
    throw new Error('Invalid session');
  }
  const profile = value.profile;
  if (profile === null) {
    return { status: 'authenticated', profile: null };
  }
  if (!record(profile) || typeof profile.subject !== 'string' || !profile.subject.trim()) {
    throw new Error('Invalid profile');
  }
  const result: { subject: string; name?: string; picture?: string } = {
    subject: profile.subject,
  };
  if (typeof profile.name === 'string') {
    result.name = profile.name;
  }
  if (typeof profile.picture === 'string') {
    try {
      const picture = new URL(profile.picture);
      if (
        ['http:', 'https:'].includes(picture.protocol) &&
        !picture.username &&
        !picture.password
      ) {
        result.picture = picture.href;
      }
    } catch {
      // Omit invalid image URLs while retaining the remaining verified display claims.
    }
  }
  return { status: 'authenticated', profile: Object.freeze(result) as ChatGPTAuthProfile };
}
