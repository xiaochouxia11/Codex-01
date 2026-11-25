# Reviews and decisions

## Review and approval

Apply the involvement and decision authority in accepted intent, including any
work-group or decision override. State each issue's reviewer, acceptance authority,
and conditions for Done; link the agreement instead of copying this policy. An
assignee, agent-led label, or maintenance preference does not establish authority.

Codex may complete eligible work only when completion is explicitly delegated and
required work, verification, and review are complete. Self-verification is not
independent review. When authority is unclear, save the work and leave it In Review
for human acceptance; name the reviewer or report the gap.

Expanded delegation requires accepted intent; human limits and stop instructions
apply immediately. Delegation never waives scope, checks, blockers, stage stopping
points, repository/tool approvals, or the checkpoints below.

### Always require human approval

These checkpoints apply at every involvement level:

| Checkpoint | Required action |
| --- | --- |
| Intent | A human accepts the saved intent under initialize's [acceptance procedure](../../../initialize/references/records.md#acceptance-in-codex); later changes follow its [revision rules](../../../initialize/references/records.md#intent-work-and-acceptance). |
| Behaviors, including revisions | A human approves every current saved behavior individually, by explicit batch, or as a catalog under the [behavior review procedure](../../../behaviors/references/review.md). |
| Migration brief and revisions to agreed outcomes or constraints | A human accepts the saved brief and prepared work breakdown under the [brief review procedure](../../../brief/references/reporting.md#review-and-hand-off). |
| An unresolved failed result | A human decides the repair or scoped exception under [failure review](#failure-review). |
| Unresolved ambiguity or a high-risk decision | A human resolves the affected ticket under the [escalation rules](#autonomous-work-and-escalation). |

Technical review of child issues does not accept the owning human checkpoint.
Honor current accepted records without adding evidence gates; substantive changes
follow the owning stage's revision procedure. Acceptance does not authorize new
work beyond the user's request.

### Human action required

Apply the adapter's **User Required** marker to the issue owning human execution,
input, review, or approval, including before agent work begins. Preserve unrelated
labels; delegated agent review alone does not require this marker.

Comment with the reason, owner if known, exact action, and relevant links or options.
Distinguish acceptance of finished work from clarification before work can resume.
Reuse an existing comment only when retrying the same request.

Keep affected work paused until the action is resolved. Check the description,
comments, and acceptance state; remove only this marker when no human action remains.
Clarification permits eligible work to resume but does not complete it. Markers
neither grant approval nor replace blockers; read-only status never changes them.

### Failure review

When a failure remains after permitted diagnosis or retries, or requires out-of-scope
work, move the owning issue to **In Review** and apply [Human action required](#human-action-required).
Explain the failure, impact, evidence, and proposed repair, retry, or decision.
Expected negative tests and failures resolved during authorized work need no escalation.

A user may request a repair or explicitly accept a scoped exception. Record the
decision without turning failed evidence into `passed`; acceptance and technical
success are separate. Keep other unresolved failures open.

## Autonomous work and escalation

### Classify findings before revising agreements

Flag findings on the owning issue first, with evidence, impact, and any decision
needed; apply [Human action required](#human-action-required) when user input is needed.
Distinguish corrections to source understanding and implementation refinements from
changes to agreed requirements. Reopen intent only for changed requirements,
outcomes, or constraints; use Initialize's [factual correction procedure](../../../initialize/references/records.md#factual-corrections-to-accepted-intent)
for incorrect observations. Apply the brief's [revision procedure](../../../brief/references/reporting.md#refresh-without-inheriting-acceptance)
to plan changes. Record the decision, refresh affected evidence and work, and
preserve unaffected acceptance. Corrected behavior claims still require catalog
revision and approval.

### Continue or escalate work

Continue eligible work within the requested stage, scope, and authority. Refresh
dependency and decision states after each outcome so newly eligible work can proceed,
including work independent of an issue awaiting review. Honor review-before-work
requirements and stage stopping points; finish or await delegated work before handoff.
When no requested work can proceed, report the review or blocker action.

Pause affected work when material ambiguity remains after checking available evidence
or a decision introduces high risk, such as data loss, breaking external consumers,
security-sensitive changes, or irreversible production effects. Routine choices
within agreed constraints may proceed. Reuse explicit decisions for the same action
and scope; changed facts or risks need renewed review.

Save the findings, keep the issue open in the provider’s state for pending decisions, and apply
[Human action required](#human-action-required). Include the ambiguity or risk,
evidence, options, recommendation, and decision in the issue comment; surface the
issue link and question in chat. Do not complete unfinished work or create a duplicate
approval ticket.

Record the decision and resume **In Progress** when prerequisites allow. Changes to
intent or the approved behavior catalog follow their revision and human-approval procedures first.
