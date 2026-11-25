---
name: status
description: "Report CodeMod migration status from migration records and accessible source without changing migration records or source. Use to identify missing or stale evidence and the next useful action."
---

# Migration status

Follow [shared startup](../codemod/references/shared-startup.md) and keep migration
records and source read-only. Locate the migration from supplied context; clarify
ambiguous matches. Missing access means unknown status, and record existence alone
does not establish progress.

## Inspect

Read the [status record guide](references/records.md) for the requested scope. If the
request or verified records establish the default workflow, compare its expected
records and follow [progress view startup](../workflow/references/progress-view.md#start-or-resume).
Otherwise report the requested or recorded scope without opening a seven-step view
or treating absent default-workflow records as missing work.

## Report and stop

Use the [stage outcome](../codemod/references/records/presentation.md#stage-outcome)
to report work in scope, human checkpoints and delegated review, evidence freshness,
material gaps, and the next useful action. Keep the response concise with supporting
links. Distinguish technical readiness, native acceptance, and migration completion;
identify the owning skill or reviewer without inventing one or generating a
continuation prompt. When implementation Git artifacts exist, use the
[Git delivery handoff](../codemod/references/records/presentation.md#git-delivery-handoff)
with issue-owned audit references and the exact candidate's verification status.

Refresh an active default-workflow [progress view](../workflow/references/progress-view.md#refresh)
with these findings. Use read-only tools and Git commands, such as
`git --no-optional-locks status`, except for that thread-local display. Do not edit
migration records or repository files, repair records, clone, fetch, create worktrees,
commit, run checks, or start another workflow. Graph queries must not implicitly index
or synchronize; use saved evidence when a nonmutating interface is unavailable.
