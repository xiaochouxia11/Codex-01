# Migration environment setup

Initialize prepares the [Local](local.md) or [Cloud](cloud.md) environment named
in intent. Read the [environment record](../records/artifacts.md#execution-environment-details)
and reuse working configuration. Preserve the agreed mode and source baseline.
Return changes to agreed requirements to intent.

## Shared requirements

Prepare every tool below that supports the source or agreed target. Where two
tools serve the same purpose, choose one. Reuse compatible installations. Install
missing analysis tools outside application source, using exact published releases
from approved sources. Defer target-specific setup until the target is known.

| Capability | What to prepare |
| --- | --- |
| Source build and tests | Follow the repository's setup instructions and version pins. Include required services and dependency access. |
| Target build and tests | Prepare the agreed runtime, SDK, and build and test tools alongside the source toolchain. Confirm version support in the official documentation. |
| Code relationships | Install the [CodeGraph CLI](../codegraph.md#install-and-configure) for supported source or target languages. MCP is optional. |
| Source quality | Prepare the [quality tools](#prepare-source-quality-tooling) that support the source. |
| Structural search and rewrites | Install [ast-grep](#structural-rewrite-tooling) for supported source or target languages. |
| Browser and visual tests | Prepare the browser runtime and automation that intent requires. Record whether the task needs headless or native access. |
| Workflow access | Make CodeMod, the selected record provider, and the report store available. Follow [skill setup](../../../initialize/references/migration-skills.md) for approved extra skills. |

Confirm that the tools start with the saved activation settings. Record versions,
activation instructions, and any unsupported or unavailable capabilities in the
environment record. Leave indexing, scanning, and rewriting application source
to the stage that needs the result.

Preflight checks the tools in the execution task. If a later stage needs a missing
tool, Initialize installs or configures it, then Preflight refreshes the affected
check. Other work can continue with current evidence.

## Prepare source-quality tooling

Use [jscpd](https://github.com/kucherenko/jscpd) for duplication and supported
dead-code checks. Choose [scc](https://github.com/boyter/scc) or
[cloc](https://github.com/AlDanial/cloc) for line counts, and
[Lizard](https://github.com/terryyin/lizard) or a language-specific analyzer
for function complexity. [Assessment](../../../assess/references/investigations/source-quality.md)
runs a measurement when it can answer an assessment question or satisfy a requirement.

## Structural rewrite tooling

Install the [ast-grep CLI](https://ast-grep.github.io/guide/quick-start.html#installation)
and invoke it as `ast-grep`. Check the
[supported languages](https://ast-grep.github.io/reference/languages.html) and
whether embedded or custom languages need parser configuration.

## Check setup progress

For a status-only request, read saved details without installing tools, running
probes, or changing records. For Local, compare the recorded host, checkout, Codex
project, activation, plugin and tooling availability, and gaps with the shared
requirements. For Cloud, use the setup conversation's result or settings state
(running, draft, or published); ask the user for it if missing. Do not discover
environments, poll setup, or message another conversation. Label user-reported
information and leave missing evidence unverified.
