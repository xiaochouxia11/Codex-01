# Partitioning and delegation

## Establish the work packages

Work the planning child using the [stage record rules](../records.md).
Start with the assessed component IDs, boundaries, typed connections, and important
flows. Preserve flow IDs where available; otherwise use the assessment's flow
names or anchors. Use the graph to find source relationships, not to infer business
meaning or assume completeness. Reuse assessed
[actor and journey references](../../../assess/references/investigations/actors-and-journeys.md)
(`ACT-*`, `JRN-*`) where relevant; keep them separate from technical flow IDs.
Journeys test coverage across packages, rather than defining a package per persona.
Return material missing context to its owner instead of inventing roles.

Give each package a durable ID and one coherent responsibility: an operation,
component, or related set of decisions. Record its primary source units, context
dependencies, exclusions, and questions to answer. Primary ownership must be unique;
shared utilities or behaviors have one owning package and may supply context to others.
Preserve links between packages when behavior crosses their boundaries.

Reconcile the planning child's coverage allocation with every assessment component,
source area, important flow, and known journey relevant to the agreed extraction
scope. Each needs one or more package assignments, an explicit exclusion with its
reason, or a recorded coverage gap. Do not silently
drop required areas that are difficult to partition or absent from the graph.

Include enough surrounding source to interpret a behavior: entry conditions, callers,
callees, types, constants, error handling, persistence, and relevant configuration.
Inspect SQL, stored procedures, schemas, triggers, templates, and deployment wiring
when they determine behavior, including sources absent from CodeGraph. Missing
edges do not establish independence. Retain inaccessible dependencies as gaps.

Size packages to fit a worker's context and inspection budget. Split large work at
meaningful contracts, retaining shared context and unresolved crossings. Avoid
arbitrary file counts or token slices that separate a condition from its outcome.
Fill small inventory gaps while partitioning; return material contradictions or
missing required architecture evidence to assessment without rewriting its report.

## Dispatch bounded batches

Read child issue states, comments, and dependencies before dispatch; work only
eligible packages. Start with one representative package to check granularity, evidence quality, and
the return format before wider fan-out. Reuse its verified results in the catalog.

Use available native subagents for independent packages, leaving capacity for the
coordinator and later verification. Respect actual concurrency and tool limits;
dispatch further batches as capacity becomes available. Work sequentially when
delegation is unavailable or adds little value. Subagents run in the active task's
environment; do not assume they launch separately configured cloud jobs.

Give each worker:

- The exact package issue, parent/migration-home and intent references, any saved catalog,
  pinned source identity, and cited relationship evidence from direct inspection
  or the selected index.
- Its package ID, responsibility, component/flow and relevant actor/journey
  references, primary units, shared context, exclusions, and specific questions.
- This skill, the [extraction procedure](inspect-and-verify.md), catalog
  template, evidence requirements, and a bounded inspection budget.

Workers are read-only: inspect source and existing evidence, query any selected index
under the [read-only query rules](../../../codemod/references/codegraph.md#query-and-reuse-the-source-graph), return findings, and
leave file changes, test execution, and tracker or report-store writes to the coordinator. Return
candidate rows and any necessary behavior details using the catalog format, source
units actually inspected, cross-package dependencies, uncertainties, and verification
performed. Supply shared context once and identify which behaviors use it. Preserve
complete behavior and evidence without repeated boilerplate or a forced example
per behavior. Report unfinished work explicitly; a successful agent turn is not a
completeness claim.

Wait for all dispatched workers. Reconcile and checkpoint each batch before issuing
more work. Retry only an unfinished package after diagnosing the cause, correcting
inputs, or splitting it into smaller packages; preserve all remaining required
work in the package issues. Repeated identical failure needs a recorded follow-up.
Do not discard completed findings or repeatedly restart the full extraction.
Use the same read-only contract for verification workers, assigning different
authors where practical. The coordinator remains the only record writer.
