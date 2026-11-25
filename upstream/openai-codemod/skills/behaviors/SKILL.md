---
name: behaviors
description: "Identify and verify migration-relevant source behaviors, save an evidence-backed catalog, and obtain human approval. Use to start, resume, or revise extraction, review saved behaviors, or record approval and corrections."
---

# Identify source behaviors

Describe migration-relevant behavior implemented by the source, with evidence
and coverage limits. These descriptions show what the implementation does; they do
not establish business intent. Human approval confirms the reviewed description;
accepted intent and target criteria determine what the migration should preserve
or change. Follow [shared startup](../codemod/references/shared-startup.md) and
[execution safety](../codemod/references/execution-safety.md).

## Prerequisites

Use accepted intent, accepted assessment evidence normally produced by
`codemod:assess`, and applicable source-access and relationship evidence normally
produced by `codemod:preflight`. Reviewing a saved catalog needs no source
checkout. Apply the [shared prerequisite rules](../codemod/references/records/README.md#prerequisite-evidence).

## 1. Select the requested work

Resolve the extraction issue, intent, assessment, and any catalog through their
native associations. Create or repair only requested work under the
[record specification](references/records.md). Honor native blockers and return
missing required evidence to its owning stage.

For review or approval, follow [behavior review](references/review.md) and stop after
that work. A disputed interpretation needing source inspection returns to its
package; do not infer a correction from feedback alone.

For extraction or source corrections, read the assessment inventory and check
[its freshness](../assess/references/reporting.md#reuse-an-assessment). Load the
applicable source, relationship, tooling, and execution evidence. Verify the
active source against the recorded repository and commit without advancing the
baseline. Use [source graph queries or equivalent relationship evidence](../codemod/references/codegraph.md#query-and-reuse-the-source-graph)
for the recorded source; target code cannot prove source behavior. Read the
[execution details](../codemod/references/records/artifacts.md#execution-environment-details)
and any existing extraction checkpoint.

## 2. Partition or resume

Reuse a current plan; a focused request goes directly to its eligible package.
When planning is needed, follow [partitioning and delegation](references/extraction/partitioning.md)
to define coherent responsibilities and account for coverage. Reuse compatible
results under [evidence reuse](references/reporting.md#identify-and-reuse-evidence).
Update the plan only when allocation changes.

The coordinator owns record and catalog writes. Workers inspect assigned evidence
and return findings without changing source or records. Use bounded native
subagents when useful, with a sequential fallback.

## 3. Extract and verify

Follow [source inspection and verification](references/extraction/inspect-and-verify.md)
and the [catalog template](assets/behaviors.md). Capture meaningful behavior
and compatibility obligations, with the context needed to interpret them. Reconcile
cross-package duplicates and conflicts, verify source citations, and distinguish
source review, tests actually executed, and human approval. Continue
eligible work within the requested scope.

## 4. Save and review

Follow [reporting and checkpoints](references/reporting.md) so compatible work
can resume. Account for dispatched workers and unfinished packages. A partial
catalog may receive scoped feedback; follow [behavior review](references/review.md)
for mandatory human approval once required technical work is complete. Agents may
verify and record decisions but cannot approve behaviors. Run
the [shared progress checkpoint](../codemod/references/records/lifecycle.md#progress-checkpoint)
before handoff.

Report the requested scope's outcome, review action, or blocker. Stop before
implementation planning, source changes, new tests, or remediation. Changes to
purpose or desired behavior return to initialize.
