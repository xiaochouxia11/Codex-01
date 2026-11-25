# Reports and artifacts

## Migration reports and artifacts

Keep one authoritative home for each artifact:

| Content | Home |
| --- | --- |
| Migration-wide documents and reports | The bound report store, indexed from the migration home. Relevant issues link to reports. |
| Check and investigation results | The owning issue's body, using its stage template. |
| Current execution choices and setup details | The Execution environment artifact in the bound store. |
| Code, tests, fixtures, computer-use scenarios, runs, PRs, and security findings | Their originating repository or tool, linked from relevant reports or issues. |

Each stage owns its scoped records under its [record specification](issue-systems.md#stage-adapters).
Keep one document per purpose and explicit phase scope, preserve its title unless
renaming is requested, and retain relevant dated evidence when refreshing it. Only
the designated writer updates an aggregate; investigators own their issues and
findings. Follow the bound adapter when it assigns saving to a coordinator. Keep the
migration home a short overview and index.

### Maintain current content

Update the existing document or issue body in place with current findings, results,
and review status; replace superseded text rather than appending another version.
The owning stage's approval and revision rules still apply.

### Create documents when there is content

Create a migration document only when its owning stage has substantive content:
findings, evidence-backed gaps, scenario definitions, or a real planning draft.
Titles, links, template headings, and generic Not run placeholders are insufficient.

Before then, the stage's own document may be absent. Omit its link from queued
issues until a verified record reference exists; reuse existing documents and preserve their
history. A required upstream report remains a real prerequisite: return missing or
stale evidence to its owner.

Report artifacts are not executable work: exclude their native states from work
counts, prerequisite satisfaction, and acceptance. Before moving work to review
or requesting acceptance, follow the owning issue's link to each report required
for that handoff. Read it back from the bound store and verify the stage's
required content. Keep the handoff pending if the link, report, or content is missing.

Use human-friendly titles and verified record references without credentials. Keep large logs
at their source; local paths are not public links. Verify migration
associations and resource links; the owning stage repairs missing associations.
Leave inaccessible publication pending and do not complete work that requires it.

### Verification report format

Use compact scenario tables for target checks, with shared run metadata recorded
once. Give each required scenario a row in its owning verification record, including
missing or unrun cases, linked to its approved obligation, target outcome, run evidence,
and any details. Aggregate reports link those rows and summarize coverage, outcomes,
and gaps rather than copying them.

Bind rows to shared evidence entries for exact revisions, runtime, fixtures,
commands, timestamps, and review. Keep exact inputs, expectations, assertions, and
actual observations in immutable linked test/run artifacts or saved scenario detail
when no artifact exists. Expand cases with meaningful differences, failures,
limitations, or complex/manual procedures; do not omit behavior to shorten a table.
Reuse established IDs and avoid repeating shared metadata or caveats in every row.

Before handoff, reconcile the summary, scenario rows, shared evidence, and artifact
links. Update current publication references after verifying published bytes, so
completed reports do not still say publication is pending. Retain original run times
and follow [current-content maintenance](#maintain-current-content).

### UI screenshots

For work that changes or verifies UI, inspect representative screenshots from the
tested application before review. Cover affected normal and relevant exceptional,
interaction, or responsive states, including failures and unresolved differences.
Use sanitized fixtures, exclude secrets, and identify the tested target state and
accepted visual criteria. Screenshots alone do not prove behavioral conformance.

Keep full captures at their source. Publish selected previews through supported
uploads or embeds, or link durable evidence. Caption each with scenario/state,
viewport, application revision, and run reference. Never substitute generated
mockups for captures.

Put slice or verification-child previews on the owning issue and aggregate previews
in the existing stage report, linked from the issue's handoff. Reuse captures; do
not create a separate screenshot report. Verify the preview or link and keep any
required capture or publication gap open.

## Execution environment details

Read the migration's **Execution environment** artifact through its saved binding
and resource index. It holds execution mode, host/activation or cloud environment
name/configuration/link, repository, plugin details, and setup scope. Reuse verified
identity and title; clarify ambiguous matches rather than choosing by recency.

Intent links to it; setup and execution prompts include its verified reference. Keep
current environment fields in this one artifact, not copied into the migration
home or work issues. A report issue used by the selected store is an artifact,
not another setup or acceptance gate. Preserve historical check evidence on its
owning work issue. Unknown execution mode is not Local.

Initialize owns [execution updates](../../../initialize/references/records.md#execution-environment-details).
Report a missing, unreadable, or conflicting artifact as a gap. Return required
corrections to initialize; other skills do not change the environment record.
