# Execution safety

Stay within the selected stage's authorized work and writes. Inspect commands and
invoked scripts before execution, and explain planned probes.

## Protect the workspace and data

Inspect Git state before and after execution. Preserve user changes; report
incidental edits without resetting or deleting files. Record the actual revision
and local changes; checking out HEAD excludes uncommitted work.

Use the supplied cloud checkouts and startup instructions; create another worktree
only when requested. Locally, isolate commands that could affect user work in a
native worktree or supported disposable checkout. Resolve inputs there; if required
isolation is unavailable, stop the affected command and record the gap.

Use disposable output and data targets, verifying them before setup or cleanup
resets state. Checkout isolation does not protect databases or external services.
Clean up only this run's scratch material when safe; restart only services started
for this work.
A restored cloud snapshot does not establish live processes, connections, or credentials.

## Run bounded commands and preserve evidence

Use documented dependency access and preserve global configuration. Route missing
runtimes to [environment setup](environments/README.md). Bound long-running commands
with timeouts. On failure, capture diagnostics and stop the affected command or
check; diagnose before retrying, keeping follow-up within the stage's scope.

Record the command, working directory, duration, exit result, sanitized output,
tool versions, runtime/host requirements, revision, and relevant local changes.
Keep credentials and customer data out of recorded evidence. If relevant changes
cannot be compared later, mark evidence freshness unverifiable.

Attribute external evidence to its revision, environment, and coverage; CI or another
task's results do not establish capabilities in this runtime.
