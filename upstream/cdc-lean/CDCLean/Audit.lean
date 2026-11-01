import CDCLean.Main

/-!
# Kernel trust audit

Run this module directly to display the axiom dependencies of the critical construction.  The
expected output contains only Lean's standard `propext`, `Classical.choice`, and `Quot.sound`.
The final Seymour-only theorem is included in the audit below.
-/

#print axioms CDCLean.local_pair_parity
#print axioms CDCLean.local_dual_identity
#print axioms CDCLean.compatibility_solvable
#print axioms CDCLean.cubic_even_double_cover
#print axioms CDCLean.FiniteGraph.expansionGraph_bridgeless
#print axioms CDCLean.FiniteGraph.tutteFlowCardinalityInvariant
#print axioms CDCLean.FiniteGraph.IndexedEvenDoubleCover.toCycleDoubleCover
#print axioms CDCLean.cycleDoubleCover_of_sixFlow
#print axioms CDCLean.cycleDoubleCover_of_gammaFlow
#print axioms CDCLean.cycleDoubleCover_of_bridgeless
