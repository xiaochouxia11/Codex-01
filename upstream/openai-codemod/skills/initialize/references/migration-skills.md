# Select and set up migration skills

Initialize owns selection and setup; [shared skill use](../../codemod/references/selected-skills.md)
owns loading instructions and worker handoffs.

## Select skills

Find relevant skills in the current catalog, available installation inventory,
user-supplied references, and repository. Exclude unrelated skills and CodeMod's
own stages. For an agreed target, search for suitable stack guidance, prefer its
maintainers, and inspect candidate instructions and dependencies. Defer that search
when the target stack has not been selected.

Consider these optional migration skills when applicable:

| Skill | When to consider it | Skill-specific guidance |
| --- | --- | --- |
| [Ponytail](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail/SKILL.md) | Minimal implementation and review. | — |
| [Systematic debugging](https://github.com/obra/superpowers/blob/main/skills/systematic-debugging/SKILL.md) | Failure investigation. | — |
| [`property-based-testing:property-based-testing`](https://github.com/trailofbits/skills/blob/main/plugins/property-based-testing/skills/property-based-testing/SKILL.md) (Trail of Bits) | Target checks in `codemod:transform` or `codemod:verify-target` when a meaningful invariant or input/output relationship across a broad input domain could strengthen coverage. | Ground the property and input domain in the [approved behavioral contract](../../codemod/references/behavioral-scenarios.md). Selecting the skill does not approve adding a test-library dependency. |

Show each candidate's name, reference, purpose, and observed status in the checked
runtime: **Installed here**, **Not installed here**, or **Unknown**. A partial
inventory cannot prove absence; Local availability cannot prove Cloud access.

Ask applicable questions together, with the actual candidates and statuses, **Yes /
No**, and a free-text option:

- Use these relevant installed skills?
- Install and use these additional recommended migration skills?
- Use these target-stack skills, installing any that are missing?

List each candidate once. Omit empty or already-answered groups; do not reoffer
declined candidates. Save selections, references, applicability, explicit install/use
requests, exclusions, and deferrals in intent. Unanswered choices stay open.

## Set up approved skills

After the execution environment is chosen, check availability in that runtime and
reuse recorded choices. Unselected, declined, or skipped skills need no setup.

| Choice or state | Action |
| --- | --- |
| Already available and matching any recorded pin | Reuse it; record its observed identity. |
| Install and use | Reuse approval covering the exact identity, scope, and destination; ask only for missing approval or changed scope. |
| Use without installing | Keep pinned instructions and supporting files readable to the migration and its workers; do not install or register. |
| Setup choice missing | Ask whether to install, use without installing, or skip. |
| Installation declined, use undecided | Offer use without installing or skip once; do not repeat the installation request. |

Record the repository/path and full commit SHA, or a snapshot/digest covering the
skill and required supporting files. A recommendation link is not a pin. Record an
existing installation's observed identity without inventing past approval; resolve
pin mismatches rather than silently replacing it. Do not enable a broader package
without approval.

For an approved installation, use the supported installer on the selected Local
host, or follow [Cloud setup and publication](../../codemod/references/environments/cloud.md#prepare-the-setup-prompt).
Check the installed identity, record activation or manual actions, and avoid
repeated prompts on resume. Keep selections in intent and setup outcomes in the
[Execution environment](../assets/execution-environment.md).
[Workflow access](../../preflight/references/checks/workflow-access.md) owns actual-task
verification, including Cloud readback after publication; link its result and leave
availability pending until verified.
