---
name: workflow
description: "Coordinate the default CodeMod migration workflow. Use to start, resume, or continue a migration, select eligible work, prepare its migration records, and hand off between skills."
---

# Coordinate the default migration workflow

Follow [shared startup](../codemod/references/shared-startup.md). Resolve the requested scope.
For a new migration, begin with initialize; honor an explicit request for a new
migration instead of resuming an older one. Reuse the selected provider, report
store, and verified migration home on resume.

| Step | Skill | Outcome |
| --- | --- | --- |
| 0 | [codemod:initialize](../initialize/SKILL.md) | Migration home, intent, and execution choices. |
| 1 | [codemod:preflight](../preflight/SKILL.md) | Source and execution readiness evidence. |
| 2 | [codemod:assess](../assess/SKILL.md) | Reviewed architecture, journeys, risks, and migration impact. |
| 3 | [codemod:behaviors](../behaviors/SKILL.md) | Source-backed behaviors for human approval. |
| 4 | [codemod:brief](../brief/SKILL.md) | Target guidance and a phased brief for human acceptance. |
| 5 | [codemod:transform](../transform/SKILL.md) | Implemented phase scope, required independent verification and repairs, and reconciled phase exit. |
| 6 | [codemod:verify-target](../verify-target/SKILL.md) | Independent whole-migration target verification. |

Before each workflow stage or phase, including transitions in this chat, read and
apply [progress-view stage entry](references/progress-view.md#stage-entry).
For a new migration, Initialize begins without a view and owns establishing the
migration home. Create and display the first view immediately once that home is
established, before subsequent substantial work or worker dispatch, following
[view startup](references/progress-view.md#start-or-resume).
Keep the view current during the stage by following the
[refresh checkpoints](references/progress-view.md#refresh).

[codemod:status](../status/SKILL.md) is available anytime and remains read-only.
Follow this order within the authorized scope, using each skill's own prerequisites
and native blockers; independent eligible work need not wait for an entire earlier
stage. Acceptance alone does not authorize another skill.

For a new default migration, run initialize, then [prepare workflow records](references/setup.md)
before handing off. At each stage change, read the selected skill's `SKILL.md` and
required reading before starting, including transitions in this chat. Use its outcome
to choose the next authorized step. Transform owns the work within step 5, including
its phase loop. Use the [handoff rules](references/handoffs.md)
when work must stop or move to another chat.

Before dependent work starts, the stage owner checks which requirements changed
and which results still apply. Keep affected work open until that check is complete.
At the full-migration implementation handoff, route destination PR publication to
transform; after final verification, return its candidate and outcome to transform
for [PR readiness](../transform/references/git-delivery.md#hand-off-the-full-migration).

## Reconcile completion

Workflow owns whole-migration completion. After final verification is accepted, or
an authorized follow-up affects completion, reconcile every required criterion in the
current accepted intent and brief with its owner, current evidence, and acceptance.
Include outcomes outside verification, such as documentation and handover; use the
complete work inventory and native states. Complete only when the final-verification
parent and all required current final work are accepted, and every criterion is met
or explicitly resolved by its approval owner. Missing or unowned obligations keep the
migration open; an accepted exception does not turn a failed check into a pass.
Record and apply the decision through the existing [lifecycle and update conventions](../codemod/references/records/lifecycle.md#progress-checkpoint),
linking evidence without creating another report. Completion does not merge the
destination PR or deploy.
