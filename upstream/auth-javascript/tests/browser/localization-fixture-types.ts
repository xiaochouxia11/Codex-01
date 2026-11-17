export type LocalizationFixtureAPI = 'dom' | 'react';
export type LocalizationFixtureText = 'continue' | 'sign-in';
export type LocalizationFixtureLocale = 'en' | 'ja-JP' | 'ar' | 'es-419' | 'fa' | 'ur';

export interface LocalizationFixtureState {
  calls: Record<LocalizationFixtureAPI, number>;
  completed: Record<LocalizationFixtureAPI, number>;
}

declare global {
  interface Window {
    localizationFixture: {
      state: LocalizationFixtureState;
      update(locale: string): void;
      settle(api: LocalizationFixtureAPI): void;
    };
  }
}
