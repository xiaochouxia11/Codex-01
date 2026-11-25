{{One sentence summarising the migration and its desired outcome.}}

{{Throughout, distinguish user requirements and reported facts, source observations,
and agent-selected defaults adopted under explicit delegation. Label unresolved
proposals; do not present inferred expectations as user requirements. Follow the
[intent content boundary](../references/gather-intent.md#intent-content).}}

**System:** {{Stable system name and brief description.}}

## Source boundary

{{The complete application or service and supporting shared code needed for
context, including components that will not change.}}

| Source repository | Boundary paths | Source branch / ref | Baseline commit |
| --- | --- | --- | --- |
| {{Git repository URL without credentials, one row per repository; Open if unverified.}} | {{Repository-relative roots, including shared code, tests, and build configuration; . means the whole repository.}} | {{Requested branch/tag; observed ref if different, Detached, or Open.}} | {{Full observed commit SHA with date/provenance; Open if unverified.}} |

**Source availability:** {{Known access or working-copy restrictions affecting the
agreed source boundary/baseline; link execution observations rather than copying them.}}

**Reported technology:** {{User-supplied languages/frameworks or Open. Preflight verifies the stack.}}

## Purpose and expectations

### Why migrate

{{The problem driving the migration and the outcomes that matter to the user.
A target technology alone is not a rationale; retain Open if not established.}}

### What complete means

- {{An observable condition required to consider the migration complete.}}

### What good looks like

- {{An expectation for quality, delivery, disruption, documentation, or handover.}}

### Constraints and context

- {{What must stay true during and after migration, or relevant deadlines, dependencies, team conventions, and unusual requirements.}}

## Actors and journeys

| Role / actor | Goal or responsibility | Important journeys and impact |
| --- | --- | --- |
| {{Known user role, operator, or external system; mark human/nonhuman where unclear. Reuse established names/IDs; unknowns stay Open.}} | {{What they need to accomplish, attributed to the user or supplied documentation.}} | {{Workflow, expected outcome, importance, disruption consequences, and known permission boundaries. Separate reported current behavior from desired changes.}} |

{{Preserve the user's terminology and caveats. Assessment assigns stable IDs and
maps these journeys to implementation evidence; do not invent profiles or code paths.}}

## Migration scope

**Intended change:** {{What should change, without assuming an undecided approach or target.}}

**Affected parts:** {{Full source boundary or a named subset of services, components, or paths.}}

**External consumers and impact:** {{Known consumers/dependencies, their importance,
and disruption consequences; unknowns stay Open. Their inclusion does not authorize changes.}}

**Compatibility requirements:** {{Use the [compatibility levels](../references/gather-intent.md#compatibility-level)
by boundary; use one row for the whole migration when uniform. Undecided choices stay Open.}}

| Boundary | Agreed level | Required outcomes/contracts | Permitted differences and limits |
| --- | --- | --- | --- |
| {{Whole migration or named API, UI, data, or operational surface.}} | {{Selected level or Open.}} | {{Specific commitments; link established requirements.}} | {{Explicit exceptions, evidence limits, and unresolved questions; no implied permission for breaking changes.}} |

**Exclusions:** {{Excluded components, behaviors, or changes, including ownership restrictions, frozen branches, or generated code; None only if established.}}

## Ongoing source development

**Source development:** {{Expected to remain frozen, continue, or Open. A fixed
migration snapshot does not require the source team to stop development.}}

**Incorporation policy:** {{Migrate the recorded snapshot only, or incorporate
agreed later changes. Capture known change owner, included change types, release
dates/cutoff, and limits; unknowns stay Open. Brief plans the reconciliation.}}

## Target direction

**Target direction:** {{Chosen technology/framework or architecture and the adopted
approach. Label preferences and unadopted recommendations separately from decisions.}}

**Target constraints:** {{Required runtime/version, platform, or service constraints and limits
on delegated choices. Leave ordinary setup choices to guidance and execution work.}}

## Code principles

**Maintenance model:** {{People, AI agents, or both; known owners and expected human
review/editing. Open if undecided.}}

**Readability and maintainability:** {{Human comprehension, simplicity, documentation,
and explanatory tests, independently of the maintenance model. Separate requirements
from preferences; use No preference when stated, Open when undecided.}}

**Conventions and patterns:** {{Style guides, reference projects, formatters/linters,
naming, layout, and design patterns, with links or repository-relative paths.
Separate requirements from preferences; use No preference when stated alongside
applicable repository standards, Open when undecided.}}

**Extra migration skills:** {{Resolve the separate installed-skill, general
recommendation, and target-stack answers, including free text, into individual
selected skills without duplicates. Include each skill's qualified identifier
when available, instruction reference, and applicability (for example source
analysis, implementation/review, or failure diagnosis). Preserve install/use
requests, declined candidates or exclusions, and deferred choices for later chats.
None only when explicitly declined; Open if undecided. Runtime identity, install
approval/outcome, publication, and availability evidence live in Execution environment.}}

## Operational constraints

{{User-supplied operational requirements, limitations, or exclusions that affect
the agreement; unknowns stay Open. Link setup details from Execution environment.}}

## Migration repository

| Decision | Recorded choice |
| --- | --- |
| Repository choice | {{Existing source repository or new repository.}} |
| Migration repository | {{Repository URL without credentials; Open if not yet created, Local only if no remote exists. Checkout paths are optional context.}} |
| Migration branch | {{Agreed migration integration branch, destination branch, and base commit, following [shared branch naming](../../codemod/references/definitions.md#migration-branches) for new branches. Distinguish existing from planned. Open if undecided; do not infer from the source ref, Git-provider state branch, or active checkout.}} |
| Issue integration | {{Issue PRs, Direct integration, or Open. Preserve the user's choice and caveats; explain an unresolved choice under Open questions. The final destination PR remains separate.}} |

## Involvement, review, and approval

**Preferred involvement:** {{Agent-led, collaborative, hands-on, or the user's own
arrangement. Describe the agreed behavior, not just a label; Open if undecided.}}

**Decision authority and escalation:** {{Decisions Codex may make within scope,
decisions reserved for people, and any additional escalation triggers. Apply the
shared ambiguity/high-risk review rules at every involvement level. Open where not agreed.}}

{{Apply the [shared approval and revision rules](../../codemod/references/records/reviews.md#always-require-human-approval).
Record review/completion owners and delegated authority, then any differences for
Migration readiness, Migration, Final verification, or specific decisions.
Distinguish review from authority to mark work Done; unknown ownership stays Open.}}

| Coverage | Review | Acceptance / completion authority |
| --- | --- | --- |
| Intent | {{Human reviewer or approver; Open if undecided.}} | {{Named human approver.}} |
| Behaviors | {{Human reviewer or approver; Open if undecided.}} | {{Named human approver.}} |
| Migration brief and queued breakdown | {{Human reviewer or approver; Open if undecided.}} | {{Named human approver.}} |
| Other work by default | {{Required human or agent review, or expressly delegated self-verification; Open if undecided.}} | {{Who may mark issues Done and under what conditions, including any authority delegated to Codex; Open if undecided.}} |
| {{Optional: work-group or decision override; omit if none is agreed.}} | {{Different reviewer or required checkpoint.}} | {{Different approval owner or delegated completion rule.}} |

## Execution environment

{{Optional: link the Execution environment document if its URL is verified;
otherwise omit this section. Do not duplicate its fields.}}

## Open questions

- {{An unknown fact or deferred choice, why it remains open, who will resolve it
  and when, and which work depends on it. Retain Open in the affected field.
  Distinguish unanswered questions from an expressed Don't know or deliberate
  deferral. Use None identified only when established.}}

## User answers

### {{Question or topic; include the question when the answer needs its context.}}

> {{The user's original words or the exact submitted option, including caveats. Repeat for relevant answers already supplied or gathered during intake.}}
