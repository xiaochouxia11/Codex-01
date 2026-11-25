# Save and maintain the migration brief

This reference governs synthesis; the [target-stack guidance procedure](planning/target-stack-guidance.md)
owns that child's resource and review. Follow the [shared record policy](../../codemod/references/records/README.md)
and [brief record specification](records.md).

## Create the brief when there is a draft

Create or reuse **System — Migration brief** at the first substantive draft
checkpoint under the [shared document rules](../../codemod/references/records/artifacts.md#create-documents-when-there-is-content).
Use the [brief template](../assets/migration-brief.md); preserve accepted plans and
dated evidence. An absent document before that checkpoint is expected. Keep early
coordination on the issue; the authoritative plan belongs in the selected report store.

## Complete the draft

[Reconcile current inputs](planning/migration-plan.md#reconcile-the-inputs) and retain the content
identities, source baseline, material relationships, coverage limits, and decision
provenance supporting the plan. Record applicable [graph evidence](../../codemod/references/codegraph.md#record-graph-evidence).
An issue update time, unchanged title, or Done state alone does not establish
technical freshness. Compare meaning when upstream evidence changes; formatting or
unrelated metadata alone need not invalidate a plan.

Keep the brief a concise approval document: scope, binding constraints, phase outcomes,
material risks, entry/exit criteria, verification ownership, and delivery decisions.
Link versioned behavior, design, guidance, and execution evidence rather than copying
it; keep detailed work instructions on implementation issues. Apply the
[planning boundary](planning/migration-plan.md#plan-the-agreed-migration) to distinguish
binding commitments from linked implementation approaches.

Confirm the issue's required planning coverage, approved behavior commitments,
resolved [required planning decisions](planning/migration-plan.md#plan-the-agreed-migration), acyclic dependencies, and observable
phase criteria. Reconcile the queued implementation breakdown and identify affected
verification obligations under the [brief procedure](../SKILL.md#4-prepare-the-implementation-breakdown).
Read back the document, issue scopes, criteria, associations, and native relations.
A partial draft identifies required unplanned work and cannot complete whole-migration
planning.

| Outcome | Meaning |
| --- | --- |
| `prepared` | Required planning coverage and its verified queued breakdown are complete and coherent; concrete execution prerequisites may remain as phase entry conditions. |
| `provisional` | A useful draft exists, but unresolved required planning decisions leave affected phases incomplete. |
| `blocked` | Missing required evidence or access prevents necessary planning. |
| `not_run` | Unstarted or incomplete. |

These outcomes describe planning, not acceptance or execution readiness. Do not
convert an undefined target or unresolved consumer contract into a vague entry
condition to label the plan prepared.

## Review and hand off

Update the brief issue with the outcome, input identities, unresolved work, and
verified links to the plan and queued breakdown. For a prepared plan, move the
issue to **awaiting review** and follow [Human action required](../../codemod/references/records/reviews.md#human-action-required):
apply the selected adapter's **User Required** marker and post an action comment
linking both deliverables, naming the reviewer when known, and explaining how to
request revisions or accept them. A human may mark the issue Done or explicitly
accept the current saved plan and breakdown in chat for Codex to record. Delegated
technical review cannot supply that acceptance; a provisional or partial draft
cannot complete the planning issue. Done does not start implementation or waive
its prerequisites.

Open the saved brief and report its approach, material gaps or entry prerequisites,
and review status under the [shared presentation rules](../../codemod/references/records/presentation.md#stage-outcome).

## Refresh without inheriting acceptance

Apply [finding classification](../../codemod/references/records/reviews.md#classify-findings-before-revising-agreements)
before reopening the brief. Within accepted phase boundaries and delegated authority,
the coordinator may adapt techniques, slice boundaries, dependencies, and check owners
on the owning issues without brief reapproval, provided agreed behavior, scope,
constraints (including architecture), entry conditions, exit criteria, and review/verification obligations remain
intact. Changes to these commitments or an explicitly binding design decision require
renewed acceptance; editing the saved breakdown alone does not. Retain required
phase-entry dependencies and capability/evidence prerequisites during dependency
refinement; removing, weakening, or replacing an accepted entry condition requires
renewed acceptance before affected execution resumes. Retain required
technical review and verification, and apply [transform reconciliation](../../transform/references/records.md#reconcile-changes).
For revisions requiring acceptance, preserve the prior
accepted plan, breakdown, input identities, and dated decisions; identify affected
phases, issues, and criteria, and verify which unaffected decisions remain usable.
Keep changed planning draft until a human accepts the revised plan and breakdown.
Retain stable IDs and successor references when needed.

Route upstream decisions to their owning stages. Reconcile the planned implementation
breakdown; keep affected work blocked by the unfinished current brief. Report changes
affecting verification to the owner of the [phase records](../../transform/references/records.md#reconcile-changes)
or [final records](../../verify-target/references/records.md#refresh-and-repair) before
relying on prior acceptance. Downstream work uses only the applicable accepted
plan version.
