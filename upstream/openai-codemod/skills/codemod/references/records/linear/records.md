# Linear adapter

Use for Linear candidate discovery or a verified `linear` migration binding. Apply
the [shared record policy](../README.md) and selected [stage procedure](../issue-systems.md#stage-adapters).

## Discovery and destination selection

Discover the installed/enabled Linear integration separately from callable tools
and authenticated reads, using supported plugin-management discovery and the
actual tool catalog. Read workspace or team metadata to verify candidate access.
Confirm the provider through [integration selection](../../../../initialize/references/integration-setup.md)
before selecting a destination, even when it is the only usable option. After
confirmation, list accessible teams when ownership is unknown and ask which team
owns the migration; do not infer selection from the current workspace or recency.
A listing or exposed save operation does not prove create/edit capability.

Linear uses native project documents; skip optional store discovery. For an existing
migration, read the selected project with `get_project`, `includeResources: true`,
and verify its saved Tracking configuration. A new migration does not require an
existing project; establish it under [project creation](#project-creation-and-configuration).

## Project creation and configuration

Use one native Linear project per migration. Create through `save_project` with the
agreed `name` and owning team (`addTeams` or `setTeams`), or reuse the confirmed
project. Read back its identity and URL, then merge the router's **Tracking
configuration** into the Markdown `description`, not the short `summary`. Read
back configuration and associations. Apply native project state through
[project lifecycle and updates](#project-lifecycle-and-updates).

## Work groups and hierarchy

Map logical Readiness to **Migration readiness**. During initialization, create or
reuse both **Migration readiness** and **Migration** milestones, even when Migration
has no issues yet; brief owns the later implementation breakdown. Preserve existing
IDs and names. Create or reuse **Final verification** when the requested workflow
needs it. Find with `list_milestones` and create/update with `save_milestone`, using
the [workflow's group templates](../../../../workflow/references/setup.md#work-groups)
for descriptions; never invent dates.
Use native project/milestone associations, not duplicate labels. The owning
coordinator adds the stage's designated aggregate or single issue to the milestone's
**Key issues**, preserving existing entries. Omit empty Key issues sections.

Use `save_issue` for native project, team, milestone, parentId, assignee, state, and
labels. Set the project/team/milestone on every executable issue and parentId on
children. Apply the stage's record specification and verify directed relations
through [dependency readback](#dependencies-and-reconciliation).

Before work read `get_issue`, `includeRelations: true`, and relevant paginated
comments under [comments and handoffs](#comments-and-handoffs).
Discover actual issue states with `list_issue_statuses`; use their saved
IDs/equivalents. Issue-status discovery is not a project-status catalog.

## Review and labels

Apply [shared review semantics](../lifecycle.md#review-representation) using native
**In Review** or the confirmed active-state-plus-**CodeMod: Awaiting Review**
fallback. Distinguish accepted Done from Canceled/Duplicate.

Reuse the exact **CodeMod: User Required** label in the selected team/workspace,
creating it if absent during an authorized write that needs the marker. Exact-name
filters may not match partial names; inspect returned labels. The prefix is a
naming convention, not an assumed native label group. Prefer exposed add/remove-label
operations for bounded changes.

## Dependencies and reconciliation

Use `save_issue` with `blockedBy`/`blocks` and read relations back to verify direction.
Use explicit `removeBlockedBy`/`removeBlocks` when reconciling obsolete relations;
do not assume assigning an empty relation list clears them. Native cancellation
does not remove blocker relations; apply the owning stage's reconciliation rules.

## Project reports and artifacts

Read existing resources through `get_project`, `includeResources: true`, before
creating. Use `save_document` with the **project**
parent for substantive migration reports/environment documents; do not attach
them under an issue. Their native association already makes them resources, so do
not duplicate their URL in project links. On update, specifying a parent reparents
the document: omit it unless an intentional association repair is required.

Read and verify full documents through `get_document`; use supported patches or
merge the latest body, preserving rich content, then verify the project resource
association. Apply the [shared artifact policy](../artifacts.md#migration-reports-and-artifacts).
For external repository/evidence resources, merge missing entries into
`save_project.links` and verify associations.

Use Markdown for Linear content. To collapse a section, open with `+++ Heading`
and close with `+++`. Use collapses when helpful unless a stage requires one;
keep Linear-only delimiters out of shared templates.

Upload screenshots through exposed prepare/upload/finalize operations when available;
read back previews/links. Tool exposure and a text save do not prove media upload.

## Project execution details

Find Execution environment via `get_project`, `includeResources: true`, matching
purpose and project association, then `get_document`. Apply the
[shared execution-detail policy](../artifacts.md#execution-environment-details).

## Project lifecycle and updates

Apply the [shared lifecycle predicate](../lifecycle.md#migration-lifecycle) through
`save_project.state`, using an actual project status/equivalent and readback.
Native project state is distinct from issue state, health, and update posts.
Do not infer project-state choices from `list_issue_statuses`.

Use `get_status_updates` before `save_status_update` with `type: "project"`.
Use evidence-supported `onTrack`, `atRisk`, or `offTrack` health when appropriate.
Apply the [shared update policy](../lifecycle.md#migration-updates) and verify the
saved update; issue-specific progress follows the comment operations below.

## Comments and handoffs

Read `list_comments` with the relevant `issueId` or `documentId`, following
pagination and replies. Preserve `onBehalfOf` attribution when present. Use
`save_comment` on the owning issue for progress and human-action handoffs, or
`documentId` for document-specific feedback; `parentId` replies to an existing
thread.

Apply the [shared continuation context](../presentation.md#continuation-context).
An optional `@Codex` issue mention is a handoff path only when available; it does
not select an execution environment.

## Progress evidence

Produce the [neutral view data](../../../../workflow/references/progress-view.md) from the exact migration
project, complete relevant issues/milestones, and saved reports. Set the home link
to the verified project URL, with label **Open Linear migration**. Qualify identity
by workspace and project ID. Normalize review through the saved mapping and human
action from the mapped User Required label on unfinished work; never from review
status alone. Native percentages do not establish accepted completion.

Resource recency uses native `updatedAt`, falling back to `createdAt`; missing times
remain unknown. Link update posts as evidence without treating them as new report runs.
