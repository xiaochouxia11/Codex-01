import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ChatGPTAuthSignInConfiguration, ChatGPTAuthSignInState } from '@openai/auth';
import {
  ChatGPTAuthProvider,
  ChatGPTSignInButton,
  ChatGPTProfilePicture,
  useChatGPTProfile,
  useChatGPTSignInState,
  useChatGPTSignInRecovery,
} from '@openai/auth-react';
import {
  createLocalPopupAdapter,
  createSessionReader,
  clearAppSession,
  safeError,
  sessionLabel,
  type AppSession,
} from './local-auth.js';

type Mode = 'popup' | 'route';
const adapter = createLocalPopupAdapter('react');

function Controls({
  mode,
  setMode,
  session,
  refreshSession,
  log,
}: {
  mode: Mode;
  setMode: (mode: Mode) => void;
  session: AppSession | null;
  refreshSession: (operation?: () => Promise<AppSession>) => Promise<AppSession>;
  log: (message: string) => void;
}) {
  const state = useChatGPTSignInState();
  const profile = useChatGPTProfile();
  const recover = useChatGPTSignInRecovery();
  const button = useRef<HTMLButtonElement>(null);
  const [confirmedState, setConfirmedState] = useState<Readonly<ChatGPTAuthSignInState> | null>(
    null,
  );
  const allowRetire = state.status === 'pending' && confirmedState === state;
  const busy = state.status === 'pending' || state.status === 'redirecting';

  const reconcileAndRecover = useCallback(
    async (abandonPending = false) => {
      const expectedState = state;
      if (abandonPending && confirmedState !== expectedState) {
        return;
      }
      try {
        await refreshSession();
        recover({ expectedState, ...(abandonPending ? { abandonPending: true } : {}) });
        setConfirmedState(null);
        log(
          abandonPending
            ? 'The app retired the local attempt. It did not cancel external authentication.'
            : 'The app checked its session. It requested recovery of the SDK interaction to idle.',
        );
      } catch {
        log(
          'The app did not recover the interaction. Check session access. Keep pending attempts until the app explicitly determines that retirement is safe.',
        );
      }
    },
    [refreshSession, recover, log, state, confirmedState],
  );

  useEffect(() => {
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void reconcileAndRecover();
      }
    };
    window.addEventListener('pageshow', restored);
    return () => window.removeEventListener('pageshow', restored);
  }, [reconcileAndRecover]);

  const hostError = () => log('The app could not check its local session.');
  return (
    <>
      <label>
        Integration{' '}
        <select
          value={mode}
          disabled={busy}
          onChange={(event) => setMode(event.target.value as Mode)}
        >
          <option value="popup">Existing-auth popup adapter</option>
          <option value="route">App-owned authPath</option>
        </select>
      </label>
      <ChatGPTSignInButton ref={button} aria-describedby="react-help" data-example="react" />
      <p id="react-help" className="hint">
        React owns this button. Its provider owns the interaction.
      </p>
      <p className="state" role="status">
        SDK interaction: {state.status}
        {state.status === 'error' ? ` (${state.error.code})` : ''}
      </p>
      <p role="status">{sessionLabel(session)}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ChatGPTProfilePicture size={48} alt="Demo account profile picture" />
        <span>
          {profile?.name ?? 'No profile available'}
          <small style={{ display: 'block' }}>
            {mode === 'popup'
              ? 'The adapter loads the profile automatically (local simulation).'
              : 'The authPath integration has no adapter session source.'}
          </small>
        </span>
      </div>
      <div className="actions">
        <button onClick={() => void refreshSession().catch(hostError)}>Check app session</button>
        <button onClick={() => void refreshSession(clearAppSession).catch(hostError)}>
          Clear demo session
        </button>
        <button onClick={() => void reconcileAndRecover()}>Check session, then recover</button>
      </div>
      <div className="notice">
        <label>
          <input
            type="checkbox"
            checked={allowRetire}
            disabled={state.status !== 'pending'}
            onChange={(event) => setConfirmedState(event.target.checked ? state : null)}
          />{' '}
          I checked the external popup and can safely retire this local attempt.
        </label>
        <button
          disabled={state.status !== 'pending' || !allowRetire}
          onClick={() => void reconcileAndRecover(true)}
        >
          Retire pending UI only
        </button>
        <p className="hint">
          The popup stays open and can still create a demo session. The SDK ignores its late
          outcome.
        </p>
      </div>
    </>
  );
}

function App() {
  const [mode, setMode] = useState<Mode>(() =>
    new URLSearchParams(location.search).get('mode') === 'route' ? 'route' : 'popup',
  );
  const [session, setSession] = useState<AppSession | null>(null);
  const [sessionReader] = useState(() => createSessionReader(setSession));
  const [events, setEvents] = useState<string[]>([]);
  const log = useCallback(
    (message: string) => setEvents((current) => [message, ...current].slice(0, 12)),
    [],
  );
  const refreshSession = sessionReader.refresh;
  const signIn = useMemo<ChatGPTAuthSignInConfiguration>(
    () =>
      mode === 'route'
        ? { authPath: '/demo/auth/start?consumer=react', onError: (error) => log(safeError(error)) }
        : {
            adapter,
            onSignInComplete: () => {
              log('The adapter reported completion. The app will check its session separately.');
              void refreshSession().catch(() => log('The app session check failed.'));
            },
            onCancel: () => log('The existing auth client reported cancellation.'),
            onError: (error) => log(safeError(error)),
          },
    [mode, log, refreshSession],
  );
  useEffect(() => {
    let active = true;
    void refreshSession().catch(() => {
      if (active) {
        log('The app session check failed.');
      }
    });
    return () => {
      active = false;
      sessionReader.invalidate();
    };
  }, [log, refreshSession, sessionReader]);

  return (
    <section className="card">
      <h2>React consumer</h2>
      <ChatGPTAuthProvider key={mode} options={signIn}>
        <Controls
          mode={mode}
          setMode={setMode}
          session={session}
          refreshSession={refreshSession}
          log={log}
        />
      </ChatGPTAuthProvider>
      <pre aria-label="Safe event log">{events.join('\n')}</pre>
    </section>
  );
}
createRoot(document.getElementById('app')!).render(<App />);
