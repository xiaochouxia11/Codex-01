const params = new URLSearchParams(location.search);
const consumer = params.get('consumer') === 'react' ? 'react' : 'vanilla';
const popup = params.get('mode') === 'popup';
const app = document.getElementById('app')!;
app.innerHTML = `<section class="card"><h2>Local auth provider simulation</h2>
  <p>The Complete demo sign-in button simulates the app's server creating a session. The simulation does not verify identity.</p>
  <div class="actions"><button id="complete">Complete demo sign-in</button>
  <button id="cancel">Cancel</button><button id="error">Simulate error</button>
  ${popup ? '<button id="handoff">Simulate redirect handoff</button>' : ''}</div>
  <p id="provider-status" role="status">This window can remain open while you retire the SDK's local attempt.</p></section>`;

async function settle(result: 'authenticated' | 'dismissed' | 'handing-off' | 'error') {
  for (const button of app.querySelectorAll('button')) {
    button.disabled = true;
  }
  try {
    if (result === 'authenticated') {
      const response = await fetch('/demo/api/session', {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!response.ok) {
        throw new Error('Local session simulation failed.');
      }
    }
    if (popup && window.opener) {
      window.opener.postMessage(
        { source: 'local-auth-example', attempt: params.get('attempt'), result },
        location.origin,
      );
      window.close();
    } else {
      location.assign(`/${consumer}?mode=route&returned=${result}`);
    }
  } catch {
    document.getElementById('provider-status')!.textContent =
      'The local server could not finish the simulation. Close this window. Start another attempt.';
    for (const button of app.querySelectorAll('button')) {
      button.disabled = false;
    }
  }
}
document.getElementById('complete')!.addEventListener('click', () => void settle('authenticated'));
document.getElementById('cancel')!.addEventListener('click', () => void settle('dismissed'));
document.getElementById('error')!.addEventListener('click', () => void settle('error'));
document.getElementById('handoff')?.addEventListener('click', () => void settle('handing-off'));

export {};
