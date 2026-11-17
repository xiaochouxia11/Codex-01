import { invalid } from '../options.js';
import { buttonMessagesByLocale, type ButtonLocale } from './catalogs.js';

const supportedLocales = (Object.keys(buttonMessagesByLocale) as ButtonLocale[]).map((locale) => {
  const details = new Intl.Locale(locale);
  return { locale, language: details.language, script: details.maximize().script };
});

/** Resolve labels without browser state so server and client rendering agree. */
export function resolveButtonLocale(value: unknown): ButtonLocale {
  if (value === undefined) {
    return 'en';
  }
  if (typeof value !== 'string') {
    throw invalid('invalid_presentation', 'locale', 'a valid BCP 47 language tag or undefined');
  }
  let requested: Intl.Locale;
  try {
    requested = new Intl.Locale(value);
  } catch {
    throw invalid('invalid_presentation', 'locale', 'a valid BCP 47 language tag or undefined');
  }
  const script = requested.maximize().script;
  return (
    supportedLocales.find(({ locale }) => locale === requested.baseName)?.locale ??
    supportedLocales.find(({ locale }) => locale === `${requested.language}-${script}`)?.locale ??
    supportedLocales.find(
      (locale) => locale.language === requested.language && locale.script === script,
    )?.locale ??
    supportedLocales.find(({ language }) => language === requested.language)?.locale ??
    'en'
  );
}
