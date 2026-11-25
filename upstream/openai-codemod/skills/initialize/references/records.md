# Initialization records and intent work

Apply the [shared record policy](../../codemod/references/records/README.md) and
bound provider's [adapter](../../codemod/references/records/issue-systems.md#stage-adapters).
**In Progress**, **In Review**, and **Done** mean the saved active, review, and
accepted representations, not hardcoded native names.

## Establish the migration home

Once source and purpose are clear, create or reuse the migration home in the
confirmed destination. For a new home, follow the [naming guidance](../../codemod/references/definitions.md#naming-and-records)
and state its exact name and destination before creation. Save and read back its
Tracking configuration, native identity, and verified record reference. Establish the
initialization groupings required by the bound provider's adapter, start
the [intent work item](#intent-work-and-acceptance), and apply the shared
[migration lifecycle](../../codemod/references/records/lifecycle.md#migration-lifecycle).

Add verified, credential-free resource links for each known source repository and
the migration repository when different. Label distinct roles **Source repository —
owner/repo** and **Migration repository — owner/repo**; a shared repository needs
one link. Source intake does not require a writable source checkout; saving Git-backed
records requires the bound writable coordinator checkout.

## Intent work and acceptance

Use [record setup](../../codemod/references/records/README.md#record-setup) to create or reuse
**Define migration intent — System — Migration** in Migration readiness as soon
as the migration home is known. Apply the shared blocker and lifecycle rules:
**In Progress** while gathering or revising, **In Review** once the document is saved and ready, and
**Done** under the [always-human approval rule](../../codemod/references/records/reviews.md#always-require-human-approval).
Earlier chat intake is not retroactively tracked.

Keep the body short: define and document the intent, then name the adapter's
accepted-state action that records human acceptance. Link **migration intent** to the saved document once it
exists; do not copy the intent or publish a placeholder link. Reuse the established
work owner and the recorded intent reviewer/approver; do not infer approval authority
from the assignee. Resolve the intent approver during initialization.

The current intent issue's **Done** state is the sole acceptance criterion; no
approval-evidence comment, snapshot, or separate proof is required. It resolves the
[intent dependencies](../../codemod/references/records/README.md#technical-work-prerequisites).
Acceptance permits requested readiness work, not implementation.

An authorized user's explicit **Issue integration** choice is execution setup when all
other accepted requirements remain unchanged. Update only that intent field, retain any
replaced choice and reason there as history, and read back the saved value. Do not reopen
intent acceptance or create a revision issue or blockers for this update.

Apply [finding classification](../../codemod/references/records/reviews.md#classify-findings-before-revising-agreements)
before reopening accepted intent. For changes requested before acceptance, resume the same issue.
For corrections to observed facts, use [factual corrections](#factual-corrections-to-accepted-intent).
When changing accepted requirements, outcomes, or constraints, create or reuse
the pending revision's new intent issue and put it In Progress. Before replacing
the saved intent, make the new intent issue a [verified native blocker](../../codemod/references/records/README.md#technical-work-prerequisites)
on every affected unfinished technical issue, including queued, active, and
awaiting-review work. Pause affected execution and acceptance until the revised
intent is accepted; independent work within the previously accepted scope may
continue. Preserve the previous Done issue and dated findings.

After any saved intent revision or factual correction, update affected issue scopes, steps, and required
evidence from the stage specifications. Preserve dated results
and history, identify evidence needing refresh, and do not run the work. A change
that leaves technical scope unchanged need not rewrite those descriptions. Follow
each stage's refresh rules, including [preflight](../../preflight/references/records.md#update-and-hand-off),
[assessment](../../assess/references/records.md#update-and-hand-off),
[behavior extraction](../../behaviors/references/records.md#update-and-hand-off), and
[the brief](../../brief/references/records.md#update-and-hand-off).
Apply [transform reconciliation](../../transform/references/records.md#reconcile-changes)
to affected implementation and phase-verification records already created; do not
create them merely because intent changed.
Refresh affected [final verification](../../verify-target/references/records.md#refresh-and-repair)
so revised inputs cannot inherit a previous candidate's accepted result.

### Factual corrections to accepted intent

Correct verified source observations in place when agreed requirements, outcomes,
and constraints remain unchanged. Fixing a misrecorded URL, path, or SHA for the
agreed source differs from choosing another source, expanding scope, or replacing
a fixed snapshot, which require intent revision. Escalate an unresolved distinction
under the [shared decision rules](../../codemod/references/records/reviews.md#continue-or-escalate-work).

Change only incorrect observed fields. Preserve the user's answers and requirements,
and retain replaced values, date,
evidence, reason, and owning issue link in the intent history. Read back the
correction and link it from that issue; leave intent acceptance Done without new
revision issues or acceptance blockers. For a corrected repository URL, also update
and read back its [migration-home resource link](#establish-the-migration-home)
under the existing role and labeling rules. For a corrected source boundary path,
also update the migration-home synopsis to match the corrected intent and read it
back, preserving unrelated home content. Report partial updates as unfinished.
Apply the downstream refresh rules above; preserved intent acceptance does not
validate stale evidence.

### Save and present intent

Draft from the [intent template](../assets/intent.md) and save as
**System — Migration intent** under the [shared artifact rules](../../codemod/references/records/artifacts.md#migration-reports-and-artifacts).
Partial drafts may be saved; before review, check [intake coverage](gather-intent.md),
ask relevant missed questions, and distinguish requirements, delegated defaults,
proposals, unknown facts, and deliberate deferrals. Read back the saved structure,
required fields, and **User answers** against intake; fix omissions and identify
unrecoverable wording as a gap. A filled template alone does not establish coverage.

Add any [repository resources](#establish-the-migration-home) learned since the home
was established. Save [execution environment details](#execution-environment-details) when substantive.
For Cloud, refresh the [setup prompt](../../codemod/references/environments/cloud.md#prepare-the-setup-prompt)
with verified links and the current decision summary. Link the saved intent from its
work item and put it **In Review** when ready. Verify records and associations,
then [present the migration home](../../codemod/references/records/presentation.md#present-saved-work),
the intent issue and document, and any outstanding setup action. Saving is not acceptance.

When the saved intent is ready for human review, name the mapped acceptance action
and provide a copyable review prompt with the [shared continuation context](../../codemod/references/records/presentation.md#continuation-context)
and verified values:

```text
Accept the saved intent for {{migration name}}.
Issue system: {{selected provider}}.
Migration home: {{verified migration-home reference and provider-specific context}}.
Report store: {{saved store choice and verified destination when applicable}}.
Intent work item: {{verified current intent work reference}}.
Intent document: {{verified saved intent reference}}.
```

### Acceptance in Codex

When the user explicitly accepts saved intent in Codex, mark the current intent issue
**Done** and read back the state. Do not repeat intake, request another acceptance,
or create an approval-evidence comment. If the migration is ambiguous, clarify
which intent issue they mean.

Report the recorded acceptance.

## Execution environment details

Create or reuse **System — Migration execution environment** in the selected report
store, indexed from the migration home, using the [document template](../assets/execution-environment.md).
Follow the [shared lookup](../../codemod/references/records/artifacts.md#execution-environment-details)
and [document save rules](../../codemod/references/records/artifacts.md#migration-reports-and-artifacts).
Save when actual execution choices or setup details exist, without waiting for
setup to finish. Use `Open` for undecided values and `Not applicable` for irrelevant
mode fields; unknown IDs and URLs stay open. Link the verified document from intent
and handoff prompts. Keep the migration home to its overview, binding, and resource index.

After saving and verifying an explicit environment change:

- **Local:** remove the old setup issue's blocking edges from affected technical issues.
- **Cloud or a different cloud environment:** create or reuse setup and verify its
  [readiness dependencies](../../codemod/references/records/README.md#technical-work-prerequisites) before removing superseded setup
  edges. Reuse completed setup only when it covers the chosen environment and
  requirements. Otherwise create or reuse an unfinished setup issue for the new
  choice; preserve the old issue's acceptance and evidence.

Preserve issues, history, and unrelated blockers. Missing metadata is not a switch
to Local. Updating the same choice or optional dependencies does not itself add a
setup prerequisite. If required execution conditions invalidate verification evidence,
follow the applicable [phase](../../transform/references/records.md#reconcile-changes)
or [final](../../verify-target/references/records.md#refresh-and-repair) refresh procedure.
Refresh affected [preflight records](../../preflight/references/records.md#update-and-hand-off) when
execution conditions invalidate their evidence.

For cloud delegation, include the explicit `owner/repo` and chosen environment in
the copyable prompt together with the [shared continuation context](../../codemod/references/records/presentation.md#continuation-context).
Native mention routing, when available, belongs to the adapter.

## Cloud environment setup

For cloud work, create or reuse **Set up Codex cloud environment — System — Migration**
using the [cloud setup template](../assets/cloud-environment.md).
Use [record setup](../../codemod/references/records/README.md#record-setup) and keep it in Migration readiness without a
technical-stage parent. Assign the user responsible for setup; ask if ownership
is unclear. Local work does not need this issue.

Follow the [cloud environment guide](../../codemod/references/environments/cloud.md)
for manual setup instructions and [prompt preparation](../../codemod/references/environments/cloud.md#prepare-the-setup-prompt).
Keep the issue to user steps, the populated tooling prompt, and a
**Share with Codex** handoff. Link a setup chat when supplied. Selected environment
details belong in the execution environment document; the prompt may repeat context
needed for setup.

When the user shares details or a setup summary, save and verify
[execution environment details](#execution-environment-details). Label user-reported readiness
and leave unknowns open. Setup is ready for the shared review handoff when reported
complete and details are saved. A failed write leaves the follow-up unfinished;
preserve a Done state already set by the user.

Filling open setup details preserves intent approval. Done resolves the setup
dependency without an additional proof requirement, but does not automatically
update the environment document: the user must ask Codex to handle the issue or share its
reference in a chat with the selected provider and report-store access. Report the saved
setup state and any unresolved setup action.
