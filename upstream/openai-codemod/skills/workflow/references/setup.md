# Prepare the default workflow records

Run this for a requested default migration after initialize establishes the
migration home and saves intent and execution choices. Reuse its existing intent
and any cloud setup issue. Apply [shared record setup](../../codemod/references/records/README.md#record-setup)
with the selected provider's native adapter and each stage's record specification.
This creates queued work; it does not accept intent, execute a stage, or create
empty reports. Keep technical unknowns open.

## Work groups

Create or reuse these groups through the selected provider, preserving existing
IDs, names, dates, and unrelated work:

| Work group | Description | Initial work |
| --- | --- | --- |
| Migration readiness | [Readiness](../assets/migration-readiness.md) | Intent and cloud setup when applicable; queued readiness work below. |
| Migration | [Migration](../assets/migration.md) | No initial execution issues; brief proposes implementation work for review. |
| Final verification | [Final verification](../assets/final-verification.md) | Queued whole-migration verification. |

Use native formatting and short links to actual key issues. Do not invent phase
issues or dates.

## Queue and reconcile work

Read each applicable issue template in full before drafting the batch. Read back
each saved technical issue and fill any gaps in its scope, steps, or required evidence.

Create or reuse the following records in Migration readiness, in this order, so
their cross-stage dependencies can be linked to known IDs:

| Skill | Record specification | Initial work |
| --- | --- | --- |
| Preflight | [Preflight records](../../preflight/references/records.md) | Parent and eight checks. |
| Assess | [Assessment records](../../assess/references/records.md) | Synthesis parent and four investigations. |
| Behaviors | [Behavior records](../../behaviors/references/records.md) | Parent and planning child. |
| Brief | [Brief records](../../brief/references/records.md) | Synthesis parent and target-stack guidance child. |

Then queue the [whole-migration verification parent and children](../../verify-target/references/records.md#final-verification-placeholders)
in Final verification. Brief may queue required phase verification during planning;
transform owns phase records and verify-target owns final records. Their respective
stages reconcile later changes and actual blockers.

Apply the shared [technical prerequisites](../../codemod/references/records/README.md#technical-work-prerequisites)
and each stage's specific dependencies directly to affected issues; native
parenthood does not transmit blockers. Read back associations and directed links,
check for cycles, and keep unresolved work queued. Link the known key issues and
Preflight checks from their owning groups or parent. A missing prerequisite is a
gap, not a completed stage.

On resume or requested repair, match by purpose and verified associations, retain
accepted results, and reconcile the dependencies required by the work in scope.
Do not duplicate the backlog, create missing downstream work outside the request,
or reopen accepted work merely to change names.
