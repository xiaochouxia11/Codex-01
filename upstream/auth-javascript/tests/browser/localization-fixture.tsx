import { useLayoutEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { ChatGPTAuthSignInAdapterResult, ChatGPTAuthSignInConfiguration } from '@openai/auth';
import { createChatGPTAuth } from '@openai/auth/client';
import { ChatGPTAuthProvider, ChatGPTSignInButton } from '@openai/auth-react';
import type {
  LocalizationFixtureAPI,
  LocalizationFixtureState,
  LocalizationFixtureText,
} from './localization-fixture-types.js';

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) {
    throw new Error(`Missing localization fixture element: ${id}`);
  }
  return found;
}

const query = new URLSearchParams(location.search);
const initialLocale = query.get('locale') ?? 'en';
const localeSelect = element('locale-select') as HTMLSelectElement;
const directionSelect = element('direction-select') as HTMLSelectElement;
document.documentElement.dir = query.get('dir') === 'rtl' ? 'rtl' : 'ltr';
directionSelect.value = document.documentElement.dir;
directionSelect.addEventListener('change', () => {
  document.documentElement.dir = directionSelect.value;
});
function selectLocale(locale: string) {
  const language = locale.toLowerCase().split('-')[0];
  localeSelect.value =
    language === 'es'
      ? 'es-419'
      : language === 'ja' || language === 'ar' || language === 'fa' || language === 'ur'
        ? language
        : 'en';
}
selectLocale(initialLocale);
const variants: LocalizationFixtureText[] = ['continue', 'sign-in'];
const state: LocalizationFixtureState = {
  calls: { dom: 0, react: 0 },
  completed: { dom: 0, react: 0 },
};
const resolvers = new Map<
  LocalizationFixtureAPI,
  (result: ChatGPTAuthSignInAdapterResult) => void
>();
function configuration(api: LocalizationFixtureAPI): ChatGPTAuthSignInConfiguration {
  return {
    adapter: {
      signIn() {
        state.calls[api]++;
        return new Promise<ChatGPTAuthSignInAdapterResult>((resolve) =>
          resolvers.set(api, resolve),
        );
      },
    },
    onSignInComplete() {
      state.completed[api]++;
    },
  };
}

const dom = createChatGPTAuth(configuration('dom'));
const views = variants.map((text) =>
  dom.mountSignInButton(element(`dom-${text}-slot`), {
    id: `dom-localization-${text}`,
    locale: initialLocale,
    text,
  }),
);
const reactConfiguration = configuration('react');
let updateReact: ((locale: string) => void) | undefined;

function Fixture() {
  const [locale, setLocale] = useState(initialLocale);
  useLayoutEffect(() => {
    updateReact = setLocale;
    localeSelect.disabled = false;
    return () => {
      updateReact = undefined;
      localeSelect.disabled = true;
    };
  }, []);
  return (
    <ChatGPTAuthProvider options={reactConfiguration}>
      {variants.map((text) => (
        <div className="button-slot" key={text}>
          <ChatGPTSignInButton id={`react-localization-${text}`} locale={locale} text={text} />
        </div>
      ))}
    </ChatGPTAuthProvider>
  );
}

window.localizationFixture = {
  state,
  update(locale) {
    if (!updateReact) {
      throw new Error('React localization fixture is not mounted');
    }
    views.forEach((view) => view.update({ locale }));
    flushSync(() => updateReact?.(locale));
    selectLocale(locale);
  },
  settle(api) {
    const resolve = resolvers.get(api);
    if (!resolve) {
      throw new Error('No localization fixture attempt is pending');
    }
    resolvers.delete(api);
    resolve({ status: 'complete' });
  },
};
localeSelect.addEventListener('change', () => {
  window.localizationFixture.update(localeSelect.value);
});

createRoot(element('react-localization-root')).render(<Fixture />);
