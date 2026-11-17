import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ChatGPTAuthSession, ChatGPTAuthSignInAdapter } from '@openai/auth';
import {
  ChatGPTAuthProvider,
  ChatGPTProfilePicture,
  ChatGPTSignInButton,
  useChatGPTProfile,
} from '@openai/auth-react';

const storageKey = 'profile-browser-fixture';
const saved = sessionStorage.getItem(storageKey);
let session: ChatGPTAuthSession = saved
  ? (JSON.parse(saved) as ChatGPTAuthSession)
  : { status: 'unauthenticated' };
const listeners = new Set<() => void>();
let failRead = false;
function update(next: ChatGPTAuthSession, notify = true) {
  session = next;
  sessionStorage.setItem(storageKey, JSON.stringify(session));
  if (notify) {
    for (const listener of listeners) {
      listener();
    }
  }
}
const adapter: ChatGPTAuthSignInAdapter = {
  async signIn() {
    // No change notification: completion must trigger the provider's session read.
    update(
      {
        status: 'authenticated',
        profile: {
          subject: 'ada',
          name: 'Ada',
          picture: `${location.origin}/profile-picture.svg`,
        },
      },
      false,
    );
    return { status: 'complete' };
  },
  session: {
    async getSession({ signal }) {
      signal.throwIfAborted();
      if (failRead) {
        throw new Error('Simulated session read failure');
      }
      return session;
    },
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  },
};
function Account() {
  const profile = useChatGPTProfile();
  const [customFallback, setCustomFallback] = useState(false);
  return (
    <>
      <ChatGPTSignInButton />
      <div id="picture-slot">
        <ChatGPTProfilePicture
          size={48}
          alt="Account picture"
          fallback={customFallback ? <span>Custom fallback</span> : undefined}
        />
      </div>
      <output data-testid="profile">{profile ? JSON.stringify(profile) : 'No profile'}</output>
      <button onClick={() => update({ status: 'unauthenticated' })}>Sign out</button>
      <button
        onClick={() =>
          update({ status: 'authenticated', profile: { subject: 'grace', name: 'Grace' } })
        }
      >
        Switch to account without picture
      </button>
      <button
        onClick={() =>
          update({
            status: 'authenticated',
            profile: {
              subject: 'lin',
              name: 'Lin',
              picture: `${location.origin}/missing-profile-picture.png`,
            },
          })
        }
      >
        Switch to broken picture
      </button>
      <button onClick={() => setCustomFallback(true)}>Use custom fallback</button>
      <button
        onClick={() => {
          failRead = true;
          for (const listener of listeners) {
            listener();
          }
        }}
      >
        Fail session read
      </button>
    </>
  );
}
createRoot(document.getElementById('profile-root')!).render(
  <ChatGPTAuthProvider options={{ adapter }}>
    <Account />
  </ChatGPTAuthProvider>,
);
