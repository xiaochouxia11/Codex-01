# Select the record provider and report store

For an existing migration, resolve and reuse its verified binding through the
[issue-system router](../../codemod/references/records/issue-systems.md). Missing
access does not authorize a provider or report-store switch.

## Confirm one provider

Use Initialize's [questions and answers](../SKILL.md#questions-and-answers) for
provider, destination, and report-store choices.

Before new-migration intake or setup, use the router's provider catalog and each
candidate's discovery procedure to verify relevant read access **before presenting
the issue-system chooser**. For an explicit
provider choice, discover only that provider. Git checks the selected repository
and file access; no tracker integration is required. Present usable providers and
observed limits, then ask the user to confirm one even if only one is usable. An
explicit choice already supplied counts once access is verified. If none is usable,
explain the specific setup or access action and stop. Do not install, connect, or
configure integrations automatically.

Follow the selected provider's catalog adapter to confirm the destination and
resolve native hierarchy, fields, states, and relationships before creating records.
Discovery alone does not establish write access; verify the first authorized
substantive save by reading it back, never with a dummy probe.

## Confirm the report store

Follow only the selected provider's report-store procedure. Use a fixed native store
without discovering optional stores. Honor an explicit or
saved choice without discovering excluded stores. If optional storage is undecided,
use bounded, relevant read-only discovery and present actual destinations and access
limits alongside the supported native option. A failed or partial lookup leaves
availability unverified and does not block the native option.

Confirm the selected store and exact destination, including reviewer access and
ownership when relevant. Save it separately from provider identity in the migration
home's Tracking configuration. Reuse it on resume; access failure never causes a
silent fallback, conversion, or duplicate report.
