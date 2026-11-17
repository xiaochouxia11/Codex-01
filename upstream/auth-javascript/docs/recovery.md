# Interaction state and recovery

Use interaction state to display sign-in progress and offer a retry after a return
from an authentication flow. The SDK tracks the button's interaction. Your
application's authentication system remains the source of truth for the account
and session.

In particular, `complete` means your adapter reported completion. Read your
application's session before displaying authenticated content. A button configured
with `authPath` starts navigation and has no completion callback.

## Read interaction state

| `state.status` | Meaning                                        | Busy |
| -------------- | ---------------------------------------------- | ---- |
| `idle`         | Ready for a user to start sign-in              | No   |
| `pending`      | The adapter operation has not settled          | Yes  |
| `complete`     | The adapter reported completion                | No   |
| `cancelled`    | The adapter reported cancellation              | No   |
| `error`        | The SDK reported a sanitized error             | No   |
| `redirecting`  | Navigation or another external handoff started | Yes  |

Core clients expose `getSnapshot()` and
`subscribe(listener)`. A snapshot contains `{ busy, state }` and keeps the same
object identity until it changes. Use `state.status` to describe the interaction
and `busy` when coordinating controls. During outcome callbacks, `busy` can remain
true briefly to prevent a second attempt from starting inside the callback.

```ts
// auth is the client returned by createChatGPTAuth().
const unsubscribe = auth.subscribe(() => {
  const { busy, state } = auth.getSnapshot();
  // Update your application's progress or retry UI here.
});

// When your observer is no longer needed:
unsubscribe();
```

Unsubscribing removes only your listener. It does not destroy the button or client.

In React, call `useChatGPTSignInState()` inside `ChatGPTAuthProvider`. All buttons
under that provider share one interaction. The hook returns the state object, and
server rendering starts at `idle`.

```tsx
import { useChatGPTSignInState } from '@openai/auth-react';

export function SignInProgress() {
  const state = useChatGPTSignInState();
  return (
    <p role="status">
      {state.status === 'pending' || state.status === 'redirecting'
        ? 'Sign-in is in progress.'
        : state.status === 'error'
          ? 'Sign-in could not finish. Please try again.'
          : ''}
    </p>
  );
}
```

## Return an interaction to idle

An external handoff can leave a mounted button in `redirecting` after a user
returns to the page. To make it available again:

1. Read your application's session.
2. Check the external operation, including any popup or navigation still running.
   Decide whether another attempt is appropriate.
3. Call `recover()` on the client. In React, call the function
   returned by `useChatGPTSignInRecovery()`.

Recovery preserves the mounted controls and subscriptions. There is no automatic
recovery timer. Changing callbacks or configuration does not reset an attempt, and
returning to a page or reaching a timeout does not establish a signed-in session.

When session reconciliation is asynchronous, capture the current **state object**
before awaiting reconciliation. Pass that object as `expectedState`:

```ts
// Your application implements this function to check its session and external flow.
async function recoverAfterReturn(reconcileAuth: () => Promise<void>) {
  const expectedState = auth.getSnapshot().state;
  await reconcileAuth();
  auth.recover({ expectedState });
}
```

If the interaction changes during the await, recovery throws `stale_recovery` and
leaves the current attempt intact. Catch the error in your application's event
handler. Check the external flow again before another recovery attempt. Pass the
original state object, not a clone. Synchronous recovery with no intervening work
can omit this optional guard.

In React, capture the object returned by `useChatGPTSignInState()` in the same
way. The recovery function is stable between renders:

```tsx
import { useChatGPTSignInState, useChatGPTSignInRecovery } from '@openai/auth-react';

export function RecoveryButton({
  reconcileAuth,
  onRecoveryError,
}: {
  reconcileAuth: () => Promise<void>;
  onRecoveryError: (error: unknown) => void;
}) {
  const state = useChatGPTSignInState();
  const recover = useChatGPTSignInRecovery();

  async function handleRecovery() {
    const expectedState = state;
    try {
      await reconcileAuth();
      recover({ expectedState });
    } catch (error) {
      onRecoveryError(error);
    }
  }

  return (
    <button type="button" onClick={() => void handleRecovery()}>
      Check sign-in status
    </button>
  );
}
```

Render this component inside your provider. `reconcileAuth` and `onRecoveryError`
are application functions. `reconcileAuth` checks your session and external operation.
`onRecoveryError` displays a safe message if the session read or recovery fails.

If your application can issue overlapping session reads, also guard against an
older response replacing a newer session result. The core client guards this
ordering for reads through `adapter.session`. Your app must guard any other reads. `expectedState` protects the SDK interaction only.

## Recovering a pending attempt

Ordinary recovery throws `interaction_pending` while an adapter attempt is still
pending. Prefer waiting for it to settle. First, check the external operation.
If your application decides to retire the local attempt, pass both options:

```ts
async function retirePendingAttempt(reconcileAuth: () => Promise<void>) {
  const expectedState = auth.getSnapshot().state;
  await reconcileAuth();
  auth.recover({ expectedState, abandonPending: true });
}
```

This discards the old SDK attempt and ignores its eventual outcome and callbacks.
It **does not cancel external authentication**, close a popup, revoke credentials,
or undo server changes. A previously started flow can still create a session
later. Keep reconciling your application's session independently.

The `expectedState` guard also applies when abandoning a pending attempt, so a
slow check cannot retire a newer one. Recovery is unavailable inside the initiating
click handler, even with `abandonPending: true`.

## Browser back/forward navigation

When the browser restores a page from its back/forward cache, the page retains its existing
JavaScript and DOM. On `pageshow` with `event.persisted === true`, read the application session.
Check the external operation. Recover the existing interaction if appropriate. Avoid destroying and recreating the button merely to clear its busy
state. Do not automatically abandon a pending operation on restoration.

A full-page reload instead creates fresh UI. Read the application session during
startup to restore its signed-in state.

## Examples and diagnostics

The [browser example](../examples/browser/README.md) contains complete
[DOM](../examples/browser/src/vanilla.ts) and
[React](../examples/browser/src/react.tsx) implementations, including session-read
ordering, recovery, and back/forward cache handling. Its local authentication
service is a simulation for exploring UI behavior. Replace it with your existing
authentication system.

Use the SDK error's `code` and `retryable` fields for diagnostics and application
messages. Avoid recording provider exceptions, tokens, authorization callback
URLs, or auth payloads in logs. Errors thrown by your own application callbacks
remain your application's responsibility.
