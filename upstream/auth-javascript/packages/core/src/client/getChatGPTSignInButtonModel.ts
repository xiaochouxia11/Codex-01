import { CHATGPT_MARK_PATH } from './brand.js';
import { getButtonFontFamily } from '../../../../shared/buttonTypography.js';
import type { SignInButtonModelState } from './getChatGPTSignInButtonModel.types.js';
import type {
  ChatGPTAuthSignInButtonModel,
  ChatGPTAuthSignInButtonVisualOptions,
} from './types.js';
import { invalid, readOptions } from './options.js';
import { presentation, visualOptionKeys } from './presentation.js';
import { buttonMessagesByLocale } from './localization/catalogs.js';
import { resolveButtonDirection } from './localization/resolveButtonDirection.js';

/** DOM and framework renderers share this pure visual model. It does not access browser globals. */
export function getChatGPTSignInButtonModel(
  options: ChatGPTAuthSignInButtonVisualOptions = {},
  state: SignInButtonModelState = {},
): ChatGPTAuthSignInButtonModel {
  const visual = presentation(readOptions(options, visualOptionKeys, 'invalid_presentation'));
  const current = readOptions(state, ['busy', 'dark'], 'invalid_presentation');
  for (const key of ['busy', 'dark']) {
    if (current[key] !== undefined && typeof current[key] !== 'boolean') {
      throw invalid('invalid_presentation', key, 'a boolean or undefined');
    }
  }
  const busy = current.busy === true;
  const dark =
    visual.appearance === 'dark' || (visual.appearance === 'auto' && current.dark === true);
  const disabled = busy || visual.disabled;
  const markSize = visual.size === 'compact' ? 18 : 20;
  const locale = visual.locale ?? 'en';
  const direction = resolveButtonDirection(locale);

  return Object.freeze({
    label: visual.text === 'brand' ? 'ChatGPT' : buttonMessagesByLocale[locale][visual.text],
    ariaLabel: visual.text === 'brand' ? buttonMessagesByLocale[locale]['sign-in'] : undefined,
    lang: locale,
    dir: direction,
    disabled,
    busy,
    id: visual.id,
    'data-testid': visual['data-testid'],
    style: Object.freeze({
      boxSizing: 'border-box',
      display: visual.layout === 'spread' ? 'inline-grid' : 'inline-flex',
      ...(visual.layout === 'spread'
        ? {
            alignContent: 'center' as const,
            gridTemplateColumns: `minmax(${markSize}px, 1fr) minmax(0, auto) minmax(${markSize}px, 1fr)`,
          }
        : {}),
      direction,
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      fontFamily: getButtonFontFamily(locale),
      fontWeight: 500,
      lineHeight: visual.size === 'compact' ? String(20 / 13) : String(20 / 14),
      whiteSpace: 'normal',
      borderRadius: '8px',
      fontSize: visual.size === 'compact' ? '0.8125rem' : '0.875rem',
      minHeight: visual.size === 'compact' ? '36px' : '44px',
      padding: visual.size === 'compact' ? '7px 12px' : '11px 16px',
      width: visual.width === 'full' ? '100%' : 'auto',
      background: dark ? '#171717' : '#ffffff',
      color: dark ? '#ffffff' : '#171717',
      border: `1px solid ${visual.variant === 'contained' ? 'transparent' : dark ? '#525252' : '#d4d4d4'}`,
      opacity: disabled ? 0.6 : 1,
      cursor: disabled ? 'default' : 'pointer',
    }),
    mark: Object.freeze({
      viewBox: '0 0 21 21',
      path: CHATGPT_MARK_PATH,
      style: Object.freeze({ width: markSize, height: markSize, flexShrink: 0 }),
    }),
  });
}
