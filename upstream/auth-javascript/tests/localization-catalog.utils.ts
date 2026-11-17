import type { ChatGPTAuthSignInButtonText } from '@openai/auth/client';
import { buttonMessagesByLocale } from '../packages/core/src/client/localization/catalogs.js';

const catalogs: Readonly<
  Record<string, Readonly<Record<Exclude<ChatGPTAuthSignInButtonText, 'brand'>, string>>>
> = buttonMessagesByLocale;

export function japaneseButtonMessages() {
  const messages = catalogs['ja-JP'];
  if (!messages) {
    throw new Error(
      'Japanese catalog is missing. Check localization/locales/ja-JP.json and run pnpm i18n:compile.',
    );
  }
  return messages;
}

export function arabicButtonMessages() {
  const messages = catalogs.ar;
  if (!messages) {
    throw new Error(
      'Arabic catalog is missing. Check localization/locales/ar.json and run pnpm i18n:compile.',
    );
  }
  return messages;
}
