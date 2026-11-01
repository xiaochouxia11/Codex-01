import CDCLean.FlowCount

/-!
# Integral path--cut dichotomy

For a fixed set `S` of currently forbidden edges, either the endpoints of an edge of `S` are
joined by an integer chain supported outside `S`, or the vertices reachable by such chains form
a cut crossed by no allowed edge.  The first alternative closes the chain with the distinguished
edge and gives the unit circulation needed by the flow-count recurrence.
-/

namespace CDCLean

namespace FiniteGraph

variable {V E : Type*} [Fintype V] [Fintype E] [DecidableEq V] [DecidableEq E]
  (G : FiniteGraph V E)

/-- Every finite graph satisfies the integral path--cut dichotomy used by the flow-count
recurrence. -/
theorem integralPathCutDichotomy : G.IntegralPathCutDichotomy := by
  classical
  intro S e he
  by_cases hpath : G.HasIntegerPath S (G.endAt e 0) (G.endAt e 1)
  · exact Or.inl (G.hasCycleCorrection_of_integerPath S e he hpath)
  · right
    let U : Finset V := Finset.univ.filter fun w ↦
      G.HasIntegerPath S (G.endAt e 0) w
    have hmemU (w : V) :
        w ∈ U ↔ G.HasIntegerPath S (G.endAt e 0) w := by
      simp [U]
    refine ⟨U, ?_, ?_⟩
    · have hstart : G.endAt e 0 ∈ U :=
        (hmemU _).mpr (G.hasIntegerPath_refl S (G.endAt e 0))
      have hend : G.endAt e 1 ∉ U := by
        intro hend
        have hforward : G.HasIntegerPath S (G.endAt e 0) (G.endAt e 1) :=
          (hmemU _).mp hend
        exact hpath hforward
      exact (show (G.endAt e 0 ∈ U) ≠ (G.endAt e 1 ∈ U) by
        simp [hstart, hend])
    · intro k hk
      have hedge := G.hasIntegerPath_single S k hk
      have hsame : (G.endAt k 0 ∈ U) ↔ (G.endAt k 1 ∈ U) := by
        constructor
        · intro h0
          exact (hmemU _).mpr (((hmemU _).mp h0).trans G hedge)
        · intro h1
          exact (hmemU _).mpr (((hmemU _).mp h1).trans G hedge.symm)
      intro hcross
      exact hcross (propext hsame)

/-- Tutte's group-order invariance for nowhere-zero flows, obtained from the fully discharged
edge-addition path/cut recurrence. -/
theorem tutteFlowCardinalityInvariant : G.FlowCardinalityInvariant :=
  G.flowCardinalityInvariant_of_pathCut G.integralPathCutDichotomy

/-- The concrete order-eight coefficient transfer used by the CDC construction. -/
theorem zmodEight_to_gamma_unconditional :
    Nonempty (G.NowhereZeroFlow (ZMod 8)) →
      Nonempty (G.NowhereZeroFlow Gamma) :=
  G.zmodEight_to_gamma G.tutteFlowCardinalityInvariant

end FiniteGraph

end CDCLean
