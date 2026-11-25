# Local environments for migrations

Use this guide for Local execution with the [shared setup requirements](README.md#shared-requirements).

## Prepare local workspace

1. Resolve the selected host and source repositories from intent. Reuse supplied
   checkouts or matching Codex projects after checking remotes, HEAD, and Git status;
   preserve branches, user changes, and managed-worktree associations.
2. For a missing checkout, reuse an agreed clone location or ask where to put it.
   Clone with existing credentials into an unused directory. Make the recorded
   baseline available in every source checkout, fetching only needed refs or commits.
   Check it out in new clones; preserve reused HEADs and dirty work, isolating when
   needed. Never advance the baseline. If it is unresolved, record the requested
   ref's observed SHA for intent. Record access or host gaps and continue intake.
3. Establish the execution repository separately from additional source or migration
   repositories. Keep an undecided destination open and monorepo boundaries as
   relative paths; do not move or copy code.
4. List native Codex projects when available and reuse the matching host/repository
   project. Otherwise add or open the repository folder using a supported capability;
   if unavailable, ask the user to add or open that exact folder. Record the project
   name, ID when available, root, and checkout path. Keep registration pending until
   observed or user-confirmed; cloning does not create a Codex project.
5. Move the current migration chat into that verified Local Codex project with
   `move_thread_to_project`, reusing a correct existing association.
   Use the selected project's ID on the same host and verify the association through
   thread metadata or user confirmation. Registering a project does not associate
   the chat.

Follow [execution safety](../execution-safety.md). Do not edit Codex's internal state
to register a project. Report a mismatch with the selected workspace.

## Prepare local tooling

Resolve the host OS and activation commands, then prepare missing tools under the
shared requirements using existing managers and scoped installations. Preserve
healthy versions and configuration; do not rewrite manifests, lockfiles, or global
shell settings to make setup pass. Check activation and executable paths in a new
command session in the actual task, and save reusable activation/start commands.
Keep CodeGraph configuration separate from application changes and each worktree's
mutable index separate.

Use the installed CodeMod plugin, including an explicitly selected development
installation. If absent, use Codex's supported installation flow for the published
package; do not copy individual skills. If an update is not discovered, direct the
user to a new task in the selected Codex project.

Record actual versions, paths, checks, activation commands, and gaps in the
[environment document](../../../initialize/references/records.md#execution-environment-details).
Routine Local preparation needs no separate setup issue. For a tracked fix or human
action, reuse or create a focused issue under the [record rules](../records/lifecycle.md#issue-workflow),
blocking only affected work. Do not create Cloud setup records for a Local migration.
