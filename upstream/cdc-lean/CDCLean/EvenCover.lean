import CDCLean.CubicLabeling

/-!
# Exact indexed even covers in the cubic case

An indexed family of even edge sets in which every edge occurs exactly twice is the structured
object projected through the vertex-ring expansion in the manuscript.  Decomposing each even
edge set into edge-disjoint cycles yields the conventional cycle multiset.
-/

namespace CDCLean

open scoped BigOperators

variable {V E : Type*} [Fintype V] [Fintype E] [DecidableEq V] [DecidableEq E]

/-- Eight indexed edge sets, represented by their `F₂` indicator functions. -/
structure IndexedEvenDoubleCover (G : CubicGraph V E) where
  member : Gamma → E → F₂
  vertexEven : ∀ s v, ∑ i : Fin 3, member s (G.edgeAt v i) = 0
  coveredTwice : ∀ e,
    (Finset.univ.filter fun s : Gamma ↦ member s e = 1).card = 2

/-- A nondegenerate affine pair in `F₂³` has exactly two members.  This finite lemma is checked
by exhaustive kernel-certified computation. -/
theorem pairIndicator_card :
    ∀ (p h : Gamma), h ≠ 0 →
      (Finset.univ.filter fun s : Gamma ↦ pairIndicator p h s = 1).card = 2 := by
  decide

/-- The compatible pair labels give an exact indexed even double cover. -/
noncomputable def cubic_even_double_cover (G : CubicGraph V E) (f : GammaFlow G) :
    IndexedEvenDoubleCover G := by
  let P := cubic_labeling G f
  refine
    { member := fun s e ↦ pairIndicator (P.base e) (f.val e) s
      vertexEven := ?_
      coveredTwice := ?_ }
  · intro s v
    exact P.vertexParity v s
  · intro e
    exact pairIndicator_card (P.base e) (f.val e) (f.nowhereZero e)

end CDCLean
