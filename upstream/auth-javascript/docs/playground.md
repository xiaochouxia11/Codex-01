# Explore the UI playground

Use the playground to compare the DOM and React APIs. Inspect button variants and
try interaction outcomes without signing in. For smaller integration examples,
start with the [vanilla JavaScript and React examples](../examples/browser/README.md).

## Start a local simulation

Complete the [repository dependency setup](contributing.md#set-up-the-workspace).
Then run this command from the repository root:

```sh
pnpm playground
```

Open <http://127.0.0.1:4319/>. The default view uses a local adapter simulation.
It needs no OpenAI client or credentials.

The command builds the SDK and starts Vite on loopback. Stop it with Ctrl+C.
Restart `pnpm playground` after changing SDK source to rebuild the packages.
Playground UI changes refresh automatically.

## Try the controls

The DOM and React cards have independent sign-in clients. Buttons on each client
share interaction state.

| Try this                                                                                | What to observe                                                                                       |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Leave the adapter response on **Keep pending for a manual result**. Then start sign-in. | Both buttons in that card become pending. Complete, cancel, or fail the attempt using the controls.   |
| Start with the second button. Hide it. Then settle the attempt.                         | The remaining button receives the shared client's outcome.                                            |
| Select completion, cancellation, rejection, a synchronous throw, or an invalid result   | The interaction display and event log identify the result.                                            |
| Select redirect handoff                                                                 | The buttons stay disabled until the app reconciles the operation and recovers, or you reset the demo. |
| Reset while an attempt is pending. Then complete the old attempt.                       | The event log records the simulated settlement without callbacks from the destroyed client.           |
| Change the visual settings                                                              | Compare layout, sizing, locale, and profile presentation without using account data.                  |

Settings apply to the next attempt. Recovery after a pending operation requires an
explicit decision to retire that attempt. Retiring SDK state does not cancel the
external operation. Read [recovery semantics](recovery.md) before using that pattern
in an application.

## React events

On the React card, toggle `preventDefault()` and `stopPropagation()` independently:

- Preventing the default action blocks sign-in.
- Stopping propagation suppresses the parent click handler while sign-in still starts.
- Clicking the label or logo lets you compare `target` and `currentTarget`.
- Tabbing between buttons records focus and blur events in the log.

Reset clears the event controls and counters.

## Try a route-based flow

Open <http://127.0.0.1:4319/?flow=authPath>. The button navigates to a local route
that simulates an application-owned sign-in page. Choose an outcome. Return to
the playground. The app records the return. Navigation does not emit an SDK
completion callback.

The application must check its own session after a real flow.

These modes simulate outcomes and do not authenticate users. Use the
[Auth.js example](../examples/authjs/README.md) to integrate your registered client.

`pnpm playground:build` produces static assets only. Use `pnpm playground` for the
local development routes demonstrated here.
