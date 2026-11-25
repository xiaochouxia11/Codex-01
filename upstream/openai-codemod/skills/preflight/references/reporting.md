# Preflight results and reporting

As evidence arrives, update the Result on the saved check or parent issue.

## Check outcomes

Technical outcomes are separate from work-item states and capability readiness.

| Outcome | Meaning |
| --- | --- |
| `passed` | Required coverage was verified. Optional gaps remain explicit. |
| `failed` | Execution or inspection demonstrated a defect or failed requirement. |
| `blocked` | Evidence establishes an unavailable prerequisite. State what it prevents and how to unblock it. |
| `deferred` | Target validation needs an unresolved technology, version, build, or test decision. Record the exact decision for initialize. |
| `not_run` | Unattempted, stopped, or incomplete without an established reason above. Also used while native approval/setup dependencies prevent starting. |
| `not_applicable` | The check or part is irrelevant, with a reason. An unresolved target is deferred, not irrelevant. |

Distinguish missing prerequisites from source/test failures; unexplained errors are
not `blocked`. Inspection can establish a blocker without an unsafe command. If a
technical blocker prevents another requested check, mark it `blocked` and link the
finding. Leave unrequested checks unchanged; native approval/setup dependencies
are not technical findings.

Record each required part's outcome. Combine them in this priority order:
`failed`, `blocked`, `not_run`, `deferred`. Use `passed` when all applicable parts
passed, or `not_applicable` when none apply. Preserve every gap regardless of priority.

## Record a check

In the check's Result, record the check time in ISO 8601 UTC, the runtime, and the
observed revision and boundary where relevant. For each action, give its command or
operation, working directory, result, measured duration if available, and evidence
reference. Summarize coverage, gaps, and any follow-up. Identify evidence from earlier
or external runs. Leave unavailable timings unmeasured and use `Not applicable`
for an API working directory. Workflow access does not inspect source; if provider
access prevents saving, report its findings in chat as unsaved.

Required work is complete only when applicable requirements are verified, explained
as not applicable, or covered by an explicit human-accepted exception. Apply shared
[failure review](../../codemod/references/records/reviews.md#failure-review) to unresolved
failed results; an accepted exception does not change the measured outcome. Other
unresolved failures, prerequisites, decisions, or unrun parts keep work unfinished.
A focused run writes results only to the checks it runs; follow the shared
[issue workflow](../../codemod/references/records/lifecycle.md#issue-workflow).

## Aggregate the parent

Only a parent run or explicit summary refresh writes the parent summary. Read the
current results for all eight checks in the [inventory](records.md#check-inventory),
and build the Checks table (check, issue, result, summary) from those results.
Show absent checks as `not_run` without inventing issue links. In the parent's
Result, replace the pending outcome with a Readiness table showing each capability,
its readiness, coverage, and gaps. Update that table on later refreshes.
Set **Last checked** to the latest actual child check
time, preserving each child's time. A summary-only refresh needs no source checkout
or matching runtime and does not rerun checks or change child states.

Compare each result's revision, boundary, and relevant runtime with current intent
and execution details from the [shared lookup](../../codemod/references/records/artifacts.md#execution-environment-details).
Incompatible, inaccessible, or unverifiable evidence leaves affected readiness
unknown and needs a focused refresh. A changed task, plugin, selected skill, or
connection may require refreshed Workflow access; do not reset unrelated current
source findings. Done records acceptance, not proof of technical success.

Report workflow execution, source analysis, source execution, and target execution separately as
`ready`, `limited`, `blocked`, or `unknown`, with coverage and gaps. Use `deferred`
for unresolved target decisions and `not_applicable` only when irrelevant. Source
can be ready while target work is deferred. Source analysis includes applicable graph
or confirmed alternative relationship evidence; an unsupported index is a stated
limit, and missing required relationship coverage limits or blocks its consumers.
Workflow execution reports usable CodeMod procedures and selected provider/report-store access;
it does not establish source, build, or graph readiness.
Include required browser capabilities in the relevant source or target execution
readiness, preserving any headless/native coverage gaps.

Partial summaries are valid. Complete the parent only when all eight checks have
current results and are complete under the agreed review, no failure awaits human
resolution, and no required check or part remains blocked, deferred, or unrun.
Retain accepted exceptions and optional limits in the table and readiness summary.
A child rerun can make the summary stale; refreshing the parent does not complete
unfinished checks.
