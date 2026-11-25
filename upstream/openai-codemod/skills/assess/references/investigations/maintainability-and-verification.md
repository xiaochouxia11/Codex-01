# Maintainability and verification

Use intent's maintenance model, readability expectations, conventions, and accepted
behavior requirements. Start from the source inventory and tools verified in preflight.
Read available source build/test results without waiting for undecided target tooling.

## Inspect

- Identify debt that affects this migration: brittle coupling, deprecated APIs,
  duplicated behavior, inconsistent error handling, configuration assumptions, or
  code that conflicts with agreed maintenance principles. Cite concrete examples.
- Use [source-quality analysis](source-quality.md) for a measurement the investigation
  needs. Inspect material findings against callers, contracts, and known variants.
- Trace important contracts and flows to existing tests, fixtures, recorded outputs,
  and CI evidence. Test presence is not execution or coverage proof. Distinguish
  exercised behavior from untested paths and limits of available results.
- Identify characterization, API, data, visual, and operational checks needed to
  check the agreed target behavior. Identify representative checks and missing
  evidence; do not write tests or execute a new test campaign in this investigation.
- Compare documentation with source. Identify missing or misleading explanations
  that matter for review, maintenance, or migration handover.

## Record

Rank findings by their effect on the migration, not by a fixed issue quota. For
each, record evidence, impact, and whether it is a migration prerequisite, useful
follow-up, or outside scope. A cleanup opportunity is not permission to change behavior.

Use the assessment template's
[Structural improvement opportunities](../../assets/assessment.md#structural-improvement-opportunities)
table for material findings. Explain how consolidating responsibilities, separating concerns,
or retaining intentional variants would help this migration; cite source locations
and affected component IDs, preservation requirements, and tradeoffs. Keep scanner
output as linked evidence rather than copying every match. These are structural proposals;
behavior extraction and approval remain downstream.

Use the [behavioral evidence and verification table](../../assets/assessment.md#behavioral-evidence-and-verification)
for important contracts and flows, then propose a verification strategy that addresses
baseline gaps. Recommendations must respect allowed changes and code principles;
unresolved acceptance thresholds go to initialize.
Do not convert code size or complexity into risk scores, cost, or delivery dates.
Follow [reporting](../reporting.md) for the child result.
