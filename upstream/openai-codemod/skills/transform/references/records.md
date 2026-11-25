# Transformation records

Use the [shared record procedure](../../codemod/references/records/README.md#record-setup)
and the migration's bound provider adapter. This specification defines implementation
and independent phase-verification records in **Migration**. Brief may use it to
prepare a draft backlog; transform creates or reconciles its records within the requested scope.
Record setup does not authorize execution or accept the brief. Apply [work tracking](work-burndown.md#record-work-evidence)
to the phase's execution records in their owning templates.

## Establish the phase records

Match records by migration, stable brief phase ID, purpose, and slice scope; reuse
matching work and preserve its history. A phase aggregate uses the
[aggregate template](../assets/transformation-issue.md) and records the phase
identity, current draft or accepted brief, owned integration criteria, and
participating slices.
It is not itself an implementation slice. Link the phase report when substantive
synthesis exists under [reporting](reporting.md#aggregate-the-phase).

Create or reuse an aggregate and only the slices needed for the request. A direct
slice call may establish its parent without creating unrelated work or a blank phase
report. Separately owned obligations stay with their owners; report missing or
affected external records without modifying them. Preserve the brief's
[criterion ownership](work-planning.md#criterion-ownership).

## Create slice records

Derive bounded responsibilities through [work planning](work-planning.md#derive-bounded-slices)
and use the [slice template](../assets/slice-issue.md). Record a stable slice ID,
scope and source/target boundaries, behavior and journey references, planned checks,
entry and acceptance criteria, and integration owner. Keep draft work queued until
the human-accepted current brief, required approval evidence, and each item's own
prerequisites and blockers permit execution.

### Pilot slices

A [pilot](work-planning.md#pilot-slices) uses the same slice template. Record why it
is representative, the uncertainty it resolves, and the evidence required before
expansion. When independently verified pilot behavior is an agreed expansion gate,
preserve the bounded pilot scope and make dependent work wait on that gate. It must
not depend on the work it is intended to unblock. Establish the distinct
[verification record](#phase-verification-records) when required; do not duplicate
or silently waive it.

## Phase verification records

When required by the brief's phase or pilot scope, create or reuse one **Verify
target behavior — Phase — System — Migration** issue in **Migration** using the
[verification issue template](../assets/phase-verification-issue.md). Match by
migration, stable phase ID, verification scope, and purpose; qualify a pilot's
bounded scope. Keep the issue separate from the implementation aggregate and
preserve prior evidence. Brief may queue it during planning, but queuing neither
authorizes execution nor establishes a candidate or result.

Apply each issue's actual prerequisites and native blockers. Full-phase verification
depends on the accepted implementation aggregate; a pilot gate depends on its
accepted pilot slice, never the aggregate or the expansion it must unblock.
Dependent work waits directly on the required gate. Make affected verification
depend on any required repair and its applicable implementation record; never make
a repair depend on the failed check. Keep verification findings and acceptance
independent from implementation.

At the first substantive checkpoint, create or reuse **System — Migration — Phase
target verification** in the bound report store, qualifying a pilot scope when
needed. Follow the [verification report format](../../codemod/references/records/artifacts.md#verification-report-format),
link the report from the issue, and read back the saved evidence. Do not create
an empty report or duplicate a whole-migration final check as phase verification.

## Record Git delivery

Apply [Git delivery](git-delivery.md) to each coding issue, including repairs.
During brief planning, reference the issue integration choice in accepted intent and
record the proposed issue branch and immediate integration parent, with the owning
issue for a nested branch. Leave an unresolved choice open for transform. The phase
aggregate identifies the migration branch and destination and links participating
issues. Distinguish proposals from verified existing artifacts; setup creates no
branches or PRs.

Once a branch or PR exists, add **Git delivery history** to the coding issue's
Result and update it as integration proceeds. Record each actual integration approach, branch, and PR if applicable,
including unpublished, superseded, closed, or deleted artifacts: credential-free
repository identity, head and immediate base branch names, exact tested commit,
disposition, and resulting parent integration commit. Record a verified PR URL or
explicit publication gap when an issue PR is expected; for direct integration, record
that no issue PR was required rather than treating its absence as a gap.
Use immutable commit references; branch links alone may stop working after deletion.

Preserve meaningful retargeting, replacement, closure, or candidate changes with
the prior identity, reason, and successor where applicable. Keep historical
evidence distinct from current state, verify Git and PR facts, and read back saved
records. Unavailable values remain explicitly pending or unknown. Reports link
participating issues as the audit source instead of duplicating their histories.

## Dependencies and eligibility

Apply [technical prerequisites](../../codemod/references/records/README.md#technical-work-prerequisites),
the current brief and behavior-approval issues when tracked, and
[equivalent evidence rules](../../codemod/references/records/README.md#prerequisite-evidence)
to every affected item. Add direct native blockers for:

- Each slice's actual predecessor slices, shared foundations, and applicable
  prior-phase gates. Confirm required code reached the relevant integration parent;
  a native Done status alone is not proof of Git integration. If the accepted brief
  requires a verified prior phase, block affected work on that check; accepted
  implementation alone does not satisfy it.
- Concrete unfinished target setup, build, or test prerequisites on the work they
  affect. Proven target capability is not blocked by unrelated source-only gaps.
- Required slices and applicable phase entry prerequisites on the aggregate.

Parenthood does not transmit blockers. Never make a slice depend on its aggregate,
or an aggregate depend on its own downstream check. A missing blocker does not
satisfy a phase entry condition.
Keep brief approval upstream of the work it approves, and verify native relations
after writes. An eligible slice may integrate while the aggregate awaits other slices;
aggregate checks and synthesis wait for their own blockers. Escalate contradictory criteria
instead of removing requirements to make work runnable.

## Remediation records

For an authorized repair, create or reuse a bounded implementation slice under the
appropriate phase aggregate. Accept reproducible defects from any source within
approved scope; match by phase, affected contract or slice, and defect, grouping
failures with one correction. Record the observed failure and originating evidence,
exact affected candidate, required correction, allowed paths, and acceptance tests.
Clarify ambiguous implementation ownership before creating executable work.

Apply the repair's real upstream prerequisites. Preserve past evidence and return
affected implementation records to unfinished states where their accepted evidence
no longer applies. Make the aggregate depend on required repairs; never block a
repair on its own aggregate, itself, or the failed check it is intended to unblock.
Refresh affected phase verification evidence and report changed whole-migration
or other separately owned obligations to their owners.
Record setup alone does not authorize a code change.

## Reconcile changes

Before reusing prior results, compare current substantive inputs and evidence under
[reporting](reporting.md#refresh-and-hand-off). Within the requested transformation
scope, refine the backlog under [work planning](work-planning.md#refine-the-work)
without reopening unchanged brief acceptance. Preserve historical results, restore
affected implementation and phase-verification work to unfinished states when
evidence is stale, and update scope, coverage, native blockers, and Git references. Retain applicable IDs;
verify replacement coverage before removing superseded edges. Cancel obsolete work
through the bound provider's supported state, never by deleting history or marking
unrun work Done. Preserve unrelated dependencies and check for cycles.

Changes to accepted intent, behaviors, or brief outcomes require the owning human
decision before affected work resumes. Preserve native blockers and report any
affected external obligations, records, or evidence for their owners to reconcile;
do not modify those records. Use the [shared escalation rules](../../codemod/references/records/reviews.md#autonomous-work-and-escalation)
for unresolved decisions.

## Synchronize source changes

Follow [source synchronization](source-synchronization.md) for an accepted baseline
change. Create or reuse a **Synchronize source changes — Scope** slice only when
target adaptation is required. Record old and new source commits, accepted change
scope, affected components, behaviors, scenarios, and tests, the target adaptation,
and validation. Report any required baseline, behavior, or brief decisions to their
owners; their approval remains upstream of the implementation work that consumes it.
Apply normal blockers and [reconciliation](#reconcile-changes) to affected
transformation records.
