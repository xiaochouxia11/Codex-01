import CDCLean.CubicBridge
import CDCLean.FlowCount

/-!
# The certified cubic implication and its visible transfer boundary
-/

namespace CDCLean

/-- Tutte's order-only invariance specialized to the one transfer used by the manuscript.  The
statement is proved for every finite graph by `FlowCount` together with `PathCut`; retaining this
named proposition also gives the conditional cubic theorem a precise integration boundary. -/
def OrderEightFlowTransferStatement : Prop :=
  ∀ (V : Type*) (E : Type*) [Fintype V] [Fintype E] [DecidableEq V] [DecidableEq E]
    (G : FiniteGraph V E),
    Nonempty (G.NowhereZeroFlow (ZMod 8)) → Nonempty (G.NowhereZeroFlow Gamma)

/-- The complete cubic portion of the argument.  Its only inputs beyond finite graph data are
Seymour's literal integer 6-flow statement and the separately named group-order transfer theorem.
-/
theorem cubic_even_double_cover_of_sixFlow
    {V E : Type*} [Fintype V] [Fintype E] [DecidableEq V] [DecidableEq E]
    (seymour : ∀ G : FiniteGraph V E,
      FiniteGraph.Bridgeless G → Nonempty G.SixFlow)
    (transfer : ∀ G : FiniteGraph V E,
      Nonempty (G.NowhereZeroFlow (ZMod 8)) → Nonempty (G.NowhereZeroFlow Gamma))
    (K : CubicGraph V E) (hK : FiniteGraph.Bridgeless K.toFiniteGraph) :
    Nonempty (IndexedEvenDoubleCover K) := by
  obtain ⟨sf⟩ := seymour K.toFiniteGraph hK
  obtain ⟨gamma⟩ := transfer K.toFiniteGraph ⟨sf.toZModEight⟩
  exact ⟨cubic_even_double_cover K (K.gammaFlowOfNowhereZero gamma)⟩

/-- The same cubic theorem with the transfer hypothesis stated exactly as Tutte's flow-count
cardinality invariant for this graph. -/
theorem cubic_even_double_cover_of_sixFlow_of_cardinalityInvariant
    {V E : Type} [Fintype V] [Fintype E] [DecidableEq V] [DecidableEq E]
    (seymour : ∀ G : FiniteGraph V E,
      FiniteGraph.Bridgeless G → Nonempty G.SixFlow)
    (K : CubicGraph V E) (hK : FiniteGraph.Bridgeless K.toFiniteGraph)
    (hcount : K.toFiniteGraph.FlowCardinalityInvariant) :
    Nonempty (IndexedEvenDoubleCover K) := by
  obtain ⟨sf⟩ := seymour K.toFiniteGraph hK
  obtain ⟨gamma⟩ := K.toFiniteGraph.zmodEight_to_gamma hcount ⟨sf.toZModEight⟩
  exact ⟨cubic_even_double_cover K (K.gammaFlowOfNowhereZero gamma)⟩

end CDCLean
