# Incorporate ongoing source changes

Follow the brief's incorporation policy, owner, and trigger. A moved source branch
is a candidate update, not permission to adopt it. A planned cadence does not
authorize background polling.

Compare exact old and proposed commits per repository across the source boundary
and relevant shared dependencies. Identify included, excluded, and unresolved
changes, their behavioral impact, and affected components, behaviors, scenarios, tests,
and target slices. Selective incorporation does not establish equivalence to all
behavior at the newer commit.

Preserve the accepted baseline and historical evidence until its revision is
accepted. Identify affected graph, assessment, behavior, and planning inputs for
their owners to refresh through the [input-refresh procedures](../../brief/references/planning/migration-plan.md#reconcile-the-inputs).
Establish compatibility before reusing unaffected evidence. Revised intent, approved
behaviors and the accepted brief remain upstream of target adaptations;
implementation does not approve a baseline or redefine behaviors.

Use the [synchronization record procedure](records.md#synchronize-source-changes)
for impact findings and bounded target adaptations. An update
requiring no target change can conclude in its owning revision work. Execute
required adaptations only after upstream revisions and normal prerequisites permit
them. Refresh affected implementation and phase-verification evidence against the
new candidate, and report separately owned checks that may be affected. Unrelated work may continue
only while its inputs remain valid and its blockers permit it.
