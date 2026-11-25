# Distributing CodeMod

CodeMod is distributed under the existing `codemod` plugin identity. Version 0.2
replaces the local application with workflow skills, references, and templates.
The package has no MCP server, local dashboard, Python runtime, SQLite store,
Node dependencies, or WSL launcher. Read [Upgrades](UPGRADES.md) before updating
an installation used with the previous application. Loading the skills requires
Codex; migration work still needs Git sources, access to the selected record
provider, and the tools required by its execution environment.

Keep the shared plugin customer-neutral. Customer source, data, credentials,
generated reports, and custom instructions belong in the approved migration
workspace or report store, outside the shared plugin source.

## Build and verify a customer package

Use Git and Python 3.11 or later. To get a clean source checkout, run:

```sh
git clone https://github.com/openai/openai-codemod.git
cd openai-codemod
```

From the CodeMod source directory, run:

```sh
python3 tests/check-package.py --self-test
python3 -m unittest discover -s tests -p 'test_*.py'
python3 scripts/package.py build --output ../codemod-package/openai-codemod.zip
python3 scripts/package.py verify --archive ../codemod-package/openai-codemod.zip
```

Use a dedicated output directory for each candidate. The build writes three
files: the requested ZIP, `RELEASE.json`, and `SHA256SUMS`. It verifies the staged
artifact before replacing these files. The ZIP extracts to `openai-codemod/` and
contains the local marketplace manifest, installation instructions, embedded
release evidence, and `plugins/codemod/`.

To install this build, extract it alongside the ZIP and follow the
[local marketplace installation steps](../README.md#install):

```sh
cd ../codemod-package
python3 -m zipfile -e openai-codemod.zip .
```

The plugin payload includes only tracked source files under `skills/` and
`assets/`, its manifest, `README.md`, and `docs/UPGRADES.md`, plus generated
`distribution.json`. Ownership files, contributor instructions, hidden files,
tests, developer scripts, review helpers, and other repository documentation are
excluded. No frontend build or dependency installation occurs. The packager
normalizes customer author metadata and retains the existing plugin name and
version. Identical inputs produce identical ZIP bytes.

`RELEASE.json` records `plugin`, `marketplace`, `version`, `source_commit`,
`dirty`, and a SHA-256 inventory of every other ZIP member. `distribution.json`
retains the installer contract: `mode: distribution`, `source_commit`,
`plugin_version`, and `dirty`. The external and embedded release records must
agree. `SHA256SUMS` identifies the exact ZIP filename and digest.

Verification checks the archive digest, file inventory and hashes, provenance,
marketplace and plugin identity, all ten workflow skills, required user guidance,
and manifest assets. It rejects unsafe archive paths, links, executable or special
files, duplicate members, and files outside the skills-only boundary. It then
extracts the verified members into a temporary directory and runs the trusted
source checkout's Markdown and provider-route checker against those exact files.
It never executes code from the ZIP. Keep `tests/check-package.py` alongside the
verifier in the source checkout; neither is a customer runtime dependency.

Normal builds require a clean CodeMod subtree. For a local preview, add
`--allow-dirty` to both build and verify. The preview is marked `dirty: true` and
cannot be consumed by managed release automation. New shipping files must be
tracked before packaging, even for previews; untracked files are never included.
Commit the final source and rebuild without this flag before release.

Before releasing a package, run the [workflow smoke](WORKFLOW_SMOKE.md) in a
disposable installation, including the upgrade check for an existing project.
