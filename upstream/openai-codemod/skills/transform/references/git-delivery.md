# Plan and maintain Git delivery

Use one migration integration branch for the migration repository across phases.
It is distinct from the agreed destination branch and any provider state branch.
It accumulates completed coding work and supplies exact candidates for phase and
whole-migration verification. The destination PR is the single cumulative review
surface. Coding issues reach their immediate integration parent through the issue
integration choice recorded in accepted intent.

## Verify the issue integration choice

At the start of coding work, verify the saved choice against repository rules and
permissions. **Issue PRs** requires access to publish and merge issue PRs; **Direct
integration** requires permission to update the parent without an issue PR and a way to
satisfy its gates. This check is read-only.

Use a feasible saved choice without asking again. If the choice is missing, `Open`, or
infeasible, identify the feasible approaches. If there are none, report the blocker.
Otherwise, hand off to `codemod:initialize` with the saved intent reference, current
choice, feasible approaches, and constraints. Initialize owns asking the authorized
decision-maker and [recording the choice in intent](../../initialize/references/records.md#intent-work-and-acceptance),
including save, readback, and handoff. Transform does not edit intent. Pause affected
coding work until Initialize returns the verified saved choice; then recheck feasibility
and resume the requested Transform scope. An individual issue awaiting CI or review is
not by itself an infeasible approach.

## Establish the migration branch

Resolve the migration repository, agreed migration branch, and its destination
from accepted intent. During planning, each coding issue records its proposed branch and immediate
parent. Transform creates the actual refs and PRs. Inspect remotes, refs, worktrees, existing PRs, and
uncommitted human changes; verify the destination, ownership, ancestry, and name
collisions before creating or using a branch. Reuse the authoritative migration
branch if it already represents the work; otherwise create it from the agreed
destination following
[shared branch naming](../../codemod/references/definitions.md#migration-branches).
If the accepted delivery explicitly includes Git-provider state history, use the
agreed verified base allowed by the [bound adapter](../../codemod/references/records/git/records.md#writes-and-checkpoints).
An unresolved destination or collision blocks affected integration; never reset,
overwrite, or rename human work to match a proposal.

Before publishing a branch or PR, check its outgoing history and target diff against
the authorized destination and scope, including inherited migration records. Apply
the bound provider's publication limits. Git-backed issue records remain on the
single bound state branch; neither the migration integration branch nor its issue
branches become record authorities.

## Integrate coding issues

Give each coding issue an isolated branch and identify its immediate integration parent,
normally the migration branch. Branch from another coding issue only when that
issue owns the combined implementation. Such nesting may repeat as needed; tracker
parenthood and readiness or verification blockers alone do not imply Git ancestry.
An issue with no code change needs no branch or PR. Workers return their results;
the transform coordinator owns publication, integration, and audit records.

Once required descendants have integrated, the coordinator integrates the issue into
its verified immediate parent only after scoped implementation checks, required
independent review, agreed acceptance of the tested candidate, and repository gates
pass. Use the repository's permitted integration method. A terminal tracker transition
is not itself an integration prerequisite.

- **Issue PRs:** Publish a short-lived PR from the issue branch into its immediate
  parent for review and checks, then merge it.
- **Direct integration:** Prepare and validate the candidate without advancing the
  parent. Serialize updates, confirm the expected parent revision, then update the
  authoritative ref without an issue PR.

If a parent advanced, reconcile the actual diff, resolve conflicts within the accepted
scope, and refresh affected checks, review, and acceptance before integration. A blocked
PR or unavailable operation leaves integration pending; continue independent eligible
work. Confirm the resulting
authoritative parent revision and save the [issue Git delivery record](records.md#record-git-delivery)
before an authorized completion transition. If a human already marked the issue Done to accept the work,
reconcile any pending integration before dependent code work consumes it. A coding
issue's delivery is complete only once its required changes have reached its
immediate parent; neither an open PR, a local-only revision when a shared remote is
authoritative, nor a tracker status alone establishes integration.

Individual issue integrations do not execute or complete a blocked phase aggregate.
After its prerequisites are met, the aggregate reconciles all required work and
checks against the exact migration-branch candidate. Dependent work consumes the
integrated parent state rather than an open predecessor PR.

## Hand off the full migration

At full-migration implementation handoff, confirm that the migration branch contains
the required integrated work and open or reuse one PR from it to the agreed
destination. A slice or interim phase handoff does not create this PR. Keep it draft
while required final verification is pending; the transform coordinator may mark it
ready when that verification and required repository gates apply to its current
candidate. A repair that makes required verification pending again returns the PR
to draft. If publication, draft state, or readiness cannot be established, report
the specific gap without substituting a duplicate or misleading PR. The coordinator
maintains this PR through repairs; the verifier links it and hands back the exact
candidate and verification outcome for PR readiness. Merging the destination PR,
deployment, and cutover are separate actions outside transform.

## Resume and repair

Reconcile recorded branches, PRs, repository state, and evidence on resume. For a
legacy stack, identify the authoritative migration branch and preserve existing
issue/PR history before adapting eligible work; do not rewrite or discard healthy
work merely to match the new model. Record retargeting, replacement, closure, or
other meaningful changes. After any candidate or ancestry change, refresh only
affected evidence and preserve prior results as history. Repairs follow the same
issue integration procedure.
