import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  ChatGPTAuthSignInAdapterResult,
  ChatGPTAuthSignInConfiguration,
  ChatGPTAuthSignInState,
} from '@openai/auth';
import { DomDemo } from './DomDemo.js';
import { ReactDemo } from './ReactDemo.js';
import { ButtonVariants } from './ButtonVariants.js';
import './styles.css';

type Api = 'dom' | 'react';
type ResponseMode =
  'manual' | 'complete' | 'cancelled' | 'error' | 'throw' | 'invalid' | 'redirecting';
type Settlement = Exclude<ResponseMode, 'manual' | 'throw'>;
interface LogEntry {
  id: string;
  time: string;
  api: Api | 'host';
  name: string;
  detail: string;
}
interface Attempt {
  id: number;
  api: Api;
  generation: number;
  settle: (result: Settlement) => void;
}
const storageKey = 'openai-auth-playground-events';
const labels = { dom: 'DOM', react: 'React' };

function readEvents(): LogEntry[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]');
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter(
        (entry): entry is LogEntry =>
          typeof entry === 'object' &&
          entry !== null &&
          ['id', 'time', 'name', 'detail'].every((key) => typeof entry[key] === 'string') &&
          ['dom', 'react', 'host'].includes(entry.api),
      )
      .slice(0, 60);
  } catch {
    return [];
  }
}

function Playground() {
  const query = new URLSearchParams(location.search);
  const [flow, setFlow] = useState<'adapter' | 'authPath'>(() => {
    const requested = query.get('flow');
    return requested === 'authPath' ? 'authPath' : 'adapter';
  });
  const [locale, setLocale] = useState(() => {
    const requested = query.get('locale');
    return requested === 'ja' || requested === 'ar' || requested === 'es-419' ? requested : 'en';
  });
  const [response, setResponse] = useState<ResponseMode>('manual');
  const [delay, setDelay] = useState(2000);
  const [generation, setGeneration] = useState(0);
  const [secondary, setSecondary] = useState({ dom: true, react: true });
  const [calls, setCalls] = useState({ dom: 0, react: 0 });
  const [events, setEvents] = useState(readEvents);
  const eventsRef = useRef(events);
  const sequence = useRef(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  const record = useCallback(
    (api: Api | 'host', name: string, detail = '') => {
      const now = new Date();
      const entry = {
        id: `${now.getTime()}-${++sequence.current}`,
        time: now.toLocaleTimeString('en-US', { hour12: false }),
        api,
        name,
        detail,
      };
      const next = [entry, ...eventsRef.current].slice(0, 60);
      eventsRef.current = next;
      setEvents(next);
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* Local history is optional. */
      }
    },
    [setEvents],
  );
  const recordReactEvent = useCallback(
    (name: string, detail: string) => record('react', name, detail),
    [record],
  );

  const begin = useCallback(
    (api: Api, mode: ResponseMode, wait: number, epoch: number) => {
      const id = ++sequence.current;
      setCalls((previous) => ({ ...previous, [api]: previous[api] + 1 }));
      record(
        api,
        'adapter.signIn()',
        `Attempt ${id} · ${mode} · activation ${navigator.userActivation?.isActive ? 'active' : 'inactive'}`,
      );
      if (mode === 'throw') {
        throw new Error('Simulated external adapter exception');
      }
      return new Promise<ChatGPTAuthSignInAdapterResult>((resolve, reject) => {
        let settled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const settle = (result: Settlement) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          setAttempts((previous) => previous.filter((entry) => entry.id !== id));
          record(api, 'mock adapter settles', `Attempt ${id} → ${result}`);
          if (result === 'error') {
            reject(new Error('Simulated external adapter rejection'));
          } else if (result === 'invalid') {
            resolve({ status: 'unexpected' } as unknown as ChatGPTAuthSignInAdapterResult);
          } else {
            resolve({ status: result });
          }
        };
        setAttempts((previous) => [...previous, { id, api, generation: epoch, settle }]);
        if (mode !== 'manual') {
          timer = setTimeout(() => settle(mode), wait);
        }
      });
    },
    [record],
  );

  const configurations = useMemo(() => {
    const make = (api: Api): ChatGPTAuthSignInConfiguration => {
      const callbacks = {
        onInteractionChange(state: ChatGPTAuthSignInState) {
          record(api, 'onInteractionChange', state.status);
        },
        onError(error: { code: string; message: string }) {
          record(api, 'onError', `${error.code}: ${error.message}`);
        },
      };
      return flow === 'authPath'
        ? { authPath: `/auth/demo?api=${api}`, ...callbacks }
        : {
            adapter: { signIn: () => begin(api, response, delay, generation) },
            onSignInComplete: () => record(api, 'onSignInComplete', '{ delivery: "delegated" }'),
            onCancel: () => record(api, 'onCancel', 'The mock adapter reported cancellation.'),
            ...callbacks,
          };
    };
    return { dom: make('dom'), react: make('react') };
  }, [flow, response, delay, generation, begin, record]);

  const returned = query.get('returned');
  const returnedApi: Api = query.get('api') === 'react' ? 'react' : 'dom';
  useEffect(() => {
    if (returned && ['complete', 'cancelled', 'error'].includes(returned)) {
      record(
        returnedApi,
        'host navigation return',
        `${returned} (simulated) · the app mounted new UI without an SDK completion callback`,
      );
    }
  }, [returned, returnedApi, record]);

  function reset() {
    record(
      'host',
      'Reset demos',
      'The app disposed and remounted both clients. Any old adapter promise may still settle.',
    );
    setGeneration((previous) => previous + 1);
    setSecondary({ dom: true, react: true });
  }
  function clearEvents() {
    eventsRef.current = [];
    setEvents([]);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* Local history is optional. */
    }
  }
  const retired = attempts.filter((attempt) => attempt.generation !== generation);

  return (
    <div className="app-shell">
      <header className="page-header">
        <div>
          <div className="eyebrow">OPENAI AUTH / DEVELOPMENT</div>
          <h1>
            Auth playground<span className="title-dot">.</span>
          </h1>
          <p>Try an interaction. Watch its lifecycle. Compare the two APIs.</p>
        </div>
        <div className="simulation-badge">
          <span /> Local simulation
        </div>
      </header>
      <div className="context-note">
        This playground uses mock adapters or a simulated navigation route. It does not contact
        OpenAI or create a session.
      </div>
      <div className="workspace">
        <main>
          <section className="controls-card" aria-label="Scenario controls">
            <div className="section-heading">
              <div>
                <span className="step-label">01 / CONFIGURE</span>
                <h2>Choose the flow</h2>
              </div>
              <button className="secondary-button" onClick={reset}>
                Reset demos
              </button>
            </div>
            <div className="flow-tabs" role="group" aria-label="Auth path">
              <button
                className={flow === 'adapter' ? 'selected' : ''}
                aria-pressed={flow === 'adapter'}
                onClick={() => setFlow('adapter')}
              >
                Adapter <span>Stay on this page</span>
              </button>
              <button
                className={flow === 'authPath' ? 'selected' : ''}
                aria-pressed={flow === 'authPath'}
                onClick={() => setFlow('authPath')}
              >
                authPath <span>Navigate to an app route</span>
              </button>
            </div>
            {flow === 'adapter' ? (
              <div className="settings-grid">
                <label>
                  Mock adapter response
                  <select
                    value={response}
                    onChange={(event) => setResponse(event.target.value as ResponseMode)}
                  >
                    <option value="manual">Keep pending for a manual result</option>
                    <option value="complete">Complete successfully</option>
                    <option value="cancelled">Report cancellation</option>
                    <option value="error">Reject with an error</option>
                    <option value="throw">Throw synchronously</option>
                    <option value="invalid">Return an invalid result</option>
                    <option value="redirecting">Report redirect handoff</option>
                  </select>
                </label>
                <label>
                  Response delay
                  <select
                    value={delay}
                    disabled={response === 'manual' || response === 'throw'}
                    onChange={(event) => setDelay(Number(event.target.value))}
                  >
                    <option value={0}>Immediately</option>
                    <option value={750}>0.75 seconds</option>
                    <option value={2000}>2 seconds</option>
                    <option value={5000}>5 seconds</option>
                  </select>
                </label>
              </div>
            ) : (
              <div className="route-explanation">
                <code>/auth/demo?api=dom|react</code>
                <p>
                  A ChatGPT button performs a real same-origin GET navigation. The destination lets
                  you simulate a return. Navigation itself never emits sign-in completion.
                </p>
              </div>
            )}
            <div className="settings-grid">
              <label>
                Button language
                <select value={locale} onChange={(event) => setLocale(event.target.value)}>
                  <option value="en">English</option>
                  <option value="ja">Japanese</option>
                  <option value="ar">Arabic</option>
                  <option value="es-419">Spanish (Latin America)</option>
                </select>
              </label>
              <p className="hint">
                Button text updates immediately, including while an attempt is pending. Playground
                controls stay in English.
              </p>
            </div>
            <p className="hint">
              Authentication settings apply to the next attempt. Reset remounts both clients. It
              does not cancel an external operation.
            </p>
            {retired.length > 0 && (
              <div className="retired-attempts">
                <span>
                  {retired.length} old mock attempt{retired.length === 1 ? ' is' : 's are'} still
                  pending.
                </span>
                <button
                  className="text-button"
                  onClick={() => retired.forEach((attempt) => attempt.settle('complete'))}
                >
                  Complete old attempts
                </button>
                <small>The event log should show the mock result without new SDK callbacks.</small>
              </div>
            )}
          </section>
          <div className="demo-heading">
            <span className="step-label">02 / INTERACT</span>
            <span>Each card owns an independent client</span>
          </div>
          <div className="demo-grid">
            {(['dom', 'react'] as const).map((api) => {
              const demoProps = {
                signIn: configurations[api],
                locale,
                generation,
                onRecovered: () => {
                  setAttempts((previous) =>
                    previous.map((attempt) =>
                      attempt.api === api ? { ...attempt, generation: -1 } : attempt,
                    ),
                  );
                  record(
                    api,
                    'Host recovery',
                    'The app checked the external state and returned the local interaction to idle.',
                  );
                },
                showSecondary: secondary[api],
                onToggleSecondary: () =>
                  setSecondary((previous) => ({ ...previous, [api]: !previous[api] })),
              };
              const pending = attempts.find(
                (attempt) => attempt.api === api && attempt.generation === generation,
              );
              return (
                <article className="api-card" key={api} data-testid={`${api}-card`}>
                  {api === 'dom' ? (
                    <DomDemo {...demoProps} />
                  ) : (
                    <ReactDemo key={generation} {...demoProps} onEvent={recordReactEvent} />
                  )}
                  <div className="status-strip">
                    <span>
                      Adapter calls <strong data-testid={`${api}-calls`}>{calls[api]}</strong>
                    </span>
                  </div>
                  {pending && (
                    <div className="settlement">
                      <p>Choose a result for this mock attempt</p>
                      <div>
                        <button
                          className="settle-complete"
                          onClick={() => pending.settle('complete')}
                        >
                          Complete {labels[api]}
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() => pending.settle('cancelled')}
                        >
                          Cancel {labels[api]}
                        </button>
                        <button className="danger-button" onClick={() => pending.settle('error')}>
                          Fail {labels[api]}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <section className="try-this">
            <span className="step-label">TRY THIS</span>
            <p>
              In the React card, enable preventDefault() to prevent sign-in. The parent still
              receives the click. Try stopPropagation() by itself. Sign-in starts, but the parent
              click count stays unchanged. Press Tab to move between buttons to see focus and blur
              callbacks.
            </p>
          </section>
          <details className="code-card">
            <summary>API usage in this playground</summary>
            <div className="code-grid">
              <pre>{`const auth = createChatGPTAuth(signIn);\nconst first = auth.mountSignInButton(header);\nconst second = auth.mountSignInButton(dialog);\n\nawait second.destroy(); // only detach this view\nawait auth.destroy();  // retire the client`}</pre>
              <pre>{`<ChatGPTAuthProvider options={signIn}>\n  <div onClick={onParentClick}>\n    <ChatGPTSignInButton\n      onClick={(event) => {\n        if (prevent) event.preventDefault();\n        if (stop) event.stopPropagation();\n        // currentTarget is the actual button.\n        record(event.currentTarget, event.nativeEvent);\n      }}\n      onFocus={onFocus}\n      onBlur={onBlur}\n    />\n  </div>\n</ChatGPTAuthProvider>`}</pre>
            </div>
          </details>
          <ButtonVariants locale={locale} onLocaleChange={setLocale} />
        </main>
        <aside className="event-panel" aria-label="Event log" id="event-log">
          <div className="section-heading">
            <div>
              <span className="step-label">03 / OBSERVE</span>
              <h2>Event log</h2>
            </div>
            <button className="text-button" onClick={clearEvents} disabled={!events.length}>
              Clear
            </button>
          </div>
          <p className="event-note">
            This log shows callbacks and authentication events, newest first. It remains available
            after navigation.
          </p>
          <div className="event-list" role="log" aria-live="polite" aria-relevant="additions">
            {events.length ? (
              events.map((event) => (
                <div className="event-entry" key={event.id}>
                  <div>
                    <span className={`event-api ${event.api}`}>
                      {event.api === 'host' ? 'Host' : labels[event.api]}
                    </span>
                    <time>{event.time}</time>
                  </div>
                  <strong>{event.name}</strong>
                  {event.detail && <p>{event.detail}</p>}
                </div>
              ))
            ) : (
              <div className="empty-log">
                <span>↳</span>
                <p>The event log is empty.</p>
                <small>
                  Click a ChatGPT button to see the sequence of adapter calls and SDK callbacks.
                </small>
              </div>
            )}
          </div>
        </aside>
      </div>
      <footer>
        Local playground <span>DOM · React · ESM consumer</span>
      </footer>
    </div>
  );
}

function AuthRoute() {
  const api = new URLSearchParams(location.search).get('api') === 'react' ? 'react' : 'dom';
  return (
    <main className="route-page">
      <div className="eyebrow">LOCAL AUTH ROUTE</div>
      <div className="route-icon">↗</div>
      <h1>The sign-in route opened.</h1>
      <p>
        The {labels[api]} button navigated to <code>/auth/demo</code> with GET. A real app would now
        use its existing authentication system.
      </p>
      <div className="context-note">
        This is a local simulation. It did not verify identity or create a session.
      </div>
      <div className="route-actions">
        <a className="settle-complete" href={`/?flow=authPath&api=${api}&returned=complete`}>
          Simulate completion
        </a>
        <a className="secondary-button" href={`/?flow=authPath&api=${api}&returned=cancelled`}>
          Simulate cancellation
        </a>
        <a className="danger-button" href={`/?flow=authPath&api=${api}&returned=error`}>
          Simulate error
        </a>
      </div>
      <p className="hint">
        Returning remounts the demos. Check for an app navigation event. Navigation does not cause
        an SDK completion callback.
      </p>
      <a className="text-button" href="/">
        ← Back to playground
      </a>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  location.pathname === '/auth/demo' ? <AuthRoute /> : <Playground />,
);
