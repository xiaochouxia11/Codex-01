import type { ButtonLocale } from './catalogs.js';

// Add RTL catalog keys here when the SDK gains more translated languages.
const rightToLeftLocales: ReadonlySet<string> = new Set(['ar', 'fa', 'ur']);

/** Direction belongs to the resolved catalog, independently of the host document. */
export function resolveButtonDirection(locale: ButtonLocale): 'ltr' | 'rtl' {
  return rightToLeftLocales.has(locale) ? 'rtl' : 'ltr';
}
