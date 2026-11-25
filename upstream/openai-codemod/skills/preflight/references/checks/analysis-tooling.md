# Analysis tooling

Read the [environment setup record](../../../codemod/references/records/artifacts.md#execution-environment-details).
Check every analysis tool listed there and record any required tool that is
missing. If no analysis tools apply to the agreed stack, mark the check
`not_applicable` and explain why.

## Check availability

In the execution task, locate each executable and run its version and help
commands. Use the release's help or documentation to confirm support for the
intended language and mode. Reuse evidence that covers the same environment,
version, language, and mode.

For a standard CLI, stop there. If a capability depends on local configuration,
check just that setting. For example, parse one snippet with a custom ast-grep
parser or confirm which project the CodeGraph MCP server serves.

[Build source graph](source-graph.md) owns source indexing and queries.
[Assessment](../../../assess/references/investigations/source-quality.md) owns
source measurements. [Transform](../../../transform/references/implementation.md#apply-migration-tools-and-prior-lessons)
applies rewrites and verifies the resulting change on the slice.

## Record results

Record the runtime and check time once on this issue. For each tool, give its
path, version, supported language or mode, and any material gap. Link any
earlier check you reused.

Route missing tools or configuration to `codemod:initialize`. Keep an optional
failure visible as a limit. If a required capability is missing, keep the work
that depends on it open and continue independent work.
