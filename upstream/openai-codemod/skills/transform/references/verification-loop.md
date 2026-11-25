# Complete a transformation phase

Use this loop for a requested, human-accepted phase. Keep implementation and
independent verification separate within transform. A slice, implementation-only,
verification-only, or repair request stops at its stated scope.

## Resolve the verification boundary first

Read the accepted brief and current records. Resolve each exit criterion's
[owner and scope](work-planning.md#criterion-ownership) before starting:

- An independent phase or pilot check required by the accepted plan belongs in
  **Migration**. Reuse or establish the [phase verification record](records.md#phase-verification-records)
  for that scope and run it after its implementation is accepted.
- The only independent check covers the **whole migration**, including a
  single-phase migration or its last phase: complete transform's development
  checks, integration, and acceptance. Return the candidate for **Final verification**
  as a later step. Do not invent a duplicate phase check or wait for one; a phase request alone does not
  authorize whole-migration verification.

When the brief requires independent verification of a pilot before expansion, run
the bounded pilot implementation, verify its accepted candidate, then return to
the remaining eligible implementation. The pilot check cannot wait on the whole
phase aggregate or the work it must unblock; its result does not verify the full phase.

## Continue the phase loop

1. **Implement.** Follow the [implementation procedure](implementation.md) for
   eligible slices, development checks, integration, and review. Obtain acceptance
   for the exact candidate required by the assigned verification scope.
2. **Verify.** When the accepted scope requires it, assign a verifier independent
   of the implementer to the phase or pilot
   issue using the [independent verification method](../../codemod/references/independent-verification.md).
   Record its evidence and agreed review separately from development checks.
3. **Repair and reverify.** Preserve failed results and use the existing
   [remediation record specification](records.md#remediation-records).
   Apply the implementation procedure to the scoped target repair; other discrepancies
   return to the owner of the source, behavior catalog, intent, harness, or runtime without
   weakening expectations. Accept the repaired candidate at the verification scope
   and repeat independent verification. Repeated identical failures need a new
   diagnosis or a blocker.
4. **Reconcile phase exit.** Check every required phase criterion against its owner,
   current evidence, and agreed acceptance. Report any outstanding independently or
   separately owned work; implementation acceptance alone is not full phase exit.

Continue the authorized loop without asking the user to invoke another skill.
Human decisions pause affected work; independent eligible work may continue.

## Continue or resume

Only an explicit multi-phase request authorizes the agreed sequence; advance after
full phase exit and the next phase's prerequisites. On resume, confirm old workers
stopped and reconcile current Git, scoped records, inputs, and evidence. Preserve
history, refresh affected verification after a candidate change, and report any
separately owned obligations. Do not merge the migration branch into the destination,
deploy, or cut over.
