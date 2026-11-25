# Extraction issues

Use this specification with [shared record setup](../../codemod/references/records/README.md#record-setup)
and the bound provider's [route](../../codemod/references/records/issue-systems.md#stage-adapters).
Extraction owns its parent, planning child, package children, and catalog; a
focused review uses only the owning issue and saved catalog. Record-only setup
does not run planning or extraction, or approve behaviors.

## Records

For extraction setup, create or reuse these records in Readiness:

| Record | Template | Purpose |
| --- | --- | --- |
| Identify source behaviors — System — Migration | [Parent issue](../assets/extraction-issue.md) | Coordinate extraction, publish the catalog, and obtain human approval. |
| Plan behavior extraction | [Planning child](../assets/extraction-plan-issue.md) | Allocate bounded packages from the accepted assessment and create their issues. |

Set the planning child's parent to the extraction issue. Identify
`codemod:behaviors` as the procedure and link only existing documents. Do
not invent packages before planning. Create or reuse **System — Migration behaviors**
at the first substantive [checkpoint](reporting.md#save-each-completed-batch),
never empty during setup. The parent owns human approval of the saved catalog;
planning and package issues receive technical review under the agreed authority.

## Dependencies

Apply the common [readiness prerequisites](../../codemod/references/records/README.md#technical-work-prerequisites)
to the parent and children. When assessment is tracked, link its synthesis parent
directly to the extraction parent and planning child; otherwise verify equivalent
accepted assessment evidence under the [shared prerequisite rules](../../codemod/references/records/README.md#prerequisite-evidence).
Each package needs the same upstream prerequisites, the planning child, and any
genuine package dependencies. Native parenthood does not inherit blockers.

Do not block children on the extraction parent or the parent on its children: the
parent coordinates work and stays unfinished until required technical work and
catalog approval are complete. Never attach extraction as an assessment child.

## Plan, then create package issues

Use [partitioning](extraction/partitioning.md) to allocate relevant components,
source areas, important flows, and known journeys to bounded responsibilities,
explicit exclusions, or gaps. Create or reuse **Identify behaviors — responsibility**
issues with the [package template](../assets/extraction-package-issue.md). Package
issues are siblings of the planning child beneath the extraction parent in Readiness.
Populate scope, inputs, questions, and completion criteria before dispatch; a small
system may need only one package. Do not create a ticket per file, behavior, worker,
or verification pass.

Apply the direct [dependencies](#dependencies), verify coverage and acyclic native
relations, then complete the planning child under the agreed review authority.
The parent links children; the planning child owns allocation; package
issues own assignments and checkpoints; the catalog owns behaviors. Technical child
completion does not approve the catalog.

## Work, resume, and refresh

The coordinator reads child states, comments, and blockers before dispatch and
updates them under the shared lifecycle. Workers receive the exact package issue
and assignment but return findings without writing migration records. Follow
[bounded delegation](extraction/partitioning.md#dispatch-bounded-batches).

Reuse compatible package issues and checkpoints. If a package splits, preserve
its superseded assignment and evidence, make remaining ownership explicit, and
reconcile dependencies without creating cycles. When scope or allocation changes,
update the planning child and affected assignments before resuming. Apply
[evidence reuse](reporting.md#identify-and-reuse-evidence) and
[refresh existing results](reporting.md#refresh-existing-results) to changed inputs or feedback.

## Update and hand off

Add the extraction parent to the Readiness work group's issue index. Completion
requires finished required technical work, explicit coverage, and human approval
of every current catalog behavior under [behavior review](review.md).

After intent, source, assessment, graph evidence, or behaviors change, preserve dated
results, identify affected packages, and reconcile scopes and prerequisites. Apply
the [intent revision procedure](../../initialize/references/records.md#intent-work-and-acceptance)
when relevant. Keep or restore the parent to an unfinished state for required
extraction, corrections, or renewed approval. Reconcile the dependent
[brief](../../brief/references/records.md#update-and-hand-off) and affected execution
records so work remains blocked until revised behaviors are approved. Record repair
does not rerun work or accept a draft.
