# Shared startup for migration skills

Apply this guidance whether the skill is invoked directly or by a workflow.
Whenever a step uses a template from `assets/`, follow the
[full-template reading rule](records/README.md#write-migration-records) before using it.

## Check a new migration request

For a new migration, check the requested change before provider discovery or
record creation. CodeMod implements bounded migrations to a different technology.
For an in-place upgrade or an architecture rebuild, offer assessment or planning
and explain that implementation needs another delivery path. This applies to a
rebuild even when the target language or framework changes.
Start setup only if the user requests supported work. If the target is undecided,
continue intake and leave the implementation path open.

## Open the migration records

Before accessing migration records, resolve the record provider, migration home, and report
store through the [issue-system router](records/issue-systems.md). Read the selected stage's
record specification, the bound provider's catalog adapter, and any procedure
listed for that provider on the stage row; follow the [shared record policy](records/README.md).
For a new migration, initialize establishes the binding through its
integration-selection procedure.
Do not infer or switch providers from available tools.

Follow applicable repository guidance and the [shared definitions](definitions.md).
When extra migration skills apply, follow [selected skill guidance](selected-skills.md),
including for delegated work. Include the [shared context](records/presentation.md#continuation-context)
in stage-local review, setup, and worker prompts. Each skill owns its scoped work;
changes to migration intent or execution choices belong to initialize.
