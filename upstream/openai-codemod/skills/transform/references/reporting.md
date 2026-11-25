# Record transformation evidence

Use the [slice template](../assets/slice-issue.md) for each implementation unit and
the [phase issue](../assets/transformation-issue.md) plus
[transformation report](../assets/transformation-report.md) for aggregate synthesis.
Follow the [shared record rules](../../codemod/references/records/README.md) for
storage, states, review, and acceptance, and
[current-content maintenance](../../codemod/references/records/artifacts.md#maintain-current-content)
when updating issues or reports. Add [actual work intervals and timing](work-burndown.md#record-work-evidence)
to the owning issue as work proceeds.

## Save a slice result

The coordinator saves each slice's implemented scope, source-to-target mapping,
executed development checks and actual results, any required failing-control evidence,
independent code review, remaining gaps, and artifact references on its issue. Workers
return evidence; they do not write shared records. Link original run evidence; keep
full logs with their originating artifacts. Follow
[UI screenshot guidance](../../codemod/references/records/artifacts.md#ui-screenshots)
when applicable.

Bind results to the accepted brief phase, reviewed behavior versions, applicable
target guidance, source baseline and [graph evidence](../../codemod/references/codegraph.md#record-graph-evidence),
scenario and assertion identities, target/test/fixture revisions, execution
environment, and original run and review times. Verify published artifacts match
the tested candidate; a branch name or PR URL alone is insufficient. Record useful
pilot or repeated-work lessons and their evidence; carry accepted patterns into
later implementation work and surface shared guidance updates to the owning skill.

| Outcome | Meaning |
| --- | --- |
| `transformed` | The requested implementation scope meets its owned criteria, including scoped development checks, independent code review, any required failing control, required issue integration, and artifact handoff. |
| `failed` | A required implementation check or owned criterion fails. |
| `blocked` | A missing prerequisite prevents required work. |
| `not_run` | Required work is unstarted, partial, or otherwise incomplete. |

Required failures take precedence over blocked or unrun work. Keep limitations
explicit; an agreed difference needs its own approved expectation and passing check.
Technical outcomes do not supply native acceptance or establish full phase exit.

## Aggregate the phase

An eligible slice may integrate into its immediate parent while the aggregate remains
blocked; do not execute blocked aggregate checks or synthesis. Once eligible,
synthesize current accepted slice results and create or reuse the phase transformation
report only when there is substantive content. Link the report from the aggregate
with concise conclusions and links to the owning evidence.

Reconcile the required implementation components, behaviors, scenarios, consumer
contracts, and data/state transitions against current slice evidence. Unassigned
work or stale evidence remains a gap even if every existing slice is Done. Establish
current evidence for any required cross-slice integration from its actual owner;
isolated passing suites do not establish integration.

The aggregate is `transformed` only when its required implementation scope and
owned development and integration criteria are satisfied. A pilot or subset cannot
complete a broader aggregate. Record implementation acceptance separately from
independent phase verification and externally owned criteria; these remain part of
phase exit. Do not infer source-to-target parity, migration completion,
destination merge, deployment, or cutover from this outcome.

For a full-phase request, once substantive phase synthesis exists, record the
[phase-exit reconciliation](verification-loop.md#continue-the-phase-loop) in the
existing transformation report, linking each criterion's current evidence
and agreed acceptance. Keep the independent verification issue and report authoritative
for that check. An implementation-only result leaves phase exit unresolved; do not
reopen unchanged implementation merely to record a later phase-exit disposition.

## Refresh and hand off

On resume, compare the current approved inputs, source baseline, graph evidence,
target candidate, dependencies, and checks before reusing a result. Revalidate and
review affected work when substantive changes invalidate its evidence; editorial
or demonstrably unrelated changes do not require a blanket rerun. Preserve original
evidence and acceptance as history; an earlier pass does not cover changed scope or
a changed candidate. Use [record reconciliation](records.md#reconcile-changes) for
affected transformation records, and report any affected external obligations to
their owners.

Save and read back the scoped issue or report and exact artifact references. Follow
the [stage outcome](../../codemod/references/records/presentation.md#stage-outcome)
and applicable [Git delivery](../../codemod/references/records/presentation.md#git-delivery-handoff)
and [runnable-app](../../codemod/references/records/presentation.md#try-the-migrated-app)
handoffs. State the implemented scope, candidate, actual check results, reviews,
applicable PRs, unresolved obligations, and the next review or blocker action. Link
any applicable failing-control or integration evidence.
Keep required work open until its technical criteria, any required publication, and agreed review
are complete. Report the result at the requested scope; distinguish implementation
acceptance, independent phase verification, and phase exit. At full-migration
implementation handoff, follow [Git delivery](git-delivery.md#hand-off-the-full-migration)
to open or reuse the destination PR.
