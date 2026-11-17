import type { ChatGPTAuthSignInConfiguration } from '../types.js';
import { checkCallbacks, invalid, readOptions } from './options.js';
import { sessionSource } from './SessionController.utils.js';

export const configurationKeys = [
  'authPath',
  'adapter',
  'onInteractionChange',
  'onError',
  'onCancel',
  'onSignInComplete',
] as const;
export function configuration(value: unknown): ChatGPTAuthSignInConfiguration {
  const next = readOptions(value, configurationKeys, 'invalid_configuration');
  if ((next.authPath !== undefined) === (next.adapter !== undefined)) {
    throw invalid('invalid_configuration', 'options', 'exactly one of authPath or adapter');
  }
  if (next.authPath !== undefined) {
    if (typeof next.authPath !== 'string' || !next.authPath.trim()) {
      throw invalid(
        'invalid_configuration',
        'authPath',
        'a non-empty app-owned sign-in route string',
      );
    }
    for (const callback of ['onCancel', 'onSignInComplete']) {
      if (next[callback] !== undefined) {
        throw invalid(
          'invalid_configuration',
          callback,
          'this callback only with an adapter binding',
        );
      }
    }
    destination(next.authPath, 'https://configuration.invalid');
  } else {
    const adapter = next.adapter;
    if (typeof adapter !== 'object' || adapter === null) {
      throw invalid('invalid_configuration', 'adapter', 'an object with a signIn() method');
    }
    let signIn: unknown;
    let isArray: boolean;
    try {
      isArray = Array.isArray(adapter);
      signIn = isArray ? undefined : Reflect.get(adapter, 'signIn');
    } catch {
      throw invalid('invalid_configuration', 'adapter.signIn', 'a readable signIn() method');
    }
    if (isArray) {
      throw invalid('invalid_configuration', 'adapter', 'an object with a signIn() method');
    }
    if (typeof signIn !== 'function') {
      throw invalid(
        'invalid_configuration',
        'adapter.signIn',
        'a signIn() method returning Promise<{ status: "complete" | "cancelled" | "redirecting" }>',
      );
    }
    const session = sessionSource(adapter);
    try {
      next.adapter = Object.freeze({
        signIn: Function.prototype.bind.call(signIn, adapter),
        session,
      });
    } catch {
      throw invalid('invalid_configuration', 'adapter.signIn', 'a callable signIn() method');
    }
  }
  checkCallbacks(
    next,
    ['onInteractionChange', 'onError', 'onCancel', 'onSignInComplete'],
    'invalid_configuration',
  );
  return Object.freeze(next) as unknown as ChatGPTAuthSignInConfiguration;
}

/** The route resolves from the document origin, never from an injected HTML base element. */
export function destination(authPath: string, origin: string, checkOrigin = false): string {
  let url: URL;
  try {
    url = new URL(authPath, `${origin}/`);
  } catch {
    throw invalid('invalid_configuration', 'authPath', 'a valid app-owned HTTP(S) sign-in route');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw invalid('invalid_configuration', 'authPath', 'an HTTP(S) sign-in route');
  }
  if (url.username || url.password) {
    throw invalid('invalid_configuration', 'authPath', 'a sign-in route without URL credentials');
  }
  if (url.hash || authPath.includes('#')) {
    throw invalid('invalid_configuration', 'authPath', 'a sign-in route without a fragment');
  }
  if (checkOrigin && url.origin !== origin) {
    throw invalid(
      'invalid_configuration',
      'authPath',
      'a route on the same origin as the button document',
    );
  }
  return url.href;
}
