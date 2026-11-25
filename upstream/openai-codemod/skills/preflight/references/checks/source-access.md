# Source access

Verify the actual execution context before relying on its checkout:

- Compare the current local/cloud runtime and repository with the migration's
  Execution environment document, resolved through the [shared lookup](../../../codemod/references/records/artifacts.md#execution-environment-details).
  In managed cloud work, read
  `cloud-environment:cloud-environment-runtime` when available and use its runtime
  status tool when exposed. A configuration name or published version is not proof
  that this task uses it. Record unavailable identity details without inventing IDs.
- For Local, compare the actual host, working directory, and Git root with the
  recorded Codex project and execution checkout. A sidebar project association
  alone does not prove that the task executes in that repository.
- Resolve every source repository and boundary root, including required shared
  code, in the active checkouts. Record repository URLs, observed refs, full commit
  SHAs, and differences from intent. A moving branch does not advance the baseline.
- Verify each source is a Git checkout with a remote matching its recorded repository
  and the required baseline commit available. Plain folders, absent remotes, or missing
  roots or commits block dependent checks. Route unsupported source to initialize without
  converting it, substituting another repository, or expanding the boundary.
- Inspect Git state and record unpublished or uncommitted changes separately from
  the committed baseline. Preserve them; graph analysis follows the shared
  [baseline isolation guidance](../../../codemod/references/codegraph.md#query-and-reuse-the-source-graph).
- When remote access is required, test the actual read-only Git operation using
  the environment's existing HTTPS/proxy configuration. Missing token variables
  or an unauthenticated `gh` session do not establish missing Git access. Report
  the command's result without exposing credentials or changing authentication.

If this task is running in the wrong repository or environment, report the required
routing correction. Checks performed elsewhere remain evidence for that context.
Do not select a replacement environment, add repositories to its configuration,
reset source, or rewrite intent. Route setup corrections to initialize.

Note whether useful Git history is available or the checkout is shallow. This is
optional context for later analysis, not a reason to fetch full history now.
