---
name: codemod
description: "Entry point for CodeMod migrations. Route migration-wide requests to the default workflow and stage-focused requests to the relevant skill."
---

# CodeMod

Use this entry point for `@codemod`. Developing the plugin itself is ordinary
repository work, not a request to initialize a migration.

For a new migration, [check the requested change](references/shared-startup.md#check-a-new-migration-request) first.
For migration-wide start, resume, or continuation, follow
[codemod:workflow](../workflow/SKILL.md) in this chat. Honor an explicit request
for a new migration instead of silently resuming an older one.

For an explicitly focused request, follow the matching skill directly:
[codemod:initialize](../initialize/SKILL.md) for intent or environment setup,
[codemod:preflight](../preflight/SKILL.md) for readiness,
[codemod:assess](../assess/SKILL.md) for source assessment,
[codemod:behaviors](../behaviors/SKILL.md) to identify and review source behavior,
[codemod:brief](../brief/SKILL.md) for migration planning,
[codemod:transform](../transform/SKILL.md) for phase transformation, phase
verification, or scoped implementation or repair,
[codemod:verify-target](../verify-target/SKILL.md) for whole-migration target
verification, or [codemod:status](../status/SKILL.md) for a read-only update.
The selected skill owns its scope and stopping point. Resolve the
[issue system](references/records/issue-systems.md) before reading or changing records.
