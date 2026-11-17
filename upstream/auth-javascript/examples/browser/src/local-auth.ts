import type {
  ChatGPTAuthSignInAdapter,
  ChatGPTAuthSignInAdapterResult,
  ChatGPTAuthErrorInfo,
  ChatGPTAuthProfile,
} from '@openai/auth';

export type Consumer = 'vanilla' | 'react';
export interface AppSession {
  authenticated: boolean;
  simulated: true;
  profile: ChatGPTAuthProfile | null;
}

const sessionListeners = new Set<() => void>();
let observedSession: string | undefined;

function notifySessionChanged(session: AppSession, force = false): void {
  const signature = JSON.stringify(session);
  if (!force && signature === observedSession) {
    return;
  }
  observedSession = signature;
  for (const listener of sessionListeners) {
    listener();
  }
}

export async function readAppSession(signal?: AbortSignal): Promise<AppSession> {
  const response = await fetch('/demo/api/session', {
    credentials: 'same-origin',
    cache: 'no-store',
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) {
    throw new Error('The local app session endpoint is unavailable.');
  }
  const value: unknown = await response.json();
  if (
    !value ||
    typeof value !== 'object' ||
    !('authenticated' in value) ||
    typeof value.authenticated !== 'boolean' ||
    !('simulated' in value) ||
    value.simulated !== true
  ) {
    throw new Error('The local app session response is invalid.');
  }
  const profile = 'profile' in value ? value.profile : null;
  if (
    profile !== null &&
    (typeof profile !== 'object' ||
      !('subject' in profile) ||
      typeof profile.subject !== 'string' ||
      !('name' in profile) ||
      typeof profile.name !== 'string' ||
      !('picture' in profile) ||
      typeof profile.picture !== 'string')
  ) {
    throw new Error('The simulated profile response is invalid.');
  }
  return {
    authenticated: value.authenticated,
    simulated: true,
    profile: value.authenticated ? (profile as ChatGPTAuthProfile | null) : null,
  };
}

export async function clearAppSession(): Promise<AppSession> {
  const response = await fetch('/demo/api/session', {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error('Could not clear the local app session.');
  }
  const session = await readAppSession();
  notifySessionChanged(session, true);
  return session;
}

/** Initial, manual, completion, and clear requests share one guard. The guard rejects responses to earlier requests. */
export function createSessionReader(commit: (session: AppSession) => void) {
  let latest = 0;
  return {
    refresh(operation: () => Promise<AppSession> = readAppSession): Promise<AppSession> {
      const request = ++latest;
      return operation().then((session) => {
        if (request !== latest) {
          throw new Error('A newer app session request superseded this response.');
        }
        commit(session);
        notifySessionChanged(session);
        return session;
      });
    },
    invalidate() {
      latest++;
    },
  };
}

export function sessionLabel(session: AppSession | null): string {
  if (session === null) {
    return 'App session: not checked yet (local simulation)';
  }
  return session?.authenticated
    ? 'App session: present (local simulation). The simulation did not verify identity.'
    : 'App session: absent (local simulation)';
}

/** Log only SDK-selected fields. Never log provider exceptions, callback URLs, or credentials. */
export function safeError(error: ChatGPTAuthErrorInfo): string {
  return `SDK error: ${error.code}. retryable=${error.retryable}`;
}

type ExistingClientResult = 'authenticated' | 'dismissed' | 'handing-off';

/** Simulate an existing auth SDK locally, including its complete popup lifecycle. */
function openLocalAuthPopup(consumer: Consumer): Promise<ExistingClientResult> {
  const attempt = crypto.randomUUID();
  // Do not await before window.open. Preserve the original button's user activation.
  const popup = window.open(
    `/demo/provider?mode=popup&consumer=${consumer}&attempt=${attempt}`,
    '_blank',
    'popup,width=520,height=650',
  );
  if (!popup) {
    return Promise.reject(new Error('The browser blocked the demo popup.'));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (result?: ExistingClientResult) => {
      if (settled) {
        return;
      }
      settled = true;
      window.removeEventListener('message', message);
      clearInterval(closed);
      if (result) {
        resolve(result);
      } else {
        reject(new Error('The local auth client reported an error.'));
      }
    };
    const message = (event: MessageEvent<unknown>) => {
      if (event.origin !== location.origin || event.source !== popup) {
        return;
      }
      const data = event.data;
      if (
        !data ||
        typeof data !== 'object' ||
        !('source' in data) ||
        data.source !== 'local-auth-example' ||
        !('attempt' in data) ||
        data.attempt !== attempt ||
        !('result' in data)
      ) {
        return;
      }
      if (
        data.result === 'authenticated' ||
        data.result === 'dismissed' ||
        data.result === 'handing-off'
      ) {
        finish(data.result);
      } else if (data.result === 'error') {
        finish();
      }
    };
    window.addEventListener('message', message);
    // Observe an explicit popup close. This is not a timeout or automatic SDK recovery.
    const closed = window.setInterval(() => {
      if (popup.closed) {
        finish('dismissed');
      }
    }, 250);
  });
}

export function createLocalPopupAdapter(consumer: Consumer): ChatGPTAuthSignInAdapter {
  return {
    session: {
      async getSession({ signal }) {
        // The app session endpoint is the authority. A sign-in result is not session proof.
        // The demo simulates these fields.
        // Real adapters expose only verified claims that the user consented to share.
        const session = await readAppSession(signal);
        return session.authenticated
          ? { status: 'authenticated', profile: session.profile }
          : { status: 'unauthenticated' };
      },
      subscribe(onChange) {
        sessionListeners.add(onChange);
        return () => sessionListeners.delete(onChange);
      },
    },
    signIn() {
      return openLocalAuthPopup(consumer).then((result): ChatGPTAuthSignInAdapterResult => {
        switch (result) {
          case 'authenticated':
            return { status: 'complete' };
          case 'dismissed':
            return { status: 'cancelled' };
          case 'handing-off':
            return { status: 'redirecting' };
        }
      });
    },
  };
}
