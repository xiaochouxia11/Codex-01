import CDCLean.GeneralGraph
import Mathlib.Data.Finset.Card

/-!
# From exact even edge covers to cycle double covers

This file supplies the elementary, but important, last step in the cycle-double-cover
argument.  We use the standard circuit definition of a cycle in a loopless multigraph: a cycle
is a nonempty inclusion-minimal even edge set.  (These are precisely the usual simple cycles,
with a pair of parallel edges allowed as a cycle of length two.)  This formulation is especially
well suited to multigraphs because edges, rather than pairs of vertices, are the primitive
objects.

The proof below is entirely finite.  Repeatedly remove an inclusion-minimal nonempty even subset.
Characteristic two makes the remaining edge set even.  No choice of an Euler tour, and no
external graph-theory theorem, is hidden in the construction.
-/

namespace CDCLean

open scoped BigOperators

namespace FiniteGraph

variable {V E : Type*} [Fintype V] [Fintype E] [DecidableEq V] [DecidableEq E]
  (G : FiniteGraph V E)

/-- The incidence indicator of an edge at a vertex, with both edge ends counted. -/
def edgeIncidence (v : V) (e : E) : F₂ :=
  (if G.endAt e 0 = v then 1 else 0) +
    (if G.endAt e 1 = v then 1 else 0)

/-- An edge set is even when every vertex has even degree in the induced multigraph. -/
def IsEvenEdgeSet (F : Finset E) : Prop :=
  ∀ v : V, ∑ e ∈ F, G.edgeIncidence v e = 0

/-- The ordinary natural-number degree of `v` in an edge set.  Edge ends are counted, so this
definition also has the standard behavior for multigraphs. -/
def degreeIn (F : Finset E) (v : V) : ℕ :=
  ((F ×ˢ (Finset.univ : Finset (Fin 2))).filter fun h ↦ G.endAt h.1 h.2 = v).card

/-- Two edge objects are parallel when they have the same unordered pair of ends. -/
def AreParallel (e f : E) : Prop :=
  (G.endAt e 0 = G.endAt f 0 ∧ G.endAt e 1 = G.endAt f 1) ∨
    (G.endAt e 0 = G.endAt f 1 ∧ G.endAt e 1 = G.endAt f 0)

/-- A (multigraph) cycle is a nonempty inclusion-minimal even edge set.

For loopless multigraphs this is the usual graphic-matroid characterization of a simple cycle;
in particular two distinct parallel edges form a legitimate cycle of length two. -/
structure Cycle where
  edges : Finset E
  nonempty : edges.Nonempty
  even : G.IsEvenEdgeSet edges
  minimal : ∀ D : Finset E, D.Nonempty → D ⊆ edges → G.IsEvenEdgeSet D → D = edges

omit [DecidableEq E] in
private theorem singleton_not_even (e : E) : ¬ G.IsEvenEdgeSet {e} := by
  intro h
  have he := h (G.endAt e 0)
  have hne : G.endAt e 1 ≠ G.endAt e 0 := (G.loopless e).symm
  simp [edgeIncidence, hne] at he

/-- Two distinct parallel edge objects form the usual length-two multigraph cycle. -/
def parallelPairCycle (e f : E) (hef : e ≠ f) (hpar : G.AreParallel e f) : G.Cycle where
  edges := {e, f}
  nonempty := ⟨e, by simp⟩
  even := by
    intro v
    rcases hpar with ⟨h0, h1⟩ | ⟨h0, h1⟩
    · simp [edgeIncidence, hef, h0, h1]
      exact CharTwo.add_self_eq_zero _
    · simp [edgeIncidence, hef, h0, h1, add_comm]
      exact CharTwo.add_self_eq_zero _
  minimal := by
    intro D hDne hDsub hDeven
    apply Finset.Subset.antisymm hDsub
    intro x hx
    simp only [Finset.mem_insert, Finset.mem_singleton] at hx ⊢
    rcases hx with rfl | rfl
    · by_contra he
      have hsub : D ⊆ {f} := by
        intro x hxD
        have hxpair := hDsub hxD
        simp only [Finset.mem_insert, Finset.mem_singleton] at hxpair ⊢
        rcases hxpair with rfl | hxf
        · exact (he hxD).elim
        · exact hxf
      have hDf : D = {f} := hDne.subset_singleton_iff.mp hsub
      exact G.singleton_not_even f (hDf ▸ hDeven)
    · by_contra hf
      have hsub : D ⊆ {e} := by
        intro x hxD
        have hxpair := hDsub hxD
        simp only [Finset.mem_insert, Finset.mem_singleton] at hxpair ⊢
        rcases hxpair with hxe | rfl
        · exact hxe
        · exact (hf hxD).elim
      have hDe : D = {e} := hDne.subset_singleton_iff.mp hsub
      exact G.singleton_not_even e (hDe ▸ hDeven)

/-- A conventional cycle double cover: a finite multiset (represented by a list, so repeated
cycles are retained) in which every edge object occurs exactly twice. -/
structure CycleDoubleCover where
  cycles : List G.Cycle
  coveredTwice : ∀ e : E, (cycles.filter fun C ↦ e ∈ C.edges).length = 2

private theorem even_sdiff {F D : Finset E} (hDF : D ⊆ F)
    (hF : G.IsEvenEdgeSet F) (hD : G.IsEvenEdgeSet D) :
    G.IsEvenEdgeSet (F \ D) := by
  intro v
  have hsplit := Finset.sum_sdiff hDF (f := fun e ↦ G.edgeIncidence v e)
  rw [hD v, hF v] at hsplit
  simpa using hsplit

/-- Every finite even edge set is an edge-disjoint union of multigraph cycles.  The displayed
equation records edge multiplicities and is stronger than mere equality of unions. -/
theorem decompose_even_edge_set (F : Finset E) (hF : G.IsEvenEdgeSet F) :
    ∃ L : List G.Cycle,
      ∀ e : E, (L.filter fun C ↦ e ∈ C.edges).length = if e ∈ F then 1 else 0 := by
  classical
  revert hF
  refine Finset.strongInductionOn F ?_
  intro F ih hF
  by_cases hne : F.Nonempty
  · by_cases hmin :
      (∀ D : Finset E, D.Nonempty → D ⊆ F → G.IsEvenEdgeSet D → D = F)
    · let C : G.Cycle :=
        { edges := F
          nonempty := hne
          even := hF
          minimal := hmin }
      refine ⟨[C], ?_⟩
      intro e
      by_cases he : e ∈ F <;> simp [C, he]
    · push Not at hmin
      obtain ⟨D, hDne, hDF, hDeven, hDproper⟩ := hmin
      have hDssub : D ⊂ F := Finset.ssubset_iff_subset_ne.mpr ⟨hDF, hDproper⟩
      have hRssub : F \ D ⊂ F := by
        apply Finset.ssubset_iff_subset_ne.mpr
        refine ⟨Finset.sdiff_subset, ?_⟩
        intro heq
        obtain ⟨e, heD⟩ := hDne
        have : e ∈ F \ D := by simpa [heq] using hDF heD
        simp [heD] at this
      obtain ⟨LD, hLD⟩ := ih D hDssub hDeven
      obtain ⟨LR, hLR⟩ := ih (F \ D) hRssub (G.even_sdiff hDF hF hDeven)
      refine ⟨LD ++ LR, ?_⟩
      intro e
      rw [List.filter_append, List.length_append, hLD e, hLR e]
      by_cases heD : e ∈ D
      · have heF : e ∈ F := hDF heD
        simp [heD, heF]
      · by_cases heF : e ∈ F <;> simp [heD, heF]
  · have hzero : F = ∅ := Finset.not_nonempty_iff_eq_empty.mp hne
    subst F
    exact ⟨[], by simp⟩

private theorem f2_eq_zero_or_one (x : F₂) : x = 0 ∨ x = 1 := by
  fin_cases x
  · exact Or.inl rfl
  · exact Or.inr rfl

/-- Edge set selected by one member of an indexed even double cover. -/
def IndexedEvenDoubleCover.support (C : G.IndexedEvenDoubleCover) (s : Gamma) : Finset E :=
  Finset.univ.filter fun e ↦ C.member s e = 1

omit [DecidableEq E] in
theorem IndexedEvenDoubleCover.support_even (C : G.IndexedEvenDoubleCover) (s : Gamma) :
    G.IsEvenEdgeSet (IndexedEvenDoubleCover.support G C s) := by
  intro v
  rw [← C.vertexEven s v]
  simp only [IndexedEvenDoubleCover.support, Finset.sum_filter]
  apply Finset.sum_congr rfl
  intro e _
  rcases f2_eq_zero_or_one (C.member s e) with hz | ho
  · simp [hz]
  · simp [edgeIncidence, ho]

private theorem filter_flatMap_length {A B : Type*} (p : B → Bool)
    (f : A → List B) (xs : List A) :
    ((xs.flatMap f).filter p).length =
      (xs.map fun x ↦ ((f x).filter p).length).sum := by
  induction xs with
  | nil => simp
  | cons x xs ih => simp [ih]

/-- An exact indexed even double cover decomposes into a conventional cycle double cover. -/
noncomputable def IndexedEvenDoubleCover.toCycleDoubleCover
    (C : G.IndexedEvenDoubleCover) : G.CycleDoubleCover := by
  classical
  have hex : ∀ s : Gamma, ∃ L : List G.Cycle,
      ∀ e : E, (L.filter fun Z ↦ e ∈ Z.edges).length =
        if e ∈ IndexedEvenDoubleCover.support G C s then 1 else 0 := by
    intro s
    exact G.decompose_even_edge_set (IndexedEvenDoubleCover.support G C s)
      (IndexedEvenDoubleCover.support_even G C s)
  choose pieces hpieces using hex
  refine
    { cycles := Finset.univ.toList.flatMap pieces
      coveredTwice := ?_ }
  intro e
  rw [filter_flatMap_length]
  simp_rw [hpieces]
  simpa [IndexedEvenDoubleCover.support] using C.coveredTwice e

end FiniteGraph

end CDCLean
