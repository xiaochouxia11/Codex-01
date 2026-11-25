# Lifecycle and progress

## Migration lifecycle

Maintain the migration home's native lifecycle separately from issue states, health,
and progress posts. Apply whole-migration completion only for the default workflow:

- Set **In Progress** when initialize creates or starts the migration home,
  including while intent and setup await completion. This does not start queued issues.
- Set **Completed** only after the [workflow's completion decision](../../../workflow/SKILL.md#reconcile-completion),
  backed by the [expected final-verification records](../../../verify-target/references/records.md#final-verification-placeholders)
  and a complete work-group inventory. Missing records, an empty set, phase-only
  verification, or required issues In Review prevent completion.
- Return a completed migration home to **In Progress** when required completion
  criteria or required Final verification work become unresolved after an authorized
  revision or repair. Metadata-only edits do not reopen completed work.

The writing-stage coordinator reconciles non-completion transitions at checkpoints
and authorized follow-ups; workflow alone decides and applies whole-migration
completion. Verify the native transition; report a pending update separately from
accepted evidence if it cannot be performed. Preserve unrelated properties and never
complete a broader shared container. Completion records workflow acceptance; it does
not merge the destination PR, deploy, or cut over.

## Issue workflow

Use the same issue for work, review, and acceptance unless the stage defines separate
review work. In Review requests review; it does not mean review has occurred.

Before starting or resuming, read the issue, recent comments, native prerequisite
relations, and blocker states. Unresolved decisions or unresolved/unreadable blockers
prevent execution even after a direct request. Report the gap; do not bypass it by
starting work, changing state, or removing dependencies. A **Done** blocker satisfies
its native dependency without reopening review; stage-specific execution entry
conditions still apply. Setup maintenance does not start blocked work.

Use the saved mapping: **In Progress** means active work; **In Review** is the
nonterminal review representation; **Done** means accepted completion, not a broad
provider category. Confirm missing or ambiguous mappings and do not create native
states or use Done for blocked, canceled, rejected, or unreviewed work.

### Review representation

Prefer a suitable native review state; otherwise use the confirmed active state
plus the adapter's Awaiting Review marker. This fallback is supported. Human review
also needs User Required; delegated review does not. Unfinished clarification or
manual action uses User Required without Awaiting Review. If a native review state
also hosts decisions, distinguish those cases in the comment.

Remove Awaiting Review when requested changes resume work; remove User Required
independently when no human action remains. Stale or missing markers do not change
acceptance or authority; read-only status suppresses stale flags without editing them.
Substantive revisions require refreshed evidence and the owning stage's revision rules.

Canceled or rejected work is neither accepted nor a satisfied prerequisite. If a
valid native disposition is unavailable, preserve the approved exclusion and its
coverage/successor, report the pending update, and name the action required. An
exclusion can change scope but cannot silently remove or satisfy a native blocker.

| When | Action |
| --- | --- |
| Creating future work | Use an existing unstarted/backlog state. Reading or creating a ticket does not start it. |
| Starting or resuming unblocked work | Move the ticket to **In Progress** before execution. |
| Encountering unresolved ambiguity or high risk | Pause the ticket with User Required and the mapped decision state; do not imply completed work is ready for review. |
| Completing the ticket's required work | Save and verify its artifact or results. Move it to **In Review** when awaiting required review or acceptance. |
| Resuming requested changes from review | Move the same unaccepted ticket back to **In Progress**, then return it to In Review when ready. |
| Meeting the agreed review and acceptance conditions | The authorized person or agent marks the ticket **Done** under the [review rules](reviews.md#review-and-approval). Authorized agent completion without separate review need not wait in In Review. |
| Other blockers or unfinished work | Keep the ticket open, record the gap and next action, and stop work that depends on it. Use an existing waiting/blocked state if the team has one; human decision requests use the mapped nonterminal decision representation. |

Use directed native blockers, not a generic blocked flag; In Review still blocks
dependents. Check read/add/remove capabilities separately. If removal is unavailable,
name the exact relationship for a human to remove and verify it before affected work
proceeds. Missing records go to the owning stage. Do not reopen completed issues to
read or synchronize metadata; accepted-intent revisions follow initialize's rules.

## Progress comments

Comment on meaningful issue findings, blockers or their resolution, decisions, and
review handoffs. Say what changed, why it matters, and what comes next; link evidence
and check recent comments to avoid duplicates. Keep child progress on that child.
Chat, descriptions, and state changes do not replace required comments or updates.

## Migration updates

Publish a migration-level update for major progress or a significant blocker: a
stage ready for review or accepted, a substantial implementation checkpoint, or a
blocker affecting the next stage, delivery expectations, or several issues. Update
again when a significant blocker resolves or materially changes. Routine activity
stays in issue comments.

The coordinator owns the update; workers return findings to it. State what changed,
its impact, supporting links, and the next action or decision and owner. Distinguish
ready for review from accepted, and partial results from completed scope.

Read recent updates to avoid duplicates and verify publication. Set health only
when evidence supports it. If publishing is unavailable, provide the draft in chat
and report it as unsaved. Do not copy full reports or turn the migration-home
overview into a progress feed.

### Progress checkpoint

Check progress after a substantial work batch, significant blocker change, or review
or acceptance transition, and again before ending a writing stage or focused follow-up:

1. Save and verify the affected results and states. Add meaningful issue comments
   under [Progress comments](#progress-comments), then reconcile the native
   [migration lifecycle](#migration-lifecycle).
2. Compare the current outcome with the latest migration update. Publish any
   unreported event meeting the [migration update triggers](#migration-updates).
3. If an update was published, verify it and link it in the handoff; report failed writes.
4. If a default-workflow progress view is active, [refresh it](../../../workflow/references/progress-view.md#refresh)
   from those results when scope, evidence, decisions, or freshness changed, even if
   no migration update was needed.

Combine closely related changes into one update. Routine child completion or
unchanged state needs no migration update. Read-only requests may refresh the
thread-local display but do not write tracker records or repository files.
