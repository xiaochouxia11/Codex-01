# Source-quality analysis

Run this analysis in the **Maintainability and verification** assessment issue,
using capabilities verified by [Analysis tooling](../../../preflight/references/checks/analysis-tooling.md).
Select only the measurements that answer the investigation's question under the
[tool selection rule](../../../codemod/references/environments/README.md#shared-requirements).
Follow the corresponding procedures below. When direct inspection answers the
question, cite the source and record the limits of that inspection.

| Tool | Responsibility |
| --- | --- |
| scc **or** cloc | Source-size baseline: files and code/comment/blank lines by language. Run one counter. |
| jscpd | Duplicate groups, heuristic complexity hotspots, and supported dead-code candidates. Its scan line counts describe coverage and duplication denominators, not the whole-source LOC baseline. |
| Lizard **or** a language analyzer | Function-level complexity for supported source languages. Use one suitable analyzer per language. |
| CodeGraph | Relationships needed to interpret material findings: callers, dependencies, and boundary crossings. |

Avoid overlapping scans without a useful new signal. Installation belongs to
[environment setup](../../../codemod/references/environments/README.md).

## Scope the analysis

Follow [execution safety](../../../codemod/references/execution-safety.md) and use the
recorded source revision and boundary. Reuse measurements only when their source,
configuration, and coverage still match. Inspect effective configuration before
running; preserve repository configuration and write reports or temporary
configuration outside application source. Use consistent source boundaries and
exclusions across tools, and record differences caused by language support or scan
filters. Exclude generated, vendored, dependency, and build-output noise; keep
application and test code distinguishable.

## Measure size

Run one available scc or cloc counter for language-aware LOC, grouping by language
and affected component where useful. Record analyzed files and code/comment/blank
lines; distinguish application, test, and generated/vendor scope. Reuse preflight's
file inventory for coverage, not as a substitute for LOC. Without a suitable
counter, use labelled physical line counts and state what they include.
Keep counts descriptive; they do not measure complexity, risk, or migration effort.
If scc also emits a complexity heuristic, keep it labelled separately from jscpd's
estimate; do not combine the scores or run both counters to reconcile unlike metrics.

## Run jscpd checks

Run the mode that answers the assessment question. Check options in the
installed release's help.

- **Duplication:** run a clone scan and save the JSON results. If the same
  investigation needs complexity hotspots, include the supported complexity
  summary in that scan. Start with exact
  matches; enable renamed/near-miss detection only when useful and record its
  thresholds. Inspect material groups and their differences in source. CX is a
  token-derived cyclomatic-complexity estimate for prioritization; it is not a
  precise function metric, migration-risk score, or effort estimate.
- **Dead-code candidates:** run `--dead-code` separately where the installed
  release supports the language/framework. Read manifests and verify entry points,
  workspace resolution, dynamic loading, and external consumers before interpreting
  reachability. Scan enough of the recorded boundary to retain that context; when
  it is unavailable, state the limitation. Preserve parse gaps and confidence reasons.
  Broad duplication-format support does not imply dead-code support. Reuse
  matching diagnostics rather than starting a new build here.

Record actual scanned files/formats and unsupported or skipped areas; empty or
partial output is not a clean result. Interpret documented exit codes alongside
diagnostics and report validity: a completed scan reporting clones is a finding,
not automatically a failed execution. Do not suppress execution errors or invent
a duplication threshold. Health scores, history scans, and experimental semantic
comparison are not required for this workflow.

## Measure function complexity

Run Lizard or a suitable language analyzer for each supported source language.
Record function locations, reported metrics, parser limits, and material hotspots.
Keep these measurements separate from jscpd and scc heuristics; do not combine
unlike scores or run equivalent analyzers over the same scope without a distinct
purpose. No score establishes a cleanup quota or migration acceptance threshold.

## Record findings

Save version, source identity, command/configuration, coverage, and linked raw
results in the **Maintainability and verification** issue under the
[artifact rules](../../../codemod/references/records/artifacts.md#migration-reports-and-artifacts).
Interpret material findings under [maintainability](maintainability-and-verification.md#record).
A match does not establish equivalent behavior; an
unreachable declaration is not proof it can be deleted. Brief decides which
improvements belong in the agreed migration and records their implementation
and verification obligations.

If a compatible tool is missing or unusable, route setup repair to initialize and
refresh its preflight capability evidence. Unsupported languages or capabilities
are coverage limits, not installation failures. Record gaps and source-inspection
fallbacks; keep affected required work open without blocking unrelated work.
