# Define target behavior scenarios

Use this guidance for transformation development checks and independent target
verification. The current approved behaviors and accepted target criteria define the
contract; neither current source output nor current target output defines an
expected result. Source analysis and existing evidence can inform coverage, but
target conformance does not establish source-to-target parity.

Within the assigned scope, map required behavior IDs and versions, accepted criteria,
and relevant assessed actor/journey or technical-flow IDs to scenarios or explicit
gaps. Include normal, boundary, error, permission, ordering, cross-component, and
side-effect behavior where material. A scenario may cover multiple obligations; a
behavior tag, matching test name, or passing suite alone does not prove assertion
coverage. Do not require a complete executable scenario set before preparing the brief.

For each scenario, retain a stable ID, contract references, initial state and
fixtures, concrete typed inputs and actions, expected outputs/state/events/errors
and prohibited effects, and the assertions or reproducible runbook that checks
them. Record how a check invokes the target separately from its behavioral
expectation. Link reusable tests and fixtures from their Git revisions or
originating tool; inventory existing assets before adding new ones.

Derive expected values independently from the approved contract and attributable
supporting evidence. Keep accepted target changes explicit. Never generate expected
snapshots from the target's current output or copy its implementation into an
assertion. Document necessary units, rounding, narrow tolerances, and deterministic
controls; do not weaken expectations to hide failures. A behavior without enough
detail for a defensible expectation returns to [codemod:behaviors](../../behaviors/SKILL.md);
changes to accepted
scope or criteria return to their approval owner.

Use the repository's existing test conventions and supported runtime. Choose an
appropriate programmatic, browser, or computer-use method for the behavior. Use
synthetic or authorized sanitized fixtures and isolate mutable state under
[execution safety](execution-safety.md). Screenshots without reproducible actions
and assertions support review but do not prove behavior.

For executed checks, bind the exact candidate, test/harness and fixture identities,
configuration and actual runner, command or actions, original execution time,
assertion results, and observations. Keep required missing, skipped, blocked, or
unrun cases visible. Link development-check evidence from the owning transformation
work item. For independent verification, use the
[verification report format](records/artifacts.md#verification-report-format)
for shared run context and compact, traceable scenario rows.
