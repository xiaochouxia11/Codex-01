# Queue migration brief records

Follow [shared record setup](../../codemod/references/records/README.md#record-setup)
and the [bound provider's adapter](../../codemod/references/records/issue-systems.md#stage-adapters).
Create or repair the planning records needed for the request.

## Records

Create or reuse **Prepare migration brief — System — Migration** in Migration
readiness using the [parent template](../assets/brief-issue.md).
Create or reuse its **Define target-stack guidance** child using the
[planning issue template](../assets/planning-issue.md) and
[target-stack guidance procedure](planning/target-stack-guidance.md).
Procedure identifies `codemod:brief` and the relevant reference.
The parent synthesizes the plan; the child develops reusable target practices
and migration implications. Link documents only when they already exist.

Brief owns creation and repair of its parent and guidance child, plus
[additional planning children](#additional-planning-children) when warranted.
Brief also owns the **System — Target-stack guidance** migration
resource and **System — Migration brief** under its
[reporting rules](reporting.md). Create neither document
empty during setup or repair. Preserve existing plans and dated evidence.
Brief may incorporate compatible, reviewed implementation lessons under the
[reuse rules](planning/target-stack-guidance.md#reuse-migration-lessons).

When preparing the plan, brief also prepares the implementation breakdown in the
**Migration** work group under the canonical
[execution record specification](../../transform/references/records.md).
Brief may queue required [phase verification](../../transform/references/records.md#phase-verification-records)
in Migration; transform owns those records and their later reconciliation.
Brief chooses the phase/slice count and detail to fit the whole agreed scope;
planning research children remain in readiness. The saved brief and its queued
implementation breakdown always require human review and acceptance.

## Additional planning children

Create or reuse a child only when a substantial question needs independent
investigation, such as comparing architectures, resolving coexistence, or designing
a data transition. Keep routine mapping, sequencing, and synthesis on the parent;
do not duplicate another stage's work or create a child per brief section. Use
[design review](planning/design-review.md) for significant proposed designs.

Use the [planning issue template](../assets/planning-issue.md) to state the specific
question, boundary, relevant input identities, decision authority, deliverable, and
checkable completion criteria. Each child is a sibling of the guidance child beneath
the brief parent in Readiness. Apply only its own common and evidence prerequisites;
required children block synthesis. If a new required question blocks active synthesis,
pause the parent while eligible children proceed. Verify the relations are acyclic.

Save findings, alternatives, recommendations, evidence, and remaining decisions on
the owning child; the guidance child uses its reusable resource. Apply the agreed
review authority. A completed adviser is not an accepted issue, and technical
[design-review completion](planning/design-review.md#resolve-and-incorporate) does not approve
the brief. Incorporate reviewed results into synthesis with decision provenance.

## Dependencies

Apply the common [readiness dependencies](../../codemod/references/records/README.md#technical-work-prerequisites)
to the parent and every child: the current intent issue and cloud setup when
applicable. Add native **Blocked by** relations to the parent from:

- Define target-stack guidance and any required planning children already created.
- The assessment synthesis issue and extraction issue when those producers are
  tracked. Extraction Done records approval of current
  behaviors. Otherwise verify the required reviewed assessment and human-approved
  behaviors under the [shared prerequisite rules](../../codemod/references/records/README.md#prerequisite-evidence).

The guidance child can run early, once common prerequisites are satisfied. Do
not copy the parent's assessment or behavior-catalog blockers onto it.
Add an evidence prerequisite only when its scoped guidance actually needs that
result. Never make a planning child depend on the brief parent.

Execution records created during brief preparation have the opposite dependency:
the current brief directly blocks each phase and implementation issue. The brief
must never depend on its execution backlog. These queued records do not authorize
implementation before human acceptance or before their other prerequisites resolve.

Honor Done states under the shared lifecycle without additional approval-evidence
gates. Use current, applicable inputs; superseded evidence does not establish a
new plan. Do not add the entire Preflight parent or combined Build toolchain
issue as a mandatory blocker: target setup gaps may become explicit phase entry
conditions. Unknown
target direction can remain open in a draft, but leaves affected planning provisional.

## Update and hand off

Add **Prepare migration brief** to the Readiness work group's issue index. Use
[reporting](reporting.md#review-and-hand-off) for the saved plan, queued breakdown,
and mandatory human acceptance. Acceptance records planning readiness; execution
also needs a request and satisfied prerequisites.

On changes to intent, target direction, behaviors, assessment, source baseline, or
verification evidence, identify affected guidance and plan sections and retain
dated history. Reconcile fixed blockers to current issues; brief reconciles any
affected dynamic children. Upstream work needing renewed review must be unfinished
under its stage's revision procedure. Preserve historical Done intent issues using
the shared intent-revision procedure.

Queue affected fixed issues in a mapped unstarted state under the shared lifecycle,
including previously Done work, and mark affected results pending. Apply
[brief revision rules](reporting.md#refresh-without-inheriting-acceptance); editorial
or demonstrably compatible changes alone do not require replanning.
