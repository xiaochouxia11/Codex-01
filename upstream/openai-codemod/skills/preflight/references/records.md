# Queue preflight records

Use [shared record setup](../../codemod/references/records/README.md#record-setup)
and the bound provider's [route](../../codemod/references/records/issue-systems.md#stage-adapters).
This specification owns the check set and dependencies; the provider adapter owns
native operations. A focused check creates or repairs only its parent, that check,
and required preflight-owned prerequisites. Do not queue unrelated work.

## Records

Create or reuse **Preflight — System — Migration** in Migration readiness using
the [parent template](../assets/preflight.md) and link the saved intent. For a full
preflight, create one child per inventory entry using the [check template](../assets/preflight-check.md).
Specialize each child's scope, steps, and required evidence from its procedure and
the recorded source, baseline, and boundary. Each child identifies `codemod:preflight`
and its check procedure.

When queuing Workflow access, copy and specialize its [self-contained issue steps](checks/workflow-access.md#self-contained-issue-steps)
so the check remains usable when the plugin cannot be loaded.

## Check inventory

| Check | What it establishes |
| --- | --- |
| [Workflow access](checks/workflow-access.md) | Plugin and selected skill access, selected provider/report reads, and actual check-result saving. |
| [Source access](checks/source-access.md) | Runtime, repositories, revisions, and boundary roots. |
| [Detect the stack](checks/detect-the-stack.md) | Languages, manifests, configuration, and file inventory. |
| [Analysis tooling](checks/analysis-tooling.md) | Available analysis tools and language coverage. |
| [Build toolchain](checks/build-toolchain.md) | Build/CI context, source/target execution, and required browser capabilities. |
| [Source completeness](checks/source-completeness.md) | Required code, build inputs, data definitions, and configuration. |
| [Boundary crossings](checks/boundary-crossings.md) | Inbound consumers and outbound dependencies. |
| [Build source graph](checks/source-graph.md) | Source relationships and coverage from inspection or a verified index. |

## Dependencies

Apply the [readiness dependencies](../../codemod/references/records/README.md#technical-work-prerequisites) directly
to the Preflight parent and every check created. Add applicable native dependencies
after their issue IDs exist:

| Downstream issue | Upstream issues that block it |
| --- | --- |
| All other preflight checks | Workflow access. |
| Detect the stack; Source completeness; Boundary crossings; Build source graph; source-only Build toolchain | Source access. |
| Build source graph | Detect the stack; Source completeness; Boundary crossings. |

For a mixed Build toolchain check, apply its [source-access requirement](checks/build-toolchain.md)
to the source work instead of blocking the whole issue.

Build source graph uses accepted source-input results and checks CodeGraph readiness when indexing is needed under its [procedure](checks/source-graph.md#resolve-inputs). Do not add
Analysis tooling as a native blocker: that issue covers other capabilities that
graph work does not use. Do not add target Build toolchain or assessment as blockers.

Do not make checks depend on the Preflight parent or make the parent depend on its
children. The parent may refresh a partial summary while children remain unfinished;
its [completion rules](reporting.md#aggregate-the-parent)
still require current, completed checks. Cloud setup remains a separate issue,
outside the technical check set.

## Update and hand off

Link the in-scope children from the parent and add **Run preflight checks** to the
readiness group's Key issues.

When source, boundary, or execution changes invalidate check evidence, queue the
affected checks and stale parent for refresh, including returning completed issues
to an unstarted state. Preserve dated findings, identify what needs rechecking, and
reconcile native dependencies so affected downstream work waits. Do not run checks
during setup. Compatible evidence and editorial changes need no rerun; changing
only the summary queues the parent without reopening current checks.
