import type { ChatGPTAuthSignInState } from '@openai/auth';
import type { ChatGPTAuthRecoveryOptions } from '@openai/auth/client';
import { useId, useState } from 'react';

export function InteractionStatus({
  api,
  state,
  recover,
  onRecovered,
}: {
  api: 'dom' | 'react';
  state: ChatGPTAuthSignInState;
  recover: (options?: ChatGPTAuthRecoveryOptions) => void;
  onRecovered: () => void;
}) {
  const id = useId();
  const [confirmedState, setConfirmedState] = useState<ChatGPTAuthSignInState | null>(null);
  const checked = confirmedState === state;
  return (
    <div className="interaction-status">
      <div className="status-strip">
        <span>
          SDK state{' '}
          <strong className="state-badge" data-state={state.status} data-testid={`${api}-state`}>
            {state.status}
          </strong>
        </span>
        <span>{api === 'react' ? 'useChatGPTSignInState()' : 'auth.getSnapshot()'}</span>
      </div>
      {state.status === 'error' && (
        <p className="error-message" role="status">
          <code>{state.error.code}</code>
          {state.error.message}
        </p>
      )}
      {state.status !== 'idle' && (
        <fieldset className="react-event-controls">
          <legend>Host-controlled recovery</legend>
          <label className="react-event-option" htmlFor={id}>
            <input
              id={id}
              type="checkbox"
              checked={checked}
              onChange={(event) => setConfirmedState(event.target.checked ? state : null)}
              data-testid={`${api}-reconciled`}
            />
            <span>
              {state.status === 'pending'
                ? 'I checked the external state. Retire this pending attempt.'
                : 'I checked the external state. Another attempt is safe.'}
            </span>
          </label>
          <p>
            This simulates the app checking its external state. Recovery keeps the buttons mounted
            and does not cancel external authentication.
          </p>
          <button
            className="secondary-button"
            disabled={!checked}
            onClick={() => {
              recover(state.status === 'pending' ? { abandonPending: true } : undefined);
              setConfirmedState(null);
              onRecovered();
            }}
            data-testid={`${api}-recover`}
          >
            Recover {api === 'react' ? 'React' : 'DOM'} UI
          </button>
        </fieldset>
      )}
    </div>
  );
}
