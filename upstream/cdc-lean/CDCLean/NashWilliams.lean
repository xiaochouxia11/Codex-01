import CDCLean.GeneralGraph
import Mathlib.Combinatorics.SimpleGraph.Acyclic
import Mathlib.Combinatorics.SimpleGraph.Connectivity.Finite
import Mathlib.Order.Partition.Finpartition

/-!
# Nash-Williams--Tutte tree packing

This file develops the finite multigraph language needed for Kaiser's elementary
tree-packing argument.  Edges remain genuine objects, so parallel edges are preserved;
`supportGraph` is used only for reachability.
-/

namespace CDCLean

namespace FiniteGraph

open scoped BigOperators

variable {V E : Type*} [Fintype V] [Fintype E] [DecidableEq V] [DecidableEq E]
  (G : FiniteGraph V E)

/-- The simple support graph of a set of multiedges.  Parallel edge objects induce the same
adjacency, which is exactly what reachability needs. -/
def supportGraph (S : Finset E) : SimpleGraph V :=
  SimpleGraph.fromRel fun u v ↦
    ∃ e ∈ S, G.endAt e 0 = u ∧ G.endAt e 1 = v

/-- Reachability using only the edge objects in `S`. -/
def ReachableIn (S : Finset E) (u v : V) : Prop :=
  (G.supportGraph S).Reachable u v

/-- `S` connects all vertices. -/
def Connects (S : Finset E) : Prop :=
  (G.supportGraph S).Connected

/-- A spanning tree is a connected set of exactly `|V|-1` edge objects.  For finite
multigraphs this is equivalent to the usual connected-and-acyclic definition, while the
cardinality form makes Kaiser's one-edge exchange literal. -/
def IsSpanningTree (S : Finset E) : Prop :=
  G.Connects S ∧ S.card + 1 = Fintype.card V

/-- A packing of `k` pairwise edge-disjoint spanning trees. -/
def HasTreePacking (k : ℕ) : Prop :=
  ∃ T : Fin k → Finset E,
    (∀ i, G.IsSpanningTree (T i)) ∧
      ∀ i j, i ≠ j → Disjoint (T i) (T j)

/-- Edge objects crossing the classes of a setoid partition. -/
noncomputable def crossingEdges (P : Setoid V) : Finset E := by
  classical
  exact Finset.univ.filter fun e ↦ ¬ P.r (G.endAt e 0) (G.endAt e 1)

/-- The edges of \`S\` that cross the classes of \`P\`. -/
noncomputable def crossingClass (S : Finset E) (P : Setoid V) : Finset E := by
  classical
  exact S.filter fun e ↦ ¬ P.r (G.endAt e 0) (G.endAt e 1)

omit [DecidableEq V] [DecidableEq E] in
@[simp]
theorem mem_crossingClass {S : Finset E} {P : Setoid V} {e : E} :
    e ∈ G.crossingClass S P ↔
      e ∈ S ∧ ¬ P.r (G.endAt e 0) (G.endAt e 1) := by
  classical
  simp [crossingClass]

omit [DecidableEq V] [DecidableEq E] in
theorem crossingClass_subset_crossingEdges (S : Finset E) (P : Setoid V) :
    G.crossingClass S P ⊆ G.crossingEdges P := by
  intro e he
  rw [mem_crossingClass] at he
  classical
  simp [crossingEdges, he.2]

noncomputable instance quotientFintype (P : Setoid V) : Fintype (Quotient P) :=
  Fintype.ofFinite _

/-- Contract the classes of \`P\` and discard the internal edges.  The edge type is a
subtype of genuine edge objects, so parallel edges remain distinct after contraction. -/
noncomputable def quotientGraph (S : Finset E) (P : Setoid V) :
    FiniteGraph (Quotient P) {e : E // e ∈ G.crossingClass S P} where
  endAt e i := Quotient.mk _ (G.endAt e.1 i)
  loopless e := by
    intro h
    have hrel : P.r (G.endAt e.1 0) (G.endAt e.1 1) := Quotient.eq'.mp h
    exact ((mem_crossingClass (G := G)).mp e.2).2 hrel

/-- The Nash-Williams--Tutte partition inequality. -/
def SatisfiesTreePackingCondition (k : ℕ) : Prop :=
  ∀ P : Setoid V,
    k * (Nat.card (Quotient P) - 1) ≤ (crossingEdges (G := G) P).card

/-- The component partition induced by a set of edge objects. -/
def componentSetoid (S : Finset E) : Setoid V :=
  (G.supportGraph S).reachableSetoid

/-- Edges of `S` whose two ends lie in the `P`-class of `u`. -/
noncomputable def insideEdges (S : Finset E) (P : Setoid V) (u : V) : Finset E := by
  classical
  exact S.filter fun e ↦ P.r (G.endAt e 0) u ∧ P.r (G.endAt e 1) u

omit [DecidableEq V] [DecidableEq E] in
@[simp]
theorem mem_insideEdges {S : Finset E} {P : Setoid V} {u : V} {e : E} :
    e ∈ G.insideEdges S P u ↔
      e ∈ S ∧ P.r (G.endAt e 0) u ∧ P.r (G.endAt e 1) u := by
  classical
  simp [insideEdges]

omit [DecidableEq V] [DecidableEq E] in
theorem insideEdges_eq_of_rel {S : Finset E} {P : Setoid V} {u v : V}
    (huv : P.r u v) : G.insideEdges S P u = G.insideEdges S P v := by
  classical
  ext e
  simp only [mem_insideEdges]
  constructor
  · rintro ⟨he, he0, he1⟩
    exact ⟨he, P.trans he0 huv, P.trans he1 huv⟩
  · rintro ⟨he, he0, he1⟩
    exact ⟨he, P.trans he0 (P.symm huv), P.trans he1 (P.symm huv)⟩

omit [DecidableEq V] [DecidableEq E] in
theorem insideEdges_subset (S : Finset E) (P : Setoid V) (u : V) :
    G.insideEdges S P u ⊆ S := by
  intro e he
  exact ((mem_insideEdges (G := G)).mp he).1

omit [DecidableEq V] in
theorem insideEdges_erase (S : Finset E) (P : Setoid V) (u : V) (e : E) :
    G.insideEdges (S.erase e) P u = (G.insideEdges S P u).erase e := by
  classical
  ext f
  simp only [mem_insideEdges, Finset.mem_erase]
  aesop

/-- Refine `P` by connected components of `S` inside each current class.  This is Kaiser's
one refinement step. -/
noncomputable def refineSetoid (P : Setoid V) (S : Finset E) : Setoid V where
  r u v := P.r u v ∧ G.ReachableIn (G.insideEdges S P u) u v
  iseqv := by
    constructor
    · intro u
      exact ⟨P.refl u, SimpleGraph.Reachable.refl u⟩
    · intro u v huv
      refine ⟨P.symm huv.1, ?_⟩
      rw [← G.insideEdges_eq_of_rel huv.1]
      exact huv.2.symm
    · intro u v w huv hvw
      refine ⟨P.trans huv.1 hvw.1, ?_⟩
      have hEq := G.insideEdges_eq_of_rel (S := S) huv.1
      exact huv.2.trans (hEq ▸ hvw.2)

omit [DecidableEq V] [DecidableEq E] in
theorem refineSetoid_le (P : Setoid V) (S : Finset E) {u v : V}
    (h : (G.refineSetoid P S).r u v) : P.r u v :=
  h.1

/-- The edges carrying color `i` in an edge-coloring.  Using a total coloring rather than an
explicit tuple makes edge-disjointness and coverage definitional. -/
noncomputable def colorClass {k : ℕ} (χ : E → Fin k) (i : Fin k) : Finset E := by
  classical
  exact Finset.univ.filter fun e ↦ χ e = i

omit [DecidableEq E] in
@[simp]
theorem mem_colorClass {k : ℕ} {χ : E → Fin k} {i : Fin k} {e : E} :
    e ∈ colorClass χ i ↔ χ e = i := by
  classical
  simp [colorClass]

omit [DecidableEq E] in
theorem colorClass_disjoint {k : ℕ} (χ : E → Fin k) {i j : Fin k} (hij : i ≠ j) :
    Disjoint (colorClass χ i) (colorClass χ j) := by
  classical
  apply Finset.disjoint_left.2
  intro e hei hej
  exact hij ((mem_colorClass.mp hei).symm.trans (mem_colorClass.mp hej))

omit [DecidableEq V] [DecidableEq E] in
theorem crossingClass_colorClass_disjoint {k : ℕ} (χ : E → Fin k) (P : Setoid V)
    {i j : Fin k} (hij : i ≠ j) :
    Disjoint (G.crossingClass (colorClass χ i) P)
      (G.crossingClass (colorClass χ j) P) := by
  apply Finset.disjoint_left.2
  intro e hei hej
  exact (Finset.disjoint_left.mp (colorClass_disjoint χ hij)
    ((mem_crossingClass (G := G)).mp hei).1
    ((mem_crossingClass (G := G)).mp hej).1).elim

omit [DecidableEq V] in
theorem crossingEdges_eq_biUnion_crossingClass {k : ℕ} [NeZero k]
    (χ : E → Fin k) (P : Setoid V) :
    G.crossingEdges P =
      Finset.univ.biUnion fun i : Fin k =>
        G.crossingClass (colorClass χ i) P := by
  classical
  ext e
  simp [crossingEdges, crossingClass, colorClass]

omit [DecidableEq V] in
theorem crossingEdges_card_eq_sum_crossingClass {k : ℕ} [NeZero k]
    (χ : E → Fin k) (P : Setoid V) :
    (G.crossingEdges P).card =
      ∑ i : Fin k, (G.crossingClass (colorClass χ i) P).card := by
  rw [G.crossingEdges_eq_biUnion_crossingClass χ P]
  apply Finset.card_biUnion
  intro i _ j _ hij
  exact G.crossingClass_colorClass_disjoint χ P hij

omit [DecidableEq E] in
theorem mem_some_colorClass {k : ℕ} [NeZero k] (χ : E → Fin k) (e : E) :
    ∃ i : Fin k, e ∈ colorClass χ i := by
  exact ⟨χ e, mem_colorClass.mpr rfl⟩

/-- In the inductive step, colors `0, ..., k-1` already carry trees and the last color is
the residual spanning subgraph. -/
def PrefixTrees {k : ℕ} (χ : E → Fin (k + 1)) : Prop :=
  ∀ i : Fin k, G.IsSpanningTree (colorClass χ i.castSucc)

noncomputable def residualClass {k : ℕ} (χ : E → Fin (k + 1)) : Finset E :=
  colorClass χ (Fin.last k)

noncomputable def residualComponents {k : ℕ} (χ : E → Fin (k + 1)) : ℕ :=
  Nat.card (G.supportGraph (residualClass χ)).ConnectedComponent

/-- A color is connected inside every class of `P`.  This is the stopping predicate in
Kaiser's refinement process. -/
def InternallyConnected (S : Finset E) (P : Setoid V) : Prop :=
  ∀ u v : V, P.r u v → G.ReachableIn (G.insideEdges S P u) u v

def NeedsRefinement {k : ℕ} (χ : E → Fin k) (P : Setoid V) : Prop :=
  ∃ i : Fin k, ¬ G.InternallyConnected (colorClass χ i) P

/-- The least color that disconnects a current class, when one exists. -/
noncomputable def firstDisconnectedColor {k : ℕ} (χ : E → Fin k) (P : Setoid V) :
    Option (Fin k) := by
  classical
  exact if h : G.NeedsRefinement χ P then
    some ((Finset.univ.filter fun i : Fin k ↦
      ¬ G.InternallyConnected (colorClass χ i) P).min'
      (by
        rcases h with ⟨i, hi⟩
        exact ⟨i, by simp [hi]⟩))
  else none

omit [DecidableEq V] [DecidableEq E] in
theorem firstDisconnectedColor_eq_none_iff {k : ℕ} (χ : E → Fin k) (P : Setoid V) :
    G.firstDisconnectedColor χ P = none ↔ ¬ G.NeedsRefinement χ P := by
  classical
  unfold firstDisconnectedColor
  split <;> simp_all

omit [DecidableEq V] [DecidableEq E] in
theorem firstDisconnectedColor_spec {k : ℕ} {χ : E → Fin k} {P : Setoid V}
    {i : Fin k} (h : G.firstDisconnectedColor χ P = some i) :
    ¬ G.InternallyConnected (colorClass χ i) P := by
  classical
  unfold firstDisconnectedColor at h
  split at h <;> rename_i hneed
  · simp only [Option.some.injEq] at h
    subst i
    have hne : (Finset.univ.filter fun i : Fin k ↦
        ¬ G.InternallyConnected (colorClass χ i) P).Nonempty := by
      rcases hneed with ⟨i, hi⟩
      exact ⟨i, by simp [hi]⟩
    have hmem := Finset.min'_mem
      (Finset.univ.filter fun i : Fin k ↦
        ¬ G.InternallyConnected (colorClass χ i) P) hne
    simpa using hmem
  · simp at h

omit [DecidableEq V] [DecidableEq E] in
theorem internallyConnected_iff_of_refineSetoid_eq
    {S T : Finset E} {P : Setoid V}
    (hEq : G.refineSetoid P S = G.refineSetoid P T) :
    G.InternallyConnected S P ↔ G.InternallyConnected T P := by
  constructor
  · intro h u v huv
    have hrel : (G.refineSetoid P S).r u v := ⟨huv, h u v huv⟩
    rw [hEq] at hrel
    exact hrel.2
  · intro h u v huv
    have hrel : (G.refineSetoid P T).r u v := ⟨huv, h u v huv⟩
    rw [← hEq] at hrel
    exact hrel.2

omit [DecidableEq V] [DecidableEq E] in
theorem firstDisconnectedColor_internal_of_lt {k : ℕ}
    {χ : E → Fin k} {P : Setoid V} {c d : Fin k}
    (hc : G.firstDisconnectedColor χ P = some c)
    (hdc : d < c) :
    G.InternallyConnected (colorClass χ d) P := by
  classical
  by_contra hbad
  unfold firstDisconnectedColor at hc
  split at hc
  · rename_i hneed
    simp only [Option.some.injEq] at hc
    let B : Finset (Fin k) :=
      Finset.univ.filter fun i : Fin k ↦
        ¬ G.InternallyConnected (colorClass χ i) P
    have hdB : d ∈ B := by simp [B, hbad]
    have hB : B.Nonempty := ⟨d, hdB⟩
    have hle : B.min' hB ≤ d := Finset.min'_le B d hdB
    have hcmin : B.min' hB = c := by
      simpa [B] using hc
    rw [hcmin] at hle
    exact (not_le_of_gt hdc hle)
  · simp at hc

omit [DecidableEq V] [DecidableEq E] in
theorem firstDisconnectedColor_eq_some_of_spec {k : ℕ}
    {χ : E → Fin k} {P : Setoid V} {c : Fin k}
    (hbad : ¬ G.InternallyConnected (colorClass χ c) P)
    (hbefore : ∀ d : Fin k, d < c →
      G.InternallyConnected (colorClass χ d) P) :
    G.firstDisconnectedColor χ P = some c := by
  classical
  unfold firstDisconnectedColor
  have hneed : G.NeedsRefinement χ P := ⟨c, hbad⟩
  rw [dif_pos hneed]
  let B : Finset (Fin k) :=
    Finset.univ.filter fun i : Fin k ↦
      ¬ G.InternallyConnected (colorClass χ i) P
  have hcB : c ∈ B := by simp [B, hbad]
  have hB : B.Nonempty := ⟨c, hcB⟩
  have hmin : B.min' hB = c := by
    apply (Finset.min'_eq_iff B hB c).2
    refine ⟨hcB, ?_⟩
    intro d hdB
    by_contra hnot
    have hdc : d < c := lt_of_not_ge hnot
    exact ((Finset.mem_filter.mp hdB).2) (hbefore d hdc)
  simp [B, hmin]

/-- One deterministic refinement step. -/
noncomputable def refineOnce {k : ℕ} (χ : E → Fin k) (P : Setoid V) : Setoid V :=
  match G.firstDisconnectedColor χ P with
  | none => P
  | some i => G.refineSetoid P (colorClass χ i)

/-- Kaiser's nested sequence of partitions. -/
noncomputable def kaiserPartition {k : ℕ} (χ : E → Fin k) : ℕ → Setoid V
  | 0 => ⊤
  | n + 1 => G.refineOnce χ (kaiserPartition χ n)

omit [DecidableEq V] [DecidableEq E] in
theorem kaiserPartition_succ_refines {k : ℕ} (χ : E → Fin k) (n : ℕ) {u v : V}
    (h : (G.kaiserPartition χ (n + 1)).r u v) :
    (G.kaiserPartition χ n).r u v := by
  change (G.refineOnce χ (G.kaiserPartition χ n)).r u v at h
  cases hcol : G.firstDisconnectedColor χ (G.kaiserPartition χ n) with
  | none =>
      unfold refineOnce at h
      rw [hcol] at h
      exact h
  | some i =>
      have h' : (G.refineSetoid (G.kaiserPartition χ n) (colorClass χ i)).r u v := by
        unfold refineOnce at h
        rw [hcol] at h
        exact h
      exact G.refineSetoid_le _ _ h'

omit [DecidableEq V] [DecidableEq E] in
theorem kaiserPartition_refines_of_le {k : ℕ} (χ : E → Fin k)
    {m n : ℕ} (hmn : m ≤ n) {u v : V}
    (h : (G.kaiserPartition χ n).r u v) :
    (G.kaiserPartition χ m).r u v := by
  induction n, hmn using Nat.le_induction with
  | base => exact h
  | succ n hmn ih =>
      exact ih (G.kaiserPartition_succ_refines χ n h)

/-- The endpoints of `e` are first separated immediately after stage `m`. -/
def HasFiniteLevel {k : ℕ} (χ : E → Fin k) (e : E) (m : ℕ) : Prop :=
  (G.kaiserPartition χ m).r (G.endAt e 0) (G.endAt e 1) ∧
    ¬ (G.kaiserPartition χ (m + 1)).r (G.endAt e 0) (G.endAt e 1)

omit [DecidableEq V] [DecidableEq E] in
theorem finiteLevel_unique {k : ℕ} {χ : E → Fin k} {e : E} {m n : ℕ}
    (hm : G.HasFiniteLevel χ e m) (hn : G.HasFiniteLevel χ e n) : m = n := by
  by_contra hne
  rcases lt_or_gt_of_ne hne with hmn | hnm
  · have hsep := hm.2
    apply hsep
    exact G.kaiserPartition_refines_of_le χ (Nat.succ_le_of_lt hmn) hn.1
  · have hsep := hn.2
    apply hsep
    exact G.kaiserPartition_refines_of_le χ (Nat.succ_le_of_lt hnm) hm.1

omit [DecidableEq V] [DecidableEq E] in
theorem exists_finiteLevel_of_not_rel {k : ℕ} {χ : E → Fin k} {e : E} {n : ℕ}
    (hnot : ¬ (G.kaiserPartition χ n).r (G.endAt e 0) (G.endAt e 1)) :
    ∃ m : ℕ, G.HasFiniteLevel χ e m := by
  classical
  let p : ℕ → Prop := fun t =>
    ¬ (G.kaiserPartition χ t).r (G.endAt e 0) (G.endAt e 1)
  have hex : ∃ t, p t := ⟨n, hnot⟩
  have ht : p (Nat.find hex) := Nat.find_spec hex
  have ht0 : Nat.find hex ≠ 0 := by
    intro h0
    have ht' : p 0 := h0 ▸ ht
    apply ht'
    change (⊤ : Setoid V).r (G.endAt e 0) (G.endAt e 1)
    exact trivial
  obtain ⟨m, hm⟩ := Nat.exists_eq_succ_of_ne_zero ht0
  have ht' : p (m + 1) := by
    have h := ht
    rw [hm] at h
    simpa [Nat.succ_eq_add_one] using h
  have hlt : m < Nat.find hex := by
    rw [hm]
    exact Nat.lt_succ_self m
  have hmin : ¬ p m := Nat.find_min hex hlt
  refine ⟨m, ?_, ht'⟩
  by_contra hmrel
  exact hmin hmrel

/-- An edge of a residual graph is cyclic when deleting it still leaves a route between its
ends.  For a multigraph this is the edge-object version of “lies on a cycle.” -/
def IsCyclicEdge (S : Finset E) (e : E) : Prop :=
  e ∈ S ∧ G.ReachableIn (S.erase e) (G.endAt e 0) (G.endAt e 1)

def IsSuperfluousAt {k : ℕ} (χ : E → Fin (k + 1)) (e : E) (m : ℕ) : Prop :=
  G.IsCyclicEdge (residualClass χ) e ∧ G.HasFiniteLevel χ e m

def HasSuperfluousEdge {k : ℕ} (χ : E → Fin (k + 1)) : Prop :=
  ∃ e m, G.IsSuperfluousAt χ e m

omit [DecidableEq V] [DecidableEq E] in
theorem insideEdges_top (S : Finset E) (u : V) :
    G.insideEdges S ⊤ u = S := by
  classical
  ext e
  simp [insideEdges]

omit [DecidableEq V] [DecidableEq E] in
theorem internallyConnected_top_iff_connects [Nonempty V] (S : Finset E) :
    G.InternallyConnected S ⊤ ↔ G.Connects S := by
  constructor
  · intro h
    refine { preconnected := ?_ }
    intro u v
    have huv := h u v (by simp)
    change (G.supportGraph (G.insideEdges S ⊤ u)).Reachable u v at huv
    rw [G.insideEdges_top S u] at huv
    exact huv
  · intro h u v _
    change (G.supportGraph (G.insideEdges S ⊤ u)).Reachable u v
    rw [G.insideEdges_top S u]
    exact h.preconnected u v

omit [DecidableEq V] [DecidableEq E] in
theorem first_partition_is_residual_components [Nonempty V] {k : ℕ}
    (χ : E → Fin (k + 1)) (hprefix : G.PrefixTrees χ)
    (hdisc : ¬ G.Connects (residualClass χ)) :
    G.kaiserPartition χ 1 = G.refineSetoid ⊤ (residualClass χ) := by
  classical
  change G.refineOnce χ ⊤ = _
  have hlast : ¬ G.InternallyConnected (residualClass χ) ⊤ := by
    simpa [G.internallyConnected_top_iff_connects] using hdisc
  have hfirst : G.firstDisconnectedColor χ ⊤ = some (Fin.last k) := by
    unfold firstDisconnectedColor
    have hneed : G.NeedsRefinement χ ⊤ := ⟨Fin.last k, hlast⟩
    rw [dif_pos hneed]
    let B : Finset (Fin (k + 1)) := Finset.univ.filter fun i ↦
      ¬ G.InternallyConnected (colorClass χ i) ⊤
    have hlast' : ¬ G.InternallyConnected (colorClass χ (Fin.last k)) ⊤ := by
      simpa [residualClass] using hlast
    have hB : B.Nonempty := ⟨Fin.last k, by simp [B, hlast']⟩
    have honly : ∀ i : Fin (k + 1),
        ¬ G.InternallyConnected (colorClass χ i) ⊤ → i = Fin.last k := by
      intro i hi
      rcases Fin.eq_castSucc_or_eq_last i with ⟨j, rfl⟩ | rfl
      · exfalso
        exact hi ((G.internallyConnected_top_iff_connects _).2 (hprefix j).1)
      · rfl
    have hminmem : B.min' hB ∈ B := Finset.min'_mem B hB
    have hbad : ¬ G.InternallyConnected (colorClass χ (B.min' hB)) ⊤ := by
      exact (Finset.mem_filter.mp hminmem).2
    have hmin : B.min' hB = Fin.last k := honly _ hbad
    simp [B, hmin]
  simp [refineOnce, hfirst, residualClass]

/-- Turn a setoid into the finite partition with the same classes.  The explicit classical
instance keeps the recursive setoids proof-oriented while still giving a finite pigeonhole
argument for termination. -/
noncomputable def finpartitionOfSetoid (P : Setoid V) :
    Finpartition (Finset.univ : Finset V) := by
  classical
  exact Finpartition.ofSetoid P

theorem finpartitionOfSetoid_rel_iff {P : Setoid V} {u v : V} :
    v ∈ (finpartitionOfSetoid P).part u ↔ P.r u v := by
  classical
  exact Finpartition.mem_part_ofSetoid_iff_rel

theorem rel_iff_of_finpartition_eq {P Q : Setoid V}
    (h : finpartitionOfSetoid P = finpartitionOfSetoid Q) (u v : V) :
    P.r u v ↔ Q.r u v := by
  classical
  rw [← finpartitionOfSetoid_rel_iff, h, finpartitionOfSetoid_rel_iff]

omit [DecidableEq E] in
/-- The deterministic refinement process reaches a stable partition.  This is the finite
termination fact hidden behind Kaiser's notation `P∞`. -/
theorem exists_stable_kaiserPartition {k : ℕ} (χ : E → Fin k) :
    ∃ n : ℕ, G.firstDisconnectedColor χ (G.kaiserPartition χ n) = none := by
  classical
  let F : ℕ → Finpartition (Finset.univ : Finset V) := fun n ↦
    finpartitionOfSetoid (G.kaiserPartition χ n)
  obtain ⟨m, n, hmn, hF⟩ := Finite.exists_ne_map_eq_of_infinite F
  have hor : m < n ∨ n < m := lt_or_gt_of_ne hmn
  rcases hor with hlt | hlt
  · let Pm := G.kaiserPartition χ m
    let Pn := G.kaiserPartition χ n
    have hrel : ∀ u v : V, Pm.r u v ↔ Pn.r u v := by
      intro u v
      exact rel_iff_of_finpartition_eq hF u v
    have hstep : ∀ u v : V,
        Pm.r u v ↔ (G.kaiserPartition χ (m + 1)).r u v := by
      intro u v
      constructor
      · intro huv
        have hn : Pn.r u v := (hrel u v).mp huv
        exact G.kaiserPartition_refines_of_le χ (Nat.succ_le_of_lt hlt) hn
      · exact G.kaiserPartition_succ_refines χ m
    by_contra hnone
    have hneed : G.NeedsRefinement χ Pm := by
      apply not_not.mp
      intro hnot
      apply hnone
      exact ⟨m, (G.firstDisconnectedColor_eq_none_iff χ Pm).2 hnot⟩
    cases hcol : G.firstDisconnectedColor χ Pm with
    | none => exact hnone ⟨m, hcol⟩
    | some i =>
        have hbad := G.firstDisconnectedColor_spec hcol
        unfold InternallyConnected at hbad
        push Not at hbad
        obtain ⟨u, v, huv, hnreach⟩ := hbad
        have hnext : (G.kaiserPartition χ (m + 1)).r u v :=
          (hstep u v).mp huv
        change (G.refineOnce χ Pm).r u v at hnext
        unfold refineOnce at hnext
        rw [hcol] at hnext
        exact hnreach hnext.2

  · let Pn := G.kaiserPartition χ n
    let Pm := G.kaiserPartition χ m
    have hrel : ∀ u v : V, Pn.r u v ↔ Pm.r u v := by
      intro u v
      exact rel_iff_of_finpartition_eq hF.symm u v
    have hstep : ∀ u v : V,
        Pn.r u v ↔ (G.kaiserPartition χ (n + 1)).r u v := by
      intro u v
      constructor
      · intro huv
        have hm : Pm.r u v := (hrel u v).mp huv
        exact G.kaiserPartition_refines_of_le χ (Nat.succ_le_of_lt hlt) hm
      · exact G.kaiserPartition_succ_refines χ n
    by_contra hnone
    have hneed : G.NeedsRefinement χ Pn := by
      apply not_not.mp
      intro hnot
      apply hnone
      exact ⟨n, (G.firstDisconnectedColor_eq_none_iff χ Pn).2 hnot⟩
    cases hcol : G.firstDisconnectedColor χ Pn with
    | none => exact hnone ⟨n, hcol⟩
    | some i =>
        have hbad := G.firstDisconnectedColor_spec hcol
        unfold InternallyConnected at hbad
        push Not at hbad
        obtain ⟨u, v, huv, hnreach⟩ := hbad
        have hnext : (G.kaiserPartition χ (n + 1)).r u v :=
          (hstep u v).mp huv
        change (G.refineOnce χ Pn).r u v at hnext
        unfold refineOnce at hnext
        rw [hcol] at hnext
        exact hnreach hnext.2

omit [DecidableEq V] [DecidableEq E] in
theorem internallyConnected_of_stable {k : ℕ} {χ : E → Fin k} {n : ℕ}
    (hstable : G.firstDisconnectedColor χ (G.kaiserPartition χ n) = none)
    (i : Fin k) :
    G.InternallyConnected (colorClass χ i) (G.kaiserPartition χ n) := by
  by_contra hnot
  have hneed : G.NeedsRefinement χ (G.kaiserPartition χ n) := ⟨i, hnot⟩
  have : G.firstDisconnectedColor χ (G.kaiserPartition χ n) ≠ none := by
    intro hnone
    exact ((G.firstDisconnectedColor_eq_none_iff χ _).1 hnone) hneed
  exact this hstable

omit [DecidableEq V] [DecidableEq E] in
theorem kaiserPartition_stable_after {k : ℕ} {χ : E → Fin k} {n : ℕ}
    (hstable : G.firstDisconnectedColor χ (G.kaiserPartition χ n) = none) :
    ∀ t : ℕ, G.kaiserPartition χ (n + t) = G.kaiserPartition χ n := by
  intro t
  induction t with
  | zero => simp
  | succ t ih =>
      rw [Nat.add_succ]
      change G.refineOnce χ (G.kaiserPartition χ (n + t)) = _
      rw [ih]
      simp [refineOnce, hstable]

/-- Swap the colors of two distinct edge objects.  This is Kaiser's exchange
`T_c + e - e'`, `T_k - e + e'`. -/
noncomputable def swapColor {k : ℕ} (χ : E → Fin k) (e e' : E) : E → Fin k :=
  Function.update (Function.update χ e (χ e')) e' (χ e)

omit [Fintype E] in
theorem swapColor_apply_left {k : ℕ} (χ : E → Fin k) {e e' : E} (h : e ≠ e') :
    swapColor χ e e' e = χ e' := by
  classical
  simp [swapColor, h]

omit [Fintype E] in
theorem swapColor_apply_right {k : ℕ} (χ : E → Fin k) (e e' : E) :
    swapColor χ e e' e' = χ e := by
  classical
  simp [swapColor]

omit [Fintype E] in
theorem swapColor_apply_of_ne {k : ℕ} (χ : E → Fin k) {e e' x : E}
    (hxe : x ≠ e) (hxe' : x ≠ e') :
    swapColor χ e e' x = χ x := by
  classical
  simp [swapColor, hxe, hxe']

theorem colorClass_swap_left {k : ℕ} (χ : E → Fin k) {e e' : E}
    (hee' : e ≠ e') (hcol : χ e ≠ χ e') :
    colorClass (swapColor χ e e') (χ e) =
      (colorClass χ (χ e)).erase e ∪ {e'} := by
  classical
  ext x
  by_cases hxe : x = e
  · subst x
    simp [mem_colorClass, swapColor_apply_left χ hee', hcol.symm, hee']
  · by_cases hxe' : x = e'
    · subst x
      simp [mem_colorClass, swapColor_apply_right, hee'.symm, hcol.symm]
    · simp [mem_colorClass, swapColor_apply_of_ne χ hxe hxe', hxe, hxe']

theorem colorClass_swap_right {k : ℕ} (χ : E → Fin k) {e e' : E}
    (hee' : e ≠ e') (hcol : χ e ≠ χ e') :
    colorClass (swapColor χ e e') (χ e') =
      (colorClass χ (χ e')).erase e' ∪ {e} := by
  classical
  ext x
  by_cases hxe : x = e
  · subst x
    simp [mem_colorClass, swapColor_apply_left χ hee', hee', hcol]
  · by_cases hxe' : x = e'
    · subst x
      simp [mem_colorClass, swapColor_apply_right, hee'.symm, hcol]
    · simp [mem_colorClass, swapColor_apply_of_ne χ hxe hxe', hxe, hxe']

theorem colorClass_swap_other {k : ℕ} (χ : E → Fin k) {e e' : E} {i : Fin k}
    (hee' : e ≠ e') (hi : i ≠ χ e) (hi' : i ≠ χ e') :
    colorClass (swapColor χ e e') i = colorClass χ i := by
  classical
  ext x
  by_cases hxe : x = e
  · subst x
    simp only [mem_colorClass, swapColor_apply_left χ hee']
    constructor <;> intro h
    · exact (hi' h.symm).elim
    · exact (hi h.symm).elim
  · by_cases hxe' : x = e'
    · subst x
      simp only [mem_colorClass, swapColor_apply_right]
      constructor <;> intro h
      · exact (hi h.symm).elim
      · exact (hi' h.symm).elim
    · simp [mem_colorClass, swapColor_apply_of_ne χ hxe hxe']

omit [DecidableEq V] [DecidableEq E] in
theorem supportGraph_adj_iff (S : Finset E) (u v : V) :
    (G.supportGraph S).Adj u v ↔
      u ≠ v ∧ ∃ e ∈ S,
        (G.endAt e 0 = u ∧ G.endAt e 1 = v) ∨
          (G.endAt e 0 = v ∧ G.endAt e 1 = u) := by
  rw [supportGraph, SimpleGraph.fromRel_adj]
  constructor
  · rintro ⟨huv, h | h⟩
    · rcases h with ⟨e, he, he0, he1⟩
      exact ⟨huv, e, he, Or.inl ⟨he0, he1⟩⟩
    · rcases h with ⟨e, he, he0, he1⟩
      exact ⟨huv, e, he, Or.inr ⟨he0, he1⟩⟩
  · rintro ⟨huv, e, he, h | h⟩
    · exact ⟨huv, Or.inl ⟨e, he, h.1, h.2⟩⟩
    · exact ⟨huv, Or.inr ⟨e, he, h.1, h.2⟩⟩

/-- The unordered endpoint pair of a genuine multiedge. -/
def symEdge (e : E) : Sym2 V := s(G.endAt e 0, G.endAt e 1)

omit [DecidableEq E] in
theorem edgeFinset_supportGraph (S : Finset E)
    [Fintype (G.supportGraph S).edgeSet] :
    (G.supportGraph S).edgeFinset = S.image G.symEdge := by
  classical
  ext z
  induction z using Sym2.inductionOn with
  | _ u v =>
      rw [SimpleGraph.mem_edgeFinset, SimpleGraph.mem_edgeSet,
        G.supportGraph_adj_iff S u v]
      simp only [Finset.mem_image]
      constructor
      · rintro ⟨huv, e, he, hends⟩
        refine ⟨e, he, ?_⟩
        rcases hends with hends | hends
        · exact Sym2.eq_iff.mpr (Or.inl ⟨hends.1, hends.2⟩)
        · exact Sym2.eq_iff.mpr (Or.inr ⟨hends.1, hends.2⟩)
      · rintro ⟨e, he, hEq⟩
        rcases Sym2.eq_iff.mp hEq with hends | hends
        · have huv : u ≠ v := by
            intro huv
            apply G.loopless e
            rw [hends.1, hends.2, huv]
          exact ⟨huv, e, he, Or.inl hends⟩
        · have huv : u ≠ v := by
            intro huv
            apply G.loopless e
            rw [hends.1, hends.2, huv]
          exact ⟨huv, e, he, Or.inr hends⟩

omit [DecidableEq V] [DecidableEq E] in
theorem supportGraph_mono {S T : Finset E} (hST : S ⊆ T) :
    G.supportGraph S ≤ G.supportGraph T := by
  intro u v huv
  rw [G.supportGraph_adj_iff S u v] at huv
  rw [G.supportGraph_adj_iff T u v]
  rcases huv with ⟨huv, e, he, hends⟩
  exact ⟨huv, e, hST he, hends⟩

omit [DecidableEq E] in
theorem exists_edge_of_mem_supportGraph_edgeSet (S : Finset E) {z : Sym2 V}
    (hz : z ∈ (G.supportGraph S).edgeSet) :
    ∃ e ∈ S, G.symEdge e = z := by
  classical
  have hz' : z ∈ (G.supportGraph S).edgeFinset := by
    simpa only [SimpleGraph.mem_edgeFinset] using hz
  rw [G.edgeFinset_supportGraph S] at hz'
  exact Finset.mem_image.mp hz'

omit [DecidableEq V] [DecidableEq E] in
theorem reachableIn_mono {S T : Finset E} (hST : S ⊆ T) {u v : V}
    (h : G.ReachableIn S u v) : G.ReachableIn T u v := by
  exact h.mono (G.supportGraph_mono hST)

omit [DecidableEq V] [DecidableEq E] in
theorem connects_mono {S T : Finset E} (hST : S ⊆ T)
    (h : G.Connects S) : G.Connects T := by
  exact h.mono (G.supportGraph_mono hST)

omit [Fintype V] [DecidableEq V] in
theorem reachable_of_adj_reachable {H K : SimpleGraph V}
    (hstep : ∀ {u v : V}, H.Adj u v → K.Reachable u v) {u v : V}
    (h : H.Reachable u v) : K.Reachable u v := by
  rcases h with ⟨p⟩
  induction p with
  | nil => exact SimpleGraph.Reachable.refl _
  | cons hadj p ih => exact (hstep hadj).trans ih

omit [Fintype V] [DecidableEq V] in
/-- A map of vertices that sends every edge to a route sends every route to a route.
Unlike a graph homomorphism, this allows an edge to collapse to a point; that is exactly
what happens when an internal edge is contracted by a partition. -/
theorem reachable_map_of_adj_reachable {W : Type*} {H : SimpleGraph V}
    {K : SimpleGraph W} (f : V → W)
    (hstep : ∀ {u v : V}, H.Adj u v → K.Reachable (f u) (f v))
    {u v : V} (h : H.Reachable u v) : K.Reachable (f u) (f v) := by
  rcases h with ⟨p⟩
  induction p with
  | nil => exact SimpleGraph.Reachable.refl _
  | cons hadj p ih => exact (hstep hadj).trans ih

omit [Fintype V] [DecidableEq V] in
/-- If every edge of a walk has both ends in a set, then the whole walk stays in that
set, provided its first vertex does. -/
theorem walk_support_subset_of_adj {H : SimpleGraph V} {s : Set V}
    {u v : V} (p : H.Walk u v) (hu : u ∈ s)
    (hedge : ∀ {x y : V}, H.Adj x y → x ∈ s ∧ y ∈ s) :
    ∀ x ∈ p.support, x ∈ s := by
  induction p with
  | nil =>
      intro x hx
      simp at hx
      simpa [hx] using hu
  | cons hadj p ih =>
      intro x hx
      rw [SimpleGraph.Walk.support_cons] at hx
      simp only [List.mem_cons] at hx
      rcases hx with rfl | hx
      · exact (hedge hadj).1
      · exact ih (hedge hadj).2 x hx

omit [DecidableEq V] [DecidableEq E] in
/-- Internal connectedness of one color class becomes ordinary connectedness after
restricting to a single partition class. -/
theorem inside_induce_connected [Nonempty V] (S : Finset E) (P : Setoid V) (u : V)
    (hS : G.InternallyConnected S P) :
    (G.supportGraph (G.insideEdges S P u)).induce {v | P.r v u} |>.Connected := by
  classical
  letI : Nonempty (Set.Elem {v : V | P.r v u}) := ⟨⟨u, P.refl u⟩⟩
  refine { preconnected := ?_ }
  rintro ⟨x, hx⟩ ⟨y, hy⟩
  have hxy : P.r x y := P.trans hx (P.symm hy)
  have hreach := hS x y hxy
  rw [G.insideEdges_eq_of_rel hx] at hreach
  change (G.supportGraph (G.insideEdges S P u)).Reachable x y at hreach
  rcases hreach with ⟨p⟩
  have hedge : ∀ {a b : V},
      (G.supportGraph (G.insideEdges S P u)).Adj a b →
        a ∈ {v | P.r v u} ∧ b ∈ {v | P.r v u} := by
    intro a b hab
    rw [G.supportGraph_adj_iff (G.insideEdges S P u) a b] at hab
    rcases hab with ⟨_, e, he, hends | hends⟩
    · have hi := ((mem_insideEdges (G := G)).mp he)
      exact ⟨by simpa [hends.1] using hi.2.1,
        by simpa [hends.2] using hi.2.2⟩
    · have hi := ((mem_insideEdges (G := G)).mp he)
      exact ⟨by simpa [hends.2] using hi.2.2,
        by simpa [hends.1] using hi.2.1⟩
  exact ⟨p.induce _ (walk_support_subset_of_adj p hx hedge)⟩

omit [DecidableEq V] [DecidableEq E] in
/-- Contracting classes preserves connectedness: a route in S projects to a route
between the corresponding quotient vertices, with internal edges collapsing to points. -/
theorem quotientGraph_connected_of_connects [Nonempty V] (S : Finset E) (P : Setoid V)
    (hS : G.Connects S) :
    (G.quotientGraph S P).Connects Finset.univ := by
  classical
  letI : Nonempty (Quotient P) := Nonempty.map (Quotient.mk P) inferInstance
  refine { preconnected := ?_ }
  intro q r
  induction q using Quotient.inductionOn with
  | _ u =>
      induction r using Quotient.inductionOn with
      | _ v =>
          apply reachable_map_of_adj_reachable
            (H := G.supportGraph S)
            (K := (G.quotientGraph S P).supportGraph Finset.univ)
            (fun x => Quotient.mk _ x)
          · intro x y hxy
            rw [G.supportGraph_adj_iff S x y] at hxy
            rcases hxy with ⟨hxy, e, heS, hends | hends⟩
            · by_cases hcross : ¬ P.r (G.endAt e 0) (G.endAt e 1)
              · let e' : {e : E // e ∈ G.crossingClass S P} :=
                  ⟨e, (mem_crossingClass (G := G)).mpr ⟨heS, hcross⟩⟩
                apply SimpleGraph.Adj.reachable
                rw [(G.quotientGraph S P).supportGraph_adj_iff Finset.univ]
                refine ⟨?_, e', Finset.mem_univ _, Or.inl ?_⟩
                · intro hq
                  apply hcross
                  rw [hends.1, hends.2]
                  exact Quotient.eq'.mp hq
                · constructor <;> simp [quotientGraph, e', hends.1, hends.2]
              · have hrel : P.r x y := by
                  simpa [hends.1, hends.2] using not_not.mp hcross
                have hq : Quotient.mk P x = Quotient.mk P y := Quotient.sound hrel
                exact hq ▸ SimpleGraph.Reachable.refl _
            · by_cases hcross : ¬ P.r (G.endAt e 0) (G.endAt e 1)
              · let e' : {e : E // e ∈ G.crossingClass S P} :=
                  ⟨e, (mem_crossingClass (G := G)).mpr ⟨heS, hcross⟩⟩
                apply SimpleGraph.Adj.reachable
                rw [(G.quotientGraph S P).supportGraph_adj_iff Finset.univ]
                refine ⟨?_, e', Finset.mem_univ _, Or.inr ?_⟩
                · intro hq
                  apply hcross
                  rw [hends.1, hends.2]
                  exact Quotient.eq'.mp hq.symm
                · constructor <;> simp [quotientGraph, e', hends.1, hends.2]
              · have hrel : P.r x y := by
                  have h' : P.r (G.endAt e 0) (G.endAt e 1) := not_not.mp hcross
                  simpa [hends.1, hends.2] using P.symm h'
                have hq : Quotient.mk P x = Quotient.mk P y := Quotient.sound hrel
                exact hq ▸ SimpleGraph.Reachable.refl _
          · exact hS.preconnected u v

omit [DecidableEq V] [DecidableEq E] in
/-- If every partition class is internally connected and the contracted graph is
connected, then the original edge set is connected. -/
theorem connects_of_internal_of_quotient_connects [Nonempty V]
    (S : Finset E) (P : Setoid V)
    (hInt : G.InternallyConnected S P)
    (hQ : (G.quotientGraph S P).Connects Finset.univ) :
    G.Connects S := by
  classical
  letI : Nonempty (Quotient P) := Nonempty.map (Quotient.mk P) inferInstance
  refine { preconnected := ?_ }
  intro u v
  have huRel : P.r u (Quotient.out (Quotient.mk P u)) :=
    P.symm (Quotient.mk_out u)
  have hvRel : P.r v (Quotient.out (Quotient.mk P v)) :=
    P.symm (Quotient.mk_out v)
  have hu : G.ReachableIn S u (Quotient.out (Quotient.mk P u)) :=
    G.reachableIn_mono (G.insideEdges_subset S P u)
      (hInt u (Quotient.out (Quotient.mk P u)) huRel)
  have hv : G.ReachableIn S v (Quotient.out (Quotient.mk P v)) :=
    G.reachableIn_mono (G.insideEdges_subset S P v)
      (hInt v (Quotient.out (Quotient.mk P v)) hvRel)
  have hquot :
      (G.quotientGraph S P).supportGraph Finset.univ |>.Reachable
        (Quotient.mk P u) (Quotient.mk P v) :=
    hQ.preconnected _ _
  have hlift :
      G.ReachableIn S (Quotient.out (Quotient.mk P u))
        (Quotient.out (Quotient.mk P v)) := by
    apply reachable_map_of_adj_reachable
      (H := (G.quotientGraph S P).supportGraph Finset.univ)
      (K := G.supportGraph S) Quotient.out
    · intro q r hqr
      rw [(G.quotientGraph S P).supportGraph_adj_iff Finset.univ q r] at hqr
      rcases hqr with ⟨_, e, _, hends | hends⟩
      · have h0 : Quotient.mk P (G.endAt e.1 0) = q := by
          simpa [quotientGraph] using hends.1
        have h1 : Quotient.mk P (G.endAt e.1 1) = r := by
          simpa [quotientGraph] using hends.2
        have hleftRel : P.r (Quotient.out q) (G.endAt e.1 0) :=
          Quotient.eq'.mp ((Quotient.out_eq q).trans h0.symm)
        have hrightRel : P.r (G.endAt e.1 1) (Quotient.out r) :=
          Quotient.eq'.mp (h1.trans (Quotient.out_eq r).symm)
        have hleft : G.ReachableIn S (Quotient.out q) (G.endAt e.1 0) :=
          G.reachableIn_mono (G.insideEdges_subset S P (Quotient.out q))
            (hInt (Quotient.out q) (G.endAt e.1 0) hleftRel)
        have hright : G.ReachableIn S (G.endAt e.1 1) (Quotient.out r) :=
          G.reachableIn_mono (G.insideEdges_subset S P (G.endAt e.1 1))
            (hInt (G.endAt e.1 1) (Quotient.out r) hrightRel)
        have hadj : (G.supportGraph S).Adj (G.endAt e.1 0) (G.endAt e.1 1) := by
          rw [G.supportGraph_adj_iff S (G.endAt e.1 0) (G.endAt e.1 1)]
          exact ⟨G.loopless e.1, e.1,
            ((mem_crossingClass (G := G)).mp e.2).1, Or.inl ⟨rfl, rfl⟩⟩
        exact hleft.trans ((SimpleGraph.Adj.reachable hadj).trans hright)
      · have h0 : Quotient.mk P (G.endAt e.1 0) = r := by
          simpa [quotientGraph] using hends.1
        have h1 : Quotient.mk P (G.endAt e.1 1) = q := by
          simpa [quotientGraph] using hends.2
        have hleftRel : P.r (Quotient.out q) (G.endAt e.1 1) :=
          Quotient.eq'.mp ((Quotient.out_eq q).trans h1.symm)
        have hrightRel : P.r (G.endAt e.1 0) (Quotient.out r) :=
          Quotient.eq'.mp (h0.trans (Quotient.out_eq r).symm)
        have hleft : G.ReachableIn S (Quotient.out q) (G.endAt e.1 1) :=
          G.reachableIn_mono (G.insideEdges_subset S P (Quotient.out q))
            (hInt (Quotient.out q) (G.endAt e.1 1) hleftRel)
        have hright : G.ReachableIn S (G.endAt e.1 0) (Quotient.out r) :=
          G.reachableIn_mono (G.insideEdges_subset S P (G.endAt e.1 0))
            (hInt (G.endAt e.1 0) (Quotient.out r) hrightRel)
        have hadj : (G.supportGraph S).Adj (G.endAt e.1 0) (G.endAt e.1 1) := by
          rw [G.supportGraph_adj_iff S (G.endAt e.1 0) (G.endAt e.1 1)]
          exact ⟨G.loopless e.1, e.1,
            ((mem_crossingClass (G := G)).mp e.2).1, Or.inl ⟨rfl, rfl⟩⟩
        exact hleft.trans ((SimpleGraph.Adj.reachable hadj).symm.trans hright)
    · exact hquot
  exact hu.trans (hlift.trans hv.symm)

omit [DecidableEq V] in
theorem insideEdges_subset_erase_of_crossing {S : Finset E} {P : Setoid V} {e : E}
    (he : e ∈ G.crossingClass S P) (u : V) :
    G.insideEdges S P u ⊆ S.erase e := by
  intro f hf
  have hi := (mem_insideEdges (G := G)).mp hf
  refine Finset.mem_erase.mpr ⟨?_, hi.1⟩
  intro hfe
  subst f
  exact ((mem_crossingClass (G := G)).mp he).2
    (P.trans hi.2.1 (P.symm hi.2.2))

omit [DecidableEq V] in
/-- A cyclic edge in the contracted graph lifts to a cyclic genuine multiedge.  Internal
routes avoid the chosen edge because that edge crosses the partition. -/
theorem cyclicEdge_of_quotient_cyclic_of_internal [Nonempty V]
    {S : Finset E} {P : Setoid V}
    (hInt : G.InternallyConnected S P)
    {e : {e : E // e ∈ G.crossingClass S P}}
    (he : (G.quotientGraph S P).IsCyclicEdge Finset.univ e) :
    G.IsCyclicEdge S e.1 := by
  classical
  letI : Nonempty (Quotient P) := Nonempty.map (Quotient.mk P) inferInstance
  have heCross : e.1 ∈ G.crossingClass S P := e.2
  have hpath :
      (G.quotientGraph S P).supportGraph (Finset.univ.erase e) |>.Reachable
        (Quotient.mk P (G.endAt e.1 0)) (Quotient.mk P (G.endAt e.1 1)) := he.2
  have hlift :
      G.ReachableIn (S.erase e.1)
        (Quotient.out (Quotient.mk P (G.endAt e.1 0)))
        (Quotient.out (Quotient.mk P (G.endAt e.1 1))) := by
    apply reachable_map_of_adj_reachable
      (H := (G.quotientGraph S P).supportGraph (Finset.univ.erase e))
      (K := G.supportGraph (S.erase e.1)) Quotient.out
    · intro q r hqr
      rw [(G.quotientGraph S P).supportGraph_adj_iff (Finset.univ.erase e) q r] at hqr
      rcases hqr with ⟨_, f, hf, hends | hends⟩
      · have h0 : Quotient.mk P (G.endAt f.1 0) = q := by
          simpa [quotientGraph] using hends.1
        have hfe : f.1 ≠ e.1 := by
          intro h
          apply (Finset.mem_erase.mp hf).1
          apply Subtype.ext
          exact h
        have hfS : f.1 ∈ S := ((mem_crossingClass (G := G)).mp f.2).1
        have h1 : Quotient.mk P (G.endAt f.1 1) = r := by
          simpa [quotientGraph] using hends.2
        have hleftRel : P.r (Quotient.out q) (G.endAt f.1 0) :=
          Quotient.eq'.mp ((Quotient.out_eq q).trans h0.symm)
        have hrightRel : P.r (G.endAt f.1 1) (Quotient.out r) :=
          Quotient.eq'.mp (h1.trans (Quotient.out_eq r).symm)
        have hleft : G.ReachableIn (S.erase e.1) (Quotient.out q) (G.endAt f.1 0) :=
          G.reachableIn_mono (G.insideEdges_subset_erase_of_crossing heCross (Quotient.out q))
            (hInt (Quotient.out q) (G.endAt f.1 0) hleftRel)
        have hright : G.ReachableIn (S.erase e.1) (G.endAt f.1 1) (Quotient.out r) :=
          G.reachableIn_mono
            (G.insideEdges_subset_erase_of_crossing heCross (G.endAt f.1 1))
            (hInt (G.endAt f.1 1) (Quotient.out r) hrightRel)
        have hadj : (G.supportGraph (S.erase e.1)).Adj
            (G.endAt f.1 0) (G.endAt f.1 1) := by
          rw [G.supportGraph_adj_iff (S.erase e.1) (G.endAt f.1 0) (G.endAt f.1 1)]
          exact ⟨G.loopless f.1, f.1, Finset.mem_erase.mpr ⟨hfe, hfS⟩,
            Or.inl ⟨rfl, rfl⟩⟩
        exact hleft.trans ((SimpleGraph.Adj.reachable hadj).trans hright)
      · have h0 : Quotient.mk P (G.endAt f.1 0) = r := by
          simpa [quotientGraph] using hends.1
        have hfe : f.1 ≠ e.1 := by
          intro h
          apply (Finset.mem_erase.mp hf).1
          apply Subtype.ext
          exact h
        have hfS : f.1 ∈ S := ((mem_crossingClass (G := G)).mp f.2).1
        have h1 : Quotient.mk P (G.endAt f.1 1) = q := by
          simpa [quotientGraph] using hends.2
        have hleftRel : P.r (Quotient.out q) (G.endAt f.1 1) :=
          Quotient.eq'.mp ((Quotient.out_eq q).trans h1.symm)
        have hrightRel : P.r (G.endAt f.1 0) (Quotient.out r) :=
          Quotient.eq'.mp (h0.trans (Quotient.out_eq r).symm)
        have hleft : G.ReachableIn (S.erase e.1) (Quotient.out q) (G.endAt f.1 1) :=
          G.reachableIn_mono (G.insideEdges_subset_erase_of_crossing heCross (Quotient.out q))
            (hInt (Quotient.out q) (G.endAt f.1 1) hleftRel)
        have hright : G.ReachableIn (S.erase e.1) (G.endAt f.1 0) (Quotient.out r) :=
          G.reachableIn_mono
            (G.insideEdges_subset_erase_of_crossing heCross (G.endAt f.1 0))
            (hInt (G.endAt f.1 0) (Quotient.out r) hrightRel)
        have hadj : (G.supportGraph (S.erase e.1)).Adj
            (G.endAt f.1 0) (G.endAt f.1 1) := by
          rw [G.supportGraph_adj_iff (S.erase e.1) (G.endAt f.1 0) (G.endAt f.1 1)]
          exact ⟨G.loopless f.1, f.1, Finset.mem_erase.mpr ⟨hfe, hfS⟩,
            Or.inl ⟨rfl, rfl⟩⟩
        exact hleft.trans ((SimpleGraph.Adj.reachable hadj).symm.trans hright)
    · exact hpath
  have h0Rel : P.r (G.endAt e.1 0)
      (Quotient.out (Quotient.mk P (G.endAt e.1 0))) :=
    P.symm (Quotient.mk_out (G.endAt e.1 0))
  have h1Rel : P.r (G.endAt e.1 1)
      (Quotient.out (Quotient.mk P (G.endAt e.1 1))) :=
    P.symm (Quotient.mk_out (G.endAt e.1 1))
  have h0 : G.ReachableIn (S.erase e.1) (G.endAt e.1 0)
      (Quotient.out (Quotient.mk P (G.endAt e.1 0))) :=
    G.reachableIn_mono
      (G.insideEdges_subset_erase_of_crossing heCross (G.endAt e.1 0))
      (hInt (G.endAt e.1 0) (Quotient.out (Quotient.mk P (G.endAt e.1 0))) h0Rel)
  have h1 : G.ReachableIn (S.erase e.1) (G.endAt e.1 1)
      (Quotient.out (Quotient.mk P (G.endAt e.1 1))) :=
    G.reachableIn_mono
      (G.insideEdges_subset_erase_of_crossing heCross (G.endAt e.1 1))
      (hInt (G.endAt e.1 1) (Quotient.out (Quotient.mk P (G.endAt e.1 1))) h1Rel)
  exact ⟨((mem_crossingClass (G := G)).mp heCross).1,
    h0.trans (hlift.trans h1.symm)⟩

omit [DecidableEq V] in
/-- Deleting a cyclic edge preserves every reachability relation. -/
theorem reachableIn_erase_of_cyclic {S : Finset E} {e : E}
    (he : G.IsCyclicEdge S e) {u v : V}
    (h : G.ReachableIn S u v) : G.ReachableIn (S.erase e) u v := by
  change (G.supportGraph S).Reachable u v at h
  change (G.supportGraph (S.erase e)).Reachable u v
  have hepath : (G.supportGraph (S.erase e)).Reachable
      (G.endAt e 0) (G.endAt e 1) := he.2
  apply reachable_of_adj_reachable (H := G.supportGraph S)
    (K := G.supportGraph (S.erase e))
  intro x y hxy
  rw [G.supportGraph_adj_iff S x y] at hxy
  rcases hxy with ⟨hxy, f, hfS, hends | hends⟩
  · by_cases hfe : f = e
    · subst f
      simpa [hends.1, hends.2] using hepath
    · apply SimpleGraph.Adj.reachable
      rw [G.supportGraph_adj_iff (S.erase e) x y]
      exact ⟨hxy, f, Finset.mem_erase.mpr ⟨hfe, hfS⟩, Or.inl hends⟩
  · by_cases hfe : f = e
    · subst f
      simpa [hends.1, hends.2] using hepath.symm
    · apply SimpleGraph.Adj.reachable
      rw [G.supportGraph_adj_iff (S.erase e) x y]
      exact ⟨hxy, f, Finset.mem_erase.mpr ⟨hfe, hfS⟩, Or.inr hends⟩
  exact h

omit [DecidableEq V] in
theorem componentSetoid_erase_eq_of_cyclic {S : Finset E} {e : E}
    (he : G.IsCyclicEdge S e) :
    G.componentSetoid (S.erase e) = G.componentSetoid S := by
  apply Setoid.ext
  intro u v
  constructor
  · intro h
    exact G.reachableIn_mono (Finset.erase_subset _ _) h
  · exact G.reachableIn_erase_of_cyclic he

omit [DecidableEq V] in
/-- Deleting a non-cyclic edge strictly increases the number of connected components. -/
theorem component_card_lt_of_not_cyclic [Nonempty V] {S : Finset E} {e : E}
    (heS : e ∈ S) (hne : ¬ G.IsCyclicEdge S e) :
    Nat.card (G.supportGraph S).ConnectedComponent <
      Nat.card (G.supportGraph (S.erase e)).ConnectedComponent := by
  classical
  let H := G.supportGraph (S.erase e)
  let K := G.supportGraph S
  have hHK : H ≤ K := G.supportGraph_mono (Finset.erase_subset _ _)
  let f : H.ConnectedComponent → K.ConnectedComponent :=
    fun C => C.map (SimpleGraph.Hom.ofLE hHK)
  have hsurj : Function.Surjective f := by
    exact SimpleGraph.ConnectedComponent.surjective_map_ofLE hHK
  have hnreach :
      ¬ G.ReachableIn (S.erase e) (G.endAt e 0) (G.endAt e 1) := by
    intro h
    exact hne ⟨heS, h⟩
  have hnotinj : ¬ Function.Injective f := by
    intro hinj
    have hneq :
        H.connectedComponentMk (G.endAt e 0) ≠
          H.connectedComponentMk (G.endAt e 1) := by
      intro hEq
      apply hnreach
      exact SimpleGraph.ConnectedComponent.eq.mp hEq
    apply hneq
    apply hinj
    change K.connectedComponentMk (G.endAt e 0) =
      K.connectedComponentMk (G.endAt e 1)
    apply SimpleGraph.ConnectedComponent.eq.mpr
    apply SimpleGraph.Adj.reachable
    dsimp [K]
    rw [G.supportGraph_adj_iff S (G.endAt e 0) (G.endAt e 1)]
    exact ⟨G.loopless e, e, heS, Or.inl ⟨rfl, rfl⟩⟩
  letI : Fintype H.ConnectedComponent := Fintype.ofFinite _
  letI : Fintype K.ConnectedComponent := Fintype.ofFinite _
  have hlt := Fintype.card_lt_of_surjective_not_injective f hsurj hnotinj
  simpa [H, K, Nat.card_eq_fintype_card] using hlt

omit [DecidableEq V] in
theorem isCyclicEdge_mono {S T : Finset E} (hST : S ⊆ T) {e : E}
    (he : G.IsCyclicEdge S e) :
    G.IsCyclicEdge T e := by
  refine ⟨hST he.1, G.reachableIn_mono ?_ he.2⟩
  intro f hf
  have hf' := Finset.mem_erase.mp hf
  exact Finset.mem_erase.mpr ⟨hf'.1, hST hf'.2⟩

omit [DecidableEq V] [DecidableEq E] in
theorem component_card_le_vertex_card (S : Finset E) :
    Nat.card (G.supportGraph S).ConnectedComponent ≤ Fintype.card V := by
  have hsurj : Function.Surjective ((G.supportGraph S).connectedComponentMk) := by
    intro C
    refine SimpleGraph.ConnectedComponent.ind (c := C) ?_
    intro v
    exact ⟨v, rfl⟩
  have hle := Nat.card_le_card_of_surjective
    ((G.supportGraph S).connectedComponentMk) hsurj
  simpa [Nat.card_eq_fintype_card] using hle

/-- A finite multiedge set with no cyclic edge is a forest in the cardinal sense:
edges plus components never exceed vertices. -/
theorem card_add_components_le_of_no_cyclic [Nonempty V] (S : Finset E)
    (hno : ∀ e ∈ S, ¬ G.IsCyclicEdge S e) :
    S.card + Nat.card (G.supportGraph S).ConnectedComponent ≤ Fintype.card V := by
  classical
  induction S using Finset.induction_on with
  | empty =>
      simpa using G.component_card_le_vertex_card (∅ : Finset E)
  | @insert e T heT ih =>
      have hnoT : ∀ f ∈ T, ¬ G.IsCyclicEdge T f := by
        intro f hf hcyc
        exact hno f (Finset.mem_insert_of_mem hf)
          (G.isCyclicEdge_mono (by
            intro x hx
            exact Finset.mem_insert_of_mem hx) hcyc)
      have hih := ih hnoT
      have hnotcyc : ¬ G.IsCyclicEdge (insert e T) e :=
        hno e (by simp)
      have hlt := G.component_card_lt_of_not_cyclic
        (S := insert e T) (e := e) (by simp) hnotcyc
      have herase : (insert e T).erase e = T := by simp [heT]
      rw [herase] at hlt
      have hcard : (insert e T).card = T.card + 1 :=
        Finset.card_insert_of_notMem heT
      omega

/-- A disconnected finite multigraph with at least one fewer edge than vertices has a
cyclic edge.  Otherwise the forest inequality leaves room for at least two components. -/
theorem exists_cyclic_of_disconnected_of_card_ge [Nonempty V] (S : Finset E)
    (hdisc : ¬ G.Connects S) (hcard : Fintype.card V - 1 ≤ S.card) :
    ∃ e : E, G.IsCyclicEdge S e := by
  classical
  by_contra hnone
  push Not at hnone
  have hforest := G.card_add_components_le_of_no_cyclic S
    (fun e _ => hnone e)
  have hcomp :
      1 < Nat.card (G.supportGraph S).ConnectedComponent := by
    by_contra hnot
    have hle : Nat.card (G.supportGraph S).ConnectedComponent ≤ 1 := by omega
    letI : Subsingleton (G.supportGraph S).ConnectedComponent :=
      Finite.card_le_one_iff_subsingleton.mp hle
    apply hdisc
    refine { preconnected := ?_ }
    intro u v
    apply SimpleGraph.ConnectedComponent.eq.mp
    exact Subsingleton.elim _ _
  have hVpos : 0 < Fintype.card V := Fintype.card_pos_iff.mpr inferInstance
  omega

omit [Fintype E] in
theorem card_exchange {S : Finset E} {e e' : E}
    (he' : e' ∈ S) (he : e ∉ S) :
    ((S.erase e') ∪ {e}).card = S.card := by
  have heErase : e ∉ S.erase e' := fun h ↦ he (Finset.mem_of_mem_erase h)
  have hpos : 0 < S.card := Finset.card_pos.mpr ⟨e', he'⟩
  rw [Finset.union_singleton, Finset.card_insert_of_notMem heErase,
    Finset.card_erase_of_mem he']
  omega

omit [DecidableEq V] in
theorem isSpanningTree_of_exchange {T : Finset E} {e e' : E}
    (hT : G.IsSpanningTree T) (he' : e' ∈ T) (he : e ∉ T)
    (hconn : G.Connects ((T.erase e') ∪ {e})) :
    G.IsSpanningTree ((T.erase e') ∪ {e}) := by
  refine ⟨hconn, ?_⟩
  rw [card_exchange he' he]
  exact hT.2

omit [DecidableEq V] in
theorem connects_erase_of_cyclic [Nonempty V] {S : Finset E} {e : E}
    (he : G.IsCyclicEdge S e) (hS : G.Connects S) :
    G.Connects (S.erase e) := by
  refine { preconnected := ?_ }
  intro u v
  exact G.reachableIn_erase_of_cyclic he (hS.preconnected u v)

/-- Every connected multiedge set contains a spanning tree.  We obtain a simple spanning
tree of its support graph and choose one genuine edge object above each simple edge. -/
theorem exists_isSpanningTree_subset_of_connects [Nonempty V] (S : Finset E)
    (hS : G.Connects S) :
    ∃ T : Finset E, T ⊆ S ∧ G.IsSpanningTree T := by
  classical
  letI : Fintype (Sym2 V) := Fintype.ofFinite _
  letI : Fintype (G.supportGraph S).edgeSet := Fintype.ofFinite _
  obtain ⟨H, hHG, hHtree⟩ := hS.exists_isTree_le
  letI : Fintype H.edgeSet := Fintype.ofFinite _
  have hpre : ∀ z : H.edgeFinset, ∃ e ∈ S, G.symEdge e = z.1 := by
    intro z
    have hz : z.1 ∈ (G.supportGraph S).edgeFinset :=
      SimpleGraph.edgeFinset_mono hHG z.2
    rw [G.edgeFinset_supportGraph S] at hz
    rcases Finset.mem_image.mp hz with ⟨e, he, hEq⟩
    exact ⟨e, he, hEq⟩
  choose f hfS hfEq using hpre
  let T : Finset E := Finset.univ.image f
  have hTS : T ⊆ S := by
    intro e he
    rcases Finset.mem_image.mp he with ⟨z, _, rfl⟩
    exact hfS z
  have hfinj : Function.Injective f := by
    intro z w hzw
    apply Subtype.ext
    calc
      z.1 = G.symEdge (f z) := (hfEq z).symm
      _ = G.symEdge (f w) := congrArg G.symEdge hzw
      _ = w.1 := hfEq w
  letI : Fintype (G.supportGraph T).edgeSet := Fintype.ofFinite _
  have hHT : H ≤ G.supportGraph T := by
    rw [← SimpleGraph.edgeFinset_subset_edgeFinset]
    intro z hz
    rw [G.edgeFinset_supportGraph T]
    let z' : H.edgeFinset := ⟨z, hz⟩
    have hfT : f z' ∈ T := by
      exact Finset.mem_image.mpr ⟨z', Finset.mem_univ _, rfl⟩
    exact Finset.mem_image.mpr ⟨f z', hfT, hfEq z'⟩
  have hTconn : G.Connects T := hHtree.connected.mono hHT
  have hcard : T.card = H.edgeFinset.card := by
    calc
      T.card = (Finset.univ : Finset H.edgeFinset).card := by
        exact Finset.card_image_of_injective _ hfinj
      _ = H.edgeFinset.card := by simp
  refine ⟨T, hTS, hTconn, ?_⟩
  rw [hcard]
  exact hHtree.card_edgeFinset

omit [DecidableEq E] in
/-- The simple support of one multigraph spanning tree is a simple tree: the
connectedness lower bound forces the support map to lose no edge objects. -/
theorem supportGraph_isTree_of_spanningTree [Nonempty V] {T : Finset E}
    (hT : G.IsSpanningTree T) :
    (G.supportGraph T).IsTree := by
  classical
  letI : Fintype (G.supportGraph T).edgeSet := Fintype.ofFinite _
  rw [SimpleGraph.isTree_iff_connected_and_card]
  refine ⟨hT.1, ?_⟩
  have hle : (G.supportGraph T).edgeFinset.card ≤ T.card := by
    rw [G.edgeFinset_supportGraph T]
    exact Finset.card_image_le
  have hle' : Nat.card (G.supportGraph T).edgeSet ≤ T.card := by
    rw [Nat.card_eq_fintype_card, ← SimpleGraph.edgeFinset_card]
    exact hle
  have hlow := hT.1.card_vert_le_card_edgeSet_add_one
  have hTcard : T.card + 1 = Nat.card V := by
    simpa [Nat.card_eq_fintype_card] using hT.2
  omega

omit [DecidableEq E] in
theorem symEdge_injOn_of_spanningTree [Nonempty V] {T : Finset E}
    (hT : G.IsSpanningTree T) :
    Set.InjOn G.symEdge T := by
  classical
  letI : Fintype (G.supportGraph T).edgeSet := Fintype.ofFinite _
  have hHtree := G.supportGraph_isTree_of_spanningTree hT
  have hcard :
      (T.image G.symEdge).card = T.card := by
    rw [← G.edgeFinset_supportGraph T]
    have hHcard := hHtree.card_edgeFinset
    have hTcard := hT.2
    omega
  exact Finset.card_image_iff.mp hcard

omit [Fintype V] [DecidableEq V] in
theorem isAcyclic_of_le {H K : SimpleGraph V} (hHK : H ≤ K)
    (hK : K.IsAcyclic) : H.IsAcyclic := by
  rw [SimpleGraph.isAcyclic_iff_path_unique]
  intro u v p q
  let f : H →g K := SimpleGraph.Hom.ofLE hHK
  let p' : K.Path u v :=
    ⟨p.1.map f, SimpleGraph.Walk.map_isPath_of_injective (fun _ _ h => h) p.2⟩
  let q' : K.Path u v :=
    ⟨q.1.map f, SimpleGraph.Walk.map_isPath_of_injective (fun _ _ h => h) q.2⟩
  have hpq : p' = q' :=
    (SimpleGraph.isAcyclic_iff_path_unique.mp hK) p' q'
  have hwalk : p.1.map f = q.1.map f := congrArg Subtype.val hpq
  apply Subtype.ext
  exact (SimpleGraph.Walk.map_injective_of_injective
    (fun _ _ h => h) u v) hwalk

omit [DecidableEq V] [DecidableEq E] in
/-- If every genuine tree edge used by a support walk is internal to a partition,
then the walk gives an internal route in the multigraph. -/
theorem reachableIn_inside_of_walk_of_no_crossing
    {T : Finset E} {P : Setoid V} {a u v : V}
    (p : (G.supportGraph T).Walk u v) (hua : P.r u a)
    (hno : ∀ f ∈ T, G.symEdge f ∈ p.edges →
      P.r (G.endAt f 0) (G.endAt f 1)) :
    G.ReachableIn (G.insideEdges T P a) u v := by
  classical
  induction p generalizing a with
  | nil =>
      exact SimpleGraph.Reachable.refl _
  | @cons u w v hadj p ih =>
      rw [G.supportGraph_adj_iff T u w] at hadj
      rcases hadj with ⟨huwne, f, hfT, hends | hends⟩
      · have hsym : G.symEdge f = s(u, w) :=
          Sym2.eq_iff.mpr (Or.inl ⟨hends.1, hends.2⟩)
        have hfedge : G.symEdge f ∈ (SimpleGraph.Walk.cons
            (by
              rw [G.supportGraph_adj_iff T u w]
              exact ⟨huwne, f, hfT, Or.inl hends⟩) p).edges := by
          simp [hsym]
        have hfw := hno f hfT hfedge
        have huw : P.r u w := by simpa [hends.1, hends.2] using hfw
        have hwa : P.r w a := P.trans (P.symm huw) hua
        have hfInside : f ∈ G.insideEdges T P a := by
          apply (mem_insideEdges (G := G)).mpr
          exact ⟨hfT, by simpa [hends.1] using hua,
            by simpa [hends.2] using hwa⟩
        have hadjInside :
            (G.supportGraph (G.insideEdges T P a)).Adj u w := by
          rw [G.supportGraph_adj_iff (G.insideEdges T P a) u w]
          exact ⟨huwne, f, hfInside, Or.inl hends⟩
        have htail : ∀ g ∈ T, G.symEdge g ∈ p.edges →
            P.r (G.endAt g 0) (G.endAt g 1) := by
          intro g hgT hgedge
          apply hno g hgT
          simp only [SimpleGraph.Walk.edges_cons, List.mem_cons]
          exact Or.inr hgedge
        exact (SimpleGraph.Adj.reachable hadjInside).trans (ih hwa htail)
      · have hsym : G.symEdge f = s(u, w) :=
          Sym2.eq_iff.mpr (Or.inr ⟨hends.1, hends.2⟩)
        have hfedge : G.symEdge f ∈ (SimpleGraph.Walk.cons
            (by
              rw [G.supportGraph_adj_iff T u w]
              exact ⟨huwne, f, hfT, Or.inr hends⟩) p).edges := by
          simp [hsym]
        have hfw := hno f hfT hfedge
        have huw : P.r u w := by
          simpa [hends.1, hends.2] using P.symm hfw
        have hwa : P.r w a := P.trans (P.symm huw) hua
        have hfInside : f ∈ G.insideEdges T P a := by
          apply (mem_insideEdges (G := G)).mpr
          exact ⟨hfT, by simpa [hends.1] using hwa,
            by simpa [hends.2] using hua⟩
        have hadjInside :
            (G.supportGraph (G.insideEdges T P a)).Adj u w := by
          rw [G.supportGraph_adj_iff (G.insideEdges T P a) u w]
          exact ⟨huwne, f, hfInside, Or.inr hends⟩
        have htail : ∀ g ∈ T, G.symEdge g ∈ p.edges →
            P.r (G.endAt g 0) (G.endAt g 1) := by
          intro g hgT hgedge
          apply hno g hgT
          simp only [SimpleGraph.Walk.edges_cons, List.mem_cons]
          exact Or.inr hgedge
        exact (SimpleGraph.Adj.reachable hadjInside).trans (ih hwa htail)

omit [DecidableEq E] in
theorem exists_crossing_tree_edge_of_not_internal_reachable
    {T : Finset E} {P : Setoid V} {u v : V}
    (p : (G.supportGraph T).Walk u v)
    (hnot : ¬ G.ReachableIn (G.insideEdges T P u) u v) :
    ∃ f ∈ T, G.symEdge f ∈ p.edges ∧
      ¬ P.r (G.endAt f 0) (G.endAt f 1) := by
  classical
  by_contra hnone
  push Not at hnone
  apply hnot
  exact G.reachableIn_inside_of_walk_of_no_crossing p (P.refl u)
    (fun f hfT hfedge => hnone f hfT hfedge)

omit [DecidableEq V] [DecidableEq E] in
theorem rel_of_reachableIn_inside {S : Finset E} {P : Setoid V}
    {a u v : V} (hua : P.r u a)
    (h : G.ReachableIn (G.insideEdges S P a) u v) :
    P.r v a := by
  rcases h with ⟨p⟩
  induction p with
  | nil => exact hua
  | @cons x y z hxy p ih =>
      rw [G.supportGraph_adj_iff (G.insideEdges S P a) x y] at hxy
      rcases hxy with ⟨_, f, hf, hends | hends⟩
      · have hf' := (mem_insideEdges (G := G)).mp hf
        apply ih
        simpa [hends.2] using hf'.2.2
      · have hf' := (mem_insideEdges (G := G)).mp hf
        apply ih
        simpa [hends.1] using hf'.2.1

omit [DecidableEq E] in
/-- If every edge of a support walk is internal to P, then every genuine edge on
the walk has both ends in the class of the walk's first vertex. -/
theorem path_edge_ends_rel_start_of_no_crossing
    {T : Finset E} {P : Setoid V} {u v : V}
    (p : (G.supportGraph T).Walk u v)
    (hno : ∀ f ∈ T, G.symEdge f ∈ p.edges →
      P.r (G.endAt f 0) (G.endAt f 1))
    {f : E} (hfedge : G.symEdge f ∈ p.edges) :
    P.r (G.endAt f 0) u ∧ P.r (G.endAt f 1) u := by
  have h0supp : G.endAt f 0 ∈ p.support :=
    p.mem_support_of_mem_edges hfedge (by simp [symEdge])
  have h1supp : G.endAt f 1 ∈ p.support :=
    p.mem_support_of_mem_edges hfedge (by simp [symEdge])
  have hroute0 :
      G.ReachableIn (G.insideEdges T P u) u (G.endAt f 0) := by
    apply G.reachableIn_inside_of_walk_of_no_crossing
      (p.takeUntil (G.endAt f 0) h0supp) (P.refl u)
    intro g hgT hgedge
    apply hno g hgT
    exact p.edges_takeUntil_subset_edges h0supp hgedge
  have hroute1 :
      G.ReachableIn (G.insideEdges T P u) u (G.endAt f 1) := by
    apply G.reachableIn_inside_of_walk_of_no_crossing
      (p.takeUntil (G.endAt f 1) h1supp) (P.refl u)
    intro g hgT hgedge
    apply hno g hgT
    exact p.edges_takeUntil_subset_edges h1supp hgedge
  exact ⟨G.rel_of_reachableIn_inside (P.refl u) hroute0,
    G.rel_of_reachableIn_inside (P.refl u) hroute1⟩

/-- Removing an edge on the tree path between the ends of a new edge and adding the
new edge preserves connectedness.  This is the multiedge form of the fundamental
cycle exchange. -/
theorem connects_exchange_of_path_edge [Nonempty V]
    {T : Finset E} {e e' : E}
    (hT : G.IsSpanningTree T) (he' : e' ∈ T)
    (p : (G.supportGraph T).Path (G.endAt e 0) (G.endAt e 1))
    (he'path : G.symEdge e' ∈ p.1.edges) :
    G.Connects (T.erase e' ∪ {e}) := by
  classical
  let H := G.supportGraph T
  let z := G.symEdge e'
  let zs : Finset (Sym2 V) := {z}
  let D := H.deleteEdges (zs : Set (Sym2 V))
  let K := D ⊔ SimpleGraph.edge (G.endAt e 0) (G.endAt e 1)
  have hHtree : H.IsTree := by
    simpa [H] using G.supportGraph_isTree_of_spanningTree hT
  have hzH : z ∈ H.edgeFinset := by
    dsimp [H]
    rw [G.edgeFinset_supportGraph T]
    exact Finset.mem_image.mpr ⟨e', he', rfl⟩
  have hnreach :
      ¬ D.Reachable (G.endAt e 0) (G.endAt e 1) := by
    intro hreach
    apply hreach.elim_path
    intro q
    let qH : H.Path (G.endAt e 0) (G.endAt e 1) :=
      ⟨q.1.mapLe (SimpleGraph.deleteEdges_le _), q.2.mapLe _⟩
    have hEqWalk : qH.1 = p.1 :=
      (hHtree.existsUnique_path _ _).unique qH.2 p.2
    have hEq : qH = p := Subtype.ext hEqWalk
    have hzqH : z ∈ qH.1.edges := by
      rw [hEq]
      exact he'path
    have hzq : z ∈ q.1.edges := by
      simp [qH, SimpleGraph.Walk.edges_mapLe_eq_edges] at hzqH
      exact hzqH
    have hzD : z ∈ D.edgeSet := q.1.edges_subset_edgeSet hzq
    have hzD' : z ∈ H.edgeSet ∧ z ∉ (zs : Set (Sym2 V)) := by
      simpa [D, SimpleGraph.deleteEdges] using hzD
    exact hzD'.2 (by simp [zs])
  have hDacyc : D.IsAcyclic :=
    isAcyclic_of_le (V := V) (SimpleGraph.deleteEdges_le _) hHtree.isAcyclic
  have hKacyc : K.IsAcyclic := by
    exact hDacyc.sup_edge_of_not_reachable hnreach
  have hDcard : D.edgeFinset.card = H.edgeFinset.card - 1 := by
    have hDel :
        D.edgeFinset = H.edgeFinset \ zs := by
      simp [D, SimpleGraph.edgeFinset_deleteEdges]
    rw [hDel]
    have hzs : zs ⊆ H.edgeFinset := by
      simpa [zs] using hzH
    rw [Finset.card_sdiff_of_subset hzs]
    simp [zs]
  have hnotAdj : ¬ D.Adj (G.endAt e 0) (G.endAt e 1) := by
    intro h
    exact hnreach h.reachable
  have hKcard : K.edgeFinset.card = H.edgeFinset.card := by
    have hsup : K.edgeFinset.card = D.edgeFinset.card + 1 := by
      simpa [K] using
        (SimpleGraph.card_edgeFinset_sup_edge D hnotAdj (G.loopless e))
    rw [hsup, hDcard]
    have hpos : 0 < H.edgeFinset.card := Finset.card_pos.mpr ⟨z, hzH⟩
    omega
  obtain ⟨F, hKF, _, hFtree⟩ :=
    SimpleGraph.connected_top.exists_isTree_le_of_le_of_isAcyclic
      (H := K) le_top hKacyc
  have hKsubF : K.edgeFinset ⊆ F.edgeFinset :=
    SimpleGraph.edgeFinset_mono hKF
  have hcardEq : K.edgeFinset.card = F.edgeFinset.card := by
    have hHcard := hHtree.card_edgeFinset
    have hFcard := hFtree.card_edgeFinset
    omega
  have hEF : K.edgeFinset = F.edgeFinset :=
    Finset.eq_of_subset_of_card_le hKsubF (by omega)
  have hFK : F ≤ K := by
    rw [← SimpleGraph.edgeFinset_subset_edgeFinset]
    rw [← hEF]
  have hKconn : K.Connected := hFtree.connected.mono hFK
  have hDelSub : D ≤ G.supportGraph (T.erase e' ∪ {e}) := by
    intro x y hxy
    dsimp [D] at hxy
    rw [SimpleGraph.deleteEdges_adj] at hxy
    have hxyH := hxy.1
    have hnotz : s(x, y) ≠ z := by simpa [zs] using hxy.2
    change (G.supportGraph T).Adj x y at hxyH
    rw [G.supportGraph_adj_iff T x y] at hxyH
    rcases hxyH with ⟨hxyne, f, hfT, hends | hends⟩
    · have hsym : G.symEdge f = s(x, y) :=
        Sym2.eq_iff.mpr (Or.inl ⟨hends.1, hends.2⟩)
      have hfe' : f ≠ e' := by
        intro h
        subst f
        exact hnotz hsym.symm
      rw [G.supportGraph_adj_iff (T.erase e' ∪ {e}) x y]
      exact ⟨hxyne, f,
        Finset.mem_union.mpr (Or.inl (Finset.mem_erase.mpr ⟨hfe', hfT⟩)),
        Or.inl hends⟩
    · have hsym : G.symEdge f = s(x, y) :=
        Sym2.eq_iff.mpr (Or.inr ⟨hends.1, hends.2⟩)
      have hfe' : f ≠ e' := by
        intro h
        subst f
        exact hnotz hsym.symm
      rw [G.supportGraph_adj_iff (T.erase e' ∪ {e}) x y]
      exact ⟨hxyne, f,
        Finset.mem_union.mpr (Or.inl (Finset.mem_erase.mpr ⟨hfe', hfT⟩)),
        Or.inr hends⟩
  have hEdgeSub :
      SimpleGraph.edge (G.endAt e 0) (G.endAt e 1) ≤
        G.supportGraph (T.erase e' ∪ {e}) := by
    rw [SimpleGraph.edge_le_iff]
    right
    rw [G.supportGraph_adj_iff (T.erase e' ∪ {e}) (G.endAt e 0) (G.endAt e 1)]
    exact ⟨G.loopless e, e,
      Finset.mem_union.mpr (Or.inr (by simp)), Or.inl ⟨rfl, rfl⟩⟩
  have hKSub : K ≤ G.supportGraph (T.erase e' ∪ {e}) := by
    exact sup_le hDelSub hEdgeSub
  exact hKconn.mono hKSub

/-- The fundamental-cycle exchange preserves the spanning-tree cardinality as well as
connectedness. -/
theorem isSpanningTree_exchange_of_path_edge [Nonempty V]
    {T : Finset E} {e e' : E}
    (hT : G.IsSpanningTree T) (he : e ∉ T) (he' : e' ∈ T)
    (p : (G.supportGraph T).Path (G.endAt e 0) (G.endAt e 1))
    (he'path : G.symEdge e' ∈ p.1.edges) :
    G.IsSpanningTree (T.erase e' ∪ {e}) := by
  refine ⟨G.connects_exchange_of_path_edge hT he' p he'path, ?_⟩
  have hcardErase : (T.erase e').card = T.card - 1 := by
    simp [he']
  have heNotErase : e ∉ T.erase e' := by
    intro heT
    exact he (Finset.mem_of_mem_erase heT)
  rw [Finset.card_union_of_disjoint]
  · have hpos : 0 < T.card := Finset.card_pos.mpr ⟨e', he'⟩
    have hTcard := hT.2
    rw [Finset.card_singleton, hcardErase]
    omega
  · exact Finset.disjoint_singleton_right.mpr heNotErase

/-- When the new edge is genuinely new in the simple support of its fundamental
path, that cycle supplies an internal replacement route for the removed edge. -/
theorem reachableIn_inside_exchange_of_path_edge_of_new_support
    {T : Finset E} {P : Setoid V} {u : V} {e e' : E}
    (he' : e' ∈ T)
    (p : (G.supportGraph T).Path (G.endAt e 0) (G.endAt e 1))
    (he'path : G.symEdge e' ∈ p.1.edges)
    (hnew : G.symEdge e ∉ p.1.edges)
    (he0 : P.r (G.endAt e 0) u) (he1 : P.r (G.endAt e 1) u)
    (hpath : ∀ f ∈ T, G.symEdge f ∈ p.1.edges →
      P.r (G.endAt f 0) u ∧ P.r (G.endAt f 1) u) :
    G.ReachableIn
      (G.insideEdges (T.erase e' ∪ {e}) P u)
      (G.endAt e' 0) (G.endAt e' 1) := by
  classical
  let U := G.insideEdges (T ∪ {e}) P u
  have hpEdges : ∀ z ∈ p.1.edges, z ∈ (G.supportGraph U).edgeSet := by
    intro z hz
    have hzT : z ∈ (G.supportGraph T).edgeSet :=
      p.1.edges_subset_edgeSet hz
    obtain ⟨f, hfT, hfz⟩ :=
      G.exists_edge_of_mem_supportGraph_edgeSet T hzT
    have hfInt := hpath f hfT (hfz ▸ hz)
    have hfU : f ∈ U := by
      apply (mem_insideEdges (G := G)).mpr
      exact ⟨Finset.mem_union_left _ hfT, hfInt.1, hfInt.2⟩
    rw [← SimpleGraph.mem_edgeFinset]
    rw [G.edgeFinset_supportGraph U]
    exact Finset.mem_image.mpr ⟨f, hfU, hfz⟩
  let pU : (G.supportGraph U).Path (G.endAt e 0) (G.endAt e 1) :=
    ⟨p.1.transfer _ hpEdges, p.2.transfer _⟩
  have hpUEdges : pU.1.edges = p.1.edges := by
    simp [pU]
  have heU : e ∈ U := by
    apply (mem_insideEdges (G := G)).mpr
    exact ⟨Finset.mem_union_right _ (by simp), he0, he1⟩
  have heAdj :
      (G.supportGraph U).Adj (G.endAt e 0) (G.endAt e 1) := by
    rw [G.supportGraph_adj_iff U (G.endAt e 0) (G.endAt e 1)]
    exact ⟨G.loopless e, e, heU, Or.inl ⟨rfl, rfl⟩⟩
  let c : (G.supportGraph U).Walk (G.endAt e 1) (G.endAt e 1) :=
    pU.1.cons heAdj.symm
  have hc : c.IsCycle := by
    rw [SimpleGraph.Walk.cons_isCycle_iff]
    refine ⟨pU.2, ?_⟩
    simpa [hpUEdges, symEdge, Sym2.eq_swap] using hnew
  have hzcycle : G.symEdge e' ∈ c.edges := by
    simp [c, hpUEdges, he'path]
  have he'Int := hpath e' he' he'path
  have he'U : e' ∈ U := by
    apply (mem_insideEdges (G := G)).mpr
    exact ⟨Finset.mem_union_left _ he', he'Int.1, he'Int.2⟩
  have he'Adj :
      (G.supportGraph U).Adj (G.endAt e' 0) (G.endAt e' 1) := by
    rw [G.supportGraph_adj_iff U (G.endAt e' 0) (G.endAt e' 1)]
    exact ⟨G.loopless e', e', he'U, Or.inl ⟨rfl, rfl⟩⟩
  have hdelReach :
      ((G.supportGraph U).deleteEdges ({G.symEdge e'} : Set (Sym2 V))).Reachable
        (G.endAt e' 0) (G.endAt e' 1) := by
    have hcycle :=
      (SimpleGraph.adj_and_reachable_delete_edges_iff_exists_cycle
        (G := G.supportGraph U) (v := G.endAt e' 0) (w := G.endAt e' 1)).2
        ⟨G.endAt e 1, c, hc, hzcycle⟩
    exact hcycle.2
  have hDelSub :
      (G.supportGraph U).deleteEdges ({G.symEdge e'} : Set (Sym2 V)) ≤
        G.supportGraph (G.insideEdges (T.erase e' ∪ {e}) P u) := by
    intro x y hxy
    rw [SimpleGraph.deleteEdges_adj] at hxy
    have hxyU := hxy.1
    have hnotz : s(x, y) ≠ G.symEdge e' := by simpa using hxy.2
    rw [G.supportGraph_adj_iff U x y] at hxyU
    rcases hxyU with ⟨hxyne, f, hfU, hends | hends⟩
    · have hfU' := (mem_insideEdges (G := G)).mp hfU
      rcases Finset.mem_union.mp hfU'.1 with hfT | hfE
      · have hsym : G.symEdge f = s(x, y) :=
          Sym2.eq_iff.mpr (Or.inl ⟨hends.1, hends.2⟩)
        have hfe' : f ≠ e' := by
          intro h
          subst f
          exact hnotz hsym.symm
        rw [G.supportGraph_adj_iff
          (G.insideEdges (T.erase e' ∪ {e}) P u) x y]
        exact ⟨hxyne, f,
          (mem_insideEdges (G := G)).mpr
            ⟨Finset.mem_union_left _ (Finset.mem_erase.mpr ⟨hfe', hfT⟩),
              hfU'.2.1, hfU'.2.2⟩,
          Or.inl hends⟩
      · have hfe : f = e := by simpa using hfE
        subst f
        rw [G.supportGraph_adj_iff
          (G.insideEdges (T.erase e' ∪ {e}) P u) x y]
        exact ⟨hxyne, e,
          (mem_insideEdges (G := G)).mpr
            ⟨Finset.mem_union_right _ (by simp), hfU'.2.1, hfU'.2.2⟩,
          Or.inl hends⟩
    · have hfU' := (mem_insideEdges (G := G)).mp hfU
      rcases Finset.mem_union.mp hfU'.1 with hfT | hfE
      · have hsym : G.symEdge f = s(x, y) :=
          Sym2.eq_iff.mpr (Or.inr ⟨hends.1, hends.2⟩)
        have hfe' : f ≠ e' := by
          intro h
          subst f
          exact hnotz hsym.symm
        rw [G.supportGraph_adj_iff
          (G.insideEdges (T.erase e' ∪ {e}) P u) x y]
        exact ⟨hxyne, f,
          (mem_insideEdges (G := G)).mpr
            ⟨Finset.mem_union_left _ (Finset.mem_erase.mpr ⟨hfe', hfT⟩),
              hfU'.2.1, hfU'.2.2⟩,
          Or.inr hends⟩
      · have hfe : f = e := by simpa using hfE
        subst f
        rw [G.supportGraph_adj_iff
          (G.insideEdges (T.erase e' ∪ {e}) P u) x y]
        exact ⟨hxyne, e,
          (mem_insideEdges (G := G)).mpr
            ⟨Finset.mem_union_right _ (by simp), hfU'.2.1, hfU'.2.2⟩,
          Or.inr hends⟩
  exact hdelReach.mono hDelSub

/-- The internal replacement route also covers the parallel-edge case, where the new
edge already has the simple support of the one-edge fundamental path. -/
theorem reachableIn_inside_exchange_of_path_edge [Nonempty V]
    {T : Finset E} {P : Setoid V} {u : V} {e e' : E}
    (hT : G.IsSpanningTree T) (he' : e' ∈ T)
    (p : (G.supportGraph T).Path (G.endAt e 0) (G.endAt e 1))
    (he'path : G.symEdge e' ∈ p.1.edges)
    (he0 : P.r (G.endAt e 0) u) (he1 : P.r (G.endAt e 1) u)
    (hpath : ∀ f ∈ T, G.symEdge f ∈ p.1.edges →
      P.r (G.endAt f 0) u ∧ P.r (G.endAt f 1) u) :
    G.ReachableIn
      (G.insideEdges (T.erase e' ∪ {e}) P u)
      (G.endAt e' 0) (G.endAt e' 1) := by
  by_cases hnew : G.symEdge e ∉ p.1.edges
  · exact G.reachableIn_inside_exchange_of_path_edge_of_new_support
      he' p he'path hnew he0 he1 hpath
  · push Not at hnew
    let H := G.supportGraph T
    have hHtree : H.IsTree := by
      simpa [H] using G.supportGraph_isTree_of_spanningTree hT
    have heEdge : G.symEdge e ∈ H.edgeSet :=
      p.1.edges_subset_edgeSet hnew
    have heAdj : H.Adj (G.endAt e 0) (G.endAt e 1) := by
      rw [← H.mem_edgeSet]
      simpa [H, symEdge] using heEdge
    let q : H.Path (G.endAt e 0) (G.endAt e 1) :=
      SimpleGraph.Path.singleton heAdj
    have hpq : p.1 = q.1 :=
      (hHtree.existsUnique_path _ _).unique p.2 q.2
    have hqEdges : q.1.edges = [G.symEdge e] := by
      simp [q, symEdge]
    have hsym : G.symEdge e' = G.symEdge e := by
      have : G.symEdge e' ∈ q.1.edges := by simpa [hpq] using he'path
      simpa [hqEdges] using this
    have hends :
        (G.endAt e 0 = G.endAt e' 0 ∧ G.endAt e 1 = G.endAt e' 1) ∨
          (G.endAt e 0 = G.endAt e' 1 ∧ G.endAt e 1 = G.endAt e' 0) := by
      simpa [symEdge] using (Sym2.eq_iff.mp hsym.symm)
    have heInside :
        e ∈ G.insideEdges (T.erase e' ∪ {e}) P u := by
      apply (mem_insideEdges (G := G)).mpr
      exact ⟨Finset.mem_union_right _ (by simp), he0, he1⟩
    apply SimpleGraph.Adj.reachable
    rw [G.supportGraph_adj_iff
      (G.insideEdges (T.erase e' ∪ {e}) P u)
      (G.endAt e' 0) (G.endAt e' 1)]
    refine ⟨G.loopless e', e, heInside, ?_⟩
    rcases hends with hends | hends
    · exact Or.inl ⟨hends.1, hends.2⟩
    · exact Or.inr ⟨hends.1, hends.2⟩

/-- A path plus a new edge gives a replacement route for any edge on the path.
This version does not assume that the old edge set is a tree. -/
theorem reachableIn_exchange_of_path_edge
    {T : Finset E} {e e' : E}
    (he' : e' ∈ T)
    (p : (G.supportGraph T).Path (G.endAt e 0) (G.endAt e 1))
    (he'path : G.symEdge e' ∈ p.1.edges) :
    G.ReachableIn (T.erase e' ∪ {e}) (G.endAt e' 0) (G.endAt e' 1) := by
  classical
  by_cases hnew : G.symEdge e ∉ p.1.edges
  · have hroute :=
      G.reachableIn_inside_exchange_of_path_edge_of_new_support
        (P := (⊤ : Setoid V)) (u := G.endAt e 0)
        he' p he'path hnew (by simp) (by simp)
        (by intro f hfT hfpath; exact ⟨by simp, by simp⟩)
    simpa [G.insideEdges_top] using hroute
  · push Not at hnew
    have hlen : p.1.length = 1 := by
      apply p.2.length_eq_one_of_mem_edges
      simpa [symEdge] using hnew
    have hpEdges : p.1.edges = [G.symEdge e] := by
      have hpEq := p.2.eq_adj_toWalk_of_mem_edges (by
        simpa [symEdge] using hnew)
      rw [hpEq]
      simp [symEdge]
    have hsym : G.symEdge e' = G.symEdge e := by
      simpa [hpEdges] using he'path
    have hends :
        (G.endAt e 0 = G.endAt e' 0 ∧ G.endAt e 1 = G.endAt e' 1) ∨
          (G.endAt e 0 = G.endAt e' 1 ∧ G.endAt e 1 = G.endAt e' 0) := by
      simpa [symEdge] using (Sym2.eq_iff.mp hsym.symm)
    apply SimpleGraph.Adj.reachable
    rw [G.supportGraph_adj_iff (T.erase e' ∪ {e})
      (G.endAt e' 0) (G.endAt e' 1)]
    refine ⟨G.loopless e', e, Finset.mem_union_right _ (by simp), ?_⟩
    rcases hends with hends | hends
    · exact Or.inl ⟨hends.1, hends.2⟩
    · exact Or.inr ⟨hends.1, hends.2⟩

/-- Every genuine edge on a path which, together with a cyclic edge, closes a
cycle is itself cyclic. -/
theorem cyclicEdge_of_mem_path_of_cyclic_edge
    {S : Finset E} {e f : E}
    (heCyc : G.IsCyclicEdge S e)
    (p : (G.supportGraph (S.erase e)).Path
      (G.endAt e 0) (G.endAt e 1))
    (hf : f ∈ S.erase e)
    (hfpath : G.symEdge f ∈ p.1.edges) :
    G.IsCyclicEdge S f := by
  have hroute :
      G.ReachableIn ((S.erase e).erase f ∪ {e})
        (G.endAt f 0) (G.endAt f 1) :=
    G.reachableIn_exchange_of_path_edge
      hf p hfpath
  have hsub : (S.erase e).erase f ∪ {e} ⊆ S.erase f := by
    intro x hx
    rcases Finset.mem_union.mp hx with hx | hx
    · have hx' := Finset.mem_erase.mp hx
      exact Finset.mem_erase.mpr
        ⟨hx'.1, Finset.mem_of_mem_erase hx'.2⟩
    · have hxe : x = e := by simpa using hx
      subst x
      have hef : e ≠ f := by
        intro h
        subst f
        exact (Finset.mem_erase.mp hf).1 rfl
      exact Finset.mem_erase.mpr ⟨hef, heCyc.1⟩
  exact ⟨Finset.mem_of_mem_erase hf, G.reachableIn_mono hsub hroute⟩

/-- Below the minimum superfluous level, deleting the chosen residual cyclic
edge cannot disconnect any current partition class.  Otherwise an edge on the
escaping cycle route would be a lower-level superfluous edge. -/
theorem reachableIn_inside_erase_of_min_superfluous [Nonempty V] {k : ℕ}
    {χ : E → Fin (k + 1)} {e : E} {m t : ℕ} {u v : V}
    (hsuper : G.IsSuperfluousAt χ e m)
    (hmin : ∀ f n, G.IsSuperfluousAt χ f n → m ≤ n)
    (htm : t < m)
    (h : G.ReachableIn
      (G.insideEdges (residualClass χ) (G.kaiserPartition χ t) u) u v) :
    G.ReachableIn
      (G.insideEdges ((residualClass χ).erase e)
        (G.kaiserPartition χ t) u) u v := by
  let P := G.kaiserPartition χ t
  by_cases heInside : e ∈ G.insideEdges (residualClass χ) P u
  · have heInside' := (mem_insideEdges (G := G)).mp heInside
    have heRoute :
        G.ReachableIn
          (G.insideEdges ((residualClass χ).erase e) P u)
          (G.endAt e 0) (G.endAt e 1) := by
      by_contra hnot
      have hnot' :
          ¬ G.ReachableIn
            (G.insideEdges ((residualClass χ).erase e) P (G.endAt e 0))
            (G.endAt e 0) (G.endAt e 1) := by
        intro hroute
        apply hnot
        rw [← G.insideEdges_eq_of_rel heInside'.2.1]
        exact hroute
      apply hsuper.1.2.elim_path
      intro p
      obtain ⟨f, hf, hfpath, hfCross⟩ :=
        G.exists_crossing_tree_edge_of_not_internal_reachable p hnot'
      have hfCyc :
          G.IsCyclicEdge (residualClass χ) f :=
        G.cyclicEdge_of_mem_path_of_cyclic_edge hsuper.1 p hf hfpath
      obtain ⟨n, hn⟩ :=
        G.exists_finiteLevel_of_not_rel (χ := χ) (n := t) hfCross
      have hnt : n < t := by
        by_contra hnotlt
        have htn : t ≤ n := Nat.le_of_not_gt hnotlt
        apply hfCross
        exact G.kaiserPartition_refines_of_le χ htn hn.1
      have hmn := hmin f n ⟨hfCyc, hn⟩
      omega
    have heCycInside :
        G.IsCyclicEdge
          (G.insideEdges (residualClass χ) P u) e := by
      refine ⟨heInside, ?_⟩
      rw [← G.insideEdges_erase]
      exact heRoute
    have h' := G.reachableIn_erase_of_cyclic heCycInside h
    rw [← G.insideEdges_erase] at h'
    exact h'
  · rw [G.insideEdges_erase, Finset.erase_eq_self.mpr heInside]
    exact h

omit [DecidableEq V] [DecidableEq E] in
/-- If every edge of T can already be traversed inside S, then every T-walk
can be traversed inside S. -/
theorem reachableIn_of_adj_reachable {S T : Finset E} {u v : V}
    (hstep : ∀ {x y : V}, (G.supportGraph T).Adj x y →
      G.ReachableIn S x y)
    (h : G.ReachableIn T u v) :
    G.ReachableIn S u v := by
  rcases h with ⟨p⟩
  induction p with
  | nil => exact SimpleGraph.Reachable.refl _
  | @cons x y z hxy p ih =>
      exact (hstep hxy).trans ih

theorem refineSetoid_residual_erase_eq_of_min_superfluous [Nonempty V] {k : ℕ}
    {χ : E → Fin (k + 1)} {e : E} {m t : ℕ}
    (hsuper : G.IsSuperfluousAt χ e m)
    (hmin : ∀ f n, G.IsSuperfluousAt χ f n → m ≤ n)
    (htm : t < m) :
    G.refineSetoid (G.kaiserPartition χ t) ((residualClass χ).erase e) =
      G.refineSetoid (G.kaiserPartition χ t) (residualClass χ) := by
  apply Setoid.ext
  intro u v
  change ((G.kaiserPartition χ t).r u v ∧
      G.ReachableIn
        (G.insideEdges ((residualClass χ).erase e)
          (G.kaiserPartition χ t) u) u v) ↔
    ((G.kaiserPartition χ t).r u v ∧
      G.ReachableIn
        (G.insideEdges (residualClass χ)
          (G.kaiserPartition χ t) u) u v)
  constructor
  · rintro ⟨huv, h⟩
    have hsub :
        G.insideEdges ((residualClass χ).erase e)
            (G.kaiserPartition χ t) u ⊆
          G.insideEdges (residualClass χ)
            (G.kaiserPartition χ t) u := by
      intro f hf
      have hf' := (mem_insideEdges (G := G)).mp hf
      exact (mem_insideEdges (G := G)).mpr
        ⟨Finset.mem_of_mem_erase hf'.1, hf'.2.1, hf'.2.2⟩
    exact ⟨huv, G.reachableIn_mono hsub h⟩
  · rintro ⟨huv, h⟩
    exact ⟨huv, G.reachableIn_inside_erase_of_min_superfluous
      hsuper hmin htm h⟩

omit [DecidableEq V] in
/-- Adding an edge whose ends are already internally connected in their P-class
does not alter refinement by that edge set. -/
theorem refineSetoid_union_singleton_eq_of_internal_reachable
    {S : Finset E} {P : Setoid V} {e : E}
    (hreach :
      G.ReachableIn (G.insideEdges S P (G.endAt e 0))
        (G.endAt e 0) (G.endAt e 1)) :
    G.refineSetoid P (S ∪ {e}) = G.refineSetoid P S := by
  apply Setoid.ext
  intro u v
  change (P.r u v ∧ G.ReachableIn (G.insideEdges (S ∪ {e}) P u) u v) ↔
    (P.r u v ∧ G.ReachableIn (G.insideEdges S P u) u v)
  have hiff :
      G.ReachableIn (G.insideEdges (S ∪ {e}) P u) u v ↔
        G.ReachableIn (G.insideEdges S P u) u v := by
    constructor
    · apply G.reachableIn_of_adj_reachable
      intro x y hxy
      rw [G.supportGraph_adj_iff (G.insideEdges (S ∪ {e}) P u) x y] at hxy
      rcases hxy with ⟨hxyne, f, hf, hends | hends⟩
      · have hf' := (mem_insideEdges (G := G)).mp hf
        rcases Finset.mem_union.mp hf'.1 with hfS | hfE
        · apply SimpleGraph.Adj.reachable
          rw [G.supportGraph_adj_iff (G.insideEdges S P u) x y]
          exact ⟨hxyne, f,
            (mem_insideEdges (G := G)).mpr ⟨hfS, hf'.2.1, hf'.2.2⟩,
            Or.inl hends⟩
        · have hfe : f = e := by simpa using hfE
          subst f
          have hEq :=
            G.insideEdges_eq_of_rel (S := S) (P := P) hf'.2.1
          have hroute :
              G.ReachableIn (G.insideEdges S P u)
                (G.endAt e 0) (G.endAt e 1) := by
            rw [← hEq]
            exact hreach
          simpa [ReachableIn, hends.1, hends.2] using hroute
      · have hf' := (mem_insideEdges (G := G)).mp hf
        rcases Finset.mem_union.mp hf'.1 with hfS | hfE
        · apply SimpleGraph.Adj.reachable
          rw [G.supportGraph_adj_iff (G.insideEdges S P u) x y]
          exact ⟨hxyne, f,
            (mem_insideEdges (G := G)).mpr ⟨hfS, hf'.2.1, hf'.2.2⟩,
            Or.inr hends⟩
        · have hfe : f = e := by simpa using hfE
          subst f
          have hEq :=
            G.insideEdges_eq_of_rel (S := S) (P := P) hf'.2.1
          have hroute :
              G.ReachableIn (G.insideEdges S P u)
                (G.endAt e 0) (G.endAt e 1) := by
            rw [← hEq]
            exact hreach
          simpa [ReachableIn, hends.1, hends.2] using hroute.symm
    · intro h
      have hsub :
          G.insideEdges S P u ⊆ G.insideEdges (S ∪ {e}) P u := by
        intro f hf
        have hf' := (mem_insideEdges (G := G)).mp hf
        exact (mem_insideEdges (G := G)).mpr
          ⟨Finset.mem_union_left _ hf'.1, hf'.2.1, hf'.2.2⟩
      exact G.reachableIn_mono hsub h
  constructor
  · rintro ⟨huv, h⟩
    exact ⟨huv, hiff.mp h⟩
  · rintro ⟨huv, h⟩
    exact ⟨huv, hiff.mpr h⟩

/-- If the whole fundamental path lies in one P-class, exchanging along it does
not change the refinement made by that tree color. -/
theorem refineSetoid_exchange_eq_of_path_internal [Nonempty V]
    {T : Finset E} {P : Setoid V} {e e' : E}
    (hT : G.IsSpanningTree T) (he' : e' ∈ T)
    (p : (G.supportGraph T).Path (G.endAt e 0) (G.endAt e 1))
    (he'path : G.symEdge e' ∈ p.1.edges)
    (heRel : P.r (G.endAt e 0) (G.endAt e 1))
    (hpath : ∀ f ∈ T, G.symEdge f ∈ p.1.edges →
      P.r (G.endAt f 0) (G.endAt e 0) ∧
        P.r (G.endAt f 1) (G.endAt e 0)) :
    G.refineSetoid P (T.erase e' ∪ {e}) = G.refineSetoid P T := by
  apply Setoid.ext
  intro u v
  change (P.r u v ∧
      G.ReachableIn (G.insideEdges (T.erase e' ∪ {e}) P u) u v) ↔
    (P.r u v ∧ G.ReachableIn (G.insideEdges T P u) u v)
  have hreach :
      G.ReachableIn (G.insideEdges (T.erase e' ∪ {e}) P u) u v ↔
        G.ReachableIn (G.insideEdges T P u) u v := by
    constructor
    · apply G.reachableIn_of_adj_reachable
      intro x y hxy
      rw [G.supportGraph_adj_iff
        (G.insideEdges (T.erase e' ∪ {e}) P u) x y] at hxy
      rcases hxy with ⟨hxyne, f, hf, hends | hends⟩
      · have hf' := (mem_insideEdges (G := G)).mp hf
        rcases Finset.mem_union.mp hf'.1 with hfT | hfE
        · have hfT' : f ∈ T := Finset.mem_of_mem_erase hfT
          apply SimpleGraph.Adj.reachable
          rw [G.supportGraph_adj_iff (G.insideEdges T P u) x y]
          exact ⟨hxyne, f,
            (mem_insideEdges (G := G)).mpr ⟨hfT', hf'.2.1, hf'.2.2⟩,
            Or.inl hends⟩
        · have hfe : f = e := by simpa using hfE
          subst f
          have hno : ∀ g ∈ T, G.symEdge g ∈ p.1.edges →
              P.r (G.endAt g 0) (G.endAt g 1) := by
            intro g hgT hgpath
            have hg := hpath g hgT hgpath
            exact P.trans hg.1 (P.symm hg.2)
          have hroute :
              G.ReachableIn (G.insideEdges T P u)
                (G.endAt e 0) (G.endAt e 1) :=
            G.reachableIn_inside_of_walk_of_no_crossing p hf'.2.1 hno
          simpa [ReachableIn, hends.1, hends.2] using hroute
      · have hf' := (mem_insideEdges (G := G)).mp hf
        rcases Finset.mem_union.mp hf'.1 with hfT | hfE
        · have hfT' : f ∈ T := Finset.mem_of_mem_erase hfT
          apply SimpleGraph.Adj.reachable
          rw [G.supportGraph_adj_iff (G.insideEdges T P u) x y]
          exact ⟨hxyne, f,
            (mem_insideEdges (G := G)).mpr ⟨hfT', hf'.2.1, hf'.2.2⟩,
            Or.inr hends⟩
        · have hfe : f = e := by simpa using hfE
          subst f
          have hno : ∀ g ∈ T, G.symEdge g ∈ p.1.edges →
              P.r (G.endAt g 0) (G.endAt g 1) := by
            intro g hgT hgpath
            have hg := hpath g hgT hgpath
            exact P.trans hg.1 (P.symm hg.2)
          have hroute :
              G.ReachableIn (G.insideEdges T P u)
                (G.endAt e 0) (G.endAt e 1) :=
            G.reachableIn_inside_of_walk_of_no_crossing p hf'.2.1 hno
          simpa [ReachableIn, hends.1, hends.2] using hroute.symm
    · apply G.reachableIn_of_adj_reachable
      intro x y hxy
      rw [G.supportGraph_adj_iff (G.insideEdges T P u) x y] at hxy
      rcases hxy with ⟨hxyne, f, hf, hends | hends⟩
      · have hf' := (mem_insideEdges (G := G)).mp hf
        by_cases hfe' : f = e'
        · subst f
          have he'Path := hpath e' he' he'path
          have he0u : P.r (G.endAt e 0) u :=
            P.trans (P.symm he'Path.1) hf'.2.1
          have he1u : P.r (G.endAt e 1) u :=
            P.trans (P.symm heRel) he0u
          have hpathU : ∀ g ∈ T, G.symEdge g ∈ p.1.edges →
              P.r (G.endAt g 0) u ∧ P.r (G.endAt g 1) u := by
            intro g hgT hgpath
            have hg := hpath g hgT hgpath
            exact ⟨P.trans hg.1 he0u, P.trans hg.2 he0u⟩
          have hroute :=
            G.reachableIn_inside_exchange_of_path_edge hT he' p he'path
              he0u he1u hpathU
          simpa [ReachableIn, hends.1, hends.2] using hroute
        · apply SimpleGraph.Adj.reachable
          rw [G.supportGraph_adj_iff
            (G.insideEdges (T.erase e' ∪ {e}) P u) x y]
          exact ⟨hxyne, f,
            (mem_insideEdges (G := G)).mpr
              ⟨Finset.mem_union_left _ (Finset.mem_erase.mpr ⟨hfe', hf'.1⟩),
                hf'.2.1, hf'.2.2⟩,
            Or.inl hends⟩
      · have hf' := (mem_insideEdges (G := G)).mp hf
        by_cases hfe' : f = e'
        · subst f
          have he'Path := hpath e' he' he'path
          have he0u : P.r (G.endAt e 0) u :=
            P.trans (P.symm he'Path.1) hf'.2.1
          have he1u : P.r (G.endAt e 1) u :=
            P.trans (P.symm heRel) he0u
          have hpathU : ∀ g ∈ T, G.symEdge g ∈ p.1.edges →
              P.r (G.endAt g 0) u ∧ P.r (G.endAt g 1) u := by
            intro g hgT hgpath
            have hg := hpath g hgT hgpath
            exact ⟨P.trans hg.1 he0u, P.trans hg.2 he0u⟩
          have hroute :=
            G.reachableIn_inside_exchange_of_path_edge hT he' p he'path
              he0u he1u hpathU
          simpa [ReachableIn, hends.1, hends.2] using hroute.symm
        · apply SimpleGraph.Adj.reachable
          rw [G.supportGraph_adj_iff
            (G.insideEdges (T.erase e' ∪ {e}) P u) x y]
          exact ⟨hxyne, f,
            (mem_insideEdges (G := G)).mpr
              ⟨Finset.mem_union_left _ (Finset.mem_erase.mpr ⟨hfe', hf'.1⟩),
                hf'.2.1, hf'.2.2⟩,
            Or.inr hends⟩
  constructor
  · rintro ⟨huv, h⟩
    exact ⟨huv, hreach.mp h⟩
  · rintro ⟨huv, h⟩
    exact ⟨huv, hreach.mpr h⟩

/-- Recoloring a residual edge with the color of a tree edge preserves all prefix
trees when the tree edge lies on the fundamental path of the residual edge. -/
theorem prefixTrees_swap_of_path_edge [Nonempty V] {k : ℕ}
    {χ : E → Fin (k + 1)} {i : Fin k} {e e' : E}
    (hprefix : G.PrefixTrees χ)
    (heRes : e ∈ residualClass χ)
    (he'T : e' ∈ colorClass χ i.castSucc)
    (p : (G.supportGraph (colorClass χ i.castSucc)).Path
      (G.endAt e 0) (G.endAt e 1))
    (he'path : G.symEdge e' ∈ p.1.edges) :
    G.PrefixTrees (swapColor χ e e') := by
  have hχe : χ e = Fin.last k := by
    exact mem_colorClass.mp heRes
  have hχe' : χ e' = i.castSucc := mem_colorClass.mp he'T
  have hcol : χ e ≠ χ e' := by
    rw [hχe, hχe']
    exact (Fin.castSucc_ne_last i).symm
  have hee' : e ≠ e' := by
    intro h
    subst e'
    exact hcol rfl
  intro a
  by_cases hai : a = i
  · subst a
    rw [show colorClass (swapColor χ e e') i.castSucc =
        (colorClass χ i.castSucc).erase e' ∪ {e} by
      simpa [hχe, hχe'] using colorClass_swap_right χ hee' hcol]
    apply G.isSpanningTree_exchange_of_path_edge
      (hprefix i) _ he'T p he'path
    intro heT
    exact (Finset.disjoint_left.mp
      (colorClass_disjoint χ (Fin.castSucc_ne_last i))
      heT heRes).elim
  · have hneLast : a.castSucc ≠ χ e := by
      rw [hχe]
      exact Fin.castSucc_ne_last a
    have hneTree : a.castSucc ≠ χ e' := by
      rw [hχe']
      exact fun h => hai (Fin.castSucc_injective _ h)
    rw [colorClass_swap_other χ hee' hneLast hneTree]
    exact hprefix a

omit [DecidableEq V] in
/-- Adding an edge whose ends were already connected does not change the component
partition. -/
theorem reachableIn_union_singleton_iff_of_reachable {S : Finset E} {e : E}
    (he : G.ReachableIn S (G.endAt e 0) (G.endAt e 1))
    (u v : V) :
    G.ReachableIn (S ∪ {e}) u v ↔ G.ReachableIn S u v := by
  constructor
  · apply G.reachableIn_of_adj_reachable
    intro x y hxy
    rw [G.supportGraph_adj_iff (S ∪ {e}) x y] at hxy
    rcases hxy with ⟨hxyne, f, hf, hends | hends⟩
    · rcases Finset.mem_union.mp hf with hfS | hfE
      · exact SimpleGraph.Adj.reachable <| by
          rw [G.supportGraph_adj_iff S x y]
          exact ⟨hxyne, f, hfS, Or.inl hends⟩
      · have hfe : f = e := by simpa using hfE
        subst f
        simpa [ReachableIn, hends.1, hends.2] using he
    · rcases Finset.mem_union.mp hf with hfS | hfE
      · exact SimpleGraph.Adj.reachable <| by
          rw [G.supportGraph_adj_iff S x y]
          exact ⟨hxyne, f, hfS, Or.inr hends⟩
      · have hfe : f = e := by simpa using hfE
        subst f
        have hrev := he.symm
        simpa [ReachableIn, hends.1, hends.2] using hrev
  · intro h
    exact h.mono (G.supportGraph_mono (by intro f hf; exact Finset.mem_union_left _ hf))

omit [DecidableEq V] in
/-- Deleting a cyclic edge and then adding an edge internal to the old components
leaves all reachability relations unchanged. -/
theorem reachableIn_erase_union_singleton_iff_of_cyclic_of_reachable
    {S : Finset E} {e f : E}
    (he : G.IsCyclicEdge S e)
    (hf : G.ReachableIn S (G.endAt f 0) (G.endAt f 1))
    (u v : V) :
    G.ReachableIn (S.erase e ∪ {f}) u v ↔ G.ReachableIn S u v := by
  have hf' : G.ReachableIn (S.erase e) (G.endAt f 0) (G.endAt f 1) :=
    G.reachableIn_erase_of_cyclic he hf
  rw [G.reachableIn_union_singleton_iff_of_reachable hf']
  constructor
  · intro h
    exact h.mono (G.supportGraph_mono (Finset.erase_subset _ _))
  · exact G.reachableIn_erase_of_cyclic he

omit [DecidableEq V] [DecidableEq E] in
/-- Pointwise equality of reachability gives equality of connected-component
cardinalities for arbitrary edge sets. -/
theorem connectedComponent_card_eq_of_reachable_iff
    {S T : Finset E}
    (h : ∀ u v : V, G.ReachableIn S u v ↔ G.ReachableIn T u v) :
    Nat.card (G.supportGraph S).ConnectedComponent =
      Nat.card (G.supportGraph T).ConnectedComponent := by
  let e :
      Quotient (G.supportGraph S).reachableSetoid ≃
        Quotient (G.supportGraph T).reachableSetoid :=
    Quotient.congr (Equiv.refl V) (by
      intro u v
      change (G.supportGraph S).Reachable u v ↔
        (G.supportGraph T).Reachable u v
      exact h u v)
  exact Nat.card_congr e

omit [DecidableEq V] [DecidableEq E] in
/-- Pointwise equality of reachability gives equality of the numbers of connected
components. -/
theorem residualComponents_eq_of_reachable_iff {k : ℕ}
    {χ χ' : E → Fin (k + 1)}
    (h : ∀ u v : V,
      G.ReachableIn (residualClass χ') u v ↔
        G.ReachableIn (residualClass χ) u v) :
    G.residualComponents χ' = G.residualComponents χ := by
  change Nat.card (G.supportGraph (residualClass χ')).ConnectedComponent =
    Nat.card (G.supportGraph (residualClass χ)).ConnectedComponent
  exact G.connectedComponent_card_eq_of_reachable_iff h

omit [DecidableEq V] in
/-- Adding an edge between two distinct components strictly decreases the number of
components. -/
theorem connectedComponent_card_lt_of_union_singleton_of_not_reachable
    {S : Finset E} {e : E}
    (hnot : ¬ G.ReachableIn S (G.endAt e 0) (G.endAt e 1)) :
    Nat.card (G.supportGraph (S ∪ {e})).ConnectedComponent <
      Nat.card (G.supportGraph S).ConnectedComponent := by
  let H := G.supportGraph S
  let H' := G.supportGraph (S ∪ {e})
  have hle : H ≤ H' := by
    exact G.supportGraph_mono (by
      intro f hf
      exact Finset.mem_union_left _ hf)
  let f : H.ConnectedComponent → H'.ConnectedComponent :=
    SimpleGraph.ConnectedComponent.map (SimpleGraph.Hom.ofLE hle)
  have hsurj : Function.Surjective f :=
    SimpleGraph.ConnectedComponent.surjective_map_ofLE hle
  have hlecard :
      Nat.card H'.ConnectedComponent ≤ Nat.card H.ConnectedComponent :=
    Nat.card_le_card_of_surjective f hsurj
  apply lt_of_le_of_ne hlecard
  intro hEq
  have hbij : Function.Bijective f := by
    apply (Nat.bijective_iff_surjective_and_card f).2
    exact ⟨hsurj, hEq.symm⟩
  have hsame :
      H'.connectedComponentMk (G.endAt e 0) =
        H'.connectedComponentMk (G.endAt e 1) := by
    apply SimpleGraph.ConnectedComponent.sound
    apply SimpleGraph.Adj.reachable
    dsimp [H']
    rw [G.supportGraph_adj_iff (S ∪ {e}) (G.endAt e 0) (G.endAt e 1)]
    exact ⟨G.loopless e, e, Finset.mem_union_right _ (by simp),
      Or.inl ⟨rfl, rfl⟩⟩
  have hmap :
      f (H.connectedComponentMk (G.endAt e 0)) =
        f (H.connectedComponentMk (G.endAt e 1)) := by
    simpa [f] using hsame
  have hold :
      H.connectedComponentMk (G.endAt e 0) =
        H.connectedComponentMk (G.endAt e 1) :=
    hbij.1 hmap
  apply hnot
  exact SimpleGraph.ConnectedComponent.exact hold

theorem residualClass_swap_of_residual_of_tree {k : ℕ}
    {χ : E → Fin (k + 1)} {i : Fin k} {e e' : E}
    (heRes : e ∈ residualClass χ)
    (he'T : e' ∈ colorClass χ i.castSucc) :
    residualClass (swapColor χ e e') =
      (residualClass χ).erase e ∪ {e'} := by
  have hχe : χ e = Fin.last k := mem_colorClass.mp heRes
  have hχe' : χ e' = i.castSucc := mem_colorClass.mp he'T
  have hcol : χ e ≠ χ e' := by
    rw [hχe, hχe']
    exact (Fin.castSucc_ne_last i).symm
  have hee' : e ≠ e' := by
    intro h
    subst e'
    exact hcol rfl
  simpa [residualClass, hχe] using
    (colorClass_swap_left χ hee' hcol)

omit [DecidableEq V] in
theorem residualComponents_swap_eq_of_cyclic_of_reachable {k : ℕ}
    {χ : E → Fin (k + 1)} {i : Fin k} {e e' : E}
    (heRes : e ∈ residualClass χ)
    (he'T : e' ∈ colorClass χ i.castSucc)
    (heCyc : G.IsCyclicEdge (residualClass χ) e)
    (he'Reach :
      G.ReachableIn (residualClass χ) (G.endAt e' 0) (G.endAt e' 1)) :
    G.residualComponents (swapColor χ e e') =
      G.residualComponents χ := by
  apply G.residualComponents_eq_of_reachable_iff
  intro u v
  rw [residualClass_swap_of_residual_of_tree heRes he'T]
  exact G.reachableIn_erase_union_singleton_iff_of_cyclic_of_reachable
    heCyc he'Reach u v

omit [DecidableEq V] in
/-- In the unchanged-component case, the tree edge moved to the residual color is
itself cyclic: after deleting it, the old residual graph with the old cyclic edge
deleted remains. -/
theorem cyclicEdge_swap_of_cyclic_of_reachable {k : ℕ}
    {χ : E → Fin (k + 1)} {i : Fin k} {e e' : E}
    (heRes : e ∈ residualClass χ)
    (he'T : e' ∈ colorClass χ i.castSucc)
    (heCyc : G.IsCyclicEdge (residualClass χ) e)
    (he'Reach :
      G.ReachableIn (residualClass χ) (G.endAt e' 0) (G.endAt e' 1)) :
    G.IsCyclicEdge (residualClass (swapColor χ e e')) e' := by
  have hχe : χ e = Fin.last k := mem_colorClass.mp heRes
  have hχe' : χ e' = i.castSucc := mem_colorClass.mp he'T
  have hee' : e ≠ e' := by
    intro h
    subst e'
    have : Fin.last k = i.castSucc := hχe.symm.trans hχe'
    exact (Fin.castSucc_ne_last i).symm this
  have he'NotRes : e' ∉ residualClass χ := by
    intro he'R
    exact (Finset.disjoint_left.mp
      (colorClass_disjoint χ (Fin.castSucc_ne_last i)) he'T he'R).elim
  rw [residualClass_swap_of_residual_of_tree heRes he'T]
  constructor
  · simp
  · have herase :
        (((residualClass χ).erase e ∪ {e'}).erase e') =
          (residualClass χ).erase e := by
        ext f
        simp [hee'.symm, he'NotRes]
    rw [herase]
    exact G.reachableIn_erase_of_cyclic heCyc he'Reach

omit [DecidableEq V] in
theorem residualComponents_swap_lt_of_cyclic_of_not_reachable {k : ℕ}
    {χ : E → Fin (k + 1)} {i : Fin k} {e e' : E}
    (heRes : e ∈ residualClass χ)
    (he'T : e' ∈ colorClass χ i.castSucc)
    (heCyc : G.IsCyclicEdge (residualClass χ) e)
    (he'NotReach :
      ¬ G.ReachableIn (residualClass χ) (G.endAt e' 0) (G.endAt e' 1)) :
    G.residualComponents (swapColor χ e e') <
      G.residualComponents χ := by
  have hnotErase :
      ¬ G.ReachableIn ((residualClass χ).erase e)
        (G.endAt e' 0) (G.endAt e' 1) := by
    intro h
    apply he'NotReach
    exact h.mono (G.supportGraph_mono (Finset.erase_subset _ _))
  have hlt :=
    G.connectedComponent_card_lt_of_union_singleton_of_not_reachable hnotErase
  have hEraseEq :
      Nat.card (G.supportGraph ((residualClass χ).erase e)).ConnectedComponent =
        Nat.card (G.supportGraph (residualClass χ)).ConnectedComponent := by
    apply G.connectedComponent_card_eq_of_reachable_iff
    intro u v
    constructor
    · intro h
      exact h.mono (G.supportGraph_mono (Finset.erase_subset _ _))
    · exact G.reachableIn_erase_of_cyclic heCyc
  change Nat.card
      (G.supportGraph (residualClass (swapColor χ e e'))).ConnectedComponent <
    Nat.card (G.supportGraph (residualClass χ)).ConnectedComponent
  rw [residualClass_swap_of_residual_of_tree heRes he'T]
  exact hlt.trans_le hEraseEq.le

omit [DecidableEq V] [DecidableEq E] in
/-- Level zero means that the endpoints lie in different residual components. -/
theorem not_reachable_residual_of_level_zero [Nonempty V] {k : ℕ}
    {χ : E → Fin (k + 1)} {e : E}
    (hprefix : G.PrefixTrees χ)
    (hdisc : ¬ G.Connects (residualClass χ))
    (hlev : G.HasFiniteLevel χ e 0) :
    ¬ G.ReachableIn (residualClass χ) (G.endAt e 0) (G.endAt e 1) := by
  have hP1 := G.first_partition_is_residual_components χ hprefix hdisc
  intro hreach
  apply hlev.2
  rw [hP1]
  change (⊤ : Setoid V).r (G.endAt e 0) (G.endAt e 1) ∧
    G.ReachableIn (G.insideEdges (residualClass χ) ⊤ (G.endAt e 0))
      (G.endAt e 0) (G.endAt e 1)
  refine ⟨by simp, ?_⟩
  rw [G.insideEdges_top]
  exact hreach

omit [DecidableEq V] [DecidableEq E] in
/-- Every positive-level edge has both ends in one residual component. -/
theorem reachable_residual_of_positive_level [Nonempty V] {k : ℕ}
    {χ : E → Fin (k + 1)} {e : E} {j : ℕ}
    (hprefix : G.PrefixTrees χ)
    (hdisc : ¬ G.Connects (residualClass χ))
    (hj : 0 < j)
    (hlev : G.HasFiniteLevel χ e j) :
    G.ReachableIn (residualClass χ) (G.endAt e 0) (G.endAt e 1) := by
  have hP1 := G.first_partition_is_residual_components χ hprefix hdisc
  have hrel1 :
      (G.kaiserPartition χ 1).r (G.endAt e 0) (G.endAt e 1) :=
    G.kaiserPartition_refines_of_le χ (Nat.succ_le_iff.mpr hj) hlev.1
  rw [hP1] at hrel1
  simpa [G.insideEdges_top] using hrel1.2

omit [DecidableEq V] in
/-- If S is connected inside the P-class of u, then its internal edge objects
contain a tree on that class.  The proof takes a simple tree in the induced support
graph and then chooses one genuine multiedge above each of its edges. -/
theorem exists_internal_tree_subset [Nonempty V] (S : Finset E) (P : Setoid V) (u : V)
    (hS : G.InternallyConnected S P) :
    ∃ T : Finset E,
      T ⊆ G.insideEdges S P u ∧
        T.card + 1 = Nat.card {v : V // P.r v u} := by
  classical
  let s : Set V := {v | P.r v u}
  let H₀ : SimpleGraph V := G.supportGraph (G.insideEdges S P u)
  let Hᵢ : SimpleGraph s := H₀.induce s
  letI : Nonempty s := ⟨⟨u, P.refl u⟩⟩
  have hconn : Hᵢ.Connected := by
    simpa [Hᵢ, H₀, s] using G.inside_induce_connected S P u hS
  obtain ⟨H, hHHᵢ, hHtree⟩ := hconn.exists_isTree_le
  letI : Fintype H.edgeSet := Fintype.ofFinite _
  have hpre : ∀ z : H.edgeFinset,
      ∃ e ∈ G.insideEdges S P u,
        G.symEdge e = Sym2.map (fun v : s => v.1) z.1 := by
    intro z
    rcases z with ⟨z, hz⟩
    induction z using Sym2.inductionOn with
    | _ a b =>
        have hab : H.Adj a b := by
          rw [← H.mem_edgeSet, ← SimpleGraph.mem_edgeFinset]
          exact hz
        have habᵢ : Hᵢ.Adj a b := hHHᵢ hab
        change H₀.Adj a.1 b.1 at habᵢ
        dsimp [H₀] at habᵢ
        rw [G.supportGraph_adj_iff (G.insideEdges S P u) a.1 b.1] at habᵢ
        rcases habᵢ with ⟨_, e, he, hends | hends⟩
        · refine ⟨e, he, ?_⟩
          simp only [symEdge, Sym2.map_mk]
          exact Sym2.eq_iff.mpr (Or.inl ⟨hends.1, hends.2⟩)
        · refine ⟨e, he, ?_⟩
          simp only [symEdge, Sym2.map_mk]
          exact Sym2.eq_iff.mpr (Or.inr ⟨hends.1, hends.2⟩)
  choose f hfS hfEq using hpre
  let T : Finset E := Finset.univ.image f
  have hTS : T ⊆ G.insideEdges S P u := by
    intro e he
    rcases Finset.mem_image.mp he with ⟨z, _, rfl⟩
    exact hfS z
  have hmapinj :
      Function.Injective (Sym2.map (fun v : s => v.1)) := by
    exact (Function.Embedding.subtype (fun v : V => v ∈ s)).sym2Map.injective
  have hfinj : Function.Injective f := by
    intro z w hzw
    apply Subtype.ext
    apply hmapinj
    calc
      Sym2.map (fun v : s => v.1) z.1 = G.symEdge (f z) := (hfEq z).symm
      _ = G.symEdge (f w) := congrArg G.symEdge hzw
      _ = Sym2.map (fun v : s => v.1) w.1 := hfEq w
  have hcard : T.card = H.edgeFinset.card := by
    calc
      T.card = (Finset.univ : Finset H.edgeFinset).card := by
        exact Finset.card_image_of_injective _ hfinj
      _ = H.edgeFinset.card := by simp
  refine ⟨T, hTS, ?_⟩
  rw [hcard]
  change H.edgeFinset.card + 1 = Nat.card s
  rw [Nat.card_eq_fintype_card]
  exact hHtree.card_edgeFinset

/-- A relation-class described using a chosen representative is the same finite type as
the corresponding fiber of the quotient map. -/
noncomputable def classFiberEquiv (P : Setoid V) (q : Quotient P) :
    {v : V // P.r v (Quotient.out q)} ≃
      {v : V // Quotient.mk P v = q} where
  toFun v :=
    ⟨v.1, (Quotient.sound v.2).trans (Quotient.out_eq q)⟩
  invFun v :=
    ⟨v.1, Quotient.eq'.mp (v.2.trans (Quotient.out_eq q).symm)⟩
  left_inv _ := Subtype.ext rfl
  right_inv _ := Subtype.ext rfl

/-- The quotient fibers, tagged by their quotient vertex, are just the original
vertex type. -/
noncomputable def quotientSigmaEquiv (P : Setoid V) :
    (Σ q : Quotient P, {v : V // Quotient.mk P v = q}) ≃ V where
  toFun x := x.2.1
  invFun v := ⟨Quotient.mk P v, v, rfl⟩
  left_inv x := by
    rcases x with ⟨q, v, hv⟩
    cases hv
    rfl
  right_inv v := rfl

omit [DecidableEq V] in
theorem sum_card_setoid_classes (P : Setoid V) :
    (∑ q : Quotient P, Nat.card {v : V // P.r v (Quotient.out q)}) =
      Fintype.card V := by
  classical
  calc
    (∑ q : Quotient P, Nat.card {v : V // P.r v (Quotient.out q)}) =
        ∑ q : Quotient P, Nat.card {v : V // Quotient.mk P v = q} := by
      apply Finset.sum_congr rfl
      intro q _
      exact Nat.card_congr (classFiberEquiv P q)
    _ = Nat.card (Σ q : Quotient P, {v : V // Quotient.mk P v = q}) := by
      symm
      exact Nat.card_sigma
    _ = Nat.card V := Nat.card_congr (quotientSigmaEquiv P)
    _ = Fintype.card V := Nat.card_eq_fintype_card

omit [DecidableEq V] in
/-- Kaiser's counting equality: a spanning tree that is connected inside every
partition class has exactly one fewer crossing edge than there are classes. -/
theorem crossingClass_card_eq_of_spanningTree_of_internal [Nonempty V]
    (S : Finset E) (P : Setoid V)
    (hTree : G.IsSpanningTree S) (hInt : G.InternallyConnected S P) :
    (G.crossingClass S P).card = Nat.card (Quotient P) - 1 := by
  classical
  letI : Nonempty (Quotient P) := Nonempty.map (Quotient.mk P) inferInstance
  choose F hFsub hFcard using
    fun q : Quotient P =>
      G.exists_internal_tree_subset S P (Quotient.out q) hInt
  have hpair :
      (↑(Finset.univ : Finset (Quotient P)) : Set (Quotient P)).PairwiseDisjoint F := by
    intro q _ r _ hqr
    apply Finset.disjoint_left.2
    intro e heq her
    have heq' := hFsub q heq
    have her' := hFsub r her
    have hq := ((mem_insideEdges (G := G)).mp heq').2.1
    have hr := ((mem_insideEdges (G := G)).mp her').2.1
    have hrel : P.r (Quotient.out q) (Quotient.out r) :=
      P.trans (P.symm hq) hr
    apply hqr
    calc
      q = Quotient.mk P (Quotient.out q) := (Quotient.out_eq q).symm
      _ = Quotient.mk P (Quotient.out r) := Quotient.sound hrel
      _ = r := Quotient.out_eq r
  let I : Finset E := Finset.univ.biUnion F
  have hIcard : I.card = ∑ q : Quotient P, (F q).card := by
    simpa [I] using Finset.card_biUnion hpair
  have hcrossI : Disjoint (G.crossingClass S P) I := by
    apply Finset.disjoint_left.2
    intro e heCross heI
    rcases Finset.mem_biUnion.mp heI with ⟨q, _, heq⟩
    have heq' := hFsub q heq
    have hi := (mem_insideEdges (G := G)).mp heq'
    exact ((mem_crossingClass (G := G)).mp heCross).2
      (P.trans hi.2.1 (P.symm hi.2.2))
  have hUnionSub : G.crossingClass S P ∪ I ⊆ S := by
    intro e he
    rcases Finset.mem_union.mp he with heCross | heI
    · exact ((mem_crossingClass (G := G)).mp heCross).1
    · rcases Finset.mem_biUnion.mp heI with ⟨q, _, heq⟩
      exact ((mem_insideEdges (G := G)).mp (hFsub q heq)).1
  have hsum :
      (∑ q : Quotient P, (F q).card) + Nat.card (Quotient P) =
        Fintype.card V := by
    calc
      (∑ q : Quotient P, (F q).card) + Nat.card (Quotient P) =
          (∑ q : Quotient P, (F q).card) + ∑ q : Quotient P, 1 := by
        simp [Nat.card_eq_fintype_card]
      _ = ∑ q : Quotient P, ((F q).card + 1) := by
        rw [Finset.sum_add_distrib]
      _ = ∑ q : Quotient P,
          Nat.card {v : V // P.r v (Quotient.out q)} := by
        apply Finset.sum_congr rfl
        intro q _
        exact hFcard q
      _ = Fintype.card V := sum_card_setoid_classes (V := V) P
  have hupper :
      (G.crossingClass S P).card + ∑ q : Quotient P, (F q).card ≤ S.card := by
    calc
      (G.crossingClass S P).card + ∑ q : Quotient P, (F q).card =
          (G.crossingClass S P ∪ I).card := by
        rw [← hIcard]
        exact (Finset.card_union_of_disjoint hcrossI).symm
      _ ≤ S.card := Finset.card_le_card hUnionSub
  have hlow :
      Nat.card (Quotient P) - 1 ≤ (G.crossingClass S P).card := by
    let Q := G.quotientGraph S P
    obtain ⟨T, hTuniv, hTtree⟩ :=
      Q.exists_isSpanningTree_subset_of_connects Finset.univ
        (G.quotientGraph_connected_of_connects S P hTree.1)
    have hTle : T.card ≤ (Finset.univ :
        Finset {e : E // e ∈ G.crossingClass S P}).card :=
      Finset.card_le_card hTuniv
    have hcard : T.card + 1 = Nat.card (Quotient P) := by
      simpa [Q, Nat.card_eq_fintype_card] using hTtree.2
    have hTcard : T.card = Nat.card (Quotient P) - 1 := by omega
    rw [← hTcard]
    simpa using hTle
  have hpos : 0 < Nat.card (Quotient P) := Nat.card_pos
  have hTreeCard := hTree.2
  have hupper' :
      (G.crossingClass S P).card ≤ Nat.card (Quotient P) - 1 := by
    omega
  exact le_antisymm hupper' hlow

omit [DecidableEq V] in
/-- Every connected edge set has at least one crossing edge per non-root quotient
class.  This is the elementary lower-bound half of the partition count: contract the
partition classes and take a spanning tree in the contracted multigraph. -/
theorem quotient_card_sub_one_le_crossingClass_card [Nonempty V]
    (S : Finset E) (P : Setoid V) (hS : G.Connects S) :
    Nat.card (Quotient P) - 1 ≤ (G.crossingClass S P).card := by
  classical
  letI : Nonempty (Quotient P) := Nonempty.map (Quotient.mk P) inferInstance
  let Q := G.quotientGraph S P
  obtain ⟨T, hTuniv, hTtree⟩ :=
    Q.exists_isSpanningTree_subset_of_connects Finset.univ
      (G.quotientGraph_connected_of_connects S P hS)
  have hTle : T.card ≤ (Finset.univ :
      Finset {e : E // e ∈ G.crossingClass S P}).card :=
    Finset.card_le_card hTuniv
  have hcard : T.card + 1 = Nat.card (Quotient P) := by
    simpa [Q, Nat.card_eq_fintype_card] using hTtree.2
  have hTcard : T.card = Nat.card (Quotient P) - 1 := by omega
  rw [← hTcard]
  simpa using hTle

omit [DecidableEq V] in
theorem quotient_card_sub_one_le_crossingEdges_card [Nonempty V]
    (S : Finset E) (P : Setoid V) (hS : G.Connects S) :
    Nat.card (Quotient P) - 1 ≤ (G.crossingEdges P).card := by
  exact (G.quotient_card_sub_one_le_crossingClass_card S P hS).trans
    (Finset.card_le_card (G.crossingClass_subset_crossingEdges S P))

omit [DecidableEq V] in
/-- The easy direction of Nash-Williams--Tutte: disjoint spanning trees supply disjoint
crossing-edge sets for every partition. -/
theorem satisfiesTreePackingCondition_of_hasTreePacking [Nonempty V] {k : ℕ}
    (hpack : G.HasTreePacking k) :
    G.SatisfiesTreePackingCondition k := by
  classical
  rcases hpack with ⟨T, htree, hdisj⟩
  intro P
  let C : Fin k → Finset E := fun i => G.crossingClass (T i) P
  have hCsub : ∀ i : Fin k, C i ⊆ G.crossingEdges P := by
    intro i
    exact G.crossingClass_subset_crossingEdges (T i) P
  have hpair :
      (↑(Finset.univ : Finset (Fin k)) : Set (Fin k)).PairwiseDisjoint C := by
    intro i _ j _ hij
    apply Finset.disjoint_left.2
    intro e hei hej
    have heiT : e ∈ T i := ((mem_crossingClass (G := G)).mp hei).1
    have hejT : e ∈ T j := ((mem_crossingClass (G := G)).mp hej).1
    exact (Finset.disjoint_left.mp (hdisj i j hij) heiT hejT).elim
  have hlow : ∀ i : Fin k,
      Nat.card (Quotient P) - 1 ≤ (C i).card := by
    intro i
    exact G.quotient_card_sub_one_le_crossingClass_card (T i) P (htree i).1
  let U : Finset E := Finset.univ.biUnion C
  have hUsub : U ⊆ G.crossingEdges P := by
    intro e he
    rcases Finset.mem_biUnion.mp he with ⟨i, _, hei⟩
    exact hCsub i hei
  calc
    k * (Nat.card (Quotient P) - 1) =
        ∑ i : Fin k, (Nat.card (Quotient P) - 1) := by simp
    _ ≤ ∑ i : Fin k, (C i).card := by
      exact Finset.sum_le_sum fun i _ => hlow i
    _ = U.card := by
      symm
      simpa [U] using (Finset.card_biUnion hpair)
    _ ≤ (G.crossingEdges P).card := Finset.card_le_card hUsub

/-- At a stable Kaiser partition, the partition inequality forces a cyclic residual
edge crossing that partition; hence that edge has a finite level and is superfluous. -/
theorem hasSuperfluousEdge_of_condition_of_disconnected [Nonempty V] {k : ℕ}
    {χ : E → Fin (k + 1)}
    (hprefix : G.PrefixTrees χ)
    (hdisc : ¬ G.Connects (residualClass χ))
    (hcond : G.SatisfiesTreePackingCondition (k + 1)) :
    G.HasSuperfluousEdge χ := by
  classical
  obtain ⟨n, hstable⟩ := G.exists_stable_kaiserPartition χ
  let P := G.kaiserPartition χ n
  have hInt : ∀ i : Fin (k + 1),
      G.InternallyConnected (colorClass χ i) P := by
    intro i
    exact G.internallyConnected_of_stable hstable i
  have hprefixCross : ∀ i : Fin k,
      (G.crossingClass (colorClass χ i.castSucc) P).card =
        Nat.card (Quotient P) - 1 := by
    intro i
    exact G.crossingClass_card_eq_of_spanningTree_of_internal
      (colorClass χ i.castSucc) P (hprefix i) (hInt i.castSucc)
  have hprefixSum :
      (∑ i : Fin k,
        (G.crossingClass (colorClass χ i.castSucc) P).card) =
        k * (Nat.card (Quotient P) - 1) := by
    simp_rw [hprefixCross]
    simp
  have hcondP := hcond P
  have htotal := G.crossingEdges_card_eq_sum_crossingClass χ P
  rw [htotal, Fin.sum_univ_castSucc, hprefixSum] at hcondP
  change (k + 1) * (Nat.card (Quotient P) - 1) ≤
      k * (Nat.card (Quotient P) - 1) +
        (G.crossingClass (residualClass χ) P).card at hcondP
  have hresge :
      Nat.card (Quotient P) - 1 ≤
        (G.crossingClass (residualClass χ) P).card := by
    have hcancel :
        k * (Nat.card (Quotient P) - 1) + (Nat.card (Quotient P) - 1) ≤
          k * (Nat.card (Quotient P) - 1) +
            (G.crossingClass (residualClass χ) P).card := by
      simpa [Nat.add_mul] using hcondP
    exact Nat.le_of_add_le_add_left hcancel
  let Q := G.quotientGraph (residualClass χ) P
  have hQdisc : ¬ Q.Connects Finset.univ := by
    intro hQ
    apply hdisc
    exact G.connects_of_internal_of_quotient_connects
      (residualClass χ) P (hInt (Fin.last k)) hQ
  letI : Nonempty (Quotient P) := Nonempty.map (Quotient.mk P) inferInstance
  have hcardQ :
      Fintype.card (Quotient P) - 1 ≤
        (Finset.univ :
          Finset {e : E // e ∈ G.crossingClass (residualClass χ) P}).card := by
    simpa [Nat.card_eq_fintype_card] using hresge
  obtain ⟨e, heQ⟩ := Q.exists_cyclic_of_disconnected_of_card_ge
    Finset.univ hQdisc hcardQ
  have hecyc : G.IsCyclicEdge (residualClass χ) e.1 :=
    G.cyclicEdge_of_quotient_cyclic_of_internal (hInt (Fin.last k)) heQ
  have hnotP :
      ¬ P.r (G.endAt e.1 0) (G.endAt e.1 1) :=
    ((mem_crossingClass (G := G)).mp e.2).2
  obtain ⟨m, hm⟩ := G.exists_finiteLevel_of_not_rel (χ := χ) hnotP
  exact ⟨e.1, m, hecyc, hm⟩

/-- The first exchange choice in Kaiser: a superfluous residual edge of level m
finds a prefix-tree edge on the corresponding tree path whose level is smaller. -/
theorem exists_lower_level_tree_edge_of_superfluous [Nonempty V] {k : ℕ}
    {χ : E → Fin (k + 1)} {e : E} {m : ℕ}
    (hprefix : G.PrefixTrees χ)
    (hsuper : G.IsSuperfluousAt χ e m) :
    ∃ i : Fin k, ∃ e' : E, ∃ j : ℕ,
      e' ∈ colorClass χ i.castSucc ∧
        j < m ∧ G.HasFiniteLevel χ e' j := by
  classical
  let P := G.kaiserPartition χ m
  have hlev := hsuper.2
  have heRes : e ∈ residualClass χ := hsuper.1.1
  have hsome : ∃ c : Fin (k + 1),
      G.firstDisconnectedColor χ P = some c := by
    cases hopt : G.firstDisconnectedColor χ P with
    | none =>
        exfalso
        apply hlev.2
        change (G.refineOnce χ P).r (G.endAt e 0) (G.endAt e 1)
        rw [refineOnce, hopt]
        exact hlev.1
    | some c => exact ⟨c, rfl⟩
  obtain ⟨c, hc⟩ := hsome
  have hnotRoute :
      ¬ G.ReachableIn (G.insideEdges (colorClass χ c) P (G.endAt e 0))
        (G.endAt e 0) (G.endAt e 1) := by
    intro hroute
    apply hlev.2
    change (G.refineOnce χ P).r (G.endAt e 0) (G.endAt e 1)
    rw [refineOnce, hc]
    exact ⟨hlev.1, hroute⟩
  have hcLast : c ≠ Fin.last k := by
    intro hlast
    subst c
    apply hnotRoute
    have heInside :
        e ∈ G.insideEdges (residualClass χ) P (G.endAt e 0) := by
      apply (mem_insideEdges (G := G)).mpr
      exact ⟨heRes, P.refl _, P.symm hlev.1⟩
    have heInside' :
        e ∈ G.insideEdges (colorClass χ (Fin.last k)) P (G.endAt e 0) := by
      simpa [residualClass] using heInside
    apply SimpleGraph.Adj.reachable
    rw [G.supportGraph_adj_iff
      (G.insideEdges (colorClass χ (Fin.last k)) P (G.endAt e 0))
      (G.endAt e 0) (G.endAt e 1)]
    exact ⟨G.loopless e, e, heInside', Or.inl ⟨rfl, rfl⟩⟩
  rcases Fin.eq_castSucc_or_eq_last c with ⟨i, rfl⟩ | rfl
  · have hreach :
        (G.supportGraph (colorClass χ i.castSucc)).Reachable
          (G.endAt e 0) (G.endAt e 1) :=
      (hprefix i).1.preconnected _ _
    apply hreach.elim_path
    intro p
    obtain ⟨e', he'T, he'path, he'cross⟩ :=
      G.exists_crossing_tree_edge_of_not_internal_reachable p hnotRoute
    obtain ⟨j, hj⟩ :=
      G.exists_finiteLevel_of_not_rel (χ := χ) (n := m) he'cross
    have hjm : j < m := by
      by_contra hnot
      have hmj : m ≤ j := Nat.le_of_not_gt hnot
      apply he'cross
      exact G.kaiserPartition_refines_of_le χ hmj hj.1
    exact ⟨i, e', j, he'T, hjm, hj⟩
  · exact (hcLast rfl).elim

/-- The same exchange choice, retaining the fundamental tree path needed for the
actual recoloring. -/
theorem exists_lower_level_tree_edge_on_path_of_superfluous [Nonempty V] {k : ℕ}
    {χ : E → Fin (k + 1)} {e : E} {m : ℕ}
    (hprefix : G.PrefixTrees χ)
    (hsuper : G.IsSuperfluousAt χ e m) :
    ∃ i : Fin k, ∃ e' : E, ∃ j : ℕ,
      ∃ p : (G.supportGraph (colorClass χ i.castSucc)).Path
          (G.endAt e 0) (G.endAt e 1),
        e' ∈ colorClass χ i.castSucc ∧
          G.symEdge e' ∈ p.1.edges ∧
          j < m ∧ G.HasFiniteLevel χ e' j := by
  classical
  let P := G.kaiserPartition χ m
  have hlev := hsuper.2
  have heRes : e ∈ residualClass χ := hsuper.1.1
  have hsome : ∃ c : Fin (k + 1),
      G.firstDisconnectedColor χ P = some c := by
    cases hopt : G.firstDisconnectedColor χ P with
    | none =>
        exfalso
        apply hlev.2
        change (G.refineOnce χ P).r (G.endAt e 0) (G.endAt e 1)
        rw [refineOnce, hopt]
        exact hlev.1
    | some c => exact ⟨c, rfl⟩
  obtain ⟨c, hc⟩ := hsome
  have hnotRoute :
      ¬ G.ReachableIn (G.insideEdges (colorClass χ c) P (G.endAt e 0))
        (G.endAt e 0) (G.endAt e 1) := by
    intro hroute
    apply hlev.2
    change (G.refineOnce χ P).r (G.endAt e 0) (G.endAt e 1)
    rw [refineOnce, hc]
    exact ⟨hlev.1, hroute⟩
  have hcLast : c ≠ Fin.last k := by
    intro hlast
    subst c
    apply hnotRoute
    have heInside :
        e ∈ G.insideEdges (residualClass χ) P (G.endAt e 0) := by
      apply (mem_insideEdges (G := G)).mpr
      exact ⟨heRes, P.refl _, P.symm hlev.1⟩
    have heInside' :
        e ∈ G.insideEdges (colorClass χ (Fin.last k)) P (G.endAt e 0) := by
      simpa [residualClass] using heInside
    apply SimpleGraph.Adj.reachable
    rw [G.supportGraph_adj_iff
      (G.insideEdges (colorClass χ (Fin.last k)) P (G.endAt e 0))
      (G.endAt e 0) (G.endAt e 1)]
    exact ⟨G.loopless e, e, heInside', Or.inl ⟨rfl, rfl⟩⟩
  rcases Fin.eq_castSucc_or_eq_last c with ⟨i, rfl⟩ | rfl
  · have hreach :
        (G.supportGraph (colorClass χ i.castSucc)).Reachable
          (G.endAt e 0) (G.endAt e 1) :=
      (hprefix i).1.preconnected _ _
    apply hreach.elim_path
    intro p
    obtain ⟨e', he'T, he'path, he'cross⟩ :=
      G.exists_crossing_tree_edge_of_not_internal_reachable p hnotRoute
    obtain ⟨j, hj⟩ :=
      G.exists_finiteLevel_of_not_rel (χ := χ) (n := m) he'cross
    have hjm : j < m := by
      by_contra hnot
      have hmj : m ≤ j := Nat.le_of_not_gt hnot
      apply he'cross
      exact G.kaiserPartition_refines_of_le χ hmj hj.1
    exact ⟨i, e', j, p, he'T, he'path, hjm, hj⟩
  · exact (hcLast rfl).elim

noncomputable def finiteLevelValue {k : ℕ} (χ : E → Fin k) (e : E) : ℕ := by
  classical
  exact if h : ∃ m, G.HasFiniteLevel χ e m then Nat.find h else 0

omit [DecidableEq V] [DecidableEq E] in
theorem finiteLevelValue_spec {k : ℕ} {χ : E → Fin k} {e : E}
    (h : ∃ m, G.HasFiniteLevel χ e m) :
    G.HasFiniteLevel χ e (G.finiteLevelValue χ e) := by
  classical
  unfold finiteLevelValue
  rw [dif_pos h]
  exact Nat.find_spec h

omit [DecidableEq V] [DecidableEq E] in
theorem finiteLevelValue_eq_of_level {k : ℕ} {χ : E → Fin k} {e : E} {m : ℕ}
    (hm : G.HasFiniteLevel χ e m) :
    G.finiteLevelValue χ e = m :=
  G.finiteLevel_unique (G.finiteLevelValue_spec ⟨m, hm⟩) hm

omit [DecidableEq V] [DecidableEq E] in
theorem exists_firstDisconnectedColor_of_finiteLevel {k : ℕ}
    {χ : E → Fin k} {e : E} {j : ℕ}
    (hj : G.HasFiniteLevel χ e j) :
    ∃ c : Fin k,
      G.firstDisconnectedColor χ (G.kaiserPartition χ j) = some c := by
  cases hc : G.firstDisconnectedColor χ (G.kaiserPartition χ j) with
  | some c => exact ⟨c, rfl⟩
  | none =>
      have hstable := G.kaiserPartition_stable_after hc
      exfalso
      apply hj.2
      have hnext := hstable 1
      simpa [Nat.add_comm, Nat.add_left_comm, Nat.add_assoc] using
        (hnext ▸ hj.1)

omit [DecidableEq V] [DecidableEq E] in
theorem finiteLevel_of_partitions_eq_upto {k : ℕ}
    {χ χ' : E → Fin k} {e : E} {n j : ℕ}
    (hEq : ∀ t : ℕ, t ≤ j →
      G.kaiserPartition χ' t = G.kaiserPartition χ t)
    (hnj : n < j)
    (hn : G.HasFiniteLevel χ e n) :
    G.HasFiniteLevel χ' e n := by
  constructor
  · rw [hEq n (Nat.le_of_lt hnj)]
    exact hn.1
  · rw [hEq (n + 1) (Nat.succ_le_of_lt hnj)]
    exact hn.2

/-- Choose the exchanged tree edge with minimum finite level on the fundamental
path.  Consequently every tree edge on that path has both ends in its level-j
class. -/
theorem exists_min_level_tree_edge_on_path_of_superfluous [Nonempty V] {k : ℕ}
    {χ : E → Fin (k + 1)} {e : E} {m : ℕ}
    (hprefix : G.PrefixTrees χ)
    (hsuper : G.IsSuperfluousAt χ e m) :
    ∃ i : Fin k, ∃ e' : E, ∃ j : ℕ,
      ∃ p : (G.supportGraph (colorClass χ i.castSucc)).Path
          (G.endAt e 0) (G.endAt e 1),
        e' ∈ colorClass χ i.castSucc ∧
          G.symEdge e' ∈ p.1.edges ∧
          j < m ∧ G.HasFiniteLevel χ e' j ∧
          ∀ f ∈ colorClass χ i.castSucc, G.symEdge f ∈ p.1.edges →
            (G.kaiserPartition χ j).r (G.endAt f 0) (G.endAt f 1) := by
  classical
  obtain ⟨i, e₀, j₀, p, he₀T, he₀path, hj₀m, hj₀⟩ :=
    G.exists_lower_level_tree_edge_on_path_of_superfluous hprefix hsuper
  let A : Finset E :=
    (colorClass χ i.castSucc).filter fun f =>
      G.symEdge f ∈ p.1.edges ∧ ∃ n, G.HasFiniteLevel χ f n
  have hA : A.Nonempty := by
    have he₀Fin : ∃ n, G.HasFiniteLevel χ e₀ n := ⟨j₀, hj₀⟩
    exact ⟨e₀, Finset.mem_filter.mpr
      ⟨he₀T, he₀path, he₀Fin⟩⟩
  obtain ⟨e', he'A, he'min⟩ :=
    Finset.exists_min_image A (G.finiteLevelValue χ) hA
  have he'A' := Finset.mem_filter.mp he'A
  let j := G.finiteLevelValue χ e'
  have hj : G.HasFiniteLevel χ e' j :=
    G.finiteLevelValue_spec he'A'.2.2
  have hjle : j ≤ j₀ := by
    have he₀A : e₀ ∈ A := by
      have he₀Fin : ∃ n, G.HasFiniteLevel χ e₀ n := ⟨j₀, hj₀⟩
      exact Finset.mem_filter.mpr ⟨he₀T, he₀path, he₀Fin⟩
    have hmin := he'min e₀ he₀A
    simpa [j, G.finiteLevelValue_eq_of_level hj₀] using hmin
  have hjm : j < m := lt_of_le_of_lt hjle hj₀m
  refine ⟨i, e', j, p, he'A'.1, he'A'.2.1, hjm, hj, ?_⟩
  intro f hfT hfpath
  by_contra hnot
  obtain ⟨n, hn⟩ :=
    G.exists_finiteLevel_of_not_rel (χ := χ) (n := j) hnot
  have hnj : n < j := by
    by_contra hnotlt
    have hjn : j ≤ n := Nat.le_of_not_gt hnotlt
    apply hnot
    exact G.kaiserPartition_refines_of_le χ hjn hn.1
  have hfA : f ∈ A := by
    exact Finset.mem_filter.mpr ⟨hfT, hfpath, ⟨n, hn⟩⟩
  have hjleN := he'min f hfA
  have hjeq : G.finiteLevelValue χ e' = j := rfl
  have hneq : G.finiteLevelValue χ f = n :=
    G.finiteLevelValue_eq_of_level hn
  rw [hjeq, hneq] at hjleN
  exact (Nat.not_lt_of_ge hjleN hnj)

theorem exists_min_level_tree_edge_on_path_anchored_of_superfluous
    [Nonempty V] {k : ℕ}
    {χ : E → Fin (k + 1)} {e : E} {m : ℕ}
    (hprefix : G.PrefixTrees χ)
    (hsuper : G.IsSuperfluousAt χ e m) :
    ∃ i : Fin k, ∃ e' : E, ∃ j : ℕ,
      ∃ p : (G.supportGraph (colorClass χ i.castSucc)).Path
          (G.endAt e 0) (G.endAt e 1),
        e' ∈ colorClass χ i.castSucc ∧
          G.symEdge e' ∈ p.1.edges ∧
          j < m ∧ G.HasFiniteLevel χ e' j ∧
          ∀ f ∈ colorClass χ i.castSucc, G.symEdge f ∈ p.1.edges →
            (G.kaiserPartition χ j).r (G.endAt f 0) (G.endAt e 0) ∧
              (G.kaiserPartition χ j).r (G.endAt f 1) (G.endAt e 0) := by
  obtain ⟨i, e', j, p, he'T, he'path, hjm, hj, hno⟩ :=
    G.exists_min_level_tree_edge_on_path_of_superfluous hprefix hsuper
  refine ⟨i, e', j, p, he'T, he'path, hjm, hj, ?_⟩
  intro f hfT hfpath
  exact G.path_edge_ends_rel_start_of_no_crossing p.1 hno hfpath

/-- Kaiser's claim: after exchanging a minimum-level edge on the fundamental
cycle, the deterministic partition sequence is unchanged through that level. -/
theorem kaiserPartition_eq_upto_of_min_exchange [Nonempty V] {k : ℕ}
    {χ : E → Fin (k + 1)} {e : E} {m : ℕ}
    {i : Fin k} {e' : E} {j : ℕ}
    {p : (G.supportGraph (colorClass χ i.castSucc)).Path
      (G.endAt e 0) (G.endAt e 1)}
    (hprefix : G.PrefixTrees χ)
    (hsuper : G.IsSuperfluousAt χ e m)
    (hmin : ∀ f n, G.IsSuperfluousAt χ f n → m ≤ n)
    (he'T : e' ∈ colorClass χ i.castSucc)
    (he'path : G.symEdge e' ∈ p.1.edges)
    (hjm : j < m)
    (hj : G.HasFiniteLevel χ e' j)
    (hpath : ∀ f ∈ colorClass χ i.castSucc, G.symEdge f ∈ p.1.edges →
      (G.kaiserPartition χ j).r (G.endAt f 0) (G.endAt e 0) ∧
        (G.kaiserPartition χ j).r (G.endAt f 1) (G.endAt e 0)) :
    ∀ t : ℕ, t ≤ j →
      G.kaiserPartition (swapColor χ e e') t =
        G.kaiserPartition χ t := by
  classical
  have heRes : e ∈ residualClass χ := hsuper.1.1
  have hχe : χ e = Fin.last k := mem_colorClass.mp heRes
  have hχe' : χ e' = i.castSucc := mem_colorClass.mp he'T
  have hcol : χ e ≠ χ e' := by
    rw [hχe, hχe']
    exact (Fin.castSucc_ne_last i).symm
  have hee' : e ≠ e' := by
    intro h
    subst e'
    exact hcol rfl
  have htreeClass :
      colorClass (swapColor χ e e') i.castSucc =
        (colorClass χ i.castSucc).erase e' ∪ {e} := by
    simpa [hχe, hχe'] using colorClass_swap_right χ hee' hcol
  have hresClass :
      residualClass (swapColor χ e e') =
        (residualClass χ).erase e ∪ {e'} :=
    residualClass_swap_of_residual_of_tree heRes he'T
  intro t htj
  induction t with
  | zero => simp [kaiserPartition]
  | succ t ih =>
      have htltj : t < j := Nat.lt_of_succ_le htj
      have htj' : t ≤ j := Nat.le_of_lt htltj
      have hpart : G.kaiserPartition (swapColor χ e e') t =
          G.kaiserPartition χ t := ih htj'
      let P := G.kaiserPartition χ t
      have hsome : ∃ c : Fin (k + 1),
          G.firstDisconnectedColor χ P = some c := by
        cases hc : G.firstDisconnectedColor χ P with
        | some c => exact ⟨c, rfl⟩
        | none =>
            have hstable := G.kaiserPartition_stable_after hc
            have htjle : t ≤ j := Nat.le_of_lt htltj
            have hjEq : G.kaiserPartition χ j = P := by
              have h := hstable (j - t)
              simpa [P, Nat.add_sub_of_le htjle] using h
            have htj1le : t ≤ j + 1 := le_trans htjle (Nat.le_succ _)
            have hj1Eq : G.kaiserPartition χ (j + 1) = P := by
              have h := hstable (j + 1 - t)
              simpa [P, Nat.add_sub_of_le htj1le] using h
            exfalso
            apply hj.2
            rw [hj1Eq, ← hjEq]
            exact hj.1
      obtain ⟨c, hc⟩ := hsome
      have htm : t < m := lt_trans htltj hjm
      have hRefine : ∀ d : Fin (k + 1), d ≤ c →
          G.refineSetoid P (colorClass (swapColor χ e e') d) =
            G.refineSetoid P (colorClass χ d) := by
        intro d hdc
        by_cases hdi : d = i.castSucc
        · subst d
          rw [htreeClass]
          have heRel :
              P.r (G.endAt e 0) (G.endAt e 1) :=
            G.kaiserPartition_refines_of_le χ (Nat.le_of_lt htm)
              hsuper.2.1
          have hpathP : ∀ f ∈ colorClass χ i.castSucc,
              G.symEdge f ∈ p.1.edges →
                P.r (G.endAt f 0) (G.endAt e 0) ∧
                  P.r (G.endAt f 1) (G.endAt e 0) := by
            intro f hfT hfpath
            have hf := hpath f hfT hfpath
            exact ⟨G.kaiserPartition_refines_of_le χ htj' hf.1,
              G.kaiserPartition_refines_of_le χ htj' hf.2⟩
          exact G.refineSetoid_exchange_eq_of_path_internal
            (hprefix i) he'T p he'path heRel hpathP
        · by_cases hdlast : d = Fin.last k
          · subst d
            have hcLast : c = Fin.last k := by
              exact le_antisymm (Fin.le_last c) hdc
            have hnext :
                G.kaiserPartition χ (t + 1) =
                  G.refineSetoid P (residualClass χ) := by
              change G.refineOnce χ P = _
              rw [refineOnce, hc, hcLast]
              rfl
            have he'AtNext :
                (G.kaiserPartition χ (t + 1)).r
                  (G.endAt e' 0) (G.endAt e' 1) :=
              G.kaiserPartition_refines_of_le χ htj hj.1
            rw [hnext] at he'AtNext
            have he'Route :
                G.ReachableIn
                  (G.insideEdges ((residualClass χ).erase e) P (G.endAt e' 0))
                  (G.endAt e' 0) (G.endAt e' 1) :=
              G.reachableIn_inside_erase_of_min_superfluous
                hsuper hmin htm he'AtNext.2
            change G.refineSetoid P (residualClass (swapColor χ e e')) =
              G.refineSetoid P (residualClass χ)
            rw [hresClass]
            calc
              G.refineSetoid P ((residualClass χ).erase e ∪ {e'}) =
                  G.refineSetoid P ((residualClass χ).erase e) :=
                G.refineSetoid_union_singleton_eq_of_internal_reachable
                  he'Route
              _ = G.refineSetoid P (residualClass χ) :=
                G.refineSetoid_residual_erase_eq_of_min_superfluous
                  hsuper hmin htm
          · have hdNeE : d ≠ χ e := by
              rw [hχe]
              exact hdlast
            have hdNeE' : d ≠ χ e' := by
              rw [hχe']
              exact hdi
            rw [colorClass_swap_other χ hee' hdNeE hdNeE']
      have hbad : ¬ G.InternallyConnected (colorClass χ c) P :=
        G.firstDisconnectedColor_spec hc
      have hbad' :
          ¬ G.InternallyConnected (colorClass (swapColor χ e e') c) P := by
        intro h
        apply hbad
        exact (G.internallyConnected_iff_of_refineSetoid_eq
          (hRefine c le_rfl)).mp h
      have hbefore' : ∀ d : Fin (k + 1), d < c →
          G.InternallyConnected (colorClass (swapColor χ e e') d) P := by
        intro d hdc
        have hd := G.firstDisconnectedColor_internal_of_lt hc hdc
        exact (G.internallyConnected_iff_of_refineSetoid_eq
          (hRefine d (le_of_lt hdc))).mpr hd
      have hc' :
          G.firstDisconnectedColor (swapColor χ e e') P = some c :=
        G.firstDisconnectedColor_eq_some_of_spec hbad' hbefore'
      change G.refineOnce (swapColor χ e e')
          (G.kaiserPartition (swapColor χ e e') t) =
        G.refineOnce χ (G.kaiserPartition χ t)
      rw [hpart]
      change G.refineOnce (swapColor χ e e') P = G.refineOnce χ P
      unfold refineOnce
      rw [hc', hc]
      exact hRefine c le_rfl

def HasSuperfluousLevel {k : ℕ} (χ : E → Fin (k + 1)) (m : ℕ) : Prop :=
  ∃ e : E, G.IsSuperfluousAt χ e m

noncomputable def minSuperfluousLevel {k : ℕ} (χ : E → Fin (k + 1)) : ℕ := by
  classical
  exact if h : ∃ m, G.HasSuperfluousLevel χ m then Nat.find h else 0

omit [DecidableEq V] in
theorem minSuperfluousLevel_spec {k : ℕ} {χ : E → Fin (k + 1)}
    (h : G.HasSuperfluousEdge χ) :
    G.HasSuperfluousLevel χ (G.minSuperfluousLevel χ) := by
  classical
  unfold minSuperfluousLevel
  have hex : ∃ m, G.HasSuperfluousLevel χ m := by
    rcases h with ⟨e, m, hem⟩
    exact ⟨m, e, hem⟩
  rw [dif_pos hex]
  exact Nat.find_spec hex

omit [DecidableEq V] in
theorem minSuperfluousLevel_le {k : ℕ} {χ : E → Fin (k + 1)} {m : ℕ}
    (hm : G.HasSuperfluousLevel χ m) :
    G.minSuperfluousLevel χ ≤ m := by
  classical
  unfold minSuperfluousLevel
  have hex : ∃ n, G.HasSuperfluousLevel χ n := ⟨m, hm⟩
  rw [dif_pos hex]
  exact Nat.find_min' hex hm

/-- The one graph-theoretic improvement furnished by the middle part of Kaiser's proof:
from a disconnected residual class one can swap two edges and either reduce its component
count or keep that count while lowering the first superfluous level. -/
def HasKaiserImprovementStep (k : ℕ) : Prop :=
  ∀ χ : E → Fin (k + 1), G.PrefixTrees χ →
    ¬ G.Connects (residualClass χ) →
      ∃ χ' : E → Fin (k + 1), G.PrefixTrees χ' ∧
        (G.residualComponents χ' < G.residualComponents χ ∨
          G.residualComponents χ' = G.residualComponents χ ∧
            G.minSuperfluousLevel χ' < G.minSuperfluousLevel χ)

/-- The local exchange argument in Kaiser's proof supplies the improvement step
from the Nash-Williams partition inequality. -/
theorem hasKaiserImprovementStep_of_condition [Nonempty V] {k : ℕ}
    (hcond : G.SatisfiesTreePackingCondition (k + 1)) :
    G.HasKaiserImprovementStep k := by
  classical
  intro χ hprefix hdisc
  have hsup : G.HasSuperfluousEdge χ :=
    G.hasSuperfluousEdge_of_condition_of_disconnected hprefix hdisc hcond
  let m := G.minSuperfluousLevel χ
  obtain ⟨e, hsuper⟩ := G.minSuperfluousLevel_spec hsup
  have hmin : ∀ f n, G.IsSuperfluousAt χ f n → m ≤ n := by
    intro f n hfn
    exact G.minSuperfluousLevel_le ⟨f, hfn⟩
  obtain ⟨i, e', j, p, he'T, he'path, hjm, hj, hpath⟩ :=
    G.exists_min_level_tree_edge_on_path_anchored_of_superfluous hprefix hsuper
  let χ' := swapColor χ e e'
  have hprefix' : G.PrefixTrees χ' :=
    G.prefixTrees_swap_of_path_edge hprefix hsuper.1.1 he'T p he'path
  refine ⟨χ', hprefix', ?_⟩
  by_cases hj0 : j = 0
  · left
    subst j
    exact G.residualComponents_swap_lt_of_cyclic_of_not_reachable
      hsuper.1.1 he'T hsuper.1
      (G.not_reachable_residual_of_level_zero hprefix hdisc hj)
  · have hjpos : 0 < j := Nat.pos_of_ne_zero hj0
    have he'Reach :
        G.ReachableIn (residualClass χ)
          (G.endAt e' 0) (G.endAt e' 1) :=
      G.reachable_residual_of_positive_level hprefix hdisc hjpos hj
    have hcomp :
        G.residualComponents χ' = G.residualComponents χ :=
      G.residualComponents_swap_eq_of_cyclic_of_reachable
        hsuper.1.1 he'T hsuper.1 he'Reach
    have he'Cyc :
        G.IsCyclicEdge (residualClass χ') e' :=
      G.cyclicEdge_swap_of_cyclic_of_reachable
        hsuper.1.1 he'T hsuper.1 he'Reach
    have hEq : ∀ t : ℕ, t ≤ j →
        G.kaiserPartition χ' t = G.kaiserPartition χ t :=
      G.kaiserPartition_eq_upto_of_min_exchange
        hprefix hsuper hmin he'T he'path hjm hj hpath
    right
    refine ⟨hcomp, ?_⟩
    obtain ⟨c, hc⟩ :=
      G.exists_firstDisconnectedColor_of_finiteLevel hj
    let P := G.kaiserPartition χ j
    have hcNeTree : c ≠ i.castSucc := by
      intro hci
      apply hj.2
      change (G.refineOnce χ P).r (G.endAt e' 0) (G.endAt e' 1)
      rw [refineOnce, hc, hci]
      refine ⟨hj.1, ?_⟩
      apply SimpleGraph.Adj.reachable
      rw [G.supportGraph_adj_iff
        (G.insideEdges (colorClass χ i.castSucc) P (G.endAt e' 0))
        (G.endAt e' 0) (G.endAt e' 1)]
      exact ⟨G.loopless e', e',
        (mem_insideEdges (G := G)).mpr
          ⟨he'T, P.refl _, P.symm hj.1⟩,
        Or.inl ⟨rfl, rfl⟩⟩
    by_cases hcLast : c = Fin.last k
    · subst c
      have he'ReachErase :
          G.ReachableIn ((residualClass χ).erase e)
            (G.endAt e' 0) (G.endAt e' 1) :=
        G.reachableIn_erase_of_cyclic hsuper.1 he'Reach
      have hnotRoute :
          ¬ G.ReachableIn
            (G.insideEdges ((residualClass χ).erase e) P (G.endAt e' 0))
            (G.endAt e' 0) (G.endAt e' 1) := by
        intro hroute
        apply hj.2
        change (G.refineOnce χ P).r (G.endAt e' 0) (G.endAt e' 1)
        rw [refineOnce, hc]
        refine ⟨hj.1, ?_⟩
        apply G.reachableIn_mono _ hroute
        intro f hf
        have hf' := (mem_insideEdges (G := G)).mp hf
        apply (mem_insideEdges (G := G)).mpr
        exact ⟨Finset.mem_of_mem_erase hf'.1, hf'.2.1, hf'.2.2⟩
      apply he'ReachErase.elim_path
      intro q
      obtain ⟨f, hf, hfpath, hfCross⟩ :=
        G.exists_crossing_tree_edge_of_not_internal_reachable q hnotRoute
      obtain ⟨n, hn⟩ :=
        G.exists_finiteLevel_of_not_rel (χ := χ) (n := j) hfCross
      have hnj : n < j := by
        by_contra hnot
        have hjn : j ≤ n := Nat.le_of_not_gt hnot
        apply hfCross
        exact G.kaiserPartition_refines_of_le χ hjn hn.1
      have hn' : G.HasFiniteLevel χ' f n :=
        G.finiteLevel_of_partitions_eq_upto hEq hnj hn
      have hee' : e ≠ e' := by
        intro h
        subst e'
        have hlast : χ e = Fin.last k := mem_colorClass.mp hsuper.1.1
        have htree : χ e = i.castSucc := mem_colorClass.mp he'T
        exact (Fin.castSucc_ne_last i).symm (hlast.symm.trans htree)
      have hresClass :
          residualClass χ' = (residualClass χ).erase e ∪ {e'} :=
        residualClass_swap_of_residual_of_tree hsuper.1.1 he'T
      have he'NotRes : e' ∉ residualClass χ := by
        intro he'R
        exact (Finset.disjoint_left.mp
          (colorClass_disjoint χ (Fin.castSucc_ne_last i)) he'T he'R).elim
      have herase :
          (residualClass χ').erase e' = (residualClass χ).erase e := by
        rw [hresClass]
        ext g
        simp [hee'.symm, he'NotRes]
      have hq' :
          ∃ q' : (G.supportGraph ((residualClass χ').erase e')).Path
              (G.endAt e' 0) (G.endAt e' 1),
            G.symEdge f ∈ q'.1.edges := by
        rw [herase]
        exact ⟨q, hfpath⟩
      obtain ⟨q', hfpath'⟩ := hq'
      have hf' : f ∈ (residualClass χ').erase e' := by
        rw [herase]
        exact hf
      have hfCyc :
          G.IsCyclicEdge (residualClass χ') f :=
        G.cyclicEdge_of_mem_path_of_cyclic_edge he'Cyc q' hf' hfpath'
      have hnewSuper : G.IsSuperfluousAt χ' f n := ⟨hfCyc, hn'⟩
      have hle : G.minSuperfluousLevel χ' ≤ n :=
        G.minSuperfluousLevel_le ⟨f, hnewSuper⟩
      exact lt_of_le_of_lt hle (lt_trans hnj hjm)
    · have htreeClass :
          colorClass χ' i.castSucc =
            (colorClass χ i.castSucc).erase e' ∪ {e} := by
        have hχe : χ e = Fin.last k := mem_colorClass.mp hsuper.1.1
        have hχe' : χ e' = i.castSucc := mem_colorClass.mp he'T
        have hcol : χ e ≠ χ e' := by
          rw [hχe, hχe']
          exact (Fin.castSucc_ne_last i).symm
        have hee' : e ≠ e' := by
          intro h
          subst e'
          exact hcol rfl
        simpa [χ', hχe, hχe'] using colorClass_swap_right χ hee' hcol
      have hRefine : ∀ d : Fin (k + 1), d ≤ c →
          G.refineSetoid P (colorClass χ' d) =
            G.refineSetoid P (colorClass χ d) := by
        intro d hdc
        by_cases hdi : d = i.castSucc
        · subst d
          rw [htreeClass]
          have heRel :
              P.r (G.endAt e 0) (G.endAt e 1) :=
            G.kaiserPartition_refines_of_le χ (Nat.le_of_lt hjm)
              hsuper.2.1
          exact G.refineSetoid_exchange_eq_of_path_internal
            (hprefix i) he'T p he'path heRel hpath
        · by_cases hdlast : d = Fin.last k
          · subst d
            exfalso
            apply hcLast
            exact le_antisymm (Fin.le_last c) hdc
          · have hχe : χ e = Fin.last k := mem_colorClass.mp hsuper.1.1
            have hχe' : χ e' = i.castSucc := mem_colorClass.mp he'T
            have hcol : χ e ≠ χ e' := by
              rw [hχe, hχe']
              exact (Fin.castSucc_ne_last i).symm
            have hee' : e ≠ e' := by
              intro h
              subst e'
              exact hcol rfl
            have hdNeE : d ≠ χ e := by simpa [hχe] using hdlast
            have hdNeE' : d ≠ χ e' := by simpa [hχe'] using hdi
            rw [colorClass_swap_other χ hee' hdNeE hdNeE']
      have hbad : ¬ G.InternallyConnected (colorClass χ c) P :=
        G.firstDisconnectedColor_spec hc
      have hbad' : ¬ G.InternallyConnected (colorClass χ' c) P := by
        intro h
        apply hbad
        exact (G.internallyConnected_iff_of_refineSetoid_eq
          (hRefine c le_rfl)).mp h
      have hbefore' : ∀ d : Fin (k + 1), d < c →
          G.InternallyConnected (colorClass χ' d) P := by
        intro d hdc
        exact (G.internallyConnected_iff_of_refineSetoid_eq
          (hRefine d (le_of_lt hdc))).mpr
          (G.firstDisconnectedColor_internal_of_lt hc hdc)
      have hc' : G.firstDisconnectedColor χ' P = some c :=
        G.firstDisconnectedColor_eq_some_of_spec hbad' hbefore'
      have hnext :
          G.kaiserPartition χ' (j + 1) =
            G.kaiserPartition χ (j + 1) := by
        change G.refineOnce χ' (G.kaiserPartition χ' j) =
          G.refineOnce χ (G.kaiserPartition χ j)
        rw [hEq j le_rfl]
        change G.refineOnce χ' P = G.refineOnce χ P
        unfold refineOnce
        rw [hc', hc]
        exact hRefine c le_rfl
      have hj' : G.HasFiniteLevel χ' e' j := by
        constructor
        · rw [hEq j le_rfl]
          exact hj.1
        · rw [hnext]
          exact hj.2
      have hle : G.minSuperfluousLevel χ' ≤ j :=
        G.minSuperfluousLevel_le ⟨e', he'Cyc, hj'⟩
      exact lt_of_le_of_lt hle hjm

omit [DecidableEq V] in
/-- Kaiser's lexicographic extremal choice: an improvement step rules out a disconnected
residual class.  This is the finite-descent shell of the short proof. -/
theorem exists_connected_residual_of_kaiser_step [Nonempty V] {k : ℕ}
    (hex : ∃ χ : E → Fin (k + 1), G.PrefixTrees χ)
    (hstep : G.HasKaiserImprovementStep k) :
    ∃ χ : E → Fin (k + 1), G.PrefixTrees χ ∧ G.Connects (residualClass χ) := by
  classical
  let A : Finset (E → Fin (k + 1)) := Finset.univ.filter G.PrefixTrees
  have hA : A.Nonempty := by
    rcases hex with ⟨χ, hχ⟩
    exact ⟨χ, by simp [A, hχ]⟩
  obtain ⟨χ₀, hχ₀A, hχ₀min⟩ :=
    Finset.exists_min_image A G.residualComponents hA
  let B : Finset (E → Fin (k + 1)) :=
    A.filter fun χ ↦ G.residualComponents χ = G.residualComponents χ₀
  have hB : B.Nonempty := ⟨χ₀, by simp [B, hχ₀A]⟩
  obtain ⟨χ, hχB, hχmin⟩ :=
    Finset.exists_min_image B G.minSuperfluousLevel hB
  have hχA : χ ∈ A := (Finset.mem_filter.mp hχB).1
  have hprefix : G.PrefixTrees χ := by simpa [A] using hχA
  have hcompEq : G.residualComponents χ = G.residualComponents χ₀ := by
    exact (Finset.mem_filter.mp hχB).2
  by_cases hconn : G.Connects (residualClass χ)
  · exact ⟨χ, hprefix, hconn⟩
  · rcases hstep χ hprefix hconn with ⟨χ', hprefix', himprove | himprove⟩
    · have hχ'A : χ' ∈ A := by simp [A, hprefix']
      have hle := hχ₀min χ' hχ'A
      rw [← hcompEq] at hle
      exact False.elim (Nat.not_lt_of_ge hle himprove)
    · have hχ'A : χ' ∈ A := by simp [A, hprefix']
      have hχ'B : χ' ∈ B := by
        simp [B, hχ'A, himprove.1, hcompEq]
      have hle := hχmin χ' hχ'B
      exact False.elim (Nat.not_lt_of_ge hle himprove.2)

omit [Fintype E] [DecidableEq E] in
theorem packing_index_unique {k : ℕ} {T : Fin k → Finset E}
    (hdisj : ∀ i j, i ≠ j → Disjoint (T i) (T j))
    {e : E} {i j : Fin k} (hei : e ∈ T i) (hej : e ∈ T j) : i = j := by
  by_contra hij
  exact (Finset.disjoint_left.mp (hdisj i j hij) hei hej).elim

/-- Color every edge already used by a packing with its unique tree index and send all
remaining edges to the new residual color. -/
noncomputable def coloringOfPacking {k : ℕ} (T : Fin k → Finset E) :
    E → Fin (k + 1) := fun e ↦
  if h : ∃ i : Fin k, e ∈ T i then (Classical.choose h).castSucc else Fin.last k

theorem colorClass_coloringOfPacking {k : ℕ} {T : Fin k → Finset E}
    (hdisj : ∀ i j, i ≠ j → Disjoint (T i) (T j)) (i : Fin k) :
    colorClass (coloringOfPacking T) i.castSucc = T i := by
  classical
  ext e
  constructor
  · intro he
    have hcolor := mem_colorClass.mp he
    unfold coloringOfPacking at hcolor
    split at hcolor
    · rename_i hex
      have hchoose : Classical.choose hex = i := by
        apply Fin.castSucc_injective _
        exact hcolor
      simpa [hchoose] using Classical.choose_spec hex
    · rename_i hno
      exact False.elim (Fin.castSucc_ne_last i hcolor.symm)
  · intro he
    have hex : ∃ j : Fin k, e ∈ T j := ⟨i, he⟩
    have hchoose : Classical.choose hex = i :=
      packing_index_unique hdisj (Classical.choose_spec hex) he
    apply mem_colorClass.mpr
    simp [coloringOfPacking, hex, hchoose]

/-- Once Kaiser's improvement lemma is available, the induction on the number of colors
produces an actual packing.  The remaining theorem below is deliberately separated from the
long local exchange argument so that the latter can be audited independently. -/
theorem hasTreePacking_of_kaiser_steps [Nonempty V]
    (hstep : ∀ k : ℕ, G.HasKaiserImprovementStep k) :
    ∀ k : ℕ, G.HasTreePacking k := by
  intro k
  induction k with
  | zero =>
      refine ⟨fun i => Fin.elim0 i, ?_, ?_⟩
      · intro i; exact Fin.elim0 i
      · intro i; exact Fin.elim0 i
  | succ k ih =>
      rcases ih with ⟨T, htrees, hdisj⟩
      let χ : E → Fin (k + 1) := coloringOfPacking T
      have hprefix : G.PrefixTrees χ := by
        intro i
        rw [show colorClass χ i.castSucc = T i by
          exact colorClass_coloringOfPacking hdisj i]
        exact htrees i
      obtain ⟨χ', hprefix', hconn⟩ :=
        G.exists_connected_residual_of_kaiser_step ⟨χ, hprefix⟩ (hstep k)
      obtain ⟨R, hRsub, hRtree⟩ :=
        G.exists_isSpanningTree_subset_of_connects (residualClass χ') hconn
      let U : Fin (k + 1) → Finset E :=
        Fin.lastCases R (fun i => colorClass χ' i.castSucc)
      refine ⟨U, ?_, ?_⟩
      · intro i
        rcases Fin.eq_castSucc_or_eq_last i with ⟨j, rfl⟩ | rfl
        · simpa [U] using hprefix' j
        · simpa [U] using hRtree
      · intro i j hij
        rcases Fin.eq_castSucc_or_eq_last i with ⟨a, rfl⟩ | rfl
        · rcases Fin.eq_castSucc_or_eq_last j with ⟨b, rfl⟩ | rfl
          · simpa [U] using colorClass_disjoint χ' hij
          · apply Finset.disjoint_left.2
            intro e hea heR
            have hea' : e ∈ colorClass χ' a.castSucc := by simpa [U] using hea
            have heR' : e ∈ R := by simpa [U] using heR
            have heLast : e ∈ residualClass χ' := hRsub heR'
            exact (Finset.disjoint_left.mp
              (colorClass_disjoint χ' (Fin.castSucc_ne_last a)) hea' heLast).elim
        · rcases Fin.eq_castSucc_or_eq_last j with ⟨b, rfl⟩ | rfl
          · apply Finset.disjoint_left.2
            intro e heR heb
            have heR' : e ∈ R := by simpa [U] using heR
            have heb' : e ∈ colorClass χ' b.castSucc := by simpa [U] using heb
            have heLast : e ∈ residualClass χ' := hRsub heR'
            exact (Finset.disjoint_left.mp
              (colorClass_disjoint χ' (Fin.castSucc_ne_last b)) heb' heLast).elim
          · exact (hij rfl).elim

omit [DecidableEq V] [DecidableEq E] in
theorem satisfiesTreePackingCondition_mono {a b : ℕ}
    (hab : a ≤ b)
    (h : G.SatisfiesTreePackingCondition b) :
    G.SatisfiesTreePackingCondition a := by
  intro P
  exact (Nat.mul_le_mul_right (Nat.card (Quotient P) - 1) hab).trans (h P)

/-- Sufficiency in the Nash-Williams--Tutte theorem, obtained by applying the
Kaiser improvement step at each inductive stage. -/
theorem hasTreePacking_of_condition [Nonempty V] :
    ∀ k : ℕ, G.SatisfiesTreePackingCondition k → G.HasTreePacking k := by
  intro k
  induction k with
  | zero =>
      intro _
      refine ⟨fun i => Fin.elim0 i, ?_, ?_⟩
      · intro i
        exact Fin.elim0 i
      · intro i
        exact Fin.elim0 i
  | succ k ih =>
      intro hcond
      have hcondPrev : G.SatisfiesTreePackingCondition k :=
        G.satisfiesTreePackingCondition_mono (Nat.le_succ k) hcond
      rcases ih hcondPrev with ⟨T, htrees, hdisj⟩
      let χ : E → Fin (k + 1) := coloringOfPacking T
      have hprefix : G.PrefixTrees χ := by
        intro i
        rw [show colorClass χ i.castSucc = T i by
          exact colorClass_coloringOfPacking hdisj i]
        exact htrees i
      obtain ⟨χ', hprefix', hconn⟩ :=
        G.exists_connected_residual_of_kaiser_step ⟨χ, hprefix⟩
          (G.hasKaiserImprovementStep_of_condition hcond)
      obtain ⟨R, hRsub, hRtree⟩ :=
        G.exists_isSpanningTree_subset_of_connects (residualClass χ') hconn
      let U : Fin (k + 1) → Finset E :=
        Fin.lastCases R (fun i => colorClass χ' i.castSucc)
      refine ⟨U, ?_, ?_⟩
      · intro i
        rcases Fin.eq_castSucc_or_eq_last i with ⟨j, rfl⟩ | rfl
        · simpa [U] using hprefix' j
        · simpa [U] using hRtree
      · intro i j hij
        rcases Fin.eq_castSucc_or_eq_last i with ⟨a, rfl⟩ | rfl
        · rcases Fin.eq_castSucc_or_eq_last j with ⟨b, rfl⟩ | rfl
          · simpa [U] using colorClass_disjoint χ' hij
          · apply Finset.disjoint_left.2
            intro e hea heR
            have hea' : e ∈ colorClass χ' a.castSucc := by simpa [U] using hea
            have heR' : e ∈ R := by simpa [U] using heR
            have heLast : e ∈ residualClass χ' := hRsub heR'
            exact (Finset.disjoint_left.mp
              (colorClass_disjoint χ' (Fin.castSucc_ne_last a)) hea' heLast).elim
        · rcases Fin.eq_castSucc_or_eq_last j with ⟨b, rfl⟩ | rfl
          · apply Finset.disjoint_left.2
            intro e heR heb
            have heR' : e ∈ R := by simpa [U] using heR
            have heb' : e ∈ colorClass χ' b.castSucc := by simpa [U] using heb
            have heLast : e ∈ residualClass χ' := hRsub heR'
            exact (Finset.disjoint_left.mp
              (colorClass_disjoint χ' (Fin.castSucc_ne_last b)) heb' heLast).elim
          · exact (hij rfl).elim

/-- Nash-Williams--Tutte spanning-tree packing theorem for finite loopless
multigraphs. -/
theorem nashWilliamsTutte [Nonempty V] (k : ℕ) :
    G.HasTreePacking k ↔ G.SatisfiesTreePackingCondition k := by
  constructor
  · exact G.satisfiesTreePackingCondition_of_hasTreePacking
  · exact G.hasTreePacking_of_condition k

end FiniteGraph

end CDCLean
