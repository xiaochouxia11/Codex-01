# Target verification records

Apply the [shared record procedure](../../codemod/references/records/README.md#record-setup)
and the bound provider's [adapter](../../codemod/references/records/issue-systems.md#stage-adapters).
This specification owns whole-migration work in **Final verification**; native
hierarchy does not substitute for a blocker. Transform owns
[phase verification records](../../transform/references/records.md#phase-verification-records).

## Final verification placeholders

For a whole-migration request, create or reuse these queued records. For a focused
child request, create or repair only the parent, requested child, and applicable
verification-owned prerequisites. Match by migration, scope, and purpose. Queuing
records does not authorize execution, create an empty report, or approve behavior.

| Record | Template | Responsibility |
| --- | --- | --- |
| **Verify target behavior — Whole migration — System — Migration** | [Verification issue](../assets/verification-issue.md) | Coordinate, synthesize accepted child evidence for one integrated candidate, and own the consolidated report and review. |
| **Map final behavior and scenario coverage** | [Coverage child](../assets/final-coverage-issue.md) | Map approved obligations to assertions and explicit gaps. |
| **Run integrated target verification** | [Execution child](../assets/final-execution-issue.md) | Independently execute and challenge the accepted mapping. |

Make coverage and execution direct children of the parent. Apply the scoped upstream
blockers below to each record. Execution also depends on coverage; the parent
depends on both children. Neither child depends on its parent. Add a
[specialist child](../assets/specialist-issue.md) only when a required
[specialist check](execution.md#select-specialist-checks) warrants distinct work
or review. Give it only its actual prerequisites and make the parent depend on it.
Never nest children or introduce cycles.

Queue each record with its pending outcome. Add actual candidate and evidence
references when available and link newly known implementation blockers. Resolve
missing prerequisites before running the affected checks. The chat coordinator may work
eligible children while the parent is blocked; synthesis begins only after every
required child is accepted and refers to the same integrated candidate. Save the
parent's **System — Migration — Whole migration target verification** report only
when substantive synthesis is eligible.

## Dependencies and criterion ownership

Apply native **Blocked by** relations directly to each applicable verification issue:

- Current intent and Cloud setup when applicable, under the [common dependencies](../../codemod/references/records/README.md#technical-work-prerequisites).
- Current brief and behavior-catalog approval issues. Equivalent verified evidence
  follows the [shared prerequisite rules](../../codemod/references/records/README.md#prerequisite-evidence)
  without weakening mandatory human approval or bypassing actual blockers.
- Whole-migration execution and the parent depend on every required implementation
  aggregate and phase-verification issue once known. The coverage child depends on
  an implementation or phase outcome only when its mapping actually requires it;
  do not copy execution's blockers to coverage. Apply similarly scoped prerequisites
  to specialist children. Link known blockers during record-only setup; execution
  waits for the required acceptance.
- Concrete runtime, access, or fixture work needed by that verification. Do not use
  an unrelated whole-preflight or combined Build toolchain issue as a blanket gate.

Resolve undefined prerequisites before execution. Route missing upstream records to
their owners; verification does not fabricate implementation acceptance. Before relying
on prior results, reconcile affected final records, blockers, and evidence against
current planning and implementation. Remove only confirmed superseded relations, preserve unrelated
dependencies, and leave affected work open if reconciliation is blocked.

Transform owns phase implementation and verification; this stage owns whole-migration
verification criteria. Other outcomes retain their owners. Return unclear ownership
to brief. A draft brief must never depend on downstream implementation or verification.

## Refresh and repair

Apply [evidence reuse](reporting.md#checkpoint-and-resume). Reconcile blockers and
return affected verification to an existing unstarted state, even if previously Done;
preserve dated history and mark current evidence pending. Record refresh does not
authorize rerunning checks. For whole migration, reconcile affected child evidence and
the parent's result together. Reuse unchanged coverage only with an explicit
compatibility basis; changed required obligations return it for review. Reconcile the
[migration lifecycle](../../codemod/references/records/lifecycle.md#migration-lifecycle)
when current final work is reopened or added.

For target implementation defects, create or reuse bounded remediation tickets in
**Migration** under the [remediation record specification](../../transform/references/records.md#remediation-records).
Block affected final verification directly on required repairs and the applicable
[implementation records](#dependencies-and-criterion-ownership). Never block a repair
on the failed check it must unblock. Transform owns the repair and its agreed review.
A rerun requires authorization and verifies the exact repaired candidate for its scope. Link original
findings and repair artifacts; prior passes do not establish the repaired candidate's result.

## Hand off

Index the whole-migration parent in Final verification. Verify setup and use
[reporting](reporting.md) for results, review, and handoff.
