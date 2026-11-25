---
name: verify-target
description: "Independently verify a whole-migration target candidate against approved behaviors and accepted criteria, and save the final verification report in the selected report store."
---

# Verify migrated behavior

Check the whole-migration target independently against the approved contract. Results establish
conformance only for the covered contract and candidate, not source-to-target parity.
Transform owns implementation, phase checks, and repairs; this skill owns final
verification and its scoped records. Follow [shared startup](../codemod/references/shared-startup.md)
and [execution safety](../codemod/references/execution-safety.md).

## Prerequisites

Use accepted intent, the human-accepted brief and human-approved behaviors normally
produced by `codemod:initialize`, `codemod:brief`, and `codemod:behaviors`;
and the candidate evidence, capabilities, and fixtures required by the assigned role.
Coverage mapping may begin before final implementation and phase outcomes are accepted
when its own inputs are available. Execution requires an accepted implementation
candidate, normally produced by `codemod:transform`; whole-migration execution
and synthesis require one accepted integrated candidate and all required phase outcomes.
Apply the [shared prerequisite rules](../codemod/references/records/README.md#prerequisite-evidence).

## Verify the requested scope

Resolve the scope and role from the accepted brief and requested issue. Follow the
[record specification](references/records.md) to create or repair only relevant
verification work. Queued records do not authorize execution; check each issue's
native blockers. The verification coordinator may work eligible children while the
parent remains blocked, but parent synthesis waits for required child acceptance.
A synthesis-only request does not start child work.

| Requested role | Work and evidence |
| --- | --- |
| Whole-migration coverage child | Map approved obligations to assertions and gaps; save the mapping on the child for agreed review. |
| Whole-migration execution child | Execute the accepted mapping on the exact integrated candidate and save findings on the child. |
| Specialist child | Perform only the assigned check and save its evidence on the child. |
| Whole-migration parent | Coordinate eligible children; after required acceptance, synthesize their evidence for the same candidate into one final report. |

For the assigned work, follow [final verification](references/execution.md) to bind the
candidate and independent reviewer, map approved obligations, select applicable
specialist checks, and run or inspect the evidence. Transform's development checks
are inputs to challenge, not independent conclusions. Do not change production code
or approved expectations.

Follow [reporting](references/reporting.md) for checkpointing, reuse, outcomes,
verification-scoped reconciliation, and failure routing. Keep required gaps
unfinished, apply the agreed review authority, run the [progress checkpoint](../codemod/references/records/lifecycle.md#progress-checkpoint),
and present the scoped result. Return it to the caller;
a direct invocation stops without implementing repairs, starting another stage, merging,
or deploying.
