# Implement a transformation slice

Follow the human-accepted brief, approved behaviors, source boundaries, entry
criteria, and [shared execution safety](../../codemod/references/execution-safety.md).
Resolve scoped record gaps through [transformation records](records.md), and
refine the breakdown within agreed scope using [work planning](work-planning.md#refine-the-work).
Do not work around unmet prerequisites or change agreed outcomes or constraints.

## Foundation-only slices

For a build configuration, shared test harness, or other foundation, define
executable checks for its responsibility before coding. Check a build configuration
by building it; validate a new or materially changed shared test harness under the
[failing-control rules](#prove-the-behavior-and-the-checks). Apply normal independent
review and acceptance. Foundation checks cannot replace consumer behavior tests, a
representative behavioral pilot, or separately owned phase criteria.

## Establish the execution and behavior contract

Read the accepted brief, approved behavior versions, existing tests and fixtures,
and applicable source and target readiness evidence. Confirm required target
capabilities in the selected runtime; report stale or missing prerequisites to
their owner. Identify the fixed source baseline, target revision, actual running
application, dependencies, fixtures, and configuration. A checkout alone does not
identify an already-running application.

Inspect the slice's [source graph neighborhood](../../codemod/references/codegraph.md#query-and-reuse-the-source-graph)
using direct inspection, queries, or recorded evidence for the fixed baseline. Confirm material
relationships in source or configuration and use them to check write boundaries,
shared ownership, consumer impact, and integration or regression coverage. Validate
the index's source identity before querying. Graph structure does not prescribe
target design or test expectations; never overwrite source evidence with a target index.

## Establish tests before implementing behavior

Follow the shared [scenario guidance](../../codemod/references/behavioral-scenarios.md).
Before implementing behavior, honor any characterization required by the accepted
brief and reuse or develop target checks with expectations derived from the approved
contract. Map every required behavior or criterion owned by this slice to
tests, including relevant boundaries, errors, ordering, side effects, and external
consumers. Record test and fixture identities separately from implementation
changes, and follow any agreed test-review checkpoint.

When the accepted brief calls for characterization, reuse attributable source
evidence that covers the agreed cases or capture controlled cases from the fixed
source baseline before implementing the affected target behavior. When executing
source, confirm the running source identity, use synthetic or authorized sanitized
inputs and isolated state, and do not change source. Keep reusable case data
independent of stack-specific invocation. Do the work in the assigned slice; use a
foundation slice only when a shared harness warrants one.

Record inputs and initial state, actual outputs, errors or side effects, any
normalization, and the source revision, runtime and run identity. Reconcile
observations against the approved contract before using them to support target
expectations; observations alone do not approve behavior. Route contradictions or
material changes to the approval owner. Link source observations and target checks
separately from the slice result using their case, fixture and run identities.
Leave affected work unfinished if required characterization is unavailable; record
optional limits without blocking unrelated work.

## Apply migration tools and prior lessons

Read the selected approaches and reviewed patterns in the
[target-stack guidance](../../brief/references/planning/target-stack-guidance.md#select-migration-tools).
Check their assumptions against this slice and honor pilot and expansion criteria.
Use the prepared tool on the slice. For a rewrite, preview the proposed diff
or apply it to a disposable copy. Check the match boundaries and shared files,
apply the change within the assigned paths, and run the slice's agreed checks.
Use a separate fixture only if the diff and those checks leave a specific risk
unresolved, such as a similar construct that must keep its original behavior.
Keep reusable recipes in Git. Link the tool version, recipe, and resulting diff
from the slice result, along with any material manual corrections.

## Implement the target idiomatically

Apply the accepted brief's target conventions, reviewed patterns, and exceptions
within their evidenced scope. Cite the applicable resource and content identity;
accepted inline conventions remain usable without a separate document. Preserve
semantics such as arithmetic, encoding, ordering, nulls, and transactions without
copying source structure mechanically. Refine internal design under
[work planning](work-planning.md#refine-the-work).

For delegated work, follow [implementation coordination](work-planning.md#coordinate-implementation).

## Prove the behavior and the checks

Run fast, focused unit tests for the slice's owned criteria by default. When an
accepted criterion requires more, or a material boundary cannot be established by
unit tests, add the smallest supported integration or other observable check. Use the
supported runner and follow applicable browser or computer-use skills for UI actions.
Record actual results; distinguish collected from executed cases when counts are
available. Missing expectations or fixtures, zero-case runs, and blanket skips cannot
count as passing. Leave whole-migration independent
verification to [codemod:verify-target](../../verify-target/SKILL.md).

Require a meaningful failing control only when a new or materially changed shared
test harness needs validation, an accepted criterion requires it, or a specific
material risk leaves assertion effectiveness unproven. Run it once at the affected
mechanism's scope, or reuse credible evidence that satisfies the criterion and covers
the unchanged mechanism and relevant assertions. For a new control, use an isolated
copy and require the intended assertion to fail; a build or import failure is
insufficient. Restore original state even after an error, verify restoration, rerun
the real cases, and record the control separately from real failures. Strengthen
checks that fail to detect it.

Diagnose implementation, harness, and expectation failures separately. Never weaken
approved expectations to make checks pass. Report contradictions in approved inputs
to their owner for resolution and required review. Missing assertions, unresolved
required mismatches, and unavailable required tests keep the slice unfinished.

## Review and integrate

For UI slices, inspect the tested states and publish
[UI screenshots](../../codemod/references/records/artifacts.md#ui-screenshots)
with the accepted visual criteria. Obtain independent code review from an available
review facility or a separate bounded, read-only reviewer. Include architecture fit,
behavior traceability, target conventions, and assertion quality. Record reviewer
independence and reviewed and tested revisions; resolve required findings, rerun
affected tests, and renew review after material fixes. Missing required review stays
open; acceptance follows the agreed authority.

Assign each necessary cross-slice check to one owner and run it before dependent
work relies on the boundary. Isolated passing tests do not establish required shared
contracts or state transitions. The coordinator integrates coding issues through
[Git delivery](git-delivery.md), then saves the issue's delivery history under
[reporting](reporting.md). Attach created PRs
to the task when supported. Return the implementation result to the transform
coordinator. An
implementation-only request stops here; a full-phase request continues through
the [phase loop](verification-loop.md). Implementation acceptance alone does not
establish phase exit, destination merge, deployment, or cutover.
