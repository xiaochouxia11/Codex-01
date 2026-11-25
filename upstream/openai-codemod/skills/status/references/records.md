# Read migration status records

Use the bound provider's shared adapter for native inventory, acceptance, and
progress normalization. Read complete scoped work and artifact inventories, using pagination where applicable,
relevant blockers, and comments. Count each executable leaf once;
exclude parent summaries, canceled work, and report artifacts. Report native
acceptance separately from evidence freshness, awaiting review, and unresolved
human action. Keep unavailable or incomplete inventory explicitly unknown.

Read only the bound report store. A report absent before its
[first substantive checkpoint](../../codemod/references/records/artifacts.md#create-documents-when-there-is-content)
may be expected; distinguish that from missing evidence for claimed completion or
required downstream work. Compare only requested or established workflow scope.
Status never changes records, configuration, source, or migration lifecycle.

## Read stage evidence

Inspect only relevant stages and use their owning guidance to interpret results:

- **Intent and migration:** Compare the saved intent with its [template](../../initialize/assets/intent.md)
  and [acceptance rules](../../initialize/references/records.md#intent-work-and-acceptance).
  For an established default workflow, compare resources, groups, and issues with
  [workflow setup](../../workflow/references/setup.md). Identify conflicting associations
  and blockers without changing them.
- **Execution and source:** Read the [Execution environment](../../codemod/references/records/artifacts.md#execution-environment-details)
  and [setup progress](../../codemod/references/environments/README.md#check-setup-progress).
  A selected environment or Done cloud setup issue does not prove runtime access;
  return missing details to initialize. Where source is accessible, compare repository,
  recorded baseline and boundary with relevant working-copy differences. A newer HEAD
  alone does not invalidate intent; label inaccessible freshness unverified.
- **Preflight:** Compare check results, original execution times, runtime, revisions,
  and coverage with the [parent summary](../../preflight/references/reporting.md).
  For graph evidence, follow the [shared identity and read-only query rules](../../codemod/references/codegraph.md#query-and-reuse-the-source-graph);
  a live index alone does not establish current reviewed source evidence.
- **Assessment:** Read relevant investigations and the synthesis parent against
  [dependencies](../../assess/references/records.md#dependencies) and [synthesis freshness](../../assess/references/reporting.md#reuse-an-assessment).
  Distinguish eligible investigations from blocked or stale synthesis; report
  material source, journey, and coverage limits.
- **Behaviors:** Compare the [catalog and package records](../../behaviors/references/records.md)
  with source, assessment, and relationship evidence. Report extraction coverage,
  uncertainties, and unfinished packages separately from [human approval](../../behaviors/references/review.md).
  A completed technical child does not approve behaviors; do not add an extra
  approval-evidence gate to an accepted owning issue.
- **Brief:** Read the plan, guidance, and any warranted additional planning records
  under its [record specification](../../brief/references/records.md). Distinguish
  eligible early guidance or research, blocked synthesis, provisional planning,
  prepared work awaiting human review, and acceptance. Compare current evidence and
  phase assumptions under [revision rules](../../brief/references/reporting.md);
  planned tickets do not establish implementation progress.
- **Transform:** Compare started phase and slice records with current candidate,
  check and review evidence, and phase criteria under [reporting guidance](../../transform/references/reporting.md).
  Report failures, required unrun checks, unpublished changes, and remaining work.
  Distinguish implementation acceptance, independent [phase verification](../../transform/references/records.md#phase-verification-records),
  and [phase exit](../../transform/references/verification-loop.md#continue-the-phase-loop).
- **Final target verification:** Read the [verification records](../../verify-target/references/records.md)
  and [reporting rules](../../verify-target/references/reporting.md). Distinguish final
  child evidence and the parent report; a final report is not expected
  until synthesis is eligible. Compare the exact candidate, approved contract,
  test/fixture/runtime identities, original results, independence, coverage, and
  outstanding repairs or review. Whole-migration claims require one integrated
  candidate and cross-phase checks; phase reports alone are insufficient.

For default-workflow migration completion, read the [workflow reconciliation](../../workflow/SKILL.md#reconcile-completion)
and owning issue states. Distinguish accepted exceptions from technical success;
report missing, unresolved, or stale obligations without changing records. Route
corrections to the owning stage and do not recommend empty report placeholders.
