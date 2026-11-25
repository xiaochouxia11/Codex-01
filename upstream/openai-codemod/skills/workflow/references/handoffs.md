# Hand off between skills

Workflow owns cross-skill handoffs. Continue already authorized eligible work in
the same chat without a prompt; otherwise end with a self-contained outcome and
**Next step** when workflow work remains. State the review, blocker, or external
action first and make continuation conditional on its resolution. Do not ask a
user to complete future work or repeat an approval already recorded.

When workflow work remains and cannot continue within the current authorization
or execution context, provide a copyable fenced `text` prompt that invokes
`codemod:workflow`, names the intended skill or phase and
requested scope, and carries the [continuation context](../../codemod/references/records/presentation.md#continuation-context).
State where to paste it. Keep explanations outside the block; a prompt cannot
switch execution environments or grant approval. Separate stage-owned acceptance
and continuation prompts unless both actions were requested.

For the first preflight run or a focused readiness refresh, populate the
[preflight continuation](../prompts/preflight-prompt.md) from verified records.
For Local, reuse the current task only when its host, Codex project, checkout, and
plugin match; otherwise identify the project or folder for a new task. For Cloud,
use the recorded environment and repository in a new task after creation or
republishing; a setup or local chat is not the execution destination. State any
outstanding publication or setup action without treating unknown metadata as proof
that republishing is needed. Give the populated prompt to the user and post the
same text on the existing Preflight parent using the
selected adapter. Avoid duplicate comments and verify the save; if posting fails,
still provide the prompt and disclose the gap. A tooling update names only the
affected checks; a task, plugin, or connection change may require refreshing
Workflow access under its existing evidence rules.

When workflow work is complete, state completion and link the saved result and
available destination PR under the [Git delivery handoff](../../codemod/references/records/presentation.md#git-delivery-handoff)
without a continuation prompt. A pending destination merge or deployment is not
another CodeMod stage.
