import type { Presentation } from './types.js';
import { checkCallbacks, invalid, readOptions } from './options.js';
import { snapshotStyle } from './presentation.utils.js';
import { resolveButtonLocale } from './localization/resolveButtonLocale.js';

export const presentationKeys = [
  'appearance',
  'size',
  'width',
  'text',
  'variant',
  'layout',
  'locale',
  'disabled',
  'id',
  'data-testid',
  'className',
  'style',
  'stylesheet',
  'onClick',
  'onFocus',
  'onBlur',
] as const;

export const visualOptionKeys = presentationKeys.filter(
  (key) =>
    key !== 'onClick' &&
    key !== 'onFocus' &&
    key !== 'onBlur' &&
    key !== 'className' &&
    key !== 'style' &&
    key !== 'stylesheet',
);

export function presentation(value: unknown = {}): Presentation {
  const next = readOptions(value, presentationKeys, 'invalid_presentation');
  const enums: Record<string, readonly string[]> = {
    appearance: ['light', 'dark', 'auto'],
    size: ['standard', 'compact'],
    width: ['content', 'full'],
    text: ['continue', 'sign-in', 'brand'],
    variant: ['button', 'outlined', 'contained'],
    layout: ['inline', 'spread'],
    stylesheet: ['auto', 'external'],
  };
  for (const [key, allowed] of Object.entries(enums)) {
    if (next[key] !== undefined && !allowed.includes(next[key] as string)) {
      throw invalid(
        'invalid_presentation',
        key,
        `one of ${allowed.map((option) => `"${option}"`).join(', ')} or undefined`,
      );
    }
  }
  for (const key of ['id', 'data-testid', 'className']) {
    if (next[key] !== undefined && typeof next[key] !== 'string') {
      throw invalid('invalid_presentation', key, 'a string or undefined');
    }
  }
  if (next.disabled !== undefined && typeof next.disabled !== 'boolean') {
    throw invalid('invalid_presentation', 'disabled', 'a boolean or undefined');
  }
  checkCallbacks(next, ['onClick', 'onFocus', 'onBlur'], 'invalid_presentation');
  // Preserve automatic selection across partial updates. Renderers use their document language.
  const locale = next.locale === undefined ? undefined : resolveButtonLocale(next.locale);
  const style = snapshotStyle(next.style);
  return Object.freeze({
    ...next,
    locale,
    style,
    appearance: next.appearance ?? 'auto',
    size: next.size ?? 'standard',
    width: next.width ?? 'content',
    text: next.text ?? 'continue',
    variant: next.variant === 'contained' ? 'contained' : 'outlined',
    layout: next.layout ?? 'inline',
    disabled: next.disabled ?? false,
  }) as Presentation;
}
