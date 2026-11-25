# Shared migration records

Apply this guidance to every skill that reads or changes migration records. Use one
migration home and one authoritative report store per migration. Resolve the
[issue-system binding](issue-systems.md), then use the owning stage's specification
and the bound provider's shared adapter, plus any stage-specific procedure listed
in the router. A **migration home** is the migration's native entry point; a
**work group** is logical readiness, implementation, or final-verification
membership. Never change a broader tracker container on the basis of these mappings.

Keep workflow records in the bound provider and reports in the bound report store;
code, tests, fixtures, and run evidence stay in Git or their originating tool.
Follow the [graph evidence guidance](../codegraph.md#record-graph-evidence) for graph
queries. The Git provider's tracked records are authoritative; do not copy another
provider's records into Git or maintain a second store. Read-only requests make no
record changes.

A **record reference** is the bound adapter's verified locator: a provider URL or a
Git repository, branch, and relative path, with a committed revision when required.
Use this locator in template fields for migration records, even when labeled URL.
Never imply that a local record has been published.

Open the relevant guide before the operation it governs:

- [Reports and artifacts](artifacts.md): ownership, document timing, and execution details.
- [Reviews and decisions](reviews.md): approval authority and escalation.
- [Lifecycle and progress](lifecycle.md): states, comments, and migration updates.
- [Presentation](presentation.md): links, outcomes, and context for handoffs.

## Find and save records

Use supplied record references or search by system, repository, and purpose. Verify the migration
home, resource associations, and record contents; clarify ambiguous matches and
never select by recency alone. Honor requests for a new migration.

If saving or destination ownership is unresolved, keep the draft in chat, explain
the gap, and do not substitute another store.

Before saving, replace package-relative Markdown links with verified published
URLs or package paths in code formatting, such as `skills/verify-target/SKILL.md`.
Template-relative links are not for copying into external records.

Reuse verified IDs and preserve unrelated content, user caveats, and existing
results. Read back writes to verify content, rendered links, states, labels,
associations, and relations. Read before retrying uncertain outcomes; report partial
saves accurately.

## Record setup

1. Create or repair only records within the request. A direct skill may establish
   its required group and records; workflow may queue future work using the owning
   skill's specification. Associate each item with its migration, group, and parent.
2. Use the owning skill's template. Specialize scope, steps, limits, and evidence
   from the procedure and intent. Name the qualified skill and exact reference in
   **Procedure**; keep actionable steps in the issue. Add report links only after
   [substantive content is saved](artifacts.md#create-documents-when-there-is-content).
3. Apply [technical prerequisites](#technical-work-prerequisites) and the owning
   skill's dependencies through directed native blockers. Preserve unrelated
   relations, avoid cycles, and do not rely on parenthood to propagate blockers.
   Keep future work queued and affected work unrun when required setup is incomplete.

For a queued issue, fill in the assignment, steps, and required evidence. Give its
result one pending outcome. Add result fields and tables as evidence arrives.
If required work cannot run, record the reason and what would unblock it.
Keep existing evidence when refreshing an issue.

### Write migration records

Read each applicable stage and provider template from start to finish before
using it. Do not use `head` or `tail` to read templates. If output is truncated,
read successive line ranges through the end of each file. Apply the template's structure and
instructions for required, conditional, and optional fields. Before review,
read back the saved record and check every applicable section against the
templates and the source answers or findings. Repair any omissions.

Write or update migration records in plain, direct prose. Name known actors, use
direct verbs, and keep terms consistent. Include detail when it affects execution,
review, or verification. Link authoritative evidence instead of duplicating it;
keep enough context in each record for the reader to act.

Preserve required fields, IDs, evidence provenance, material conditions,
uncertainty, blockers, and approval history. Distinguish recommendations,
observations, decisions, and results. Omit irrelevant optional sections and empty
tables; state required unknowns explicitly.

Style inspired by [ASD-STE100 Simplified Technical English](https://www.asd-ste100.org/about_STE.html).
This guidance does not claim compliance with the standard.

## Prerequisite evidence

A skill's prerequisites describe the inputs and acceptance needed for its requested
scope. An earlier skill is the usual producer, not proof in itself. Equivalent
evidence is usable when its provenance, migration scope, revision, freshness,
coverage, and required review or acceptance are verified. Record its identity and
limits on the consuming work. A missing artifact, inaccessible record, stale result,
completion message, or absent blocker never establishes a prerequisite.

Respect every existing native blocker. Never mark an unrun predecessor Done, ignore
or remove a blocker, or fabricate a replacement issue to make alternative evidence
fit. If a native relation conflicts with the evidence, report the mismatch and use
authorized reconciliation before dependent work. Human approval of current intent,
behaviors, and the brief remains mandatory; equivalent inputs do not weaken
that authority. Children need only the evidence applicable to their own scope.

## Technical work prerequisites

When tracked, the current intent issue and, for cloud execution, the applicable
setup issue directly block each affected technical work item, including dynamic
issues. Otherwise verify the required intent approval and execution evidence under
[prerequisite evidence](#prerequisite-evidence); do not create an unrun predecessor.
Add the owning skill's scoped evidence dependencies. Intent and cloud setup do not
block each other, and setup never depends on work it unblocks. Reconcile existing
records during requested setup, environment changes, and intent revisions.

## Issue format

Use supported native fields for identity, group, hierarchy, assignee, state,
labels, dependencies, and creation/update data. Verify them before removing body
duplicates; retain evidence and explanations they cannot represent.

Fill the stage's template with facts or explicit unknowns; never publish its
instructions or option lists. Approval follows the owning work item and native
dependencies; routing, report roles, and review mappings add no approval gates.

Use **Next action** only for a concrete follow-up or decision that adds information
beyond the issue's steps and native fields.
