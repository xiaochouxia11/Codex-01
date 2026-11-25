# Security assessment

Assess security implications within the recorded boundary and intended change.
Separate existing weaknesses, risks introduced by the target direction, and gaps
that need further validation. This investigation does not fix findings.

## Reuse and inspect

Read relevant existing scans, dependency reports, and reviewed findings when
accessible. Record repository, revision, scope, date, and validation state; older
or broader results are context until their applicability is established.

Inspect relevant trust boundaries, entry points, authentication/authorization,
input and output handling, data access, configuration, and dependency changes.
Trace candidate issues to source and state uncertainty. Verify vulnerability and
support/version claims against current official advisories or documentation.
Use severity and CWE identifiers only when supported by evidence.

For credential findings, record location, credential type, and required action
with redacted evidence; do not create a raw secret inventory.

## Codex Security Cloud

When connected, use its accessible findings and completed scan outputs. Keep
finding IDs/links and scan IDs as evidence references rather than duplicating
entire scanner reports. A coding environment ID is not a security scan environment ID.

Launch a new scan only when requested or already required and authorized by the
migration scope. Follow the available tools' discovery workflow: identify the
repository and matching security environment, read workflow configuration choices,
and resolve any required model/reasoning selection before launch. Do not assume
the API supports a source ref or path filter that is absent from its schema.

For an asynchronous launch, retain the returned run ID on this issue and reuse it
to check status and read outputs. Reuse the launch idempotency key on an uncertain
retry; do not start duplicate scans. Verify the actual scanned revision and scope
before treating findings as baseline evidence. Keep a required scan pending until
its result is available; launching it does not complete the investigation.

## Record

Report findings, migration implications, evidence, and uncovered areas. If native
scanning is unavailable or not requested, state the bounded source review's limits;
do not imply scanner coverage or that the system is secure. A mandatory missing
review or scan keeps required work open. Optional scan gaps can be reported as a
limitation alongside completed source analysis. Follow [reporting](../reporting.md).
