# CodeMod contributor guidance

CodeMod is a skills-only migration plugin. `codemod:codemod` routes requests;
`codemod:workflow` coordinates stages. The selected record provider is the
authority. There is no local control plane or workflow database.
Read [DEVELOPMENT.md](DEVELOPMENT.md) and the relevant skills before editing.

- Keep product changes in this package. Update repository packaging, CI, and
  export references only when the requested change requires that integration.
  Preserve the `codemod` identity, marketplace registrations, and any repository
  ownership and release controls. Do not publish or change installed plugins unless
  the user requests it.
- Preserve unrelated work and keep changes to the requested scope. Inspect and
  report for review/explanation requests; implement for change requests.
- Stage skills own scope and prerequisites; provider adapters own native records.
  Keep shared evidence, approval, and continuation rules in their current owners.
  Do not add another state store, synchronize providers, or silently switch one.
- Preserve old project files. Follow [UPGRADES.md](docs/UPGRADES.md) when a change
  affects compatibility; old SQLite projects are not automatically converted.
- Keep skill directory/frontmatter names unqualified and user-facing names
  qualified, such as `codemod:assess`. Keep references portable in installed ZIPs.
- Run `python3 tests/check-package.py --self-test` and relevant standard-library
  unit tests. Test the built ZIP for packaging changes. For release verification,
  use [WORKFLOW_SMOKE.md](docs/WORKFLOW_SMOKE.md) and report which live checks ran.
- Use a Conventional Commit title for pull requests.

Prefer focused changes and existing checks. Add tests only for consequential
behavior or regressions; synthetic fixtures do not prove live migration execution.
