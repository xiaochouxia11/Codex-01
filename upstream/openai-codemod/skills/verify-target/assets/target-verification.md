# Whole-migration target verification

## Summary

{{Lead with the technical outcome, exact integrated candidate, scope, and any
required failures or gaps. Name the independent verifier. Link the accepted brief,
approved behaviors and target changes, and accepted implementation evidence.}}

## Run evidence

{{Link the coverage child's assertion map and the execution and specialist
children's original evidence for this candidate. Include the collected, executed,
passed, failed, errored, skipped, pending, unrun, and unknown counts. Summarize
the regression probe, restoration, and clean rerun. Link shared run context,
original observations and selected UI evidence using the
[shared evidence format](../../codemod/references/records/artifacts.md#verification-report-format).}}

## Verification reconciliation

{{Use one row per required behavior or verification-owned criterion. Reference
overlapping criteria on the same row when their evidence and disposition match.
Follow the [verification reporting rules](../references/reporting.md#reconcile-verification-completion).
Expand failures, mixed outcomes and gaps with their assertion, observed effect,
and repair or decision.}}

| Behavior / version or criterion | Technical outcome | Owner and evidence | Acceptance, exception or next action |
| --- | --- | --- | --- |
| {{Approved obligation and any agreed change.}} | {{Current result, including required failures or missing cases.}} | {{Owning issue and precise assertion, run or specialist finding.}} | {{Disposition, decision reference or outstanding action and owner.}} |

**Verification completion:** {{State which required criteria remain open or link
the decision resolving them. Preserve the technical result of an accepted exception.}}

## Findings and handoff

**Delivery history:** {{Reference the transformation report and its participating
issues under the [shared handoff rules](../../codemod/references/records/presentation.md#git-delivery-handoff).
The issue records own their integration histories; do not duplicate them here.}}

**Destination PR:** {{Verified migration-branch → destination-branch PR link and
status, or the specific publication gap if full-migration handoff is due.}}

**Try the migrated app:** {{For a runnable application, follow the [shared app handoff](../../codemod/references/records/presentation.md#try-the-migrated-app).
Omit when not applicable.}}

{{Identify separately owned migration outcomes and any difference between the tested
candidate and the current PR head. Apply the agreed review and handoff.}}
