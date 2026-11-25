# Save and reconcile behaviors

The coordinator owns issue and catalog writes. Apply the [shared artifact and
lifecycle rules](../../codemod/references/records/README.md); package workers return
findings and do not edit migration records.

## Keep the catalog reviewable

Use the [catalog template](../assets/behaviors.md). Group concise behavior tables
by behavior area; a row and its linked technical details together define the behavior.
Write shared evidence and data contracts once, reference them by stable IDs, and
keep detailed source and library traces, inspection ledgers, and run history on the
owning extraction package issues. Link their preserved evidence from the concise
catalog; summarize only what is needed to interpret each claim under the
[extraction rule](extraction/inspect-and-verify.md#inspect-behavior-in-context).
Synthesize worker findings rather than pasting their returns. Retain all material
conditions, exceptions, negative behavior, and source citations in the catalog.

Prefer one document. If a verified document limit or readability requires splitting,
use named behavior-area documents linked from one authoritative index; keep one
home per behavior and make approval scope explicit across every linked document.
Never truncate behaviors, drop coverage, or silently rewrite approved content to fit.

## Save each completed batch

Create or reuse **System — Migration behaviors** at the first substantive
checkpoint: behaviors, candidates, inspected evidence, or evidence-backed gaps. Follow
[shared document timing](../../codemod/references/records/artifacts.md#create-documents-when-there-is-content);
an absent catalog before that point is expected. Keep source-verified behaviors separate
from unresolved candidates; update coverage and remaining work. Use stable behavior IDs
such as `BEH-orders-001`; do not manufacture entries when inspection finds none.

Add the actual check time, inspected coverage, review method, and remaining gaps
to the package checkpoint. Verify the catalog save before recording the saved behavior IDs and
[version](#identify-and-reuse-evidence) on the owning package's checkpoint. Source
verification applies only after the saved meaning matches the checked evidence. If no
relevant behavior was identified, record the inspection and verification evidence. On a
partial or uncertain write, reread both records before retrying. Never dispatch
dependent work on an unsaved result. Package completion follows
the agreed technical review authority and does not approve the behaviors.

## Identify and reuse evidence

Bind each package checkpoint to its original inputs: source repositories, exact commits
and boundaries, assessment revision or retrievable content, extraction scope, released
procedure version or retrievable revision, applicable [graph](../../codemod/references/codegraph.md#record-graph-evidence)
or other relationship evidence, and actual runtime when behavior was executed. Compare
these inputs before reuse; revalidate or rerun affected work when they change. Rebuilding
an equivalent graph alone does not change the source baseline.

Bind verification and approval to the identified behaviors and exact saved content,
including material conditions, exceptions, source evidence, and linked technical details
and contracts across all catalog parts. Use a durable, retrievable native version or
preserved snapshot covering that content. A stable ID, timestamp, issue state, current
document, or mutable link alone cannot establish what was reviewed. If the content cannot
be established, keep its verification or approval unresolved.

Substantive changes to a claim or its supporting evidence require reverification and new human
approval before the affected behavior is treated as approved. Check all affected behaviors
when shared evidence or contracts change. Editorial, navigation, or review-annotation
changes alone need not invalidate prior work after confirming the claim, scope, and
supporting evidence are unchanged. Preserve prior decisions with the content they covered.

## Reconcile the catalog

Compare full claims and evidence across packages; merge only matching behavior and
applicability, preserve variants, and record superseded IDs and reasons. Assign one
primary owner to cross-component behaviors without double-counting shared context.
Trace important journeys and technical flows across boundaries for missing ordering,
permissions, failures, transactions, shared-state effects, or inconsistent behaviors.
Resolve material disagreements against source or keep them explicitly unresolved.

Account for relevant assessment components, source areas, flows, journeys, and
planned packages, including unassigned areas. Required omissions stay unfinished.
Verify referenced details and data contracts, unique IDs, source citations, and coverage
limits. Check every required child's technical completion before catalog review. Structural
checks complement [source interpretation checks](extraction/inspect-and-verify.md);
they do not prove semantic correctness or exhaustive discovery.

## Complete and hand off

| Outcome | Meaning |
| --- | --- |
| `extracted` | Required packages, source interpretation checks, reconciliation, and catalog checks are complete. Domain questions may remain explicitly open. |
| `limited` | Required work is complete, with optional coverage gaps justified against the agreed scope. |
| `blocked` | A missing prerequisite prevents required extraction or verification. |
| `not_run` | Unstarted or incomplete. |

A material unresolved candidate or required coverage gap keeps technical work
unfinished. These outcomes do not establish user approval. Save and read back the
substantive catalog and issue results, including actual ISO 8601 UTC extraction
and review times. Link the saved catalog from the parent and follow
[behavior review](review.md) for mandatory human approval. Open the catalog under
[shared presentation guidance](../../codemod/references/records/presentation.md#present-saved-work);
when no substantive catalog exists, hand off the issue and outstanding work.

## Refresh existing results

[Refresh affected packages](records.md#work-resume-and-refresh) before saving
changed inputs. Retain prior results with their original identities and dates in
accessible provider history or linked records; index them under **History and
decisions**, verify retrieval, and retain them inline if durable history is
unavailable. Exclude pending reverification from current verified counts.

Keep substantively changed or uncertain claims in **Unresolved candidates** until
reverified. Preserve stable behavior IDs and original version identities, record retired
or replaced behaviors and successors, and update checkpoints with each verified save.
