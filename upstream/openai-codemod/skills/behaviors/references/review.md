# Review saved behaviors

Every current behavior needs human approval, individually, by explicit batch, or as a
catalog. Agents may verify and record feedback but cannot approve behaviors.

## Load and select

Read accepted intent for scope and authority, the saved catalog, extraction parent,
relevant child results, blockers, and feedback on both the issue and catalog. Review-only
work needs no checkout or new preflight checks. Review the requested scope, prioritizing
flagged or consequential behaviors; a subset does not approve the rest.

Identify the [reviewed content](reporting.md#identify-and-reuse-evidence) and reuse clear
existing answers. Unsaved or inaccessible content, ambiguous scope or feedback, and
silence cannot establish approval.

## Ask and distinguish the decision

Present the behavior, its material conditions and exceptions, and the question requiring
judgment. Use short batches with these choices:

| Choice | Meaning and action |
| --- | --- |
| **Approve behavior** | Accept the saved description of current behavior, including qualifications; intent determines whether to preserve or change it. |
| **Correct extraction** | Flag a wrong or incomplete description as disputed and return it to its package for source review. Do not use it as an expected result while pending. |
| **Propose behavior change** | Preserve the observed behavior and route the proposed change through initialize. |
| **Needs discussion** | Record the uncertainty and its effect on downstream use. |

Human approval does not establish source verification, actual execution, or
authority to implement. A behavior-change proposal never rewrites observed behavior.

## Record and hand off

Keep original discussion in native comments; record chat answers verbatim with caveats,
attributing them to the person who answered and identifying Codex as the recorder. Update
the catalog's **Human review** table with the reviewed scope and version, decision and
exceptions, and original feedback link.
Record a batch decision once, preserve disagreements and attribution, and verify the save.

Apply [Human action required](../../codemod/references/records/reviews.md#human-action-required)
while a decision is pending. Once required technical work is complete, keep the extraction
parent awaiting review until every current behavior is approved. A human marking the parent
Done accepts the saved catalog it identifies; Codex may mark Done only after explicit human
approval covers every current behavior. Technical child completion cannot substitute for
catalog approval. Keep unresolved candidates and proposed changes out of approved expectations.
Run the [progress checkpoint](../../codemod/references/records/lifecycle.md#progress-checkpoint),
report the [stage outcome](../../codemod/references/records/presentation.md#stage-outcome),
and stop after the review.
