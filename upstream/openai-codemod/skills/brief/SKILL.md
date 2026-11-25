---
name: brief
description: "Define target-stack guidance and prepare or revise a phased migration brief with queued implementation issues from accepted intent and reviewed evidence. Save the plan and work breakdown for mandatory human acceptance; do not start implementation."
---

# Prepare the migration brief

Turn the migration's established evidence into a scoped plan with clear
dependencies, behavior commitments, and verification criteria.
Follow [shared startup](../codemod/references/shared-startup.md) before beginning.
This skill owns target-stack guidance, additional planning subissues when warranted,
the brief, and its queued implementation breakdown; it does not replace the
assessment or alter approved behaviors.

## Prerequisites

Use accepted intent. Brief synthesis needs reviewed assessment evidence normally
produced by `codemod:assess`, current human-approved behaviors normally produced by
`codemod:behaviors`, and its required planning inputs. A focused guidance or
planning question needs only its applicable evidence. Apply the
[shared prerequisite rules](../codemod/references/records/README.md#prerequisite-evidence).

## 1. Resolve the work

Find the brief parent, its children, and migration resources through native
associations. Create or repair only the requested scope under the
[brief record specification](references/records.md).

For a child invocation, work only on that question using its relevant inputs.
For a brief-wide request, coordinate eligible children and continue as dependencies
resolve; leave the blocked synthesis parent untouched. A synthesis-only request
reads completed work without running children. The guidance child can run early
without inheriting the parent's assessment and behavior-catalog blockers.

Synthesis uses saved evidence; it does not need a source checkout or matching
runtime. Do not rerun checks, index source, configure environments, or build the target.

## 2. Establish guidance and resolve planning questions

Skip this section for synthesis-only requests. Run eligible **Define target-stack
guidance** work using the
[research and decision procedure](references/planning/target-stack-guidance.md). Combine
applicable customer and repository standards with current official target guidance
and suitable migration tools, then save the substantive **Target-stack guidance**
migration resource for reuse.

Use [additional planning children](references/records.md#additional-planning-children)
when a substantial question warrants independent investigation. Research within
the accepted decision authority; do not install tools or implement recommendations.
For significant target designs, use the conditional
[AI design-review procedure](references/planning/design-review.md) once a concrete proposal
exists, including proposals produced during synthesis. Its planning subissue records
technical review; human approval remains on the brief.

Use bounded read-only advisers when useful. They return advice and gaps; the
coordinator owns writes, reconciles conflicts, and follows the agreed review.

## 3. Synthesize the plan

Skip synthesis for a child-only invocation. Start it only when its native blockers
resolve. [Reconcile the current inputs](references/planning/migration-plan.md#reconcile-the-inputs),
then follow that planning procedure and the [brief template](assets/migration-brief.md)
to prepare a phased plan with verifiable criteria and explicit owners. Return stale
or conflicting evidence to its owning stage. Keep unresolved required planning
choices provisional; known execution gaps can be concrete phase prerequisites.

## 4. Prepare the implementation breakdown

Skip this section for child-only invocations. As part of preparing the plan,
create or reconcile its phase issues, bounded implementation subissues, and any
required phase verification/check issues in the **Migration** work group. Follow
[work planning](../transform/references/work-planning.md), [Git delivery](../transform/references/git-delivery.md),
and the canonical [execution record specification](../transform/references/records.md).
Cover the agreed scope with a practical breakdown; a partial draft leaves remaining
required planning open.

Queue required independent [phase verification](../transform/references/records.md#phase-verification-records)
separately from implementation. Transform owns later reconciliation of phase records;
report changes affecting final verification to its owning stage. Brief does not
create final-verification work.

Keep execution queued; the brief never depends on its own execution backlog.
Planning creates no branches, PRs, or implementation changes.

## 5. Save and review

For synthesis, follow [reporting and revisions](references/reporting.md). Keep the
authoritative plan in the selected report store and link it from the brief issue.
Child findings use their owning issue; reusable target-stack guidance stays in its
migration resource.

The initial brief and implementation breakdown require human acceptance; later
changes follow the [revision rules](references/reporting.md#refresh-without-inheriting-acceptance).
Acceptance alone does not start execution.

Run the [shared progress checkpoint](../codemod/references/records/lifecycle.md#progress-checkpoint)
before handoff. Open the saved guidance for that child, another planning child's
issue for its handoff, or the brief for synthesis. Report the completed scope,
material decisions, evidence limits, and review action. Stop before implementation.
