**Migration brief:** {{Accepted brief link and phase ID.}}

**Behaviors:** {{Approved catalog link and applicable versions.}}

{{Follow [current-content maintenance](../../codemod/references/records/artifacts.md#maintain-current-content)
throughout; keep detailed implementation and run evidence on its owning slice issue or artifact.}}

## Summary and evidence base

{{Describe implemented scope, approach, limitations, and exact source, approved
contract, applicable guidance, target and runtime identities. Link slice results
and applicable source relationship evidence; note what each establishes and its
limits. A pilot or subset cannot establish completion of the phase.}}

## Implemented behavior and criteria

| Slice / component | Approved behavior or criterion | Target implementation and development checks |
| --- | --- | --- |
| {{Slice issue and component IDs.}} | {{Behavior versions and criterion IDs; link their definitions.}} | {{Concise implementation/check outcome and limits; link the slice's exact code, scenario and run evidence.}} |

{{Account for implementation-owned criteria, including errors and side effects,
explain approved exclusions and differences, and identify separately owned phase
obligations. Do not equate excluded code with retired production code.}}

## Checks, review, and integration

{{Link current slice results for the exact candidate, actual check outcomes,
assertions, and independent reviewers and reviewed and tested revisions. Include
required failing-control and cross-slice evidence from their owners when applicable;
isolated slice checks do not establish a required shared contract. List unresolved
implementation criteria and affected external obligations.}}

## Git delivery and artifacts

{{Follow the [Git delivery handoff](../../codemod/references/records/presentation.md#git-delivery-handoff).
Identify the migration branch, exact integrated candidate and covered scope, and
any newer head. Reference participating issues, reusing the traceability table
where complete; their Git delivery histories own the issue integration audit trail.
Link the destination PR and status when it exists; distinguish an interim handoff
from a full-migration publication gap. Provide [verified run instructions](../../codemod/references/records/presentation.md#try-the-migrated-app)
for runnable applications and link selected [UI evidence](../../codemod/references/records/artifacts.md#ui-screenshots)
when applicable. Keep candidate and run evidence durable and reviewable.}}

## Phase exit

{{For a full-phase request, link current evidence and agreed acceptance for every
assigned phase-exit criterion, including independent verification. State the phase
disposition and unresolved obligations. Omit when the request covers implementation
only; keep independent verification results in their owning report.}}
