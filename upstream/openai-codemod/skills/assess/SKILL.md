---
name: assess
description: "Assess migration impact, architecture, actors and journeys, maintainability, verification, and security from source and readiness evidence. Work on a migration investigation issue or synthesize reviewed investigations into the migration assessment document."
---

# Assess a migration

Explain what the agreed migration involves, its risks, and a suitable approach.
Follow [shared startup](../codemod/references/shared-startup.md) before beginning.

## Prerequisites

Use accepted intent and current source-readiness evidence for the selected
investigation, normally produced by `codemod:preflight`. Synthesis needs its
reviewed investigations; it does not wait on the entire preflight parent. Apply the
[shared prerequisite rules](../codemod/references/records/README.md#prerequisite-evidence).

## 1. Load context and select work

Create or repair only the requested assessment records under the
[record specification](references/records.md). Resolve the issue and migration home,
saved intent, any existing assessment document, and current source-readiness findings
through native associations. Read the migration's
[execution details](../codemod/references/records/artifacts.md#execution-environment-details)
and the [assessment dependency graph](references/records.md#dependencies).
Create and link the assessment report when you have reviewed findings to summarize.

For a child invocation, run only that investigation. For an assessment-wide request,
work only on eligible child issues; leave the parent untouched until its native
blockers resolve. A synthesis-only request reads saved evidence without running
investigations. Honor any later stop.

## 2. Investigate

Skip this section for synthesis-only requests.

Read available **Analysis tooling** results for executables, versions, capabilities,
coverage, and fallbacks, and **Build toolchain** results for execution evidence.
Reuse current evidence only for the matching source revision, boundary, and relevant
runtime; retain other results as attributed context. CI evidence does not prove
execution here. Verify the active checkout against the recorded baseline without
silently advancing it. Request a focused preflight refresh for stale or missing
prerequisite evidence.
Unresolved target tooling does not prevent source assessment. Missing source
execution evidence limits behavioral conclusions.

Read the [selected investigation procedure](references/records.md#investigations)
and follow [shared execution safety](../codemod/references/execution-safety.md) for
any commands. Prefer suitable capabilities verified in saved tooling results; do
not install dependencies, configure environments, or modify application source.

Use the recorded source boundary for context and migration scope for affected parts.
Optional telemetry enriches findings; its absence is a stated limit. Keep facts,
inferences, and recommendations distinct and cite source under the shared
[source-reference rules](../codemod/references/definitions.md#source-references).

For multiple independent investigations, prefer parallel native subagents when
available and useful, within the runtime's concurrency and delegation limits.
Actor discovery and architecture can run independently; synthesis reconciles their
journey-to-flow links after both investigations are reviewed.
Assign one writer per child issue. The chat coordinates these investigations;
the blocked synthesis parent remains untouched. Work sequentially when
delegation is unavailable or adds little value.

Give each agent the issue/migration and intent IDs, source repository and commit,
boundary and migration scope, selected runtime, relevant preflight evidence,
investigation reference, and required outputs. Have it read this skill, its
procedure, and current issue/blockers before starting. It owns only that child's
result and comments, and returns its issue link, outcome, key findings, gaps,
and save/review status.

Wait for dispatched agents before the final handoff. If an agent fails or stops,
retain available evidence and report unfinished work. Re-read the saved child
results and native states; a completed agent turn alone does not resolve review blockers.

## 3. Record or synthesize

Follow [reporting and synthesis](references/reporting.md).
Run the [shared progress checkpoint](../codemod/references/records/lifecycle.md#progress-checkpoint)
before handoff, including when synthesis is ready for review or accepted.
Use the [shared handoff](../codemod/references/records/presentation.md#present-saved-work)
to open the investigation issue or synthesized assessment document.
Stop before implementation planning, source changes, pull requests, or fixes.

This skill covers one migration. Portfolio ranking, delivery estimates, and
exhaustive system mapping are outside this scope.
