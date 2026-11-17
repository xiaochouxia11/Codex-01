import type { ChatGPTAuthSessionSource } from '@openai/auth';
import { toSdkSession } from './session.ts';

const listeners = new Set<() => void>();

/** The SDK reads the app session again after the app's explicit session check succeeds. */
export const appSession: ChatGPTAuthSessionSource = {
  async getSession({ signal }) {
    const response = await fetch('/api/auth/session', {
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    });
    if (!response.ok) {
      throw new Error('The app could not read the application session.');
    }
    return toSdkSession(await response.json());
  },
  subscribe(onChange) {
    listeners.add(onChange);
    return () => listeners.delete(onChange);
  },
};

export async function refreshAppSession(signal: AbortSignal): Promise<void> {
  await appSession.getSession({ signal });
  for (const listener of listeners) {
    listener();
  }
}
