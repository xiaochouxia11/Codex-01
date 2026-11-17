import { createChatGPTAuth, type ChatGPTAuthClient } from '@openai/auth/client';
import type { ChatGPTAuthSignInState } from '@openai/auth';
import {
  createLocalPopupAdapter,
  createSessionReader,
  clearAppSession,
  safeError,
  sessionLabel,
} from './local-auth.js';

const app = document.getElementById('app')!;
app.innerHTML = `<section class="card"><h2>Vanilla JavaScript consumer</h2>
  <label>Integration <select id="mode"><option value="popup">Existing-auth popup adapter</option><option value="route">App-owned authPath</option></select></label>
  <div id="sign-in"></div><p id="interaction" class="state" role="status"></p>
  <p id="session" role="status">Checking the app's session…</p>
  <p id="sdk-session" role="status"></p>
  <div class="actions"><button id="refresh">Check app session</button><button id="clear-session">Clear demo session</button>
  <button id="recover">Check session, then recover</button></div>
  <div class="notice"><label><input id="allow-retire" type="checkbox" /> I checked the external popup and can safely retire this local attempt.</label>
  <button id="retire" disabled>Retire pending UI only</button><p class="hint">The popup stays open and can still create a demo session. The SDK ignores its late outcome.</p></div>
  <pre id="events" aria-label="Safe event log"></pre></section>`;

const mode = document.getElementById('mode') as HTMLSelectElement;
mode.value = new URLSearchParams(location.search).get('mode') === 'route' ? 'route' : 'popup';
const allowRetire = document.getElementById('allow-retire') as HTMLInputElement;
const retire = document.getElementById('retire') as HTMLButtonElement;
const events: string[] = [];
const log = (message: string) => {
  events.unshift(message);
  document.getElementById('events')!.textContent = events.slice(0, 12).join('\n');
};
const sessionReader = createSessionReader((session) => {
  document.getElementById('session')!.textContent = sessionLabel(session);
});
const refreshSession = sessionReader.refresh;
const hostError = () =>
  log('The app could not check its local session. It did not recover the interaction.');
const adapter = createLocalPopupAdapter('vanilla');
let auth: ChatGPTAuthClient;
let unsubscribe: (() => void) | undefined;
let unsubscribeSession: (() => void) | undefined;
let confirmedState: Readonly<ChatGPTAuthSignInState> | undefined;

function renderState() {
  const { busy, state } = auth.getSnapshot();
  document.getElementById('interaction')!.textContent =
    `SDK interaction: ${state.status}${state.status === 'error' ? ` (${state.error.code})` : ''}`;
  mode.disabled = busy;
  allowRetire.checked = confirmedState === state && state.status === 'pending';
  allowRetire.disabled = state.status !== 'pending';
  retire.disabled = state.status !== 'pending' || !allowRetire.checked;
}
function mount() {
  unsubscribe?.();
  unsubscribeSession?.();
  if (auth) {
    void auth.destroy();
  }
  auth = createChatGPTAuth(
    mode.value === 'route'
      ? { authPath: '/demo/auth/start?consumer=vanilla', onError: (error) => log(safeError(error)) }
      : {
          adapter,
          onSignInComplete: () => {
            log('The adapter reported completion. The app will check its session separately.');
            void refreshSession().catch(hostError);
          },
          onCancel: () => log('The existing auth client reported cancellation.'),
          onError: (error) => log(safeError(error)),
        },
  );
  auth.mountSignInButton(document.getElementById('sign-in')!);
  unsubscribe = auth.subscribe(renderState);
  const renderSession = () => {
    const { status, profile } = auth.getSessionSnapshot();
    document.getElementById('sdk-session')!.textContent =
      `SDK session source: ${status}${profile?.name ? ` (${profile.name})` : ''}`;
  };
  unsubscribeSession = auth.subscribeSession(renderSession);
  renderSession();
  renderState();
}

async function reconcileAndRecover(abandonPending = false) {
  const current = auth;
  const expectedState = current.getSnapshot().state;
  if (abandonPending && confirmedState !== expectedState) {
    return;
  }
  try {
    await refreshSession(); // The app's authority, not SDK `complete`, determines its session.
    if (current !== auth) {
      return;
    }
    current.recover({ expectedState, ...(abandonPending ? { abandonPending: true } : {}) });
    confirmedState = undefined;
    renderState();
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
}

mode.addEventListener('change', mount);
allowRetire.addEventListener('change', () => {
  confirmedState = allowRetire.checked ? auth.getSnapshot().state : undefined;
  renderState();
});
document
  .getElementById('refresh')!
  .addEventListener('click', () => void refreshSession().catch(hostError));
document
  .getElementById('clear-session')!
  .addEventListener('click', () => void refreshSession(clearAppSession).catch(hostError));
document.getElementById('recover')!.addEventListener('click', () => void reconcileAndRecover());
retire.addEventListener('click', () => {
  if (allowRetire.checked) {
    void reconcileAndRecover(true);
  }
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    void reconcileAndRecover();
  } // Never automatically abandon a pending attempt.
});
mount();
void refreshSession().catch(hostError); // Includes ordinary full-page returns, which create a fresh UI.
if (new URLSearchParams(location.search).has('returned')) {
  log(
    'The app returned from its sign-in route. It will check its session. This navigation does not imply SDK completion.',
  );
}
