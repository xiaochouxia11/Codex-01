---
name: transform
description: "Transform an approved migration phase in a different technology. Coordinate implementation, independent phase verification, and repairs, or perform a focused slice, implementation, verification, or repair."
---

# Transform a system

Implement and verify agreed behavior in the target stack. Follow [shared startup](../codemod/references/shared-startup.md)
and [execution safety](../codemod/references/execution-safety.md).

## Prerequisites

Use accepted intent, the current human-accepted brief normally produced by
`codemod:brief`, current human-approved behaviors normally produced by
`codemod:behaviors`, applicable phase or slice entry evidence, and verified target
capabilities. Apply the [shared prerequisite rules](../codemod/references/records/README.md#prerequisite-evidence).

## Resolve the requested work

Identify the accepted phase and requested scope. Its boundaries, approved behavior,
explicitly agreed target decisions, entry conditions, and exit criteria are binding. A request to
complete a phase includes its required implementation, independent phase verification,
repairs, and phase-exit reconciliation. A focused slice, implementation-only,
verification-only, or repair request stays scoped. Approval alone does not authorize
execution or changes to agreed outcomes or constraints.

For work that will change code, [verify the issue integration choice](references/git-delivery.md#verify-the-issue-integration-choice)
at the start, before creating issue branches or PRs or dispatching coding work.

Use the [record specification](references/records.md) to create or refine only the
transformation work in scope. Plan and coordinate eligible slices through
[work planning](references/work-planning.md); aggregate checks and synthesis wait
for their own blockers. For a repair, bind the defect to its affected candidate and
authorized correction. Handle agreed source updates through
[source synchronization](references/source-synchronization.md).

## Perform the requested transformation

Capture [work estimates and timing](references/work-burndown.md#record-work-evidence)
as work is planned and performed.

For a full phase, follow the [transformation loop](references/verification-loop.md).
It separates implementation and its development checks from an independent
verifier's judgment, then coordinates repairs and reverification within the phase.
For focused implementation or repair, follow the [implementation procedure](references/implementation.md)
and [Git delivery](references/git-delivery.md). For verification-only work, follow
the [phase verification record](references/records.md#phase-verification-records)
and [independent verification method](../codemod/references/independent-verification.md).
The coordinator integrates coding issues into their immediate parents under
Git delivery and records the actual history on each owning issue. Preserve native
blockers and agreed review authority.

## Report and stop

Follow [reporting](references/reporting.md) to save the exact candidate, implemented
scope, check and review results, deliberate differences, artifact links, gaps, and
affected separately owned obligations. Keep implementation evidence and independent
verification evidence distinct. Apply the agreed review
authority and [present the stage outcome](../codemod/references/records/presentation.md#stage-outcome).

Report phase exit only when all assigned criteria have current evidence and agreed
acceptance. Implementation alone does not establish phase exit; phase exit does not
establish whole-migration verification or migration completion. Return the scoped
result to the caller and stop without starting another step, merging the migration
branch into the destination, deploying, or cutting over.
