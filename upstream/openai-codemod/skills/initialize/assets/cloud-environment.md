## User steps

1. {{If setup has not started: in Codex choose Work in → Cloud → Select environment → Create environment. For an unpublished setup already in progress: continue its setup conversation, linking it when available. For a published environment: Settings → Codex Cloud → Environments → its … menu → Edit. Include only the applicable path.}}
2. Confirm {{source repository links and a different migration destination when known}} are selected. If creating the environment, select **Get started**.
3. Paste the **Set up migration tooling** prompt below into that setup or editing conversation to extend its repository setup before publishing.
4. Review its setup, resolve required gaps, save, and select **Publish** or **Republish**. Use **Share with Codex** below to record the details.

[OpenAI cloud environment instructions](https://learn.chatgpt.com/docs/environments/cloud-environments)

## Set up migration tooling

```text
{{Insert the fully populated [cloud tooling prompt](../prompts/cloud-tooling-prompt.md), including the
published CodeMod plugin details and language-compatible tools from the shared
setup requirements, with their exact releases, activation, and capability limits.
Do not leave a template path or placeholders here.}}
```


## Share with Codex

Populate the message with the [shared continuation context](../../codemod/references/records/presentation.md#continuation-context)
and paste it into a Codex chat with access to the selected provider and report store:

```text
I have completed the cloud environment setup for {{system and migration name}}.
- Issue system: {{selected provider}}
- Migration home: {{verified migration-home reference and provider-specific context}}
- Report store: {{saved store choice and exact destination}}
- Setup issue: {{verified work reference}}
- Execution environment record: {{verified document reference, or explicitly not yet saved}}
- Scope: Record the supplied setup details and report any remaining setup action.
- Name: {{environment name}}
- Settings link or configuration ID: {{if available}}
- Connected repositories: {{repository names or URLs}}
- Published setup and tooling: {{publication state, setup summary, and remaining gaps}}
- CodeMod plugin: {{publication/availability and version when known; Workflow access result pending or its issue link}}

Use codemod:initialize to save these details for the migration and follow its agreed review and completion rules for this setup issue.
```
