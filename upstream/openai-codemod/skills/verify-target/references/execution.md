# Verify the whole migration

Run only the assigned final-verification role under the [record specification](records.md).
Use the [independent verification method](../../codemod/references/independent-verification.md)
for the approved contract, candidate binding, verifier independence, execution,
challenge, and evidence quality. Development and phase results are inputs to
scrutinize; they do not establish the final result.

The coverage child may prepare its map before every phase outcome is accepted when
its own inputs are available. Incomplete target evidence supports partial mapping,
not an accepted complete map. Save the map and obtain agreed review before the
execution child runs. Execution and final synthesis must refer to one accepted
integrated candidate containing all required phases and interactions. The execution
child covers cross-phase behavior; specialist children retain their assigned scope.

## Select specialist checks

Select checks from accepted criteria, reviewed target guidance, and material risks
introduced by the target design. No category or scanner is universally required.

| Area | Examples of relevant checks |
| --- | --- |
| Security | Trust boundaries, permissions, sensitive data, and dependency exposure. |
| Code and architecture | Integrated boundaries, dependency direction, error handling, maintainability, and framework conventions. |
| Performance and reliability | Accepted latency, throughput, resource, recovery, or availability requirements under representative conditions. |
| Accessibility | Keyboard, focus, semantics, and assistive-technology behavior for affected interactions. |

Record the criterion or risk, required/optional basis, owner, method, prerequisites,
and expected evidence in the existing coverage map. Keep small checks in the execution
child. Create a separate specialist child only when required work warrants distinct
execution or review; apply only its actual dependencies. Optional exploration never
blocks completion. Missing tools do not make required checks optional. Keep quality
findings separate from behavioral outcomes.

Reconcile all required obligations and cases, then [report and route](reporting.md#repair-and-hand-off)
findings without repairing production code here.
