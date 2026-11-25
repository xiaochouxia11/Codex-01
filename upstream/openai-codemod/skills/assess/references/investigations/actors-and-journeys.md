# Actors and journeys

Use this reference for **Identify actors and user journeys**. Record findings in
that investigation's issue using the **Actors and journeys** section of the
[assessment template](../../assets/assessment.md#actors-and-journeys).

## Ground the actors

Start with roles, goals, and important workflows recorded in intent. Cite the
original user answers or supplied documentation. Inspect source for entry points,
authentication roles, permissions, and external integrations, labelling observed
technical roles separately from confirmed human responsibilities and goals.
A permission name or static graph edge does not establish who uses the system
or why. Keep plausible roles as candidates with explicit questions.

Record only context useful to migration: role, goal or responsibility, relevant
journeys, evidence, and uncertainty. Actors can be people or explicitly identified
external systems; a scheduled job can be a trigger without inventing a human actor.
Avoid demographic profiles or imagined motivations.

Give actors stable IDs such as `ACT-caseworker` and journey IDs such as
`JRN-submit-claim`. Reuse existing IDs; preserve aliases and replacements when
merging or splitting records. These are assessment IDs, separate from CodeGraph
symbols. Do not change or regenerate the source graph to add them.

## Connect journeys to behavior

For each important journey, record the actor, goal, trigger, relevant preconditions
or permissions, business-language steps, and outcome. Link steps to the existing
technical flow IDs and component IDs rather than duplicating their implementation
details. Architecture owns those technical records; do not invent a competing map.
The two investigations can run in parallel: when IDs are not yet available,
cite the relevant source entry points and leave the mapping pending for synthesis.
One journey may span several flows, and one flow may serve several actors.

Distinguish user-reported expectations, source-supported behavior, inferred links,
and executed observations. Describe failures and consequential permission boundaries
where evidence supports them. A source contradiction does not silently change the
user's goal or establish permission to fix behavior. Return intent decisions to
initialize and retain the observed behavior for [codemod:behaviors](../../../behaviors/SKILL.md).

Account for important journeys as traced, partial, untraced, or excluded with a
reason. Unknown actors do not prevent tracing known technical flows. Ask for
clarification through the existing workflow when uncertainty materially affects
scope, permissions, or expected behavior. Route these decisions to initialize
under the shared review rules; reuse existing answers rather than repeating its
questionnaire. Do not require complete persona research.

## Complete the investigation

Account for the known roles and important workflows in intent, including omissions
and exclusions and their migration impact. Distinguish missing human context from
missing source analysis; leave unresolved technical links visible for synthesis.
Follow [reporting](../reporting.md) for outcome and review.

## Carry references forward

Behaviors link relevant actor, journey, and technical flow IDs; journeys help reveal
gaps across extraction packages. Verification links those IDs to behavior-based scenarios,
including relevant failures and access boundaries. The brief explains phase impact
using the same journeys. Downstream stages reference this map rather than maintaining
competing actor definitions or inventing new journeys.

An editorial link or label change does not change behavior. A changed actor's rights,
journey outcome, or behavior interpretation follows the existing intent, assessment,
and behavior revision procedures, with affected evidence refreshed.
