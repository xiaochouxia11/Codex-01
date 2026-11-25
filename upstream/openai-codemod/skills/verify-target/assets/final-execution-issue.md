**Procedure:** codemod:verify-target — skills/verify-target/SKILL.md.

**Parent:** {{Whole-migration verification coordinator in Final verification.}}

**Coverage map:** {{Coverage child; required native blocker.}}

## Scope and steps

After the coverage map and upstream prerequisites are accepted, independently
execute its assigned target behavior and quality checks on one integrated candidate,
including cross-phase interactions. Follow verify-target execution guidance:
check approved obligations, challenge boundaries and assertions, and
demonstrate a meaningful failing canary followed by restoration and a clean rerun.
Route target defects to Migration repairs and block affected verification on them.
Specialist checks assigned to other children retain their owners; the parent
reconciles their evidence without duplicating those checks here.

## Required evidence

Exact candidate and input identities, independent verifier, per-case observations
and target outcomes, actual results, challenge/canary evidence, and complete
required-coverage reconciliation. Reference durable assets and raw runs. For UI
checks, include selected screenshot evidence under **UI screenshots** in
`skills/codemod/references/records/artifacts.md`.
Required gaps stay open. Obtain the agreed review. The parent synthesizes accepted findings
for this same candidate and owns the final report; do not create a competing report.

## Result

**Outcome:** not_run
