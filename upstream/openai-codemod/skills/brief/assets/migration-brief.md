**Intent:** {{Accepted intent document link.}}

**Assessment:** {{Current assessment document link.}}

**Behaviors:** {{Approved catalog link.}}

**Target-stack guidance:** {{Applicable reviewed migration resource link.}}

{{Follow the [brief content boundary](../references/reporting.md#complete-the-draft)
throughout; link details from their owning resources or issues.}}

## Summary

{{Approach, intended outcome, affected boundary, material risks, and provisional
choices.}}

## Evidence base

| Input | Identity and coverage | Planning implications |
| --- | --- | --- |
| {{Link the relevant input.}} | {{Reviewed version/content reference, applicable IDs, scope and material limits; link detailed inventories and execution metadata.}} | {{Concise implication for planning, uncertainty, and documented versus executed facts.}} |

## Scope, constraints, and decisions

{{Agreed scope and planning coverage; remaining required work for a partial draft;
constraints, external consumers, decision authority, and review requirements.
Summarize material structural decisions and their consequences.}}

**Binding decisions:** {{Only required decisions, with their constraint and authority.}}

**Implementation approach:** {{Link reviewed design/guidance as an adaptable approach;
do not reproduce its detailed wiring or make it binding merely by reference.}}

**Git delivery:** {{Migration branch and agreed destination. Link the integration
choice in intent and the coding issues for their branch plans.}}

## Ongoing source development

{{Reference the accepted incorporation policy. For a fixed snapshot, state briefly
that later source changes are out of scope unless the agreement changes. If changes
must be incorporated, identify the owner, refs/boundaries, trigger or cadence,
included changes, decision authority, and final-verification cutoff; link known
reconciliation work.}}

## Source-to-target mapping

| Source component / boundary | Target responsibility / interface | Transition and decision basis |
| --- | --- | --- |
| {{Assessment component ID and source boundary.}} | {{Agreed target or provisional proposal; unchanged dependencies.}} | {{Contract, data/state ownership, coexistence, preserved variants, evidence, tradeoffs, and unresolved choices.}} |

## Journey and flow impact

| Journey / actor / technical flow | Business walkthrough | Components and phases |
| --- | --- | --- |
| {{Relevant JRN-*, ACT-*, and technical flow references.}} | {{Known goal, trigger, steps, outcome, and evidence limits.}} | {{Affected component and phase IDs.}} |

## Applicable compatibility changes

{{Use version-specific deltas for upgrades or relevant interface, data, and runtime
constraints for other migrations. Include the table only for applicable changes;
otherwise explain inapplicability briefly. State material inspection limits.}}

| Affected component / usage | Source → target requirement | Planned response and evidence |
| --- | --- | --- |
| {{Observed component, API, dependency, or harness usage.}} | {{Applicable delta and affected consumers.}} | {{Required response, assessment/official evidence, and uncertainty.}} |

## Behavior and verification contract

| Behavior references | Preserve or intentionally change | Phases and verification |
| --- | --- | --- |
| {{Required approved behavior IDs/versions and applicable journey/flow references.}} | {{Preserve the linked contract, or identify an approved change and its decision; do not restate catalog details.}} | {{Phase and check owners, expected observations and evidence links. For a consequential exact boundary, name a discriminating source case, link its trace, or identify the gap and decision owner.}} |

## Phases

{{Repeat with stable IDs for the agreed scope; identify required work still unplanned
in a partial draft. Use a representative pilot only when it resolves uncertainty.}}

### {{Phase ID}} — {{Checkable outcome}}

- **Scope:** {{Component IDs, boundaries, interfaces, exclusions, and known journeys.}}
- **Delivery path and records:** {{Execution owner/path; verified queued phase,
  implementation, and required independent verification issue links. Use an explicit
  alternative for work outside transform's supported scope.}}
- **Dependencies and entry:** {{Prior phase IDs and concrete capability/evidence prerequisites.}}
- **Work and transition:** {{Bounded work, routing/coexistence, data/state movement,
  write ownership, shared dependencies, adopted improvements, and any representative
  tool trial with conditions for reuse.}}
- **Validation and exit:** {{Named obligations, checkable observations, required
  review, evidence to retain, and criterion owners. State whether later phases need
  accepted implementation or independently verified behavior.}}
- **Risks and recovery:** {{Failure indicators, recovery actions and limits,
  irreversible effects, and unresolved decisions.}}

## Open decisions and prerequisites

| Item | Affected phases and consequence | Required resolution |
| --- | --- | --- |
| {{Decision, assumption, or concrete execution prerequisite.}} | {{Phase IDs and impact.}} | {{Evidence or decision needed and owner.}} |

## Review and revision history

**Review:** {{Link the brief issue and current decision/action. Before acceptance,
request human acceptance of both the brief and queued breakdown; after acceptance,
record that decision without retaining a stale pending request.}}

{{Concise substantive changes, affected phases/issues and current review scope.
Follow the [current-content rule](../../codemod/references/records/artifacts.md#maintain-current-content).}}
