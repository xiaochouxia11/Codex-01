---
name: preflight
description: "Verify source and execution readiness for a CodeMod migration in the selected local or cloud environment. Run all checks, one tracked check issue, or refresh the parent summary from existing check results."
---

# Migration preflight

Verify readiness for this migration in the selected execution context. Follow
[shared startup](../codemod/references/shared-startup.md) before beginning.

## Prerequisites

Use the accepted intent, identified migration home, saved provider/report store, and
selected execution context, normally established by `codemod:initialize`.
Apply the [shared prerequisite rules](../codemod/references/records/README.md#prerequisite-evidence).

## 1. Select work

Run the full preflight, a selected check, or a summary-only refresh as requested.
Resolve the owning issue, intent, and [execution details](../codemod/references/records/artifacts.md#execution-environment-details).
Create or repair only the requested preflight records under the
[record specification](references/records.md). A focused check runs only that check
and its required preflight prerequisites within the authorized scope. If a required
refresh is outside scope, report it and stop. A summary refresh reads saved results
without rerunning checks. Honor native blockers, review authority, and later stop
instructions.

## 2. Run eligible checks

Skip execution for a summary-only refresh. Use the [check inventory](references/records.md#check-inventory)
and its [dependencies](references/records.md#dependencies). Other checks require a
current, accepted Workflow access result in this task. Run or refresh it first when
needed, then continue requested checks as their prerequisites become eligible. Read each
selected procedure and follow [execution safety](../codemod/references/execution-safety.md).

Stay within the recorded source boundary and required shared inputs. Independently
verify this task's source and capabilities; setup or prior CI evidence does not
establish readiness here. Record coverage and limits. Do not
trigger CI, security scans, or external reviews.

### Bounded capability checks

For a full Preflight, account for every tool Initialize prepared for the
migration. Check plugin and provider access in Workflow access, analysis tools
in Analysis tooling, and build, test, and browser tools in Build toolchain.
A representative build or test can cover several tools in one run. Stop once the
result establishes the intended capability. Link current evidence from another
check and record any gap. A focused request checks only its named capability
and prerequisites.

## 3. Record results and stop

Follow [reporting and completion](references/reporting.md), run the
[progress checkpoint](../codemod/references/records/lifecycle.md#progress-checkpoint),
and report the [stage outcome](../codemod/references/records/presentation.md#stage-outcome).
Stop before application changes, repairs, or other skills.
