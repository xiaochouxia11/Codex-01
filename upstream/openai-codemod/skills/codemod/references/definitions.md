# Migration definitions

Use these terms across migration stages. For tracker, report, and issue terminology,
see the [shared record guidance](records/README.md).

| Term | Meaning |
| --- | --- |
| **System** | The application, service, or related components providing context; only a subset may change. |
| **Source boundary** | Source, shared code, tests, and build configuration needed for context. |
| **Migration scope** | Intended change, affected parts, and exclusions. Source access does not expand it. |
| **Actor** | A human role or identified external system participating in behavior; source roles alone do not establish human needs. |
| **Journey** | An actor's path toward a goal, linked to assessed technical flows and components. See [actors and journeys](../../assess/references/investigations/actors-and-journeys.md). |
| **Technical flow** | A source-backed path from a trigger through components and effects. It may support several journeys or have no known human actor. |
| **Behavior** | A migration-relevant action, outcome, constraint, or compatibility obligation supported by source evidence. It describes what the implementation does, not what the business intended or what the target should do. |
| **Migration phase** | A scoped part of the brief with dependencies and checkable entry and exit criteria; planning it does not mean work ran. |
| **Transformation slice** | A bounded unit implementing target behavior for named components and approved obligations within a phase. |
| **Verification scenario** | A behavior- or criterion-linked case with inputs, preconditions, expected observations, and assertions. See [scenario guidance](behavioral-scenarios.md). |
| **Target verification** | Independent checking of an exact candidate against approved behaviors and accepted target criteria. Transform owns phase or pilot checks; verify-target owns whole-migration checks. |

## Source references

Only Git sources with a verifiable HTTPS or SSH remote and a committed baseline
are supported. Local checkouts, worktrees, and monorepo subdirectories are valid
entry points; plain folders, uncommitted-only source, and repositories without a
remote are not.

Identify each source repository by remote URL, its requested branch or tag, full
baseline commit SHA, and repository-relative boundary paths (`.` means the whole
repository). A ref can move; the commit fixes the baseline. Resolve paths in the
active checkout and distinguish its observed state, uncommitted or unpublished
changes, and the migration repository/branch from the recorded source. Leave
unverified values open; use commit-specific evidence links when available and never
include credentials.

Never advance the baseline because a branch moved. Adopting a later baseline follows
[intent revision](../../initialize/references/records.md#intent-work-and-acceptance);
preserve prior commit identities and evidence. The brief plans
[ongoing source development](../../brief/references/planning/migration-plan.md#plan-ongoing-source-development).
Source-executing stages verify baseline access in their runtime. Intent intake and
saved-record summaries do not require a source checkout. Git-backed record writes
require the bound coordinator checkout; selected Local setup prepares a source
checkout before execution.

## Naming and records

A monorepo can hold multiple systems; a system can span repositories or have several
migrations. Use a stable system name without a timestamp and a descriptive name for
each migration effort. Reuse established names or choose missing ones once source
and purpose are clear. Match records by source and purpose, not system name alone.
Names do not determine source paths or require moving code.

## Migration branches

Every new branch created for CodeMod work, including delegated work, must start with
`codex/codemod/`. Use `codex/codemod/<migration-name>` for the migration integration
branch and `codex/codemod/<migration-name>-<issue-or-task>` for coding-issue branches.
The integration branch accumulates implementation across phases; it is distinct from
the agreed destination and any Git-provider state branch. Include this convention
in delegated assignments.

Brief plans issue branches and their immediate integration parents in the work issues;
transform validates and creates them under the
[Git delivery guidance](../../transform/references/git-delivery.md).
