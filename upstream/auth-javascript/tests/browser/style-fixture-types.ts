import type { ChatGPTAuthSignInButtonPresentation } from '@openai/auth/client';

export type StyleFixtureAPI = 'dom' | 'react';
export type StyleFixturePresentation = Omit<
  ChatGPTAuthSignInButtonPresentation,
  'onClick' | 'onFocus' | 'onBlur'
>;
export interface StyleFixtureState {
  calls: Record<StyleFixtureAPI, number>;
  hydrationErrors: string[];
}

declare global {
  interface Window {
    styleFixture: {
      state: StyleFixtureState;
      update(api: StyleFixtureAPI, options: StyleFixturePresentation): void;
      settle(api: StyleFixtureAPI): void;
      mountInFrame(): void;
      preservedServerButton(): boolean;
      unmountReact(): void;
    };
  }
}
