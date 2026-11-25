# CodeMod development and validation

The [workflow coordinator](skills/workflow/SKILL.md) owns the default sequence
and cross-skill handoffs. Stage skills own their work, prerequisites, and scoped
records; [transform](skills/transform/SKILL.md) owns the phase loop. Independent
phase and final verification share a [verification method](skills/codemod/references/independent-verification.md).
Both workflow and stages are provider-neutral.
Shared [record guidance](skills/codemod/references/records/README.md) and provider adapters
live under `skills/codemod/references/records/`. Stage-specific native instructions
and assets, when needed, live under each owning skill's `references/<provider>/` and
`assets/<provider>/`; common report content stays shared. A new provider adds its
catalog entry, any necessary stage-specific procedures and assets, and validation
scenarios without changing the renderer or rewriting stage policy. This package adds no backend or
local workflow database and does not synchronize providers or move migrations
between them. The Git provider uses tracked Markdown on one bound state branch.

Check Markdown links, workflow routing and handoffs, direct stage stopping points,
read-only status, missing routing or execution records, and supported report stores.
Separate installed tools, authenticated reads, permission metadata, and actual
write/readback evidence; development example accounts are never default test
destinations. Live write validation needs an agreed destination and scope.

Run the standard-library [package checker](tests/check-package.py) from the CodeMod source directory
to validate relative Markdown targets/anchors, provider adapters, stage records,
and reference routes from every skill to the shared router. Each stage row links
to its record specification first; append a provider-specific procedure only when
needed, under that stage's `references/<provider>/` directory. Otherwise the catalog
adapter applies. Coordinators reuse the selected stage's guidance. The self-test
checks valid routes and failure paths in disposable packages:

```bash
python3 tests/check-package.py --self-test
python3 -m unittest discover -s tests -p 'test_*.py'
```

These checks require Python 3.11 or later. The
[distribution guide](docs/DISTRIBUTION.md) explains how to build and verify a
ZIP with the standard-library [packager](scripts/package.py).

Use `--package-root PATH` for a copied package and repeatable `--extra-markdown PATH`
to check additional Markdown files. The
[adapter scenarios](tests/adapter-scenarios.md) cover raw provider evidence and
workflow outcomes separately from structural checks and normalized display fixtures.
Use the [Git delivery scenarios](tests/git-delivery-scenarios.md) to walk through
branch, PR, issue-audit, and candidate handoffs without live integrations.

The [progress-view test](tests/progress-view.cjs) uses synthetic provider data,
native/fallback review, Jira report artifacts, optional Confluence, Git records,
unknown/stale evidence, full inventories, and narrow layouts in both themes. Run
it from this package with existing Playwright, Chromium, and visualization host CSS.
It also checks the evidence-backed Transform burndown and its idle-time control:

```bash
VISUALIZE_HOST_CSS=/path/to/visualize.css \
PLAYWRIGHT_MODULE=/path/to/playwright \
node tests/progress-view.cjs
```

The test header documents optional screenshots. Rendering checks do not prove live
tracker access, report publication, or a registered live view.

Before release, run the [workflow smoke](docs/WORKFLOW_SMOKE.md) in a disposable
installation. Structural checks and synthetic records do not establish live
provider access or an end-to-end migration.
