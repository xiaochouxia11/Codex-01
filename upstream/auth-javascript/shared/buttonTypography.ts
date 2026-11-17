// These names refer to locally installed fonts. The SDK does not download font files.
export const buttonFontFamily = 'Arial, Helvetica, sans-serif';
export const buttonFontFallbacks: Readonly<Record<string, string>> = {
  am: '"Noto Sans Ethiopic", Nyala',
  ar: '"Noto Sans Arabic", Tahoma',
  bn: '"Noto Sans Bengali", Vrinda',
  fa: '"Noto Sans Arabic", Tahoma',
  gu: '"Noto Sans Gujarati", Shruti',
  hi: '"Noto Sans Devanagari", Mangal',
  hy: '"Noto Sans Armenian", Sylfaen',
  ja: '"Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, "Noto Sans JP"',
  ka: '"Noto Sans Georgian", Sylfaen',
  kn: '"Noto Sans Kannada", Tunga',
  ml: '"Noto Sans Malayalam", Kartika',
  my: '"Noto Sans Myanmar", "Myanmar Text"',
  ta: '"Noto Sans Tamil", Latha',
  th: '"Noto Sans Thai", Tahoma',
  zh: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC"',
  'zh-HK': '"PingFang HK", "Microsoft JhengHei", "Noto Sans TC"',
  'zh-Hant': '"PingFang TC", "Microsoft JhengHei", "Noto Sans TC"',
};

/** Keep the Latin typeface and add glyph fallbacks for the resolved label language. */
export function getButtonFontFamily(locale: string): string {
  const fallback = buttonFontFallbacks[locale] ?? buttonFontFallbacks[locale.split('-')[0]!];
  return fallback ? `Arial, Helvetica, ${fallback}, sans-serif` : buttonFontFamily;
}
