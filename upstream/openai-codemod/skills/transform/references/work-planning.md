# Plan and coordinate transformation work

Use this guidance to prepare, refine, and coordinate transformation work. Save
implementation responsibilities through
[transformation records](records.md). Planning records do not authorize execution.

## Criterion ownership

Assign each brief exit criterion to slice implementation and development checks,
phase integration, independent phase verification, or a named external owner.
The coordinator resolves ownership within the accepted phase under
[work refinement](#refine-the-work), preserving every obligation. Acceptance
of implementation covers its own criteria; full phase exit requires all applicable owners. Never move unfinished
implementation criteria downstream merely to close them.

Coding issues integrate into their immediate parents under [Git delivery](git-delivery.md).
Aggregate integration checks follow acceptance of the input slices and cannot also
block their acceptance. If a slice needs cross-slice evidence first, assign that check to
an eligible slice or explicit predecessor. A check of an accepted implementation
cannot be a prerequisite for accepting that same implementation. Apply the
[record dependencies](records.md#dependencies-and-eligibility).

## Derive bounded slices

Use the phase scope, assessed components, applicable
[source relationships](../../codemod/references/codegraph.md#query-and-reuse-the-source-graph),
approved behaviors, interfaces, and criteria to identify independent
responsibilities. Choose slice count and detail from scope, coupling, and risk;
keep one bounded slice when division is unsafe. Specify source and target
boundaries, exclusions, contracts, relevant actor or journey IDs, test and
acceptance criteria, integration ownership, and unresolved evidence.

Behavior slices deliver target behavior and tests under the
[implementation procedure](implementation.md). Foundation-only slices use
[checks appropriate to their responsibility](implementation.md#foundation-only-slices)
and cannot satisfy their consumers' behavioral obligations. Give shared foundations
an owner and consumer dependencies; assign cross-slice contracts and journey checks
to a slice or aggregate integration.

## Pilot slices

Use the smallest representative pilot that resolves meaningful uncertainty. State
the risk or technique it tests, why it is representative, and the evidence required
for expansion. Use several pilots only for materially different risks.

Ordinary tests and review belong to the pilot slice. If independent verification
gates expansion, it needs a bounded candidate and must not wait on the work it is
meant to unblock. Follow the [pilot record procedure](records.md#pilot-slices).
Save evidence and lessons through [slice reporting](reporting.md#save-a-slice-result)
and carry reviewed patterns forward before dependent work starts.

## Coordinate implementation

During authorized execution, use native subagents for eligible, bounded work when
the contracts and write boundaries support independent progress. Respect actual
runtime and tool limits across all workers, including descendants. Isolate mutable
outputs and shared resources, or serialize the affected work. Work sequentially
when delegation is unavailable or adds little value.

Give each worker the [shared context](../../codemod/references/records/presentation.md#continuation-context),
exact issue and input identities, applicable source relationships and limits,
allowed paths, contract, checks, and required return evidence. Workers edit only
assigned paths. One phase coordinator owns shared files, Git changes, integration,
and tracker or report-store writes. It inspects results and waits for or stops active
workers before handoff.

A worker may subdivide its assignment when useful, within the same boundaries and
capacity limits. It returns one reconciled result to its assigning agent. Delegation
does not grant approval authority or determine
[Git ancestry](git-delivery.md#integrate-coding-issues).
Keep [independent verification](../../codemod/references/independent-verification.md)
separate from the implementation assignment and its descendants.

A separate Codex chat is useful for durable, separately owned work or a handoff.
Start one only when the user explicitly requests a new chat. Carry the shared context
and identify the assignment, phase coordinator, and return path; reconcile results
against the authoritative records. If coordination itself moves, hand it off
explicitly so the old and new chats do not concurrently own it.

## Refine the work

Use the [brief revision rule](../../brief/references/reporting.md#refresh-without-inheriting-acceptance)
for the coordinator's refinement authority and the threshold for renewed acceptance.
Follow the shared [escalation rules](../../codemod/references/records/reviews.md#autonomous-work-and-escalation)
for unresolved decisions; unaffected eligible work may continue within the request.

Reconcile affected transformation evidence and records under [reporting](reporting.md)
and [record reconciliation](records.md#reconcile-changes). Preserve accepted history;
prior results must establish compatibility with revised scope. Report affected
external obligations without changing their records.
