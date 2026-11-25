# Jira adapter

Use for Jira candidate discovery or a verified `jira` binding. Apply the
[shared record policy](../README.md) and selected [stage procedure](../issue-systems.md#stage-adapters).
Jira Cloud uses the Atlassian plugin; Jira-only supports the full workflow.
Confluence is optional. Never use development-account destinations.

## Discovery and configuration

Discover Atlassian installation/enabled state separately from available operations
and authenticated Jira access. Use the supplied site URL when accepted by the
current tool; otherwise resolve accessible resources once and retain the selected
cloud ID. Pass the explicit site/cloud ID on every scoped operation. Jira and an
optional Confluence destination may have different sites and permissions.

Use `discover` for exact operation names/signatures and invoke the returned
read/write/destructive family. Do not invent operation names or raw REST access.
For Jira destinations use `listJiraProjects` (UI: spaces), following pagination and
matching the selected ID/key, not a development name. Its view/create/edit action
filters are capability evidence, not a successful issue mutation.

Inspect `listJiraProjectIssueTypesMetadata` and
`getJiraIssueTypeMetaWithFields`, with `requiredFieldsOnly: false` when parent,
labels, or other optional fields matter. Resolve required values/defaults and
Reporter/assignee identity from the selected site; do not reuse account IDs from
another site. Use assignable-user discovery for assignment, not a general person
lookup alone. Custom names are valid; a non-subtask flag or a type name is not
proof of its hierarchy level. Use available configuration/relationship evidence,
and verify parent fields after the first authorized creations in an empty space.

Discover statuses per selected type with `listJiraStatuses` in project mode.
Use `listJiraIssueTransitions` for the actual issue/current state and required
transition fields; a project's status list does not prove that transition is
currently permitted. Persist exact status/type identities and the confirmed review
mapping. Missing hierarchy or native blocking semantics pauses dependent setup;
do not create types, workflows, fields, spaces, or a substitute hierarchy.

## Report-store choice

After initialize confirms Jira and its space, use bounded read-only Confluence
discovery unless the user already requested or saved Jira-only. Prioritize a
supplied destination; inspect access and relevant space metadata, not page contents
or an exhaustive inventory. Account for pagination and applicable space types.
A failed/partial lookup means unverified availability, not absence. Discovery
does not authorize installation, connection, space creation, permission changes,
or dummy writes.

Offer **Jira only** in every case. Offer **Jira + Confluence** with actual candidate
destinations and access limits when available; confirm user interest and the space.
If unresolved, check a supplied destination or let the user select Jira-only.
Persist the store separately from the tracker. Explicit/saved Jira-only skips
Confluence discovery and checks, including in preflight and future chats.

## Migration home and hierarchy

Use exactly **one migration Epic** in the selected existing Jira space. The space
can contain unrelated migrations/work. Store the shared Tracking configuration,
grouped work links, and artifact index in the Epic's description; initialize owns
the [Epic template](../../../../initialize/assets/jira/migration-home.md).
Its immutable issue ID plus site identifies the migration; use returned key/URL
for display. Preserve unrelated content and existing native associations.

Map stage/phase parents to standard work items under this Epic, and their checks,
investigations, packages, slices, or repairs to Sub-tasks using native `parent`.
No group Epics, extra group Tasks, or Sub-task nesting. Phase verification is a
standard sibling of its transformation parent; verification specialists and behavior
packages are children of their stage parent, not of another Sub-task.

Use `createJiraIssue`/`editJiraIssue` with discovered types/fields and read back
parenting. Every owned record has a migration-home backlink and explicit role
(`work` or `report`) in its shared template/header or artifact index. Native
parentage and verified index membership scope the migration; labels are not proof
that an unrelated item belongs. Keep a compact exact index of stage parents and
reports on the Epic, not duplicate report bodies.

## Groups and labels

| Meaning | Native Jira label |
| --- | --- |
| Logical Readiness / Migration readiness | `CodeMod-Readiness` |
| Migration | `CodeMod-Migration` |
| Final verification | `CodeMod-Final-Verification` |
| Human action required | `CodeMod-User-Required` |
| Awaiting review fallback | `CodeMod-Awaiting-Review` |
| Report artifact | `CodeMod-Report` |

Apply work-group labels explicitly to children; do not assume inheritance or a label
catalog operation. Read–merge–write the complete labels array: `editJiraIssue` sets
multivalue fields rather than appending. Preserve unrelated labels/components.
Do not convert work groups into release versions, sprints, or extra hierarchy.

## Review and acceptance

Apply the [shared review representation](../lifecycle.md#review-representation)
using the saved native status mapping and labels above. If no suitable review
status exists, confirm an active status plus `CodeMod-Awaiting-Review`; a basic
To Do/In Progress/Done workflow remains supported. `CodeMod-User-Required` is
independent of the review representation.

Use `transitionJiraIssue` with a currently valid transition ID; match its destination
status, not its transition name. Write required handoff/decision comments through
`addOrEditJiraIssueComment`, not an assumed comment embedded in transition updates.
Accepted Done is distinct from Jira's broad done category and canceled/rejected
resolutions. A missing cancellation mapping leaves that action pending.

## Native dependencies and readback

Read issue details with `getJiraIssue`, `view: "evidence"`, for native issue links.
Read relevant comments separately through paginated `listJiraIssueComments`.
Embedded comment/changelog snippets are incomplete; use full paginated changelogs
only when history is needed, not as an additional approval-proof gate.

Discover `listJiraIssueLinkTypes` and create links using the supported
`createJiraIssueLink`. Confirm the selected type's directional descriptions before
writing. For the normal Blocks contract (`outward: "blocks"`,
`inward: "is blocked by"`), set `outwardIssue` to the blocker and `inwardIssue` to
the blocked issue. For example, when intent blocks a technical task, the creation
payload uses the intent as `outwardIssue` and the task as `inwardIssue`.
Read back both issues: the intent must show that it blocks the task, and the task
must show that it is blocked by intent. Interpret each issue's returned links
using the matching type description, as documented in the
[Jira issue-link model](https://developer.atlassian.com/cloud/jira/platform/issue-linking-model/).

Discover native unlink support at operation time. If it is unavailable, follow the
[shared dependency policy](../lifecycle.md#issue-workflow): name the exact
relationship for a human to remove, then verify removal before affected work
proceeds. Do not guess an operation or repurpose transition fields.

## Reports and resources

### Jira only

Every migration document—including intent, Execution environment, assessment,
behaviors, brief, guidance, and verification—uses a dedicated **report Task directly
under the migration Epic**, with `CodeMod-Report`, explicit artifact purpose/phase,
and [report envelope](../../../assets/jira/report.md). Apply the
[shared artifact policy](../artifacts.md#migration-reports-and-artifacts). For
routine Local setup, index the environment artifact on the Epic; omit an absent
owning-work link instead of creating a setup/approval ticket. Split oversized
bodies into linked report parts with one authoritative index and stable behavior/scenario IDs.

Read actual Epic transition conditions: if artifact states prevent closure,
preserve accepted evidence and report the pending native-state action; do not mark
reports Done just to force closure.

### Confluence selected

Persist exact Confluence site/cloud ID, space ID/key and parent page ID/URL or
explicit root placement. A matching name or readable space is not proof of
ownership, reviewer access, or create/edit capability. Read metadata/permissions
where supported and label unverified writes. Never assume the Jira space key or
site also identifies the Confluence destination.

Use `getConfluenceContent`, `detail: "full"`, for substantive reads/edits; its default
summary is insufficient. Load current content-format guidance and applicable
space instructions before authoring. Create/update through the discovered
Confluence content operations; updates require the current `snapshotToken`.
On conflict reread and merge, preserving rich content. Do not crawl all space
pages or duplicate reports on Jira issues.

### Publication and links

Use ordinary headings and tables or the current native content-format guide; do not
copy another provider's collapse delimiters. Read–merge–write rich Jira descriptions
and comments using the returned content format, usually HTML when media, panels,
mentions, or other structured nodes exist. Markdown can drop these elements.
Creation/edits may partly succeed; retain returned IDs and read before retrying.
`editJiraIssue` echoes only default fields, so explicitly reread changed labels,
custom fields, or parents. A successful text save is not verified media publication.

Maintain the Epic's resource index with verified artifact URLs. For native Web
links, call `listJiraIssueRemoteIssueLinks` before adding missing URLs; duplicate
URLs create duplicate links, and the audited remote-link contract has no removal
operation. Do not promise cleanup without discovering a supported operation.
Upload/inline-media flows may require a returned local upload command and media
ID/collection; discover the current contract and verify actual availability.

## Lifecycle and migration updates

Apply the [shared migration lifecycle](../lifecycle.md#migration-lifecycle) to the
single Epic, never to the containing Jira space. A native Epic state does not
approve children or replace final reconciliation.

Publish **Migration update** comments on the Epic via `addOrEditJiraIssueComment`,
under the [shared update policy](../lifecycle.md#migration-updates). Include
evidence-backed health as prose when useful. The Atlassian Project update operation
is a separate product, not an Epic update.

## Inventory and progress evidence

Enumerate the migration Epic's standard children and their Sub-tasks with scoped
JQL, following `nextPageToken` until `isLast`; a direct Epic-child query alone
misses grandchildren. Reconcile the parent/resource index and labels; identify
unexpected/missing members rather than reading the whole space as one migration.
Filter report artifacts from execution counts and active-work lists but include
them as resources. Use enumerated accepted required work, not approximate JQL
counts or board completion, for shared stage/migration predicates.

Normalize the [view contract](../../../../workflow/references/progress-view.md): site-qualified immutable Epic
identity, verified home URL, **Open Jira migration** button, current logical
review/acceptance, and separate User Required flags. Resource recency comes from
the actual report/page update/create timestamp, not an Epic link edit. Unknown or
partial records stay explicit; do not compute zero/completed from denied reads.
Board access is separate: do not require boards when issue operations supply the
needed evidence, or bypass a board permission failure through speculative access.
