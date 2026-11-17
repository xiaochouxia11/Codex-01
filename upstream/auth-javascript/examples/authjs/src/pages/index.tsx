import {
  ChatGPTAuthProvider,
  ChatGPTProfilePicture,
  ChatGPTSignInButton,
  useChatGPTProfile,
  useChatGPTSignInRecovery,
  useChatGPTSignInState,
} from '@openai/auth-react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { refreshAppSession } from '../lib/app-session';
import { chatgptAuth } from '../lib/chatgpt-auth';

function Account() {
  const profile = useChatGPTProfile();
  const interaction = useChatGPTSignInState();
  const recover = useChatGPTSignInRecovery();
  const [recoveryFailed, setRecoveryFailed] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();
  async function recoverRedirect() {
    // This adapter has no popup. It already completed its navigation request.
    if (interaction.status !== 'redirecting' || checkingSession) {
      return;
    }
    setCheckingSession(true);
    try {
      await refreshAppSession(new AbortController().signal);
      recover({ expectedState: interaction });
      setRecoveryFailed(false);
    } catch {
      setRecoveryFailed(true);
    } finally {
      setCheckingSession(false);
    }
  }
  async function signOutOfApp() {
    setSignOutFailed(false);
    setSigningOut(true);
    try {
      await signOut({ callbackUrl: '/' });
    } catch {
      setSignOutFailed(true);
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <main>
      <h1>Sign in with ChatGPT</h1>
      <p>This example uses Auth.js for authentication and the OpenAI SDK for its sign-in UI.</p>
      <div className="account">
        <ChatGPTProfilePicture size={48} />
        <span>{profile?.name ?? 'Profile unavailable'}</span>
      </div>
      <ChatGPTSignInButton />
      <p role="status">Sign-in interaction: {interaction.status}</p>
      {(router.query.error || interaction.status === 'error' || recoveryFailed) && (
        <p role="alert">Sign-in could not finish. Start a new attempt when you are ready.</p>
      )}
      {interaction.status === 'redirecting' && (
        <button type="button" disabled={checkingSession} onClick={() => void recoverRedirect()}>
          Check session and enable sign-in again
        </button>
      )}
      <button type="button" disabled={signingOut} onClick={() => void signOutOfApp()}>
        Sign out of this app
      </button>
      {signOutFailed && <p role="alert">Sign-out could not finish. Try again.</p>}
      <p className="note">
        Profile availability does not determine authorization. Protected server routes must check
        the application session. Signing out here does not sign you out of ChatGPT.
      </p>
    </main>
  );
}

export default function Home() {
  return (
    <ChatGPTAuthProvider options={{ adapter: chatgptAuth }}>
      <Account />
    </ChatGPTAuthProvider>
  );
}
