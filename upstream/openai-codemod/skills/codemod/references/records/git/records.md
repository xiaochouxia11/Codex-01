# Git adapter

Use for Git candidate discovery or a confirmed `git` binding with the [shared record
policy](../README.md) and the owning [stage specification](../issue-systems.md#stage-adapters).
Git stores the authoritative migration records; it requires no tracker integration.

## Discovery and binding

Inspect the selected migration repository, its refs and remotes, committed baseline,
and checkout state. Confirm the repository, state branch, and migration directory
before creating records; never infer the binding from the current checkout or recency.
Use **one authoritative state branch per migration**. For a new migration, create it
from the selected source branch or ref at its verified commit when source and migration
share a repository; otherwise use an agreed verified base in the migration repository.
Name a new state branch `codex/codemod/state/<migration-id>` by default, distinct
from the source and implementation/integration branches. If that name conflicts
with a ref or repository convention, choose another distinct name under the
[branch naming guidance](../../definitions.md#migration-branches). Never write
migration records to the source branch or a transformation branch.

When binding the branch, confirm the exact remote/ref and publication scope once if
the state will be shared; that agreement authorizes verified checkpoint pushes.
Otherwise keep state local. Check read, write, commit identity, and remote access
separately; remote access is needed only for requested remote reads or publication.
Save the binding and publication policy on the migration home.

The default root is `.codemod/migrations/<migration-id>/`, tracked on the state
branch. Choose a stable filesystem-safe slug, preserve established paths, and resolve
the root inside the selected repository. Confirm a new location when ignored or
conflicting. Reject traversal, symlinked record paths, and paths outside the bound
root. Do not reuse the CodeMod application's `.codemod/state.sqlite3` or generated
`.codemod/issues/` records. Persist credential-free repository identity and relative
paths, not host-specific absolute paths.

## Native record mapping

| Record | Location and representation |
| --- | --- |
| Migration home | `README.md`: the [home template](../../../../initialize/assets/git/migration-home.md), including work-group sections and resource index. A group needs no separate file. |
| Work item | `work/WORK-001.md`, etc.: [work envelope](../../../assets/git/work-item.md) plus the owning stage's body template. Allocate an unused ID from filenames; never reuse or renumber one. |
| Report | `reports/<purpose>[-<phase>].md`: the owning stage's report template, indexed by purpose and phase. |
| Work comments | Dated, attributed Activity entries on the owning work file. |
| Migration updates | Dated, attributed entries in `updates.md`; link it from the home after its first substantive entry. |

Use the work file's Group and Parent fields for membership and hierarchy. Store a
directed prerequisite only in the downstream item's **Blocked by** field, as a
relative link to a work file in this migration; use `None` for no relation. Before
changing a relation, verify the endpoints, direction, and paths needed to rule out a
cycle; preserve unrelated relations and read back the change. Derive reverse
dependencies from the relevant work inventory when reconciliation needs them.
Missing or conflicting endpoints block only affected work.

Use `Backlog`, `In Progress`, `In Review`, `Done`, and `Canceled` for work states;
only `Done` satisfies a prerequisite. Use `User required: Yes` for unfinished human
action and `No` otherwise. An authorized user may accept through Codex or set the
work State to Done; a file save, commit, or push is not acceptance. The home uses
`Planned`, `In Progress`, and `Completed` under the [shared lifecycle](../lifecycle.md).

Read the requested records, applicable blockers, and required artifacts. Inventory
the complete requested scope for status or reconciliation, and the whole migration
for completion. An incomplete inventory is unknown, not empty or complete; gaps
outside the requested work do not become blanket blockers. Preserve canceled work
and its history; the owning stage reconciles its dependencies.

## Writes and checkpoints

Read current migration records from the bound state branch. One coordinator writes
them there in its agreed checkout; workers return findings to that coordinator.
Inherited copies on transformation branches are never state authorities. Do not switch
a dirty checkout or merge a stale record directory over current state. If the bound
checkout is unavailable, report the unsaved work.

Read affected files before editing and preserve concurrent human changes. Pause
only work affected by conflicting edits, unresolved markers, or incomplete required
dependencies. At an existing [progress checkpoint](../lifecycle.md#progress-checkpoint),
commit the related record changes together on the state branch. Preserve unrelated
staged changes; use a safely scoped commit when possible, otherwise report the
pending checkpoint. Verify the commit and its contents. A failed commit blocks only
actions requiring committed state; same-checkout work may use verified saved results
when its own prerequisites allow. Never substitute a state revision for the recorded
source baseline or exact tested target candidate.

Push the state branch at these checkpoints when the agreed policy authorizes it.
Verify the destination, outgoing commits, and remote result; report failed or
uncertain publication, and never force-push or overwrite remote changes. A local-only
policy never authorizes a push. Saving, committing, and remote publication are
distinct outcomes.

Transformation branches may descend from the state branch when the agreed code
delivery includes its record history. A descendant inherits those commits: separating
code and records into different commits, or deleting records later, does not remove
them from history. Before publishing a descendant or proposing it for integration,
check its outgoing history and destination against the authorized scope. If code
delivery must exclude records, use a verified base without state-branch commits;
the single state branch remains the record authority.

## References, status, and progress

Use relative links between records and verify changed links on readback. In chat,
link to a local file only when the checkout contains the revision read; otherwise
give the repository, state branch, revision, and relative path. Use a web URL only
for a verified published revision. Supply the [shared continuation context](../presentation.md#continuation-context)
with the state branch, relevant relative paths, last committed state SHA, and any
local or unpublished gap. A receiving checkout must contain that revision; do not
silently resume an older remote copy or push to make a prompt usable.

Read-only status may use `git show` on a branch that is not checked out and
`git --no-optional-locks status` in a checkout; do not change files, index, refs, or
remote state. For the [progress view](../../../../workflow/references/progress-view.md),
qualify identity by repository and migration ID; use the work-state and human-action
fields above. Use the last commit affecting each resource for recency, qualifying
local edits separately. Label a verified published home **Open Git migration**; apply
the shared view rules when links are unavailable.
