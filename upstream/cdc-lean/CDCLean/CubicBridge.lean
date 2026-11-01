import CDCLean.SixFlow

/-!
# Passing between the general and cubic encodings
-/

namespace CDCLean

open scoped BigOperators

namespace CubicGraph

variable {V E : Type*} [Fintype V] [Fintype E] [DecidableEq V] [DecidableEq E]
  (K : CubicGraph V E)

/-- Forget the three-slot presentation while retaining the two numbered edge ends. -/
def toFiniteGraph : FiniteGraph V E where
  endAt := K.endAt
  loopless := by
    intro e
    exact K.loopless e

omit [DecidableEq E] in
theorem sum_incident_ends
    {A : Type*} [AddCommMonoid A] (q : E → A) (v : V) :
    (∑ e : E, ∑ j : Fin 2, if K.endAt e j = v then q e else 0) =
      ∑ i : Fin 3, q (K.edgeAt v i) := by
  rw [K.sum_edgeEnds_eq_sum_vertexSlots]
  simp only [K.endAt_edgeAt_incidence]
  calc
    (∑ w : V, ∑ i : Fin 3, if w = v then q (K.edgeAt w i) else 0) =
        ∑ i : Fin 3, if v = v then q (K.edgeAt v i) else 0 := by
          apply Fintype.sum_eq_single v
          intro w hw
          simp [hw]
    _ = ∑ i : Fin 3, q (K.edgeAt v i) := by simp

@[simp]
theorem neg_gamma : ∀ x : Gamma, -x = x := by decide

/-- A general `F₂³`-valued flow on the forgotten graph is exactly a cubic characteristic-two
flow in the three-slot presentation. -/
def gammaFlowOfNowhereZero
    (f : (K.toFiniteGraph).NowhereZeroFlow Gamma) : GammaFlow K where
  val := f.val
  nowhereZero := f.nowhereZero
  conservation := by
    intro v
    have h := f.conservation v
    have hsigned :
        (∑ e : E, if K.endAt e 0 = v then f.val e else 0) +
          (∑ e : E, if K.endAt e 1 = v then f.val e else 0) = 0 := by
      simpa [toFiniteGraph, FiniteGraph.IsFlow, sub_eq_add_neg] using h
    rw [← K.sum_incident_ends f.val v]
    simp only [Fin.sum_univ_two]
    rw [Finset.sum_add_distrib]
    exact hsigned

end CubicGraph

end CDCLean
