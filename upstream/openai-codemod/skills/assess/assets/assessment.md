**Intent:** {{Intent document link.}}

{{Apply the [synthesis guidance](../references/reporting.md#synthesize-reviewed-findings)
throughout.}}

## Executive summary

{{Migration scope, principal risks, recommendation, and any incomplete synthesis.}}

## Source and execution baseline

{{Observed source stack, fixed or open target direction, actual build/test execution
and context, and main limits. Link preflight evidence.}}

## Evidence and coverage

| Repository / revision | Boundary and coverage | Investigation evidence |
| --- | --- | --- |
| {{Repository and assessed commit.}} | {{Inspected scope, exclusions, and gaps.}} | {{Each investigation issue, actual analysis time, and reliable result-content revision when available.}} |

## Architecture and migration impact

{{Link source graph evidence and add a diagram if useful.}}

### Components

| ID | Responsibility | Source boundary | Dependencies and migration relevance | Evidence |
| --- | --- | --- | --- | --- |
| {{Stable component ID.}} | {{Responsibility.}} | {{Repository-relative paths and overlaps.}} | {{Dependencies and affected or context-only role.}} | {{Source links at the assessed commit.}} |

### Connections

| From → To | Kind | Evidence and uncertainty |
| --- | --- | --- |
| {{Component IDs, named stores or external systems, or unresolved endpoints.}} | {{Call, dispatch, event, read, or write.}} | {{Source/configuration links; observed, inferred, or unresolved details.}} |

### Important flows

{{One record per important flow; preserve existing IDs and anchors.}}

- **Flow and trigger:** {{Stable ID, name, entry point, and trigger.}}
- **Path and effects:** {{Ordered component IDs, data reads/changes, and external interactions.}}
- **Contracts:** {{Behavior, interfaces, ordering, and failure handling.}}
- **Evidence and gaps:** {{Source/configuration links, inferred or unresolved steps, and any observed execution.}}

### Coverage and gaps

| Area / component | Coverage | Gaps and consequences |
| --- | --- | --- |
| {{Source area or component ID.}} | {{Inspection state or exclusion reason.}} | {{Gap, effect on conclusions, and follow-up.}} |

{{Distinguish representative flow inspection from graph coverage.}}

### Migration impact

{{Affected component IDs, why they are affected, compatibility and sequencing
constraints, confidence, and source/official-documentation citations.}}

## Actors and journeys

| Actor ID | Role and kind | Goal / responsibility | Evidence and open questions |
| --- | --- | --- | --- |
| {{Stable ACT-* ID.}} | {{Human role or external system.}} | {{Known goal or responsibility.}} | {{User/documentation/source reference or explicit inference; open questions.}} |

{{One record per important journey, including known journeys with coverage gaps.}}

- **Journey:** {{Stable JRN-* ID and name.}}
- **Actors and goal:** {{Actor IDs or unknown; goal and its provenance.}}
- **Trigger and preconditions:** {{Event, relevant state, and permissions.}}
- **Steps and outcome:** {{Business-language steps linked to flow/component IDs; expected or observed outcome and consequential failures.}}
- **Evidence and coverage:** {{Source/user references, tracing status or exclusion reason, inferred links, and gap consequences.}}

## Maintainability and verification

{{Summarize measured scale, material debt, documentation gaps, and their migration
implications. Link detailed measurements, methods, scan results, and coverage limits
on the maintainability investigation.}}

### Behavioral evidence and verification

| Behavior or contract | Existing evidence and status | Gap or proposed target check |
| --- | --- | --- |
| {{Important behavior, contract, or flow ID.}} | {{Tests, fixtures, outputs, or CI links; distinguish observed execution from test presence.}} | {{Missing evidence or a representative target check.}} |

{{Proposed verification strategy, coverage priorities, and unresolved thresholds.}}

### Structural improvement opportunities

{{Material interpreted findings, or no material opportunities identified with coverage limits.}}

| Evidence and source locations | Affected component(s) | Proposed improvement or retain-as-is | Behavior / variants to preserve | Tradeoffs |
| --- | --- | --- | --- | --- |
| {{Source citations and investigation/scan evidence.}} | {{Component IDs or unresolved mappings.}} | {{Proposal or reason to retain; relevance and scope.}} | {{Contracts, variants, side effects, and gaps.}} | {{Benefit, risk, verification needs, and uncertainty.}} |

## Security and operational risks

{{Supported findings and links, scan/source-review coverage, operational evidence, and limits.}}

## Recommended approach

{{Recommendation, alternatives, tradeoffs, confidence, sequencing principles, and pilot rationale when applicable.}}

## Decisions and follow-ups

{{Open decisions, evidence or analysis needed, and proposed intent changes.}}
