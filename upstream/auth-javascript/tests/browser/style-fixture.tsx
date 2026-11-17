import { useLayoutEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, hydrateRoot } from 'react-dom/client';
import type { ChatGPTAuthSignInAdapterResult, ChatGPTAuthSignInConfiguration } from '@openai/auth';
import { createChatGPTAuth } from '@openai/auth/client';
import { ChatGPTAuthProvider, ChatGPTSignInButton } from '@openai/auth-react';
import type {
  StyleFixtureAPI,
  StyleFixturePresentation,
  StyleFixtureState,
} from './style-fixture-types.js';

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) {
    throw new Error(`Missing style fixture element: ${id}`);
  }
  return found;
}

const state: StyleFixtureState = {
  calls: { dom: 0, react: 0 },
  hydrationErrors: [],
};
const resolvers = new Map<StyleFixtureAPI, (result: ChatGPTAuthSignInAdapterResult) => void>();
function configuration(api: StyleFixtureAPI): ChatGPTAuthSignInConfiguration {
  return {
    adapter: {
      signIn() {
        state.calls[api]++;
        return new Promise<ChatGPTAuthSignInAdapterResult>((resolve) =>
          resolvers.set(api, resolve),
        );
      },
    },
  };
}
const dom = createChatGPTAuth(configuration('dom'));
const views = ['primary', 'secondary'].map((name) =>
  dom.mountSignInButton(element(`dom-${name}-slot`), { id: `dom-style-${name}` }),
);
const reactConfiguration = configuration('react');
let updateReact: ((options: StyleFixturePresentation) => void) | undefined;
const serverButton = document.getElementById('react-style-primary');

function Fixture() {
  const [presentation, setPresentation] = useState<StyleFixturePresentation>({});
  useLayoutEffect(() => {
    updateReact = (options) => setPresentation((current) => ({ ...current, ...options }));
    return () => {
      updateReact = undefined;
    };
  }, []);
  return (
    <ChatGPTAuthProvider options={reactConfiguration}>
      <div className="button-slot">
        <ChatGPTSignInButton {...presentation} id="react-style-primary" />
      </div>
      <div className="button-slot">
        <ChatGPTSignInButton {...presentation} id="react-style-secondary" />
      </div>
    </ChatGPTAuthProvider>
  );
}

window.styleFixture = {
  state,
  update(api, options) {
    if (api === 'dom') {
      views.forEach((view) => view.update(options));
    } else {
      if (!updateReact) {
        throw new Error('React style fixture is not mounted');
      }
      flushSync(() => updateReact?.(options));
    }
  },
  settle(api) {
    const resolve = resolvers.get(api);
    if (!resolve) {
      throw new Error('No style fixture attempt is pending');
    }
    resolvers.delete(api);
    resolve({ status: 'complete' });
  },
  mountInFrame() {
    const frame = document.createElement('iframe');
    frame.title = 'Separate style document';
    document.body.append(frame);
    const body = frame.contentDocument?.body;
    if (!body) {
      throw new Error('Style fixture frame is unavailable');
    }
    dom.mountSignInButton(body, { appearance: 'light' });
    dom.mountSignInButton(body, { appearance: 'dark' });
  },
  preservedServerButton: () =>
    serverButton !== null && serverButton === document.getElementById('react-style-primary'),
  unmountReact: () => root.unmount(),
};

const hydrate = new URLSearchParams(location.search).has('hydrate');
const root = hydrate
  ? hydrateRoot(element('react-style-root'), <Fixture />, {
      onRecoverableError: (error) =>
        state.hydrationErrors.push(error instanceof Error ? error.message : 'Hydration error'),
    })
  : createRoot(element('react-style-root'));
if (!hydrate) {
  root.render(<Fixture />);
}
