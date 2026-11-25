# Build source graph

Establish the relationships in the recorded source boundary. When an index is needed, use
CodeGraph CLI or MCP queries, following the shared
[query and reuse guidance](../../../codemod/references/codegraph.md#query-and-reuse-the-source-graph).

## Resolve inputs

Read the accepted Source access, Detect the stack, Source completeness, and
Boundary crossings results. Their native dependencies must be resolved before
this check starts. Reconcile their repositories, exact commits, boundary, and
shared inputs with the current intent and actual checkout.

Use direct source and configuration inspection for known callers, entry points,
and boundary crossings. Cite the exact revision, locations, relationships, coverage,
and gaps on this issue. When inspection covers the recorded boundary and establishes the required
relationships and the agreement permits direct evidence, complete the check
with that evidence and skip indexing. If relationships remain
uncertain or indexed evidence is required, follow the
[tool selection and setup rules](../../../codemod/references/environments/README.md#shared-requirements).
Confirm CodeGraph access and language support in this task, reusing current
[Analysis tooling](analysis-tooling.md) results or checking just that capability
here. Route a missing required installation to Initialize.

Include the entire recorded source boundary, even when migration work affects
only part of it, plus the shared code and definitions needed to resolve its
relationships. Record those supporting inputs separately; indexing does not
expand migration intent. If the tool requires a broader repository index, record
that scope and restrict query evidence to the intended boundary and supported
crossing endpoints. Do not silently substitute a sample, omit required roots, or
advance a moving branch. Unknown boundaries or baseline decisions go to initialize.

## When indexed evidence is needed

Apply indexing and query checks only to supported source languages. For unsupported
areas, inspect entry points, imports/calls, configuration, and boundary crossings;
save confirmed relationships and gaps as source/configuration evidence in this
same issue. Skip index operations when no source language is supported, even if
CodeGraph was prepared for the target. Report that limit, not a verified source
graph. Required relationship coverage must still be established; if it cannot be,
or intent explicitly requires indexed coverage, keep affected work open.

Run the following steps only for repositories that need indexed evidence and
have a supported source language. Identify the checkout and index for each result.

1. Inspect the checkout and existing cache before running the release's supported
   initialize, synchronize, or rebuild command. Use its own `.codegraph/` cache;
   never share a mutable index between checkouts. Follow the shared query guidance
   to isolate the recorded baseline from local changes and establish index freshness.
   Preserve unrelated changes; an index containing them is not evidence for the
   committed baseline. Unverifiable source or index state leaves this check unfinished.
2. Index the actual source with a recorded time/resource bound. Inspect status
   after completion: expected root, initialized/complete state, indexed and skipped
   file counts, pending work, exclusions, and freshness. Reconcile counts with the
   stack inventory and completeness findings. A zero exit code, initialized flag,
   or populated database alone does not prove complete coverage or the right commit.
3. Query representative known definitions and relationships across the boundary,
   including a known crossing when available. Compare paths, lines, and endpoints
   with source. Use CLI or MCP against this exact index; report the access method
   actually exercised. Keep unresolved/dynamic edges, unsupported languages,
   intentionally external inputs, and missing required coverage distinct.
4. [Record graph evidence](../../../codemod/references/codegraph.md#record-graph-evidence)
   in this check's findings so later tasks can identify the exact source, index,
   queries, relevant relationship results, and limitations.
   No inferred personas, user journeys, or architectural claims are needed here.

Keep these findings in the check issue. Downstream tasks reuse this evidence and
may reuse or rebuild a matching per-checkout index under the shared query guidance
without rerunning all preflight checks. Missing required coverage, partial indexing,
or unverified freshness keeps this check unfinished under the
[reporting rules](../reporting.md). Refresh affected evidence through this check when
the recorded source or required coverage changes.
