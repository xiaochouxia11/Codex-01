# CodeMod workflow smoke

Use a disposable installation and repository. This operator-run check is separate
from package validation; never use an existing customer migration as a fixture.
Before testing live writes, choose a provider destination you have permission to write to.

1. Install the exact candidate ZIP through its `openai-codemod` marketplace and
   restart Codex. Verify the `codemod` identity, expected version, all ten skills,
   and absence of a CodeMod MCP server or application runtime prerequisite.
2. Ask `@codemod` to start a migration. Select a provider and a small source scope;
   verify the saved provider/home/report-store binding and authorized saves.
3. Exercise initialization, readiness, assessment, behavior review, and the brief.
   Check required human approvals and that focused calls stop at their own scope.
4. Authorize a bounded transformation. Verify implementation and independent
   checks use the correct candidate, maintain issue-owned Git history, and leave
   destination merge separate. Complete whole-migration verification and reconcile
   required outcomes before reporting completion.
5. Resume in a fresh chat using the same binding. Ask `codemod:status` for a report
   and confirm no migration records or repository files change.
6. In a separate synthetic legacy project, create a placeholder
   `.codemod/state.sqlite3` and representative documents and instructions. Ask to
   resume it. Confirm Codex explains the unsupported format, preserves all bytes,
   and does not create replacement records without a new-migration request.

### Small Git-backed fixture

Use a local disposable repository with a batch converter and two callers. Test
the following changes against the candidate package. Keep the fixture's agreement
and review decisions clearly identified as test inputs.

1. Try two requests through both the router and direct Workflow entry: an in-place
   framework upgrade and a rebuild that splits a monolith into services in a new
   language. Each should offer assessment or planning before provider discovery
   or record creation. Then request a supported migration and queue the default work.
   Count 21 items beyond intake and check the parent and reviewer assignments.
   Run one eligible check. Compare its queued result with its recorded evidence.
   Refresh the parent summary twice. Its Result should contain one readiness
   table. Unrun children should still show `not_run` in the Checks table.
2. Trace the two callers directly. Check that the Build source graph issue names
   the exact baseline, paths, and coverage. Have Initialize prepare ast-grep
   for the fixture language. In Preflight, confirm the executable, version, and
   supported mode. In Transform, preview and apply one rewrite. Inspect the diff
   for the intended call and an unchanged lookalike, then run the slice checks.
3. For an exact batch-write contract, supply a valid row followed by an invalid
   row. On the fixed source, capture the error and the unchanged output. Seed a
   target defect that writes the first row before failing. Verify the intended
   assertion fails, repair the target, and rerun it on the repaired commit.
4. From a fresh chat, follow the brief and final handoff to the slice branch plan,
   exact candidate, failed assertion, repair, and acceptance. Check that a report
   written with the earlier coverage and reconciliation headings is still usable.

Record the plugin version, candidate commit/checksum, provider and test destination,
actual results and limits. The [adapter scenarios](../tests/adapter-scenarios.md)
and [Git delivery scenarios](../tests/git-delivery-scenarios.md) provide narrower
offline checks. They do not establish hosted PR access or live provider behavior.
