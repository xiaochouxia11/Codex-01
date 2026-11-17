import { useSyncExternalStore } from 'react';
import type { ChatGPTAuthProfile } from '@openai/auth';
import { readSessionSource } from '../components/ChatGPTAuthProvider/ChatGPTAuthProvider.utils.js';
import type { ProviderController } from '../components/ChatGPTAuthProvider/ProviderController.js';
import type { ProviderBinding } from '../components/ChatGPTAuthProvider/ProviderController.types.js';

export function useProfileSession(
  binding: ProviderBinding,
  controller: ProviderController,
): ChatGPTAuthProfile | null {
  const snapshot = useSyncExternalStore(
    controller.subscribeSession,
    controller.getSessionSnapshot,
    controller.getServerSessionSnapshot,
  );
  // Hide the previous profile during render, before descendant layout effects run.
  // Core owns session reads; this identity check does not activate a new source.
  return snapshot.client === binding.client &&
    snapshot.source === readSessionSource(binding) &&
    snapshot.session.status === 'authenticated'
    ? snapshot.session.profile
    : null;
}
