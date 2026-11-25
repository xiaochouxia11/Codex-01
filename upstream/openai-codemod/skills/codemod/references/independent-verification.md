# Independently verify an approved target contract

Use this method for an authorized phase, pilot, or whole-migration check. The
owning stage defines the scope, records, blockers, and stopping point. Verification
does not execute or compare the source.

## Bind scope and independence

Use a verifier who did not author the implementation. If the coordinator authored
it, delegate execution and judgment to a separate verifier with task-only context.
Give an independent worker
the approved obligations, exact accepted candidate and boundary, test and fixture
identities, assigned coverage, permitted verifier-owned paths, and [shared context](records/presentation.md#continuation-context).
The verifier inspects original evidence; implementation summaries are leads, not
conclusions. The coordinator retains shared record and publication ownership. If
independence is unavailable, leave required verification unfinished.

Bind approved behaviors, accepted criteria, relevant guidance, harness,
configuration, actual application and runner, and execution time. Confirm required
capabilities in the selected runtime; missing capability checks belong to preflight,
and environment changes belong to initialize. A checkout or moving branch alone does
not identify the running candidate. Isolate writable outputs and fixtures when using
parallel workers; otherwise serialize the work.

## Map, execute, and challenge

Follow [scenario guidance](behavioral-scenarios.md): independently map every
assigned approved obligation to a meaningful assertion or explicit gap. Inspect
the target and dependencies for missing paths, relevant journeys, permissions,
failure paths, side effects, and cross-component behavior. Current target output
is not an independent oracle. An approved requirement for source comparison needs
its approval owner's resolution; never silently substitute a weaker criterion.

Run the assigned checks on the bound candidate and inspect original assertion
results. Record observed outcomes, execution identity and time, and distinct
collected, executed, passed, failed, errored, skipped, pending, unrun, and unknown
counts. Challenge weak assertions and consequential boundaries. Verifiers may
repair isolated tests or harnesses in assigned paths, but never modify the
production candidate or weaken approved expectations.

For behavioral execution, demonstrate that a meaningful regression triggers the
intended assertion in an isolated copy. Restore and verify the original state even
after errors, rerun clean, and record the probe separately. A build failure alone
does not prove the assertion. Zero tests, blanket skips, missing expectations, and
unresolved observations cannot establish success.

## Report the result

Use the [verification report format](records/artifacts.md#verification-report-format).
Bind findings to exact candidate, test, fixture, configuration, runtime, and
original run identities; confirm published bytes match executed bytes. Preserve
dated history and reuse evidence only with an explicit compatibility basis. Changed
candidate or contract evidence needs affected checks refreshed; unrelated edits do
not require a blanket rerun.

Report `verified` only when all required scoped checks, coverage, controls,
and evidence meet the approved criteria; `limited` is for justified
optional limits after required work is complete. Otherwise report `failed`,
`blocked`, or `not_run`, with required failures taking precedence. Classify target,
contract, harness, and runtime findings separately. Technical results do not grant
native acceptance, prove source parity, or establish a broader scope.
