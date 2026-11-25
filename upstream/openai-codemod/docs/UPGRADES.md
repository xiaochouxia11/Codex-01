# Upgrading CodeMod

## Skills-only replacement

The 0.2 release line keeps the `codemod` plugin identity and replaces the earlier
Python/SQLite application with migration skills using GitHub Issues, Linear,
Jira Cloud, ChatGPT Space, or Git-backed Markdown records. The local dashboard, MCP server, and
old planning, issues, execution, and verify-findings skills are removed. Use
`@codemod` or `codemod:workflow` to enter the new workflow; individual stage
skills remain available for focused requests.

Update through the same distribution you already use and restart Codex before
starting a new chat. A managed release must actually be published before it is
available there. If an old CodeMod server is running, stop it using the old
installation's supported shutdown procedure before replacing that installation;
do not kill an unidentified process. Updating the plugin does not convert or
delete project data, uninstall other integrations, or publish a Cloud plugin.

## Existing SQLite projects

A project containing `.codemod/state.sqlite3` belongs to the previous application.
This implementation cannot resume its executions, read its approval history as
new workflow approvals, or convert its issues automatically. Preserve the entire
`.codemod/` directory, including its database, documents, instructions, and issue
projections. Do not reset, rewrite, or import that directory to make it look like
the new record format.

For an old project's status or continuation request, explain this limitation and
identify the old project. Do not claim its work is complete or initialize a new
migration as a side effect. The user can continue with the previous plugin
version, or explicitly start a new migration with a selected provider and home.
For a new Git-backed migration in the same repository, verify its chosen
`.codemod/migrations/<migration-id>/` path does not overlap or replace old data.
Follow existing repository instructions and resolve any conflicting legacy
runtime instructions before writing.

When the user requests reuse of old documents, reference them as inputs with
their origin and limitations. The new migration still needs its own verified
provider binding and the human approval required by its stages. Historical
approvals and generated issue Markdown are not native records in the new system.
There is no supported automatic project converter in this release.

## Existing provider-backed migrations

Migrations created with the earlier draft package can keep their existing
provider, home, report store, state branch, and records. Invoke the corresponding
`codemod:*` skill and verify the saved tracking configuration. Older copied
prompts may name the draft plugin; those names identify its procedures, not a
different record provider. Update continuation prompts when authorized without
rewriting historical evidence or resetting the migration.
