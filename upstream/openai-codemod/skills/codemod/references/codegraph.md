# CodeGraph for migrations

Use [colbymchenry/codegraph](https://github.com/colbymchenry/codegraph) as the default
graph tooling for migrations, not another package with the same name.

## Install and configure

Apply the [shared compatibility policy](environments/README.md#shared-requirements)
and prepare the selected [Local](environments/local.md#prepare-local-tooling) or
[Cloud](environments/cloud.md#prepare-the-setup-prompt) environment:

- Reuse a compatible recorded version or pin an exact published release. Check its
  runtime requirements, installer options, and approved distribution channel;
  registry mirrors may lag upstream, and upstream `main` may contain unreleased
  features. If the pin is unavailable, use the official tagged standalone release
  where permitted or leave setup pending. Do not substitute `latest` or another
  version. Inspect the installer, version-selection options, and install paths at
  the chosen tag before execution.
- For supported languages, install and verify a persistent CLI executable on PATH
  in both Local and Cloud before configuring agents. Ephemeral `npx` is insufficient:
  the unattended installer assumes the executable is already available. Include
  the CLI in activation instructions.
- Configure MCP only if the runtime supports it. Use the official installer with
  an explicit Codex scope and preserve existing settings. Project scope
  (`--location local`) changes `.codex/config.toml` and the marked section of
  `AGENTS.md`; review both. Verify activation separately from configuration.
- Do not pass `--init` or run `codegraph init` during environment preparation;
  [Build source graph](../../preflight/references/checks/source-graph.md) owns initial
  indexing and readiness checks.

Record the package version, configuration scope, usable access method, and pending
work in the [execution environment](records/artifacts.md#execution-environment-details).
Installation does not replace [Analysis tooling preflight](../../preflight/references/checks/analysis-tooling.md).
An ad hoc cloud task installation does not update the published environment.

## Query and reuse the source graph

Preflight's [Build source graph](../../preflight/references/checks/source-graph.md) owns
initial indexing and readiness checks. Environment startup activates tools; it
does not rebuild the graph. Each checkout owns its `.codegraph/` cache; do not share
a mutable database between worktrees or commit it as a migration record.

When direct inspection covers the required relationships, use the source and
configuration evidence saved on the check. Follow the index requirements below
when indexed evidence is selected and the language is supported.

Before queries, verify the repository remote, exact source commit, source boundary,
index root, tool version, and checkout state against the recorded baseline. Use a
clean source checkout, isolating it when the execution checkout contains changes;
preserve user work. An index watching evolving target code is not the source graph.
Do not advance the baseline to a moving branch or trust a previous Done issue as
proof that this task has a matching index.

Select the intended project using the installed release's documented CLI working
directory/options or MCP project path. A shell directory change does not retarget
an existing MCP server. Check status, exclusions, pending work, and freshness using
the supported interface. Synchronize or rebuild a stale cache before depending on
its relationships; if freshness cannot be established, keep the gap explicit.

Later execution tasks may create or rebuild a checkout-local index for the same
accepted source and coverage without repeating the whole preflight. Record the
new index check and representative query results. Changed source, required coverage,
or material tool limitations return to preflight; tooling installation returns to
initialize. Read-only status and delegated read-only workers use only an interface
verified not to initialize or synchronize indexes, including implicitly on connection
or query. Default MCP may auto-sync. If a nonmutating mode is unavailable, inspect
saved evidence and report the live-query gap. Missing caches are execution setup
gaps, not evidence that saved findings or human approvals are invalid.

Use focused queries for the question at hand. The
[upstream CLI guide](https://github.com/colbymchenry/codegraph/blob/v1.6.1/README.md#cli-reference)
documents `explore`, `node`, `query`, `callers`, `callees`, and `impact`; inspect the
installed version's help before choosing options. Use equivalent MCP tools when
actually exposed. Inspect relevant returned symbols, relationships, and source
locations; do not dump the entire graph into chat or every report. Give subagents
the exact source/index context and relevant queries or results.

Use relationships to locate dependencies alongside assessed components and flows.
Confirm material interpretations against source/configuration; returned source can
support that inspection, while static edges alone do not establish runtime behavior,
behaviors, safe parallelism, or target architecture. Keep dynamic, unsupported,
and out-of-boundary relationships explicit; missing edges do not prove independence.
Keep source evidence fixed as target code evolves. Query target code separately
when useful and identify its actual revision and working-tree state.

## Record graph evidence

Save initial index checks in **Build source graph** and later query findings in
their owning issue or existing report. Record:

- Source repository, exact commit, boundary and supporting inputs; tool version,
  index root, freshness/coverage checks, and actual check time.
- The query or tool call, selected project, relevant symbols/relationships and
  source locations, and the conclusion or coverage decision they support.
- Exclusions, unresolved relationships, and limits.

Use these saved references for downstream graph evidence and checkpoint identity;
reuse existing context rather than repeating it per query. Paths locate a runtime;
repository/commit/source links identify the source across environments. Query
results are scoped evidence, not proof of runtime behavior. Save selected query
output when it helps reproduce a finding; large raw results stay at their origin
under the shared artifact rules. Existing saved evidence remains usable when its
source identity, relevant inputs, and coverage still match; retain its provenance.

For direct inspection, label evidence as source/configuration inspection, cite the
actual locations and relationships examined, and mark index/query fields not
applicable. Downstream stages reuse it under the same source-identity and coverage
rules; never describe it as a verified graph or conceal unresolved relationships.
