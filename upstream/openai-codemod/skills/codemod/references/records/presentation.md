# Presenting migration work

## Issue links in chat

Link every issue ID in user-facing commentary and final responses to its verified
record destination when accessible. Otherwise give the adapter's full locator and
explain the access limit; do not link to stale content or invent a web URL.

## Pull request links

Link verified repository-specific PR URLs in chat and tracker prose; bare `#6` or
`PR6` references can resolve to the wrong repository. Check destinations on readback.

## Present saved work

Run the [progress checkpoint](lifecycle.md#progress-checkpoint) before the final handoff.
After verifying the save, open the destination specified by the stage, normally
the saved document or issue. Use `open_in_codex` with `placement: "right"`.
For a ChatGPT Space Page, use `target: { type: "page", pageId: "<verified Page ID>" }`.
For other verified web URLs, use `target: { type: "browser", url: "<verified URL>" }`.
Follow the bound adapter for local record links.
Link the destination and distinguish saved work from pending writes or a failed
opening. If opening is unavailable, the link is sufficient.
Read-only status does not open migration records unless requested.

### Stage outcome

End with a self-contained outcome linking saved work and its issue. State scope,
completed and unfinished work, evidence or limits, review action, and any blocker
with its resolution. Name the reviewer and how to accept or request changes when
needed. Direct stage calls stop without a next-stage prompt; when workflow coordinates
the request, return the outcome to it.

In chat and migration records, put any stage-local review, setup, or worker message
in a fenced `text` block containing only the message. Include the applicable
[continuation context](#continuation-context) and state where to use it.

### Continuation context

Every generated acceptance, continuation, setup, and delegated prompt must carry:
selected provider ID/name; verified migration-home reference and tenant/workspace or
repository context; selected report store; requested stage/phase/scope and relevant
work/report references. Include the bound adapter's native revision and access
context where applicable.
Execution prompts also carry the selected local/cloud destination and verified
Execution environment reference (or an explicit unsaved gap). Include pending prerequisites
and applicable review authority without implying acceptance or mode switching.

Put these values inside the copied message, not only surrounding prose. Workers
receive the same binding and applicable pinned skills, return findings to the
coordinator, and do not gain record-writing or approval authority from tool access.
On resume, use [binding resolution](issue-systems.md#resolve-a-migration) and current
records; never guess provider from issue-key prefixes or switch on access failure.

### Git delivery handoff

For phase or whole-migration handoffs, identify the migration branch, exact
integrated candidate and covered scope, verification status, and the transformation
report. The report references participating issues whose
[Git delivery histories](../../../transform/references/records.md#record-git-delivery)
retain their branches, commits, and applicable PRs. Link the destination PR with its
actual head and base branches and current status when it exists; otherwise distinguish
an interim handoff from a full-migration publication gap.

Include the same key references in the owning issue's concise handoff comment and
final chat without duplicating issue audit records. For a single-slice handoff,
link the issue and exact tested and integrated revisions. Include its PR or publication
gap when an issue PR was required; identify direct integration when none was required.
Do not create a report solely for that handoff. Read-only status uses the same
presentation in chat without record writes.

Verify PR relationships and candidate identity, mark unavailable facts explicitly,
and distinguish tested commits from newer heads. A destination PR does not establish
a destination merge, deployment, or cutover.

### Try the migrated app

For a runnable application, include **Try the migrated app** in the owning report,
issue handoff comment, and final chat. Link to run instructions at the exact
candidate revision, or an existing preview verified to serve that candidate.
Identify the required host/environment and essential prerequisites. Reuse commands
checked during implementation or verification; report missing or unverified
instructions rather than inventing a working path.

Prefer durable README/runbook links. Label local or temporary previews and access
limits; a stopped localhost URL is not usable. Providing a link does not authorize
launching, deploying, or publishing a service.
