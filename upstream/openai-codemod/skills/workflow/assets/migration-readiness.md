Prepare {{System — Migration}} for implementation by agreeing intent and establishing technical readiness.

## Scope

Group the preparation work for this migration: defining and accepting intent,
cloud environment setup when needed, preflight, migration assessment, behavior
extraction and human approval, and a phased migration brief.
Implementation is outside this work group.


## Key issues

- [Define migration intent]({{Intent issue URL}})
- [Set up Codex cloud environment]({{Setup issue URL; omit this bullet when no setup issue exists}})
- [Run preflight checks]({{Preflight parent issue URL}})
- [Assess the migration]({{Assessment parent issue URL}})
- [Identify and approve source behaviors]({{Behavior issue URL}})
- [Prepare migration brief]({{Brief issue URL}})


## Completion criteria

- The intent issue is marked **Done**, recording acceptance of its document.
- For cloud work, the environment setup issue is complete.
- Every preflight check has been reviewed and completed, with no unresolved
  required failures, blockers, deferred decisions, or unrun stages.
- The Preflight parent summarizes readiness, gaps, and concrete follow-up actions.
- Build source graph records the exact source commit and boundary, relevant
  relationships, and coverage limits, using source/configuration inspection or a verified index as appropriate.
- The assessment investigations and consolidated assessment have been reviewed;
  recommendations, limitations, and unresolved decisions are explicit.
- The extraction issue is Done after human approval of every current catalog behavior,
  with source coverage, verification, and unresolved questions explicit. Required
  behavior extraction and source-review packages are complete; saved drafts or source
  review alone do not satisfy this criterion.
- A human has accepted the migration brief and its prepared Migration issue breakdown, with scoped phases,
  checkable completion criteria, required evidence, and a validation plan. Planning
  assumptions, gaps, and phase entry conditions are explicit. An undecided target
  direction leaves the brief provisional; saving a draft is not accepted planning.
  The implementation issues are queued with scope, criteria, and native dependencies;
  their execution is not required to complete readiness.

Completion records reviewed readiness for the agreed scope, including any optional
limitations. It does not authorize implementation.
