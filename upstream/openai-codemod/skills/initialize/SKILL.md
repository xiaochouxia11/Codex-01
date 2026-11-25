---
name: initialize
description: "Initialize or revise a CodeMod migration using a supported record provider. Confirm its access and report store, gather and accept intent, or prepare execution."
---

# Initialize migration

Capture intent, track its review, and record execution choices in the selected provider.
Follow [shared startup](../codemod/references/shared-startup.md).

Initialize owns intent and acceptance, execution setup, and the minimum migration
home and records needed for this work. It does not queue other skills' work.

## Prerequisites

None for a new migration. A focused follow-up needs the identified migration and
access to its saved provider and report store.

## Questions and answers

Use `request_user_input_async` when available for initialization questions, starting
with provider selection and continuing through intent, execution, and review choices.
Ask the next unresolved question or a small related group, with concise options and
free-text room. Reuse answers already supplied and ask dependent questions only after
their prerequisites are answered. Present the question through the tool itself.

The async tool returning means the question was delivered, not answered. Keep the
question pending and the turn active; continue only independent, authorized work,
then use an available interruptible wait or sleep tool until the user replies.
Repeat the wait as needed; do not end the turn merely because a question was sent.
Silence, preselection, an empty or partial response, and a wait timeout do not answer
unresolved questions or grant approval. Leave dependent work paused, incorporate
actual answers, and continue intake unless the user asks to stop or defer.

If the async tool is unavailable, use another native question tool permitted in the
current mode. If none is usable, ask concisely in chat and wait for a reply before
dependent work; do not require a mode switch.

## Initialization flow

1. [Select the provider and report store](references/integration-setup.md) before
   new-migration intake or setup; reuse the verified binding for existing work.
2. [Gather intent](references/gather-intent.md). For an existing migration, start
   the [intent work item](references/records.md#intent-work-and-acceptance) before
   drafting or revising. For a new one, [establish the migration home](references/records.md#establish-the-migration-home)
   and start the issue as soon as source and purpose are clear, then continue intake.
3. Ask where execution should run if not already decided. Follow the [environment
   setup guide](../codemod/references/environments/README.md) for the selected
   mode and [set up approved migration skills](references/migration-skills.md#set-up-approved-skills).
   Continue intake while setup is pending; preflight owns capability checks.
4. Draft from the [intent template](assets/intent.md) and use the
   [execution environment template](assets/execution-environment.md) when saving setup details.
   [Save and present intent](references/records.md#save-and-present-intent) with its
   linked work item and applicable setup actions. Stop after this scope.

## Focused follow-ups

| Request | Follow |
| --- | --- |
| Accept saved intent | [Acceptance in Codex](references/records.md#acceptance-in-codex) |
| Resolve or change the issue integration choice from Transform | Ask the authorized decision-maker using the supplied feasibility constraints, then follow the [method-only execution setup update](references/records.md#intent-work-and-acceptance). Save and read back the choice, present the verified intent reference and value, and hand back to Transform. If other accepted requirements change, use the normal intent revision and acceptance flow. |
| Prepare or update a local workspace and tooling | [Local environments](../codemod/references/environments/local.md) |
| Choose an existing cloud environment or create one | [User selection and setup](../codemod/references/environments/cloud.md#choose-an-environment) |
| Update the cloud environment or add missing tooling | [Manual environment updates](../codemod/references/environments/cloud.md#refine-an-existing-environment) |
| Check setup progress | [Progress in the selected environment](../codemod/references/environments/README.md#check-setup-progress) |
| Record supplied environment details | [Migration execution details](references/records.md#execution-environment-details), plus [cloud setup tracking](references/records.md#cloud-environment-setup) when applicable |
| Resolve intent questions from later stages | Start the [intent revision](references/records.md#intent-work-and-acceptance), [gather intent](references/gather-intent.md), then [save it](references/records.md#save-and-present-intent). |

Run the [shared progress checkpoint](../codemod/references/records/lifecycle.md#progress-checkpoint)
before handing off initialization or a writing follow-up.
