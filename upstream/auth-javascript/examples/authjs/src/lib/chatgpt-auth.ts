import type { ChatGPTAuthSignInAdapter } from '@openai/auth';
import { signIn } from 'next-auth/react';
import { appSession } from './app-session';

/** Auth.js owns navigation, callback verification, CSRF protection, and the app session. */
export const chatgptAuth: ChatGPTAuthSignInAdapter = {
  async signIn() {
    await signIn('openai', { callbackUrl: '/' });
    // A redirect request is not proof that the user has an authenticated session.
    return { status: 'redirecting' };
  },
  session: appSession,
};
