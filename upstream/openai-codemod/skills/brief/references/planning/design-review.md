# Review a significant target design

Use an independent AI reviewer when a proposed design materially changes service
boundaries, data ownership, failure behavior, or important quality requirements,
or when complexity and tradeoffs warrant challenge. Keep routine, well-understood
changes in normal brief synthesis; this is not a mandatory review for every migration.

## Queue the review

Create or reuse **Review target design — Scope** under
[planning records](../records.md#additional-planning-children), using the existing planning issue template
in **Readiness**. Record why review is useful, the design boundaries,
input identities, and completion criteria. Procedure identifies `codemod:brief`
and this reference. One bounded review may cover related decisions; split only
where independent responsibilities warrant it.

Review a concrete proposal: relevant sections of the saved draft brief or a
planning child's design, with its content identity. The proposal need not already
be accepted. Queue the review once that input exists, or depend only on the child
producing it. The review blocks final synthesis, never depends on the brief parent
being Done, and does not depend on implementation. If added during synthesis,
pause the parent while the review child handles findings and proposed revisions.
Resume synthesis after the child is complete.

## Run an independent review

Use a bounded read-only native subagent that did not author the proposal. Supply
the issue scope, exact proposal, accepted intent and authority limits, relevant
assessment/graph findings, approved behaviors, accepted criteria, and target-stack
guidance. Include consumer contracts, quality criteria, and migration constraints
that apply. The reviewer returns findings; the coordinator writes migration records.
If independent review is unavailable, record the gap and leave the review
incomplete; self-review must not be presented as independent review.

Ask the reviewer to challenge:

- Whether the design meets intent, behavior and consumer commitments, and relevant
  quality requirements; distinguish evidence from assumptions.
- Whether fewer services, abstractions, dependencies, or operational components
  would meet those needs with less complexity.
- Ownership of data and writes, boundary contracts, and behavior under partial
  failure, retries, concurrency, or recovery where relevant.
- Incremental delivery, coexistence, reversibility, and whether the proposed tests
  can demonstrate the required behavior and quality.

Return concrete findings with the affected proposal section, supporting evidence,
consequence, and a simpler alternative or correction where useful. Distinguish
material problems, open questions, and optional improvements; no finding quota.
Do not redesign outside agreed scope or rerun upstream checks during review.

## Resolve and incorporate

Record findings and their disposition on the review issue: adopted correction,
reasoned rejection, or unresolved decision. Retain the reviewed proposal identity
and evidence. Record scoped proposed corrections on the child within existing authority;
ask the independent reviewer to recheck material corrections. Unresolved ambiguity
or high-risk decisions use the shared escalation rules, not an agent waiver.
Honor decisions expressly reserved to humans.

Once material findings are resolved and the result is saved/read back, complete or
route the review issue under the [agreed review authority](../../../codemod/references/records/reviews.md#review-and-approval).
Once accepted, summarize reviewed decisions and rationale in the draft and backlog
under the [planning boundary](migration-plan.md#plan-the-agreed-migration).
Link the detailed proposal and review rather than reproducing them. Confirm that
synthesis has not materially changed the reviewed design; refresh affected review if it has.

Human approval remains on the saved brief and its queued implementation breakdown
under [brief acceptance](../reporting.md#review-and-hand-off). Completing the review
child does not approve the brief or authorize implementation. Keep findings on the
issue and adopted decisions in the existing brief; no separate review report is needed.
