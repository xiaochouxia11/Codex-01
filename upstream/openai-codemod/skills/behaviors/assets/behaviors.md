**Intent:** {{Intent document link.}}

**Assessment:** {{Migration assessment document link.}}

## Summary

{{In a short paragraph, state the covered behavior, technical outcome, human
approval state, and material coverage limits. Highlight the few invariants,
surprising behaviors, or unresolved decisions that most affect this migration.
Identify pending packages when incomplete; counts do not establish completeness.}}

## Source-verified behaviors

{{Use compact tables grouped by behavior area, not one document per worker or
batch. Each row is one independently meaningful behavior or compatibility
contract. Keep stable behavior IDs on refresh, including after sorting.
Use one or two sentences where sufficient; do not omit material conditions to fit.
Add linked Behavior details only where a row cannot express the behavior clearly.
If none are verified, say so and use Unresolved candidates below.}}

### {{Behavior area}}

| Behavior ID and name | Observed behavior and exceptions | Migration consequence | Evidence |
| --- | --- | --- | --- |
| {{Stable BEH-* ID and short name.}} | {{Conditions and observable outcomes, including material limits, error/no-effect paths, and exceptions. Link any required detail or data-contract ID.}} | {{Concrete consequence if changed; distinguish obligations from adaptable source mechanisms under the [extraction rule](../references/extraction/inspect-and-verify.md#inspect-behavior-in-context).}} | {{Short immutable source links and the applicable EV-* evidence entry. Include all material parts of a cross-file claim, here or in linked details.}} |

## Behavior details

{{Omit when unnecessary. Add entries keyed by behavior ID for complex conditions,
decision tables, exact constants/units, rounding, precedence, side effects, or
non-obvious examples. They complete the behavior, not repeat it. Distinct implementations
or conflicting conditions remain explicit. Mark examples as proposed and unexecuted
unless a linked test or trace establishes the result. Do not add a generic example
or a list of None fields to every behavior.}}

## Evidence base

{{Record shared source and verification context once. Rows reference it by EV-* ID;
record exceptions separately. Follow the
[catalog reporting boundary](../references/reporting.md#keep-the-catalog-reviewable)
for links to extraction package evidence.}}

| Evidence ID | Source and scope | Verification |
| --- | --- | --- |
| {{EV-*}} | {{Repository URL and exact commit; boundary and primary component IDs; link the owning package checkpoint with shared graph evidence, assessment, and procedure identity.}} | {{Who checked source, independent or self-review, method, actual ISO 8601 UTC time, and limits. State whether behavior was executed; link existing tests/traces to their actual runs.}} |

## Data contracts

{{Omit when unnecessary. Include only shared shapes needed to interpret behaviors;
give each an ID and reference it from affected behaviors instead of repeating it.}}

| Contract | Fields and semantics | Used by behaviors | Source evidence |
| --- | --- | --- | --- |
| {{DC-* and name.}} | {{Relevant types, units, defaults/nulls, constraints, and invariants.}} | {{Behavior IDs.}} | {{Immutable schema/source links.}} |

{{Behavior details, referenced contracts, and shared evidence are part of the
[reviewed content](../references/reporting.md#identify-and-reuse-evidence).}}

## Human review

{{Initially: Awaiting user approval. Follow [behavior review](../references/review.md).
Use one row per actual catalog/batch decision and separate rows only for exceptions. Link the
reviewed version or snapshot and native feedback; do not repeat the same approval,
comment, or caveat once per behavior. Original discussions stay in native comments.}}

| Behaviors / reviewed version | Disposition | Decision and caveats | Feedback source |
| --- | --- | --- | --- |
| {{Behavior IDs or named batch/catalog, with its retrievable reviewed version or snapshot.}} | {{Awaiting user approval, approved, correction requested, behavior change proposed, or needs discussion.}} | {{Concise decision and exceptions; preserve previous version decisions.}} | {{Native comment/Done acceptance with author and time; identify chat answers recorded by Codex.}} |

## Unresolved candidates

{{Omit when empty. Use the same behavior-table fields with verification pending and an
extra Gap / next action column. Include only plausible unverified behavior,
retaining material conditions and linked details needed to resolve it. State the
missing evidence or disagreement and its consequence. Retain IDs when promoting
candidates; human agreement alone does not establish executed evidence.}}

## Coverage and gaps

| Package / components / journeys | Behaviors and inspected scope | Gaps and consequences |
| --- | --- | --- |
| {{Package issue; component IDs and relevant ACT-* / JRN-* navigation.}} | {{Behavior IDs and compact coverage result; link the issue's detailed inspection ledger. Distinguish no relevant behavior identified, partial, not inspected, and excluded with reason.}} | {{Missing source, consumers, dynamic wiring, conflicting evidence, and effect on conclusions; owner/next action when needed.}} |

{{Account for all required assessment components, source areas, important flows,
journeys, and planned packages, including unassigned areas. Navigation links do
not define behavior: role/permission conditions belong in the behavior itself.
Completed inspection does not establish exhaustive behavior discovery.}}

## History and decisions

{{Omit when empty. Use a compact index of changed/retired behavior IDs, replacements,
reasons, and links to retained prior evidence and decisions with original dates
and versions. History does not count as current verified behavior. Keep full
superseded records in durable provider history or linked records, not repeated in
the current review table. Route desired behavior changes to initialize; this
catalog does not create a migration implementation backlog.}}
