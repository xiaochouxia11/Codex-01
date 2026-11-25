# CodeMod

Use Codex with GitHub Issues, Linear, Jira Cloud, ChatGPT Space, or Git-backed
records to plan and carry out a migration to a different technology, with reviewed
source behaviors, target tests, and independent verification against the accepted
contract. The current workflow supports phased transformation; upgrade and
architecture rebuild workflows are not yet included.

CodeMod is a skills-only plugin. It uses the selected record provider directly;
it has no bundled MCP server, local workflow database, or application dashboard.
This replaces the earlier SQLite-backed CodeMod application. Read
[Upgrading](#upgrading) before continuing an existing project.

## Install

Install `codemod` from your managed marketplace if it is available there.
To install from a source checkout, first
[build and verify the marketplace ZIP](https://github.com/openai/openai-codemod/blob/main/docs/DISTRIBUTION.md#build-and-verify-a-customer-package).
If you already have a CodeMod package ZIP, start with that ZIP.

Extract the ZIP to a directory you plan to keep. From the parent of the
extracted `openai-codemod/` directory, run:

```bash
codex plugin marketplace add ./openai-codemod
codex plugin add codemod@openai-codemod
```

Restart Codex. For Cloud tasks, the selected environment needs the published
plugin. See [cloud plugin availability](skills/codemod/references/environments/cloud.md#published-plugin).

## Start

You need Codex and Git sources with an HTTPS or SSH remote and a committed baseline.
Local checkouts and monorepo subdirectories are supported. GitHub Issues requires
access to a selected records repository; use the GitHub integration first and an
authenticated GitHub CLI for missing operations. An existing GitHub Project is
optional and requires separate access. Linear and Jira require a connected integration
with destination access; Confluence is optional. Git-backed records require a writable
migration-repository checkout and configured commit identity. For ChatGPT Space,
Initialize checks read access before offering it. Saving records requires permission
to create a Space or add Pages in the selected destination.

During intent gathering, choose whether coding issues integrate through short-lived
PRs or directly into their integration parent. Transform verifies the choice before
coding. Both paths use one migration integration branch and end in one cumulative PR to
the agreed destination. See [Git delivery](skills/transform/references/git-delivery.md).

Open your repository in Codex and ask:

```text
@codemod help me start a migration for this repository
```

Include what you know: the reason for migrating, the source path or repository URL,
and any existing migration home or intent document. An undecided target is valid.
Initialize verifies access to your selected provider, or helps you choose one.
It does not install integrations or switch providers automatically.

To resume, provide the migration's home reference and describe what you want to do next.
The migration home must contain its saved tracking configuration.
Continuation prompts carry the provider, home, selected report store, relevant
records, and execution context so a new chat can recover the same migration. For Git,
they also identify the authoritative branch, record paths, and committed state revision.

Initialize prepares the compatible tools for your Local or Cloud environment.
Preflight checks that they are available in the task. See the
[environment setup guide](skills/codemod/references/environments/README.md).

## Upgrading

The 0.2 release line replaces the old application and its `planning`, `issues`,
`execution`, and `verify-findings` skills with the workflow below. Existing
`.codemod/state.sqlite3` projects cannot be resumed by this implementation.
Their databases, documents, and generated issue files remain intact; there is
no automatic conversion. Follow the [upgrade guide](docs/UPGRADES.md) to preserve
an old project or start a separately bound migration.

## The workflow

[codemod:workflow](skills/workflow/SKILL.md) coordinates the seven-step default
migration and its handoffs. Each stage can also run directly when its prerequisites
are met. [codemod:transform](skills/transform/SKILL.md) owns implementation,
independent phase verification, and repairs; step 6 verifies the whole migration.
[codemod:codemod](skills/codemod/SKILL.md) remains an entrypoint, and
[codemod:status](skills/status/SKILL.md) is available anytime for a read-only update.

## Records and reviews

Track migration work in the [selected record provider](skills/codemod/references/records/issue-systems.md#provider-catalog)
and keep documents in the configured report store; code, tests, and fixtures stay in
Git. Intent, the behavior catalog, the migration brief, and changes to agreed outcomes
or constraints require [human approval](skills/codemod/references/records/reviews.md#always-require-human-approval).
Target verification covers the approved requirements tested; it does not establish
source-to-target parity.

## Further guidance

- [Migration progress view](skills/workflow/references/progress-view.md): follows the default workflow in supported clients.
- [Environment setup](skills/codemod/references/environments/README.md): prepare the selected Local or Cloud execution environment.
- [Records and lifecycle](skills/codemod/references/records/README.md): documents, issues, reviews, and progress reporting.
- [CodeGraph](skills/codemod/references/codegraph.md): setup, source graph queries, and saved evidence.
- [Source-quality analysis](skills/assess/references/investigations/source-quality.md): LOC measurement, duplication, complexity estimates, and supported dead-code checks.
- [Definitions](skills/codemod/references/definitions.md): source boundaries, migration terminology, and naming.
- [Developer guide](https://github.com/openai/openai-codemod/blob/main/DEVELOPMENT.md): package architecture, validation, and test instructions.
- [Distribution guide](https://github.com/openai/openai-codemod/blob/main/docs/DISTRIBUTION.md): build and verify the installable ZIP.
