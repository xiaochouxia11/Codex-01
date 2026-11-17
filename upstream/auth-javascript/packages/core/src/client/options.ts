import { ChatGPTAuthError } from '../ChatGPTAuthError.js';

export function invalid(
  code: 'invalid_configuration' | 'invalid_presentation',
  param = 'options',
  expected = 'an options object containing only supported fields',
): ChatGPTAuthError {
  return new ChatGPTAuthError({
    code,
    message: `Invalid ${param}. Expected ${expected}.`,
    retryable: false,
    param,
  });
}

export function readOptions(
  value: unknown,
  keys: readonly string[],
  code: 'invalid_configuration' | 'invalid_presentation',
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw invalid(code, 'options', 'a non-null options object');
  }
  let ownKeys: PropertyKey[] | null;
  try {
    ownKeys = Array.isArray(value) ? null : Reflect.ownKeys(value);
  } catch {
    throw invalid(code, 'options', 'an options object with readable own properties');
  }
  if (ownKeys === null) {
    throw invalid(code, 'options', 'an options object, not an array');
  }
  const result: Record<string, unknown> = {};
  for (const key of ownKeys) {
    if (typeof key !== 'string' || !keys.includes(key)) {
      // Unknown property names can themselves contain URLs or secrets. Only a
      // short identifier is useful as a diagnostic. Never stringify symbols.
      const param =
        typeof key === 'string' && /^[A-Za-z_$][A-Za-z0-9_$-]{0,63}$/.test(key) ? key : 'options';
      throw invalid(code, param, `only supported fields: ${keys.join(', ')}`);
    }
    try {
      result[key] = Reflect.get(value, key);
    } catch {
      throw invalid(code, key, 'a readable property value');
    }
  }
  return result;
}

export function checkCallbacks(
  value: Record<string, unknown>,
  keys: readonly string[],
  code: 'invalid_configuration' | 'invalid_presentation',
) {
  for (const key of keys) {
    if (value[key] !== undefined && typeof value[key] !== 'function') {
      throw invalid(code, key, 'a callback function or undefined');
    }
  }
}
