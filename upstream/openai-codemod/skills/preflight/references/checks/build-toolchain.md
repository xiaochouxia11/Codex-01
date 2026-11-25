# Build toolchain

Verify this migration's components in the selected environment, following
[bounded capability checks](../../SKILL.md#bounded-capability-checks) and
[shared execution safety](../../../codemod/references/execution-safety.md).
Routine restores, builds, and tests are within preflight; source fixes, environment
configuration, production access, live-data migrations, and deployment are separate
work. Do not change application files. If safe isolation is unavailable, record the
affected stage as `blocked` and continue other requested, unblocked checks.
Require current, accepted Source access evidence before inspecting or executing source;
independent target and browser probes may proceed without it.

## Read definitions and CI context

Inspect the relevant pipeline, build entrypoints, and parent/shared configuration:
SDK pins, parent POMs or shared properties, feeds, and `build/`, `eng/`, or `scripts/`.
Record versions and dependency sources, generators, wrappers, dialect/include
flags, and required services. Identify what a direct build would skip.

Use the available GitHub or CI integration to inspect a small sample of relevant
completed runs. Record workflow/job outcomes, covered components/checks, durations,
run links, and commit refs. Distinguish partial checks from the full pipeline and
do not sum parallel job durations. Note differences from the baseline and reported
expectations. Inaccessible configuration or history is a gap, not proof of absent
CI. Do not trigger or retry it; CI success does not prove execution here.

## Check source execution

Choose a small representative project within the migration scope, with its shared
build inputs. If distinct affected components use different toolchains, check a
representative of each and state coverage. Respect reported duration and environment
requirements; do not build unrelated monorepo services.

- Syntax-check a standalone unit when useful for dialect/include issues. Skip
  this redundant stage when a configured project build already covers it.
- Restore and build through the documented CI entrypoint or local equivalent,
  preserving lockfiles and using real shared settings and generators.
- Run a relevant existing test or bounded suite. For an application that needs
  services, follow documented startup and verify a functional request or smoke test;
  an open port alone is insufficient. Report whether tests actually ran.

Skipped or undiscovered tests are not test proof. Passing one module establishes
evidence for that module, not the full system or behavioral equivalence.
Capture actual errors and likely causes under the [outcome rules](../reporting.md#check-outcomes).
Note available tests, fixtures, and coverage limits for assessment and later target
scenario design. Do not expand this bounded readiness check into a source test campaign.

## Check agreed target capabilities

Use intent and existing target manifests to identify the agreed capabilities:
runtime/version and the build/package tools or test framework needed by the probe.
A language name alone may not establish those choices. Verify what is defined,
then mark remaining target validation `deferred` if a needed decision is unresolved.
Name that decision for initialize; do not choose tools, architecture, or application
dependencies just to make the check runnable.

When sufficiently defined, create the smallest representative target project in
disposable scratch space outside source roots; restore, build, and run a real test
with the agreed tools. If target code already exists, use a bounded relevant
build/test instead. Decided but unavailable tooling is `blocked`, not `deferred`.

For version upgrades, check the required source and target versions separately and
record whether both can be exercised in the environment. Installing the target
must not be assumed to preserve source execution. Deferring target validation does
not defer source checks. Scaffold success proves only the tested toolchain, not
the migrated application or behavioral equivalence.

## Check required browser capabilities

When intent requires browser or visual testing, verify the required automation with
a bounded launch, page load, and screenshot using an isolated application or
disposable local page under the shared execution safety rules. Report headless
automation and native computer-use capabilities separately; success with one does
not establish the other. Configuration alone is not proof of usability. Record
missing required capabilities as `blocked`; this probe does not establish target UI conformance.

## Record gaps

Report outcomes and evidence separately for source restore/build, tests/startup,
target validation, and required browser probes; combine them under the outcome rules.
Retain partial evidence so source analysis can proceed even when execution is
blocked or target validation is deferred.

Record missing dependencies as setup follow-up for `codemod:initialize`.
After a separately requested fix, rerun affected checks in a task using the updated
environment; an already-running cloud task may still use the earlier setup.
