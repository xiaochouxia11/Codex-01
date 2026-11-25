# Plan the agreed migration

Synthesize existing evidence and prepare its queued implementation breakdown;
do not repeat assessment or execute the plan. Use the recorded source boundary
for context and migration scope for changes. Reuse the assessment's
[actors and journeys](../../../assess/references/investigations/actors-and-journeys.md)
and technical flows; do not invent roles, goals, or new source behavior.
Default planning coverage is the whole agreed migration. For a requested pilot
or other partial draft, identify the covered parts and required work left unplanned;
a useful partial plan does not complete whole-migration planning or readiness.

Define outcomes, boundaries, constraints, and verification obligations without
overprescribing implementation details. Label proposed techniques as adaptable;
make a technique binding only when an agreed requirement or material constraint
requires it. Transform may refine implementation as evidence develops within those
commitments.
Identify binding design decisions with their requirement or constraint and authority.
Link detailed designs as proposed approaches; referencing or technically reviewing
them does not make every technique part of the approval contract.
Resolve choices that determine scope, feasibility, external contracts, or material
constraints before accepting affected phases. Seek the smallest targeted early check through
the existing stage owners only when an unresolved assumption could invalidate
those commitments. Otherwise record the uncertainty and leave implementation
detail to Transform; exhaustive characterization or a detailed design is not a
default prerequisite for brief acceptance.

## Reconcile the inputs

Read accepted intent, the assessed component inventory/connections/flows and
structural improvement opportunities, approved behaviors and relevant native
feedback, assessment's inventory of existing tests and evidence, reviewed target-stack
guidance and required planning-child findings, and relevant preflight findings. Check
[assessment freshness](../../../assess/references/reporting.md#reuse-an-assessment) and
[behavior evidence](../../../behaviors/references/reporting.md#identify-and-reuse-evidence).
Read current records rather than treating a Done upstream issue as proof of fresh
technical evidence. Missing or conflicting required analysis returns to its owning stage.

Inspect the relevant [source graph relationships](../../../codemod/references/codegraph.md#query-and-reuse-the-source-graph)
through source inspection, index queries, or saved evidence for the exact baseline,
not just its issue status or summary. Reconcile callers, dependencies, shared code,
and boundary crossings with assessed components and flows. Use that evidence to
choose phase/slice boundaries, sequencing, shared owners, and integration checks;
cite the relationships and confirming source evidence behind material
decisions. Preserve unresolved crossings as planning gaps rather than treating
disconnected graph regions as independent.

Carry forward completion criteria, code principles, maintenance/style expectations,
involvement and review limits, off-limits code, and external-consumer commitments.
Keep fixed decisions, preferences, recommendations, and unresolved choices distinct.
Make routine design choices within accepted decision authority; do not silently
choose a target stack or change business policy. Intent changes go to initialize;
changed behavior descriptions go to [codemod:behaviors](../../../behaviors/SKILL.md)
for user review.

Reference the [target-stack guidance](target-stack-guidance.md) resource and its
applicable conventions instead of repeating its standards in the brief. Map
relevant checks and review obligations to implementation or independent verification.
If a substantial unresolved question warrants independent investigation, use
[planning children](../records.md#additional-planning-children); keep ordinary brief
sections on the parent.

## Plan ongoing source development

Carry forward intent's source-development and incorporation policy. For a fixed
snapshot, state that later source changes are outside this migration unless the
agreement changes; do not infer a freeze of the source team's work.

When changes must be incorporated, name the reconciliation owner, source refs and
boundaries, trigger or cadence, included change types, conflict/selection authority,
and source cutoff for final verification. Record unresolved choices and their
impact. A cadence is a plan, not authorization to create background monitoring.
Selective incorporation needs explicit included changes and approved exclusions;
it does not establish equivalence to all behavior of the newer commit.

Link the existing input-refresh procedures above and the
[source synchronization procedure](../../../transform/references/source-synchronization.md).
Queue known target adaptations as bounded Migration slices; future updates are
added when identified. Keep upstream revisions with their owning stages. Final
verification must use the approved contract reflecting the agreed source cutoff and
cover all required incorporated changes, using existing phase and final dependencies.

## Describe the target and compatibility delta

Map affected source component IDs and contracts to proposed target responsibilities,
boundaries, and interfaces. Identify unchanged dependencies and data/state ownership.
For rewrites or rebuilds, justify the approach from intent, coupling, verification
evidence, and operational constraints; do not force a particular migration pattern.

Resolve material structural opportunities from assessment within the agreed scope.
For adopted improvements, use the existing source-to-target mapping to identify
target responsibilities and interfaces, then assign bounded slice work and
verification obligations. Preserve meaningful behavioral variants using approved
behaviors and assessed evidence; scanner similarity or dead-code candidates
alone cannot justify consolidation or removal. Explain retain-as-is, rejected,
and deferred recommendations in the existing scope/decision records, with their
reason and consequences. Carry forward material coverage gaps; do not copy scan
noise, create a cleanup quota, or rerun assessment during brief synthesis.

For version changes, build an applicable compatibility delta table: affected
component/API/dependency, observed usage, source/target versions, required change,
evidence, and uncertainty. Reuse the assessment and verify material support and
breaking-change claims against current official documentation. Include only changes
that reach this source; state coverage limits instead of copying generic checklists.
For other migrations, carry forward relevant interface, data, and runtime
compatibility constraints from assessment, with evidence for proposed responses.

Identify test harness/runtime incompatibilities before the product upgrade so the
plan provides usable target checks. Coordinate shared dependencies when
independent upgrades would break connected components. Make compatibility with
out-of-scope consumers an explicit requirement or unresolved decision; inaccessible
consumers are not evidence that breaking them is safe.

## Define the behavior contract

Summarize relevant assessed journeys and technical flows as short business
walkthroughs: actor/goal where known, trigger, meaningful steps/outcome, components,
and phases affecting them. Preserve ACT-*, JRN-*, and technical flow references;
link the assessment instead of copying its actor inventory. Keep current behavior
and desired migration outcomes distinct. Report material gaps to their owner.

Reference all required approved behavior IDs/versions and accepted target criteria.
Do not copy the catalog. State what must remain true and how each affected contract
will be checked, including programmatic or computer-use evidence where applicable.
Inventory existing evidence where useful; a complete executable scenario set is
not a prerequisite for planning. Transform develops slice-level checks using the
[shared scenario guidance](../../../codemod/references/behavioral-scenarios.md).

Carry forward applicable characterization needs from the assessment's
[behavioral evidence and verification table](../../../assess/assets/assessment.md#behavioral-evidence-and-verification).
These are recommendations to check a behavior, not source observations. In the
brief's existing behavior and verification contract, map each need to approved
behavior IDs/versions, the evidence gap and observable scope, the owning Transform
phase or slice, and whether the check is required or optional. Identify
source-execution prerequisites and existing evidence that may satisfy the need.
For each consequential boundary marked **Exact replication**, name a case that
would distinguish correct behavior from a plausible regression, link an attributable
source trace covering it, or record the evidence gap and decision owner. Assign
any required source observation to the responsible slice. [codemod:transform](../../../transform/references/implementation.md#establish-tests-before-implementing-behavior)
reuses attributable observations from prior source execution or captures new ones
from the fixed source baseline before implementing the affected behavior.

Plan reuse of tests, fixtures, and phase findings as inputs to
[final verification](../../../verify-target/references/execution.md#verify-the-whole-migration).
Final verification independently checks all required obligations on one integrated
candidate; phase passes do not establish final coverage.

Separate approved target changes from proposals and cite their intent decision.
Unapproved changes cannot define target expectations. If an accepted criterion
requires source comparison, return it to its approval owner for revision or
resolution; do not silently substitute a target-only criterion.

## Sequence bounded phases

Choose a direct migration or staged work based on the evidence, without forcing a
phase count, sizing labels, or speculative durations. Use stable phase IDs and
acyclic dependencies. Each phase must identify:

- Outcome, affected component IDs/source boundaries, interfaces, and exclusions.
- Execution path: `codemod:transform` for a bounded change to a different
  technology with implementation-owned checks, or an explicit alternative/unresolved
  delivery path. Same-technology uplifts and architecture rebuilds need their own
  path; do not route them to transform merely because it is available.
- Entry prerequisites and checkable exit criteria, with evidence for each.
- Coexistence/routing and data or state transitions, including ordering and owners
  of writes where old and new implementations overlap.
- Impact on known actors/journeys and validation against their named behaviors/scenarios,
  required review, and residual risks.
- Criterion ownership: slice implementation/development checks, transform integration,
  independent target verification, or another explicit owner. Distinguish what a
  later phase consumes: accepted implementation or independently verified behavior.
- Recovery or rollback conditions and actions; identify irreversible effects and
  unresolved recovery needs instead of promising a rollback that cannot work.

Use the smallest representative pilot when it resolves meaningful uncertainty;
follow [pilot design](../../../transform/references/work-planning.md#pilot-slices)
and queue its [slice record](../../../transform/references/records.md#pilot-slices).
Name the unit, explain what it tests, and state what enables expansion. Identify
findings that change agreed outcomes or constraints, such as a dependency requiring
an architecture change, a shared breaking change, or an unsupported data transition.
Refresh the affected plan after those findings rather than expanding from an
outdated pilot assumption. A harness or environment prerequisite may precede the
pilot. Avoid a trivial pilot that bypasses the risky boundary.

Include any needed migration-tool or technique trial in the representative slice
and link the proposed approach in target-stack guidance. Dependent slices wait
for the pilot and any verification required by the brief. Keep the brief independent
of the trial it schedules; no separate trial issue is needed when the slice owns it.

Target-runtime gaps may be concrete phase entry prerequisites; link required setup
to initialize's [environment workflow](../../../codemod/references/environments/README.md)
and capability proof to preflight. Configured tooling does not establish target
readiness or verified behavior.
Size the queued implementation breakdown to independently owned outcomes, explicit
boundaries, and checkable evidence. Block each slice only on prerequisites it needs,
including shared and cross-boundary requirements; leave independent work eligible
to run in parallel. Record explicit alternative delivery ownership for work outside
transform's supported scope; an unresolved path leaves the affected phase
provisional. Whole-migration planning includes a usable breakdown beyond any pilot.
Implementation acceptance precedes independent verification of its candidate.
Full phase exit requires every criterion assigned by the brief, including its
required independent verification. Preserve deployment,
cutover, or external requirements under explicit owners instead of silently dropping
them or making implementation depend on its own downstream verification.

## Check coherence

Reconcile phases and implementation issues with every affected component, crossing,
known journey, required behavior, and verification obligation. Look for dependency
cycles, shared changes scheduled independently, uncovered transitions, and criteria
that cannot be tested. Mark assumptions and decisions with consequences and the
evidence needed to resolve them.
Apply [AI design review](design-review.md) where warranted before finalizing the
plan. Incorporate completed findings; a material design change after review needs
an affected-scope recheck before the brief goes to its human approver.

Follow [reporting](../reporting.md) to save, reconcile the queued records, and review.
