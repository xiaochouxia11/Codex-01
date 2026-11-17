import type {
  ChatGPTAuthDelegatedSignInCompletion,
  ChatGPTAuthSignInAdapterResult,
} from '@openai/auth';

export interface RecordedReactEvent {
  listener: string;
  type: string;
  nativeType: string;
  currentTargetTag: string;
  currentTargetId: string;
  targetTag: string;
  targetId: string;
  synthetic: boolean;
  nativeMouseEvent: boolean;
  nativeFocusEvent: boolean;
}
export interface ReactFixtureState {
  calls: number;
  reconciliations: number;
  recoveryErrors: string[];
  completed: ChatGPTAuthDelegatedSignInCompletion[];
  cancelled: number;
  interactions: string[];
  events: RecordedReactEvent[];
  order: string[];
  activation: boolean[];
  popupOpened: boolean;
}
export interface ReactFixtureRefs {
  attachments: number;
  cleanups: number;
  nulls: number;
  callbackElementId: string | null;
  objectElementId: string | null;
}
declare global {
  interface Window {
    reactFixture: {
      state: ReactFixtureState;
      resolve(status: ChatGPTAuthSignInAdapterResult['status']): void;
      destroy(): void;
      finishReconciliation(): void;
      readRefs(): ReactFixtureRefs;
    };
  }
}
