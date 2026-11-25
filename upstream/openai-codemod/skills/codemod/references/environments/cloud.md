# Cloud environments for migrations

The user selects, creates, edits, and publishes Cloud environments in Codex. Reuse
the recorded choice; do not discover environments or automate these actions. Apply
the [shared setup requirements](README.md#shared-requirements); the copied setup
prompt must work on its own in the setup conversation.

## Choose an environment

Ask only whether the user will reuse or create an environment, and request the
existing environment's name or settings link if unknown. Provide the [user steps](../../../initialize/assets/cloud-environment.md#user-steps)
and [OpenAI cloud environment guide](https://learn.chatgpt.com/docs/environments/cloud-environments).
Confirm coverage of source repositories and any separate migration destination;
leave undecided coverage open. Track preparation on the [Cloud setup issue](../../../initialize/references/records.md#cloud-environment-setup)
and continue intake while it is pending. Selection does not prove source access.

## Prepare the setup prompt

Resolve setup-relevant [target choices](../../../initialize/references/gather-intent.md#target-direction)
through intent. At each handoff, read saved intent and the [environment document](../records/artifacts.md#execution-environment-details),
then populate the [cloud tooling prompt](../../../initialize/prompts/cloud-tooling-prompt.md).
Include the saved intent, environment, and migration-home references. Identify
anything still unsaved. Give the source revisions, target choices, delegated
decisions, constraints, and deferrals. Include existing setup results and the
published plugin version when known. For each compatible tool, specify the
release, installation source, supported languages, activation, and known limits.
The prompt must work without record access. Refresh it when those details change.

Put the populated prompt in a copyable code block and the setup issue's **Set up
migration tooling** section. Include no plugin-dependent instructions, local links,
template tokens, or secrets; leave unknowns open. For an unpublished environment,
continue its setup conversation before **Publish**. For a published environment,
use **Edit** then **Republish**. Extend existing setup and save the tested Install
script and Start skill. Deferred choices limit only dependent setup; provisional
tools do not establish agreed architecture.

## Published plugin

Cloud work uses the published CodeMod plugin, not a Git copy or nested CLI
installation. Record its identifier and expected version when known; distinguish
confirmed publication from availability in an execution task. Local personal plugins
do not sync to Cloud tasks. Preflight's [Workflow access](../../../preflight/references/checks/workflow-access.md)
checks actual availability; link its result from the environment document when available.

## Refine an existing environment

Update the setup prompt for missing SDKs, dependencies, services, browser capabilities,
or analysis tooling. Preserve working configuration and previous evidence; record
what changed and which capabilities need a fresh check. Ordinary task changes do not
update the reusable environment. Intent changes follow initialize's revision procedure.

## Save the choice

Collect the name, available settings link or configuration ID, repositories,
publication state, published plugin details, and tooling summary or gaps. Distinguish
configuration IDs from task IDs and setup results from preflight findings; do not
invent links. Follow [Cloud setup tracking](../../../initialize/references/records.md#cloud-environment-setup)
to save the environment document and present the issue for review.
