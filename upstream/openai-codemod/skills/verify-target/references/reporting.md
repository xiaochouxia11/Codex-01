# Report independent target verification

Coverage, execution, and specialist children save their own
evidence and durable references on their issues. After all required children are
accepted, the parent synthesizes one report for the exact integrated candidate and
owns consolidated review using the [final verification report](../assets/target-verification.md).
Children do not create competing final reports; coordinating
eligible work while the parent is blocked does not permit premature synthesis.
Apply [current-content maintenance](../../codemod/references/records/artifacts.md#maintain-current-content)
to both child issues and the report.

## Checkpoint and resume

Save and read back substantive work on the owning child until parent synthesis is eligible.
Bind results to the accepted scope and criteria, approved behavior versions, target
commit/boundary, relevant guidance or accepted inline conventions, scenario/assertion
and harness, fixtures, configuration, actual application/runner, and original run time.
Use exact artifact commits or pre-publication content identities and verify published
bytes match executed bytes. A PR or moving branch alone does not identify a run.

Retain original per-test results and observations. Attribute reused CI or prior
evidence to its original run, revision, and coverage; do not claim it ran here.
Publish selected [UI evidence](../../codemod/references/records/artifacts.md#ui-screenshots)
on its owning child; final synthesis reuses those references.

On resume, compare substantive inputs. Changes to target code, contract, relevant
guidance or planned checks, assertions, fixtures, shared dependencies, or runtime
refresh affected checks; preserve superseded results as dated history. Reuse unaffected
evidence only with an explicit compatibility basis. Publishing unchanged executed
bytes or editing unrelated metadata does not require a rerun. Before final synthesis,
confirm required child acceptance and the same integrated candidate across execution
and reporting.

## Interpret results

The coverage child may report its map as `prepared` after required mapping is complete,
with any gaps recorded; this is not a target execution result. For each required
behavioral case, report passed, failed, blocked, not run, or unknown with expected and
observed behavior and supporting assertions. A pass cannot erase another required
failure or gap. Keep measurement-only quality findings separate from behavioral outcomes.

Use the [shared verification outcomes](../../codemod/references/independent-verification.md#report-the-result).

Required skipped, pending, unrun, unknown, or unassigned work remains unfinished.
Required specialist checks contribute to the technical outcome. Technical results
are distinct from native acceptance; separately owned migration work stays visible
without becoming a verification requirement or being declared complete.

## Reconcile verification completion

After required children are accepted, map each required behavior and verification-owned intent/brief
criterion to its technical result, owner, evidence, and disposition in
the final report's **Verification reconciliation** section. On resume, use equivalent evidence under earlier report headings.
Link existing coverage,
execution, and specialist findings rather than repeating them. Use met, pending,
blocked, accepted exception, or not applicable with an agreed basis. An empty required
set, missing owner, or unreadable evidence is a gap. Keep technical failures visible
even when an exception is accepted; changes to agreed outcomes or constraints require
their existing human approval.

The parent's agreed review accepts its verification and reconciliation; it does
not establish migration-wide completion. On an authorized acceptance follow-up,
reread changed criteria, native acceptance, and evidence, then refresh the same
section. The [default workflow](../../workflow/SKILL.md#reconcile-completion) uses
the result when reconciling completion across all owners. No new verification
report, universal human approval gate, or unrelated rerun is required.

## Repair and hand off

Record reproducible defects with expected and observed behavior, affected obligations,
candidate identity, and evidence. Route implementation defects through
[verification repair](records.md#refresh-and-repair); transform owns implementation and
its agreed review. Verification may repair its own isolated harness. Return behavior changes
to `codemod:behaviors` for human reapproval, and intent or criteria changes to
initialize or brief. Escalate unresolved ambiguity or high risk without changing the
approved contract.

Verify report association, evidence links, and issue reconciliation. Apply the agreed
review authority and [present saved work](../../codemod/references/records/presentation.md#present-saved-work),
opening the saved report or owning child issue as applicable.
For the final report, follow the [Git delivery handoff](../../codemod/references/records/presentation.md#git-delivery-handoff)
and [app handoff](../../codemod/references/records/presentation.md#try-the-migrated-app)
when applicable. Link the transformation report and return the exact verified candidate
and outcome to its owner for [destination PR readiness](../../transform/references/git-delivery.md#hand-off-the-full-migration).
If repairs changed the candidate, that owner also refreshes its report. Verification
does not manage the PR or duplicate issue audit histories; state any pending gap.
Describe only the covered target contract and candidate; do not infer source parity
or broader completion.
