Verify the completed migration against the agreed intent for {{System — Migration}}.

## Scope

Check the completed changes against the behaviour, quality, completion criteria,
and handover expectations recorded in intent and the accepted brief, after required
development and its verification loops are complete in Migration. Step 6,
codemod:verify-target, runs a separate whole-migration pass on one integrated
candidate, including required cross-phase interactions. Phase/slice verification
and repairs remain in Migration. Add focused specialist checks where agreed
requirements or material risks warrant them, rather than queueing every category by
default.


## Key issues

{{Link the whole-migration verification parent queued by workflow.
Its children map required coverage, run integrated target checks, and perform any
needed specialist checks; the parent saves the final report, reconciles its
verification criteria, and obtains the agreed review. Workflow reconciles
migration-wide completion across all owners. Use human-friendly issue names.}}


## Completion criteria

- Required verification has run, with evidence linked to the exact integrated target
  candidate, approved behaviors and accepted criteria, scenario identities, and actual test runtime.
- Whole-migration coverage and required cross-phase interactions have been checked
  against one integrated candidate; separate passing phase reports are insufficient.
- Required completion criteria in accepted intent and brief are met or explicitly
  resolved by their approval owner; limitations and accepted exceptions remain visible.
- Required documentation and handover are complete.
- The final report maps every required verification criterion to its owner, current
  evidence, and acceptance or explicit resolution under the applicable approval rules.

Issue acceptance does not automatically complete this work group or authorize a
destination merge, deployment, cutover, or release. Preserve the brief's separately
owned criteria.
