# Assessment results and synthesis

## Child investigations

Add the investigation findings to the child issue’s Result section. Identify the source
revision, boundary, runtime, tools, coverage, and evidence. Record the actual
analysis time in ISO 8601 UTC; link applicable [graph evidence](../../codemod/references/codegraph.md#record-graph-evidence),
including the Build source graph result.

| Outcome | Meaning |
| --- | --- |
| `assessed` | Required questions answered with evidence. |
| `limited` | Required analysis complete; optional gaps explicit and conclusions qualified. |
| `blocked` | A missing prerequisite prevents required analysis; state what is missing and the next action. |
| `not_run` | Unstarted, stopped, or incomplete. |

Findings needing remediation do not make completed analysis fail; an outcome does
not establish acceptance. Leave the parent and assessment document unchanged during
child work, and flag changed findings for synthesis refresh.

## Reuse an assessment

If a required report is missing, return the gap to assessment. Compare each cited
investigation's current saved result and review state with the evidence
incorporated into the report. Use a reliable result-content revision when available;
otherwise compare material findings, evidence, coverage, and actual analysis times.
A changed revision prompts content comparison; issue update times, states, and
comments alone do not establish a substantive change. A required investigation
being rerun or awaiting review, or material changes missing from the report, requires
refresh. The parent's Done state records acceptance, not technical freshness. Route
required synthesis or dependency repair to assessment before dependent work proceeds.

## Synthesize reviewed findings

Only the unblocked assessment parent synthesizes current reviewed child results.
Use the [assessment template](../assets/assessment.md) and
[shared artifact rules](../../codemod/references/records/artifacts.md#create-documents-when-there-is-content).
Reconcile results with intent and the recorded source baseline, incorporating
relevant evidence changes before saving. No source checkout or matching runtime is needed.

Keep the synthesis proportional to migration scope: summarize conclusions, material
risks, tradeoffs, and consequential gaps. Link reviewed investigations for detailed
maps, measurements, commands, and evidence instead of reproducing them. Use compact
template sections without repeating baseline or review details.

Preserve stable IDs and structured connections; link journey steps to reviewed
component and flow IDs. Reconcile material structural proposals with architecture
and intent, retaining meaningful variants, conflicting evidence, unresolved links,
coverage gaps, and their consequences. Return missing required analysis to its
owning investigation before completing synthesis.

Distinguish agreed requirements from observations and recommendations. A framework
default alone does not create a binding requirement: explain the observable behavior
or material constraint it affects and carry relevant candidate contracts into behavior
extraction for approval. Honor existing commitments under the
[shared review rules](../../codemod/references/records/reviews.md#review-and-approval).

Respect fixed target decisions; open choices may remain proposals and need not
block completion. For a proposed pilot, name the uncertainty and expected
verification evidence. Route proposed intent changes to initialize. Recommendations
do not authorize implementation or remediation, and a reviewed assessment alone
does not establish migration readiness.
