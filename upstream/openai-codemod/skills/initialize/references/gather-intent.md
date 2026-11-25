# Gather intent

Cover the relevant topics below with concise questions about gaps. Reuse supplied
answers, saved intent, and repository conventions. A technical direction and
execution choice do not establish a rationale or a finish line. Accept "Don't know",
"No preference", and requests to skip. Follow Initialize's
[questions and answers](../SKILL.md#questions-and-answers) throughout intake.

Distinguish user requirements and reported facts, source observations, and delegated
defaults. Delegating technical choices does not supply the user's motivation,
operational knowledge, or constraints. Confirm material choices outside delegated
scope. Preserve the user's original answers and caveats in the
[intent template](../assets/intent.md); unasked facts remain unknown.

## Intent content

Keep intent to outcomes, source/scope identity, constraints, target direction,
delivery choices, and decision authority. Put checkout/toolchain observations,
generated outputs, CI/setup details, and tool/skill snapshots in Execution environment;
retain only operational constraints that affect the agreement in intent and link the
execution document.

## Source boundary

Establish where the system lives and which repositories, applications, paths, shared
code, tests, and build configuration belong to it. Record its
[source identity and baseline](../../codemod/references/definitions.md#source-references),
distinguishing user reports from observations. Check the Git source requirement
from supplied details or read-only metadata. If the source is known to be unsupported,
ask for a Git repository before environment setup; if access is unavailable, leave
verification open for preflight. Do not clone or fetch merely for intake.

## Purpose and expectations

Ask why the user wants to migrate, what must be true at completion, and what a good
migration would look like. Capture expected outcomes and evidence separately from
quality, delivery, disruption, handover, timing, and unusual constraints. Independent
verification checks the target against approved behaviors and accepted criteria; it
does not establish source parity. Resolve incompatible proof requirements before
accepting target criteria.

## Actors and journeys

Ask who uses or relies on the system, what they need to accomplish, which workflows
matter, and what disruption would mean. Include operators, external consumers, and
permission boundaries when relevant. Distinguish current behavior, expectations,
and requested changes; leave unknowns open. Assessment maps this context to source.

## Migration scope

Record the intended change, affected parts, exclusions, and relevant external
consumers. Distinguish the full source boundary from what may change, including
ownership restrictions and behavior that must stay unchanged. Record compatibility
needs and disruption impact; do not infer permission for breaking changes.

### Compatibility level

Offer these starting points, reusing explicit choices. Allow different levels by
boundary, such as an exact public API with an adaptable UI.

| Level | Preservation commitment |
| --- | --- |
| Outcome-focused | Agreed journeys, domain results, and data integrity; interface changes only within explicitly agreed limits. |
| Contract-compatible | Also preserve named API, UI, and operational contracts, including agreed errors and edge cases. |
| Exact replication | Observable source behavior within the agreed boundary, including incidental quirks and failure modes; expect more characterization and testing. |

Record each boundary's level, required surfaces/outcomes, permitted differences,
and unknowns. Clarify ambiguous requests such as "preserve everything" once; do not
silently select exact replication or waive compatibility. Exactness still has scoped
evidence limits, not a proof for every possible input. Source extraction remains
factual; these commitments determine what the target must preserve or may change.

## Ongoing source development

When relevant, ask whether to migrate the recorded snapshot or incorporate agreed
later changes. A fixed snapshot does not require the source team to freeze work.
Capture known ownership, included change types, dates, or cutoff; brief defines the
reconciliation approach. Do not start monitoring or advance the baseline.

## Target direction

Ask which technology or architecture choices are fixed and which remain open,
including only setup-relevant details such as framework, runtime, build/test tooling,
platform, and private dependencies. A named technology may not settle its framework
or runtime. For requested recommendations, verify support and version claims against
current official documentation, propose concrete defaults, and confirm material
choices unless delegated. Record decisions separately from preferences or proposals.

Defer a choice when the user wants to wait or it requires later evidence; record why,
who resolves it and when, and what depends on it. Keep independent work available.

## Code principles

Ask who will maintain the code and which readability, maintainability, documentation,
testing, and repository conventions should guide it. Offer "No preference — use your
judgment"; this delegates a choice within scope and is distinct from `Open`. Do not
infer readability requirements from the maintenance model.

For optional migration skills, follow [selection and setup](migration-skills.md#select-skills).

## Operational context

Capture undocumented build and test steps, required services or access, unreliable
checks, private feeds, generators or wrappers, validation constraints, documentation,
and previous migration attempts when relevant. Locate CI from an available repository
listing or supplied pipeline link; distinguish observed configuration from a reported
location, and leave unavailable information open. Preflight owns run history and
results, coverage, and timing.

## Migration repository

Reuse an agreed destination or ask whether work should use the source repository or
a new repository. Record its URL, [migration integration branch](../../codemod/references/definitions.md#migration-branches),
and agreed destination separately from the source baseline and any provider state branch.
Distinguish existing, planned, and open choices; transform creates a planned integration
branch during authorized work under [Git delivery](../../transform/references/git-delivery.md).

## User involvement

Ask how the user wants to participate in decisions and reviews. Offer agent-led
(routine work delegated), collaborative (key decisions reviewed), and hands-on
(each work item reviewed) as starting points, with room for another arrangement.
Record the agreed behavior: routine decision authority, escalation,
reviewers, completion authority, and any work-group or decision overrides. Distinguish
self-verification from independent review and review from authority to mark work Done.
Capture explicit user-required verification gates; otherwise Brief assigns phase/final
verification scope. Do not mandate both stages or different reviewers for them at intake;
verification independence follows the [shared method](../../codemod/references/independent-verification.md#bind-scope-and-independence).

Apply the [mandatory human approvals](../../codemod/references/records/reviews.md#always-require-human-approval)
for intent, behaviors, and the migration brief at every involvement level. Resolve
the intent approver before presenting it for review; later owners may remain open.

## Issue integration

Once the migration repository and review expectations are understood, ask how coding
issues should reach their integration parent, normally the migration branch. Offer
**Issue PRs** (one short-lived PR per coding issue, with a separate review and check
surface) or **Direct integration** (integrate each issue without an issue PR, reducing
PR overhead). Both retain required checks and review, and the final destination PR.
Reuse an explicit choice already supplied. Save the choice in migration intent, or
record it as `Open` if deferred or unresolved.
