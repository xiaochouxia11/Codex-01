# Define target-stack guidance

Use for the brief's **Define target-stack guidance** child. Follow the
[brief skill](../../SKILL.md), [record dependencies](../records.md#dependencies),
and shared record lifecycle. This is research and decision documentation; setup
and execution checks retain their existing owners.

## Research the applicable conventions

Read accepted target choices and code principles, customer standards and reference
projects, applicable target-repository guidance/configuration, and any existing
guidance resource. Use current assessment and preflight findings where relevant;
their unfinished aggregate reports do not automatically block this research.
If essential evidence is missing, identify the specific prerequisite.

Research current official documentation for the selected language, framework, and
versions. Focus on decisions this migration needs: structure and naming, documentation,
typing, error handling, dependencies, tests, formatting/linting, and relevant
framework/security patterns. Omit irrelevant topics and generic best-practice lists.
Record sources, version applicability, and research date; distinguish documentation
from behavior actually tested by preflight or verification.

Customer requirements and applicable repository conventions guide the choices.
Use official guidance for compatible defaults. Distinguish binding requirements
and their authority from delegated implementation defaults, proposals, and unknowns.
Conventions remain adaptable within agreed behavior and constraints; technical
acceptance of guidance alone does not make them binding design decisions.
Resolve conflicts using accepted intent and decision authority. Material ambiguity
or high risk pauses this child under the shared escalation rules; intent changes
return to initialize. Other decisions retain their owning stage.
Do not silently select an undecided stack, replace architecture, or add dependencies.

## Select migration tools

For repetitive changes, check for suitable official migration tools, syntax-tree
codemods, or established recipes. Match documented source/target versions and
supported constructs to observed code; a matching language alone is insufficient.
Prefer a maintained applicable tool over recreating mechanical edits. Agent-led
implementation is valid when no suitable tool exists; build a custom recipe only
when the repetition justifies it.

When a structural search or rewrite would help, check the saved
[Analysis tooling result](../../../preflight/references/checks/analysis-tooling.md)
for ast-grep's coverage of the language and operation. Specify proposed
matches or rewrites, excluded lookalikes, parser support, and coverage limits.
Availability does not require a rewrite. Syntax matching does not establish
symbol/type meaning or behavioral equivalence, and ast-grep is not a general
cross-language translator.

Record the selected tool/version, recipe/configuration, official documentation,
applicable boundaries, prerequisites, automated coverage, and semantic work left
to the agent. Distinguish a researched choice from one tested on this migration.
Plan a preview and diff inspection on a representative
[pilot slice](../../../transform/references/work-planning.md#pilot-slices), followed by its
normal behavior checks and review. Research does not execute the tool; trial work
belongs to the phase's execution owner after brief acceptance. Setup and capability
proof retain their existing owners. A planned trial does not block this research.

If the needed capability is missing or unverified, follow the
[shared setup guidance](../../../codemod/references/environments/README.md#shared-requirements)
before the affected slice uses it.

## Selected migration skills

Carry intent's selected guidance, references, and applicability into the brief.
Follow [shared skill use](../../../codemod/references/selected-skills.md) for loading and delegation.

## Save reusable guidance

Use the [guidance template](../../assets/target-stack-guidance.md) and
[shared document rules](../../../codemod/references/records/artifacts.md#migration-reports-and-artifacts)
to create or reuse **System — Target-stack guidance** associated with the migration home once
concrete conventions and their rationale exist. Link it from the child; keep the
issue to outcome, input identities, open decisions, and the resource link using
the [planning issue template](../../assets/planning-issue.md).

Keep the resource proportional to the migration: record only useful target decisions,
their scope, rationale/source, and intended check; add examples only when they clarify
a choice. Link existing assessment, execution, selected-skill, and verification evidence
rather than repeating findings, setup details, hashes, or run logs. Record proposed tooling as
a recommendation, not an installation or successful validation. Route required
environment changes to initialize and proof of capability to preflight.

The child is ready for review when applicable conventions and material choices are
resolved, the document is saved/read back, and its migration association is verified.
Useful provisional findings may be saved earlier but do not complete the child.
Follow the existing review agreement; this adds no mandatory human checkpoint.
The brief references the applicable reviewed guidance and records its identity.
Transform passes it to implementers and reviewers; verify-target checks relevant
quality criteria separately from behavioral conformance.

## Reuse migration lessons

Brief may incorporate compatible lessons reported from accepted implementation into
**Reusable migration patterns** in this resource. Link the originating slice and record
the applicable constructs, technique, reviewed example, validation, and reuse limits;
code and recipe configuration stay in Git. Preserve adopted decisions and history.
Changes to agreed decisions follow the revision rules below before affected work
expands. If the resource is absent, keep the evidence on the implementation record;
do not create a competing document. One example does not validate unexercised constructs.

## Reuse and refine

Reuse compatible standards already recorded in accepted intent or a brief. A new
issue or document alone is not a reason to invalidate accepted planning. On a
requested setup repair, seed the resource from those decisions and research only
missing or stale guidance, preserving provenance and review history.

Record default refinements and their rationale on the owning issue, preserving
prior guidance and identifying affected conventions and phases. Follow
[brief revision rules](../reporting.md#refresh-without-inheriting-acceptance)
for required review or renewed acceptance and downstream reconciliation.
Unaffected conventions remain reusable;
do not silently impose new standards on accepted implementation.
