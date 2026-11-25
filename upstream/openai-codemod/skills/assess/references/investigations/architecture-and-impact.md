# Architecture and migration impact

Start from intent and the source-access, stack, completeness, and boundary-crossing
findings, plus the **Build source graph** result and its recorded evidence. Follow
[source graph reuse and queries](../../../codemod/references/codegraph.md#query-and-reuse-the-source-graph)
to verify the exact source commit, boundary, coverage, and applicable index identity.
Use the check's direct inspection evidence or query its verified index as needed.
Preflight owns initial readiness and material gaps.
Keep the recorded source baseline fixed: a graph of changed target code cannot
prove source behavior.

## Build the architecture inventory

- Group source into components with coherent responsibilities. Give each a stable
  assessment identifier, distinct from graph symbol IDs, and repository-relative
  boundary; reuse identifiers on refresh. Explain overlapping boundaries and shared
  code so later investigations can divide work without silently omitting or
  double-counting it. Include unchanged dependencies needed to understand affected
  behavior.
- Find entry points in routes, jobs, queue subscriptions, deployment configuration,
  and source. Resolve dispatch through configuration, dependency injection, and
  generated wiring where possible.
- Record connections as calls, dispatch, events, reads, or writes. Join logical
  stores to their mappings in configuration or schemas; inspect SQL and stored
  procedures where relevant. Cite source/configuration for each material connection.
  A static graph edge alone does not establish data access or runtime behavior.
- Trace important flows from their triggers through component IDs, data changes,
  and external interactions. Identify contracts to preserve, including ordering,
  failure behavior, APIs, schemas, files, UI, and operational interfaces as relevant.
  Mark inferred steps or ordering; static calls alone do not prove runtime order.
  Use stable flow IDs and retain existing names and anchors on refresh.

The separate [actors and journeys investigation](actors-and-journeys.md) owns
roles, goals, and business-language journeys. Use known journeys to prioritize
technical tracing; synthesis connects the two investigations through these
component and flow IDs.

Use existing dependency exports or language tooling when suitable, spot-checking
edges against source. A missing static reference does not prove unused code;
record unresolved dynamic dispatch and inaccessible consumers as unknowns.
Map enough to support decisions; prioritize affected flows in large monorepos.
Propose focused deeper mapping only where uncertainty materially changes the approach.

## Evaluate migration impact

Explain coupling, shared state, deployment boundaries, ordering constraints, and
seams for a pilot where useful. For a decided target, compare affected APIs,
dependencies, runtime requirements, data semantics, and deployment constraints
against its version-specific requirements and breaking changes. Verify material
compatibility and support claims against current official documentation. If target
choices remain open, record constraints and conditional options without adopting one.

For each material impact, state the affected component, why the intended change
reaches it, compatibility implications, and confidence. Cite source and official
target documentation for compatibility findings; distinguish confirmed conflicts
from assumptions needing validation. Documentation and a working target scaffold
do not prove migrated application behavior.

Available runtime telemetry may identify critical or variable flows; record its
time window and environment separately from source evidence. Do not invent
production behavior from configuration.

Recommend investigation priorities and a pilot only where it would reduce risk
or uncertainty; explain when a direct migration is more appropriate. Do not choose
a final target architecture or expand scope. Return conflicts and human decisions to
initialize.

## Record and check coverage

Use the **Architecture and migration impact** structure in the
[assessment template](../../assets/assessment.md#architecture-and-migration-impact)
for this investigation's Findings: components, connections, important flows,
coverage and gaps, and migration impact. Synthesis carries these records into the
migration document in the selected report store under [reporting](../reporting.md); the child does not update
that document. Add a small diagram or link an existing one when it clarifies the
records, retaining a text explanation. Link the
[graph evidence](../../../codemod/references/codegraph.md#record-graph-evidence), including
queries, key relationships, and supporting source references.

Before completing, account for relevant areas as inspected, partially inspected,
not inspected, or excluded with a reason. Check boundaries, citations, and revisions;
resolve connections and flow steps to components, stores, external systems, or
explicitly unresolved endpoints. Account for paths needed by known journeys and
explain the consequences of coverage gaps. Unknown user context does not establish
that a source flow or permission is absent.

The inventory should support focused downstream investigation. Representative flows
and graph coverage do not establish exhaustive architecture or behavior coverage.
