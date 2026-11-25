# GitHub Issues adapter

Use for GitHub candidate discovery or a verified `github` binding. Apply the
[shared record policy](../README.md) and selected [stage procedure](../issue-systems.md#stage-adapters).
GitHub Issues is the record provider; it is distinct from the `git` provider's
tracked Markdown. Support GitHub.com and GitHub Enterprise Cloud when the selected
host exposes the required capabilities. GitHub Enterprise Server is not supported.

## Discovery and binding

Use the installed GitHub integration first. Discover its current operations and
signatures, authenticated identity, and access to the selected host and records
repository. Check that Issues are enabled and the repository is not archived.
The records repository may differ from the source and migration repositories;
confirm its exact owner and name rather than inferring it from the checkout.
Distinguish installed state, exposed operations, authenticated reads, permission
evidence, and a successful substantive write/readback. Verify access in the actual
Local or Cloud task; earlier access does not carry over.

For an operation the integration does not expose or cannot perform completely,
use an already authenticated GitHub CLI (`gh`) against the same bound host and
repository. Verify the active identity with `gh auth status --active --hostname HOST`
without `--show-token`, and read the same destination through CLI before writing.
Confirm that the identity is authorized for this migration; resolve conflicting
identities or destinations before writing. This fallback fills an operation gap;
it does not authorize bypassing a permission denial, switching accounts, changing
permissions, installing tools, or exposing credentials. If neither path supplies
a required capability, name the gap and leave dependent work unfinished.

Discover issue reads/creation/edits, comments, labels, parent/child relations,
directed dependency read/add/remove, and complete inventory independently. Check
Project access only when a Project is requested or already bound. Use the current
`gh` help to verify flags. Qualify every issue command with
`--repo HOST/OWNER/REPO`; for `gh api`, specify `--hostname HOST` and the exact
repository path. For Project commands, set `GH_HOST=HOST` for that command and
use the selected Project owner and number. Never let checkout, default host, or
an ambient repository variable choose the destination.

Bind one records repository and one migration-home issue. Store the provider ID,
host, repository identity and verified URL, home issue ID/number and URL, fixed
report store, confirmed lifecycle and human-action mappings, and optional Project
owner type/login, number, stable ID, and URL in the home's Tracking configuration.
Project identity is separate from repository identity. Keep verified report and
external-resource references in the resource index. Use the same binding and
verified references in [continuation context](../presentation.md#continuation-context).

## Home, hierarchy, and work groups

Initialize creates or reuses exactly one home issue using the
[migration-home template](../../../../initialize/assets/github/migration-home.md).
For a new issue, first create the home with its known destination and purpose, then
save its returned identity in the Tracking configuration and verify the complete
binding before creating dependent records. A partial home is not a completed
binding; read it before retrying and never create a duplicate to fill a gap.

Create stage/phase parents and standalone work as native sub-issues of the home.
Create checks, investigations, packages, slices, specialists, and repairs as native
sub-issues of their owning stage/phase parent. Preserve the stage's specified
relationships, including verification siblings. Use the home body's logical
Migration readiness, Migration, and Final verification sections to index direct
work children; descendants inherit their logical group through their owning parent.
This is an index, not a separate state store. Do not create group issues, milestones,
Projects, or repository configuration to represent these groups.

Use the owning stage's work template. Each work issue must backlink to the home;
the home index and verified native ancestry establish membership. A label or
Project membership alone does not. When the integration lacks hierarchy operations,
use the current CLI's `gh issue edit` parent/sub-issue flags or `gh api` with the
[sub-issues API](https://docs.github.com/en/rest/issues/sub-issues). Never replace
an existing parent without resolving ownership; verify the relationship after saving.

## Hierarchy capacity

GitHub allows at most 100 direct sub-issues per parent. Before saving a planned
breakdown or creating any of its work issues, enumerate every affected parent's
existing direct children (open and closed, including unrelated children) and count
the proposed additions. Apply this check to the home as well as stage/phase parents;
slices, specialists, repairs, and any other direct children share the same limit.
Do not assume that closing a child frees a slot. Incomplete enumeration leaves
capacity unverified and dependent record creation unfinished.

For GitHub-backed planning, constrain each parent to at most 100 total direct
children. If a proposed phase exceeds the limit, have the owning planning stage
revise the breakdown into smaller, coherent phases before creating that breakdown,
retaining the full agreed scope, dependencies, and verification obligations. Check
that the additional phase parents also fit beneath the home and that the entire
revised graph satisfies [dependency capacity](#dependency-capacity). The revised brief
and queued breakdown still require the stage's normal human acceptance. Never
silently drop work, combine unrelated slices to hide the limit, or add overflow
group issues that change the prescribed hierarchy.

Recheck capacity before later additions, including specialists and repairs. If an
existing parent has no room, do not create an unattached issue or reparent accepted
work to make space. Record the capacity blocker on the existing owning issue and
return the affected scope to its planning/reconciliation stage for an authorized
revision; preserve existing IDs, ancestry, evidence, and acceptance history. Leave
affected execution and completion pending until a valid revised breakdown is saved
and verified. Independent work with verified capacity may continue. If the home
itself cannot accommodate the required parents, report the bound migration's
capacity limit and request a scope decision; do not create a second home or switch
providers automatically.

## Work lifecycle and labels

Use these exact repository labels for work issues. Reuse existing labels; if a
required label is missing, create only that label in the selected records repository
as part of authorized setup and verify it. If label setup is unavailable, report
the affected mapping as incomplete. Preserve unrelated labels and assignees;
prefer additive/removal operations, or read–merge–write when an operation replaces
the whole set.

| CodeMod meaning | GitHub representation |
| --- | --- |
| Queued | Open, without `codemod:in-progress` or `codemod:awaiting-review` |
| In Progress | Open with `codemod:in-progress` |
| In Review | Open with `codemod:in-progress` and `codemod:awaiting-review` |
| Human action required | Add `codemod:user-required` independently of review |
| Done | Closed with reason `completed`, under the agreed acceptance authority |
| Canceled or rejected | Closed with reason `not_planned`; never a satisfied prerequisite |

Follow [shared review representation](../lifecycle.md#review-representation) for
marker removal and human versus delegated review. Only the owning work issue
records its acceptance; a report's state, a Project field, a PR merge, and a
closed issue with a different or unknown reason do not. Do not add a new approval
gate to a valid accepted state. If there is evidence of automatic or accidental
closure that conflicts with the required acceptance, report the mismatch and leave
dependent work pending until authorized reconciliation. Use neutral issue references
in PRs and commits; avoid GitHub closing keywords or automatic closing links before
the owning stage's acceptance conditions are met. See
[GitHub's PR linking behavior](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue).

Apply the [migration lifecycle](../lifecycle.md#migration-lifecycle) to the home
issue itself: open means In Progress; close as completed only after workflow's
whole-migration completion decision. Reopen it when that policy requires it.
Never close or complete the containing repository or Project.

## Dependencies, writes, and comments

Use native directed issue dependencies. Read every relevant blocker and its state
before starting work. If the integration lacks relation operations, use the current
CLI's `gh issue view` relationship fields and `gh issue edit` dependency flags, or
`gh api` with the [issue dependencies API](https://docs.github.com/en/rest/issues/issue-dependencies).
For example, add intent as a blocker on the consuming technical issue with
`gh issue edit CONSUMER --repo HOST/OWNER/REPO --add-blocked-by INTENT`. Verify
the consumer is blocked by intent and intent blocks the consumer. Check removal
separately; if unavailable, name the exact manual action and verify it before
dependent work proceeds. Parenthood, body checklists, generic blocked labels,
and Project fields never substitute for a directed dependency.

### Dependency capacity

GitHub permits at most 50 linked issues per relationship type on each issue:
50 **blocked by** and, separately, 50 **blocking**. This limit is independent of
sub-issue capacity. Before saving a planned breakdown or creating its work issues
and dependencies, enumerate the complete existing relations at both endpoints of
every proposed edge. Count distinct existing and proposed edges per direction,
including links to closed or unrelated issues; an already-present edge consumes
one slot, not an additional slot on retry. Incomplete reads leave capacity
unverified and dependent record creation pending.

Check the whole proposed graph, not just each phase. The current tracked intent
and applicable cloud setup must each directly block every affected technical item,
including dynamic work. Their outgoing capacity is shared across all phases;
splitting phases does not make a 51st consumer fit. Also check incoming capacity
for each consumer and outgoing capacity for brief, verification, and other scoped
prerequisites. A GitHub-backed plan is supported only when every required edge
fits at both endpoints without weakening the shared prerequisite policy.

If capacity would be exceeded, stop before creating the affected breakdown or
adding its edges. Report the saturated issue, direction, existing count, proposed
additions, and affected work on the existing owning record. Ask the owning planning
stage for a scope decision and a valid revised plan under normal acceptance rules.
Do not silently omit direct blockers, substitute transitive/group dependencies,
duplicate intent or setup, remove historical edges merely to free slots, or switch
providers. Closing work does not establish that its dependency slots are free.
Recheck before dynamic repairs, specialists, and intent/setup revisions. Preserve
old required edges until their authorized replacement is saved and verified. If a
concurrent change or partial write exhausts capacity, reread both endpoints, retain
saved IDs/edges, report the missing relations, and leave affected execution and
completion pending; never claim the records are ready from a partial graph.

Use an exposed ordinary-issue comment operation for meaningful findings, review
handoffs, and **Migration update** comments on the home. A PR-only comment tool
is not proof of issue-comment support; use `gh issue comment` when needed. Read
recent comments before writing and verify the published comment. Preserve existing
body content when editing work, home, or report issues; verify saved content,
links, labels, state/reason, associations, and relations. A multi-step operation
can partially succeed: retain returned IDs, reread before retrying, and report
what remains unsaved. Do not use dummy writes to test access.

## Reports and resources

The fixed report store is dedicated issues in the bound records repository. Use
the [report envelope](../../../assets/github/report.md) and the owning stage's
substantive report template. Each report has an explicit report role and home
backlink, is indexed by purpose/phase on the home, and links its owning work when
one exists. Keep report issues outside the executable sub-issue hierarchy and
Project work inventory. Their state does not indicate approval, completion, or
progress. If content must be split, maintain one indexed report root with verified
links to its parts and stable scenario/behavior IDs.

## Optional GitHub Project

When requested, bind one existing GitHub Project as an organizational view. Confirm
the Project owner, number, identity, and access separately from repository access;
discover existing fields/options before mapping any field. Add the home and owned
work issues as Project items, using verified issue URLs. Do not add report issues,
draft items, or unrelated issues as substitutes for work. If the integration lacks
these operations, use the current `gh project` view, field, and item commands;
Project operations may require additional permission. Discover and verify the exact
item and field identities before changing a value.

Issue records remain authoritative. If the user chooses a Project status mapping,
update only the bound migration's items from the verified issue state at existing
checkpoints; never infer issue acceptance or readiness from Project status. A
failed Project update is a pending view update, not a failed issue save. Preserve
unrelated items and field values; do not create Projects, fields, views, or
automations. Without a bound Project, skip Project discovery and writes entirely.

## Inventory and progress evidence

For requested scope, reconcile the home index with native direct children and each
relevant parent's descendants, then resolve directed blockers and indexed reports.
Include open and closed work; exclude the home, parent summaries, PRs, reports,
and unrelated Project items from executable counts. Follow pagination for issues,
children, dependencies, comments, and Project items where applicable. A default or
capped CLI listing, search result, embedded relationship preview, or partial Project
view is not a complete inventory; use paginated `gh api` reads when needed or mark
counts and completion evidence incomplete.

Normalize the [progress-view contract](../../../../workflow/references/progress-view.md)
from verified issue evidence: home URL and **Open GitHub migration** button,
logical work states, separate human-action flags, and indexed reports using their
own update/create timestamps. Keep unknowns explicit. Read-only status may read
the bound issues and Project but must not repair labels, fields, links, or states.
