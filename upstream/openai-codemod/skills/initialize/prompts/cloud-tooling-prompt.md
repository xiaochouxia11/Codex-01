Prepare this Codex cloud environment for {{system and migration purpose}}.

- Issue system: {{selected provider from the saved binding.}}
- Migration home: {{verified reference and provider-specific continuation context; explicitly unavailable if not yet saved.}}
- Report store: {{saved choice and exact destination; include only the selected store.}}
- Migration intent: {{verified document reference, or explicitly not yet saved.}}
- Setup work item: {{verified work reference, or explicitly not yet saved.}}
- Execution environment: {{verified document reference, or explicitly not yet saved.}}
- Requested scope: Prepare the selected cloud execution environment and return its setup summary.

Read the linked records if accessible. If the environment document is unlinked,
check the migration home's resource index. Reuse saved decisions and delegated
authority; surface conflicts with the summary below. If selected provider or report
store access is unavailable, report the gap, use this summary, and ask only for
missing setup details. Do not discover optional stores, change destinations, or
create records.

Context:

- Source: {{repository URLs, requested refs, full baseline commits when known,
  repository-relative system boundaries, and required shared inputs.}}
- Migration destination: {{repository and planned branch, or explicitly open.}}
- Target: {{chosen technology/runtime/architecture, whether target code exists,
  adopted versions or constraints, delegated choices, and explicit deferrals.}}
- Setup requirements: {{known source restore/build/test/start commands, target
  tooling, services/private feeds, and browser or visual-test needs; explicit unknowns.}}
- Analysis tools: {{List each compatible tool, its purpose, language or mode,
  exact release, and approved installation source. Note any setup constraint.}}
- Existing setup: {{saved configuration, completed checks and limitations, and
  draft/published state when known; otherwise inspect them.}}
- Extra migration skills: {{selected identifiers, applicability, source repository/path
  and full commit SHA or saved snapshot/digest, approved installation scope and this
  environment, and current outcome; distinguish use-without-installing, skipped,
  undecided, and pending approval. Include retrievable references, not local-only paths.}}
- CodeMod: {{published plugin identifier and expected version when known;
  otherwise publication or version confirmation pending.}}

Read the existing Install script, Start skill, repository configuration, and setup
results. Extend working setup and validate additions. Preserve source toolchains and
repository changes; do not reset the checkout or confuse its HEAD with the recorded
baseline.

Use the published CodeMod plugin; do not install it from Git or through a nested
Codex CLI. Report its availability/version here. If unavailable, leave verification
pending and continue independent tooling setup. Install only extra skills explicitly
approved for this environment, using their recorded immutable identity and scope;
preserve existing skills. Do not install use-without-installing, skipped, undecided,
or unapproved selections. Store installation in the Install script and activation
in the Start skill. Report setup gaps; publication and setup do not establish
availability in a later execution task.

Prepare the minimal agreed target runtime/SDK and build/test tools alongside the
source stack. Verify version and support choices against current official documentation.
Return material choices outside the saved decisions or delegation for resolution and
continue independent preparation. Prepare required browser or visual-test tooling;
distinguish headless testing from native computer-use capabilities.

Prepare every listed analysis tool. Reuse compatible
installations or install the specified releases outside application source. Verify
version, required runtime, language coverage, and persistent CLI activation.
For CodeGraph, use the specified package and pin. Configure MCP only when supported
and verify it separately.

Do not scan application source or run CodeGraph init/index during setup or at startup.
Preflight checks the prepared tools in the execution task and owns any required
source indexing, build/test, and browser probes. Assessment owns source measurements.
If indexing is planned, explain how later tasks use a separate index for their checkout.

Save the tested configuration draft in the environment's Install script and Start
skill; shell-only changes or scripts printed in chat are insufficient. Return a
short summary of repositories/refs, exact tool versions and selected skill identities,
setup checks, plugin availability, CLI/MCP and browser capability, saved configuration
changes, publication state, and gaps. After user publication or republication,
preflight's Workflow access check verifies the plugin and selected skills in a new
execution task. Leave unperformed preflight checks pending. Stop at environment preparation; do not change
application code or update provider or report-store records.
