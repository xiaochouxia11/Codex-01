import Mathlib.Data.ZMod.Basic
import Mathlib.Algebra.Field.ZMod
import Mathlib.LinearAlgebra.Dual.Lemmas
import Mathlib.LinearAlgebra.Pi
import Mathlib.Tactic.FinCases
import Lean.Elab.Tactic.Omega

/-!
# Finite cubic multigraphs and characteristic-two flows

We encode a cubic multigraph by an equivalence between its three vertex slots and its two edge
ends.  This keeps parallel edges as genuinely distinct elements of `E`, rules out accidental
reuse of an edge, and makes the incidence double-counting argument definitional up to reindexing
by an equivalence.
-/

namespace CDCLean

open scoped BigOperators

/-- The field with two elements. -/
abbrev F₂ := ZMod 2

/-- The additive group used by the labeling construction, `F₂³`. -/
abbrev Gamma := Fin 3 → F₂

/-- A finite cubic multigraph.  `incidence` identifies each of the three slots at every vertex
with exactly one of the two ends of an edge.  Distinct elements of `E` are distinct edge objects,
so parallel edges are represented faithfully. -/
structure CubicGraph (V E : Type*) [Fintype V] [Fintype E] where
  incidence : (V × Fin 3) ≃ (E × Fin 2)
  loopless : ∀ e : E,
    (incidence.symm (e, 0)).1 ≠ (incidence.symm (e, 1)).1

namespace CubicGraph

variable {V E : Type*} [Fintype V] [Fintype E] (G : CubicGraph V E)

/-- The edge object occupying local slot `i` at `v`. -/
def edgeAt (v : V) (i : Fin 3) : E := (G.incidence (v, i)).1

/-- Endpoint number `j` of edge object `e`. -/
def endAt (e : E) (j : Fin 2) : V := (G.incidence.symm (e, j)).1

@[simp]
theorem incidence_symm_edgeAt (v : V) (i : Fin 3) :
    (G.incidence.symm (G.incidence (v, i))).1 = v := by
  simp

@[simp]
theorem edgeAt_incidence_symm (e : E) (j : Fin 2) :
    G.edgeAt (G.endAt e j) (G.incidence.symm (e, j)).2 = e := by
  simp [edgeAt, endAt]

@[simp]
theorem endAt_edgeAt_incidence (v : V) (i : Fin 3) :
    G.endAt (G.edgeAt v i) (G.incidence (v, i)).2 = v := by
  simp [edgeAt, endAt]

theorem edgeAt_injective (v : V) : Function.Injective (G.edgeAt v) := by
  intro i k hik
  let ji : Fin 2 := (G.incidence (v, i)).2
  let jk : Fin 2 := (G.incidence (v, k)).2
  have hvi : G.endAt (G.edgeAt v i) ji = v := by
    simp [edgeAt, endAt, ji]
  have hvk : G.endAt (G.edgeAt v k) jk = v := by
    simp [edgeAt, endAt, jk]
  by_cases hj : ji = jk
  · have hinc : G.incidence (v, i) = G.incidence (v, k) := by
      exact Prod.ext hik hj
    exact congrArg Prod.snd (G.incidence.injective hinc)
  · exfalso
    have heq : G.endAt (G.edgeAt v i) ji = G.endAt (G.edgeAt v i) jk := by
      have hvk' : G.endAt (G.edgeAt v i) jk = v := by simpa [hik] using hvk
      exact hvi.trans hvk'.symm
    have hjcases : (ji = 0 ∧ jk = 1) ∨ (ji = 1 ∧ jk = 0) := by omega
    rcases hjcases with ⟨hji, hjk⟩ | ⟨hji, hjk⟩
    · exact G.loopless (G.edgeAt v i) (by simpa [endAt, hji, hjk] using heq)
    · exact G.loopless (G.edgeAt v i) (by simpa [endAt, hji, hjk] using heq.symm)

/-- Reindexing all edge ends as all vertex slots. -/
theorem sum_edgeEnds_eq_sum_vertexSlots
    {A : Type*} [AddCommMonoid A] (h : E → Fin 2 → A) :
    ∑ e : E, ∑ j : Fin 2, h e j =
      ∑ v : V, ∑ i : Fin 3,
        h (G.edgeAt v i) (G.incidence (v, i)).2 := by
  rw [← Fintype.sum_prod_type', ← Fintype.sum_prod_type']
  symm
  exact G.incidence.sum_comp (fun p : E × Fin 2 ↦ h p.1 p.2)

end CubicGraph

/-- A nowhere-zero `F₂³` flow on a cubic multigraph.  In characteristic two the orientation
signs disappear, so conservation is the sum over the three incidence slots. -/
structure GammaFlow {V E : Type*} [Fintype V] [Fintype E] (G : CubicGraph V E) where
  val : E → Gamma
  nowhereZero : ∀ e, val e ≠ 0
  conservation : ∀ v, ∑ i : Fin 3, val (G.edgeAt v i) = 0

end CDCLean
