import CDCLean.NashWilliams
import CDCLean.CycleDecomposition
import CDCLean.FlowCount

/-!
# The Jaeger--Kilpatrick eight-flow theorem

This file proves the group-valued form of the eight-flow theorem.  The coefficient
group is `Gamma = (ZMod 2)^3`, so a flow is assembled from three even edge sets.
-/

namespace CDCLean

namespace FiniteGraph

open scoped BigOperators

variable {V E : Type*} [Fintype V] [Fintype E] [DecidableEq V] [DecidableEq E]
  (H : FiniteGraph V E)

/-- The `Gamma`-valued function encoded by three edge sets. -/
noncomputable def gammaOfEvenCover (F : Fin 3 → Finset E) : E → Gamma :=
  fun e i => if e ∈ F i then 1 else 0

/-- Three even edge sets covering every edge give a nowhere-zero `Gamma`-flow. -/
theorem nowhereZeroGammaFlow_of_evenCover
    (F : Fin 3 → Finset E)
    (hEven : ∀ i, H.IsEvenEdgeSet (F i))
    (hCover : ∀ e : E, ∃ i : Fin 3, e ∈ F i) :
    Nonempty (H.NowhereZeroFlow Gamma) := by
  classical
  refine ⟨⟨gammaOfEvenCover F, ?_, ?_⟩⟩
  · intro v
    funext i
    have hi := hEven i v
    simp only [edgeIncidence] at hi
    rw [Finset.sum_add_distrib] at hi
    simp only [Pi.sub_apply, Finset.sum_apply, Pi.zero_apply]
    have hsum (j : Fin 2) :
        (∑ e : E,
          (if H.endAt e j = v then gammaOfEvenCover F e else 0) i) =
          ∑ e ∈ F i, if H.endAt e j = v then (1 : F₂) else 0 := by
      calc
        _ = ∑ e : E,
            if e ∈ F i then (if H.endAt e j = v then (1 : F₂) else 0) else 0 := by
              apply Finset.sum_congr rfl
              intro e _
              by_cases he : e ∈ F i <;> by_cases hev : H.endAt e j = v <;>
                simp [gammaOfEvenCover, he, hev]
        _ = _ := by
          simp
    rw [hsum 0, hsum 1]
    simpa [sub_eq_add_neg] using hi
  · intro e he
    obtain ⟨i, hei⟩ := hCover e
    have := congrFun he i
    simp [gammaOfEvenCover, hei] at this

/-- A route using `T` gives an integral path avoiding every edge in a disjoint set `S`. -/
theorem hasIntegerPath_of_reachableIn_of_disjoint
    {S T : Finset E} {u v : V} (hST : Disjoint S T)
    (h : H.ReachableIn T u v) : H.HasIntegerPath S u v := by
  rcases h with ⟨p⟩
  induction p with
  | nil => exact H.hasIntegerPath_refl S _
  | @cons x y z hxy p ih =>
      rw [H.supportGraph_adj_iff T x y] at hxy
      rcases hxy with ⟨_, e, heT, hends | hends⟩
      · have heS : e ∉ S := by
          intro heS
          exact Finset.disjoint_left.mp hST heS heT
        have hstep := H.hasIntegerPath_single S e heS
        have hstep' : H.HasIntegerPath S x y := by
          simpa [hends.1, hends.2] using hstep
        exact FiniteGraph.HasIntegerPath.trans (G := H) hstep' ih
      · have heS : e ∉ S := by
          intro heS
          exact Finset.disjoint_left.mp hST heS heT
        have hstep := (H.hasIntegerPath_single S e heS).symm
        have hstep' : H.HasIntegerPath S x y := by
          simpa [hends.1, hends.2] using hstep
        exact FiniteGraph.HasIntegerPath.trans (G := H) hstep' ih

/-- Finite sums of integer flows are integer flows. -/
theorem isFlow_sum_int (s : Finset E) (c : E → E → ℤ)
    (hc : ∀ e ∈ s, H.IsFlow (c e)) :
    H.IsFlow (∑ e ∈ s, c e) := by
  classical
  induction s using Finset.induction_on with
  | empty => simp [IsFlow]
  | @insert e s heS ih =>
      rw [Finset.sum_insert heS]
      exact H.isFlow_add (hc e (by simp))
        (ih (fun f hf => hc f (by simp [hf])))

omit [DecidableEq E] in
/-- Reducing an integer circulation modulo two gives an `F₂` circulation. -/
theorem isFlow_intCast_f2 {c : E → ℤ} (hc : H.IsFlow c) :
    H.IsFlow (fun e => (c e : F₂)) := by
  intro v
  have h := congrArg (fun z : ℤ => (z : F₂)) (hc v)
  simpa only [IsFlow, Int.cast_sub, Int.cast_sum, Int.cast_ite, Int.cast_zero] using h

private theorem f2_eq_zero_or_one (x : F₂) : x = 0 ∨ x = 1 := by
  fin_cases x
  · exact Or.inl rfl
  · exact Or.inr rfl

omit [DecidableEq E] in
/-- The support of an `F₂` circulation is an even edge set. -/
theorem isEvenEdgeSet_support_of_isFlow_f2 (f : E → F₂) (hf : H.IsFlow f) :
    H.IsEvenEdgeSet (Finset.univ.filter fun e => f e = 1) := by
  intro v
  have hv := hf v
  rw [sub_eq_add_neg] at hv
  rw [ZMod.neg_eq_self_mod_two] at hv
  rw [← Finset.sum_add_distrib] at hv
  calc
    ∑ e ∈ Finset.univ.filter (fun e => f e = 1), H.edgeIncidence v e =
        ∑ e : E,
          ((if H.endAt e 0 = v then f e else 0) +
            if H.endAt e 1 = v then f e else 0) := by
      rw [Finset.sum_filter]
      apply Finset.sum_congr rfl
      intro e _
      rcases f2_eq_zero_or_one (f e) with he | he <;>
        simp [edgeIncidence, he]
    _ = 0 := hv

/-- The complement of a spanning tree can be completed to an even edge set.  For every
non-tree edge, route its two ends through the tree and sum the resulting fundamental
cycles modulo two. -/
theorem exists_even_superset_compl_of_spanningTree [Nonempty V]
    (T : Finset E) (hT : H.IsSpanningTree T) :
    ∃ F : Finset E, H.IsEvenEdgeSet F ∧ ∀ e : E, e ∉ T → e ∈ F := by
  classical
  let S : Finset E := Finset.univ \ T
  have hST : Disjoint S T := by
    apply Finset.disjoint_left.2
    intro e heS heT
    exact (Finset.mem_sdiff.mp heS).2 heT
  have hcorr : ∀ e ∈ S, H.HasCycleCorrection S e := by
    intro e heS
    apply H.hasCycleCorrection_of_integerPath S e heS
    apply H.hasIntegerPath_of_reachableIn_of_disjoint hST
    exact hT.1.preconnected _ _
  let c : E → E → ℤ := fun e =>
    if he : e ∈ S then Classical.choose (hcorr e he) else 0
  have hc_spec (e : E) (he : e ∈ S) :
      H.IsFlow (c e) ∧ c e e = 1 ∧ ∀ k ∈ S.erase e, c e k = 0 := by
    dsimp [c]
    rw [dif_pos he]
    exact Classical.choose_spec (hcorr e he)
  let q : E → ℤ := ∑ e ∈ S, c e
  have hqflow : H.IsFlow q := by
    dsimp [q]
    apply H.isFlow_sum_int S c
    intro e he
    exact (hc_spec e he).1
  let f : E → F₂ := fun e => (q e : F₂)
  let F : Finset E := Finset.univ.filter fun e => f e = 1
  refine ⟨F, H.isEvenEdgeSet_support_of_isFlow_f2 f ?_, ?_⟩
  · exact H.isFlow_intCast_f2 hqflow
  · intro e heT
    have heS : e ∈ S := by simp [S, heT]
    have hqe : q e = 1 := by
      dsimp [q]
      rw [Finset.sum_apply]
      calc
        _ = c e e := by
          apply Finset.sum_eq_single e
          · intro b hb hbe
            exact (hc_spec b hb).2.2 e
              (Finset.mem_erase.mpr ⟨Ne.symm hbe, heS⟩)
          · intro he
            exact (he heS).elim
        _ = 1 := (hc_spec e heS).2.1
    simp [F, f, hqe]

/-- Every proper nonempty vertex cut has at least three edge objects. -/
def IsThreeEdgeConnected : Prop :=
  ∀ S : Finset V, S.Nonempty → S ≠ Finset.univ → 3 ≤ (H.cut S).card

/-- Two parallel copies of every genuine edge object. -/
def doubleGraph : FiniteGraph V (E × Fin 2) where
  endAt e i := H.endAt e.1 i
  loopless e := H.loopless e.1

/-- The vertex set belonging to one class of a setoid partition. -/
noncomputable def classFinset (P : Setoid V) (q : Quotient P) : Finset V := by
  classical
  exact Finset.univ.filter fun v => Quotient.mk P v = q

omit [DecidableEq V] [DecidableEq E] in
@[simp]
theorem mem_classFinset {P : Setoid V} {q : Quotient P} {v : V} :
    v ∈ classFinset P q ↔ Quotient.mk P v = q := by
  classical
  simp [classFinset]

omit [DecidableEq V] [DecidableEq E] in
theorem classFinset_nonempty (P : Setoid V) (q : Quotient P) :
    (classFinset P q).Nonempty := by
  induction q using Quotient.inductionOn with
  | _ v => exact ⟨v, by simp⟩

omit [DecidableEq V] [DecidableEq E] in
theorem classFinset_ne_univ (P : Setoid V) [Nontrivial (Quotient P)]
    (q : Quotient P) : classFinset P q ≠ Finset.univ := by
  obtain ⟨r, hr⟩ := exists_ne q
  induction r using Quotient.inductionOn with
  | _ v =>
      intro hEq
      have hv : v ∈ classFinset P q := by rw [hEq]; simp
      exact hr (by simpa using hv)

omit [DecidableEq V] [DecidableEq E] in
/-- Doubling edge objects doubles the number of crossing edges of every partition. -/
theorem crossingEdges_doubleGraph_card (P : Setoid V) :
    ((H.doubleGraph).crossingEdges P).card =
      2 * (H.crossingEdges P).card := by
  classical
  have hEq : (H.doubleGraph).crossingEdges P =
      (H.crossingEdges P).product (Finset.univ : Finset (Fin 2)) := by
    ext e
    simp [crossingEdges, doubleGraph]
  rw [hEq]
  simp [Finset.card_product, Nat.mul_comm]

private theorem sum_xor_eq_two {α : Type*} [Fintype α] [DecidableEq α]
    (a b : α) (hab : a ≠ b) :
    ∑ q : α, (if (a = q) ≠ (b = q) then 1 else 0) = 2 := by
  calc
    ∑ q : α, (if (a = q) ≠ (b = q) then 1 else 0) =
        ∑ q : α, ((if a = q then 1 else 0) + if b = q then 1 else 0) := by
      apply Finset.sum_congr rfl
      intro q _
      by_cases ha : a = q
      · by_cases hb : b = q
        · exact (hab (ha.trans hb.symm)).elim
        · simp [ha, hb]
      · by_cases hb : b = q <;> simp [ha, hb]
    _ = (∑ q : α, if a = q then 1 else 0) +
        ∑ q : α, if b = q then 1 else 0 := Finset.sum_add_distrib
    _ = 2 := by simp

omit [DecidableEq V] [DecidableEq E] in
@[simp]
theorem mem_cut_classFinset {P : Setoid V} {q : Quotient P} {e : E} :
    e ∈ H.cut (classFinset P q) ↔
      (Quotient.mk P (H.endAt e 0) = q) ≠
        (Quotient.mk P (H.endAt e 1) = q) := by
  classical
  simp [cut, Crosses]

omit [DecidableEq V] in
/-- Summing the cuts of all partition classes counts each crossing edge twice. -/
theorem sum_card_cut_classFinset (P : Setoid V) :
    (∑ q : Quotient P, (H.cut (classFinset P q)).card) =
      2 * (H.crossingEdges P).card := by
  classical
  calc
    (∑ q : Quotient P, (H.cut (classFinset P q)).card) =
        ∑ q : Quotient P, ∑ e : E,
          if e ∈ H.cut (classFinset P q) then 1 else 0 := by
      apply Finset.sum_congr rfl
      intro q _
      calc
        (H.cut (classFinset P q)).card =
            ∑ e ∈ H.cut (classFinset P q), 1 := Finset.card_eq_sum_ones _
        _ = ∑ e : E, if e ∈ H.cut (classFinset P q) then 1 else 0 := by
          rw [← Finset.sum_filter]
          congr 1
          ext e
          simp
    _ = ∑ e : E, ∑ q : Quotient P,
          if e ∈ H.cut (classFinset P q) then 1 else 0 := Finset.sum_comm
    _ = ∑ e : E, if e ∈ H.crossingEdges P then 2 else 0 := by
      apply Finset.sum_congr rfl
      intro e _
      let a : Quotient P := Quotient.mk P (H.endAt e 0)
      let b : Quotient P := Quotient.mk P (H.endAt e 1)
      by_cases hab : a = b
      · have hrel : P.r (H.endAt e 0) (H.endAt e 1) := Quotient.eq'.mp hab
        have hnot : e ∉ H.crossingEdges P := by
          simp [crossingEdges, hrel]
        simp [mem_cut_classFinset, a, b, hab, hnot]
      · have hnrel : ¬ P.r (H.endAt e 0) (H.endAt e 1) := by
          intro hrel
          exact hab (Quotient.sound hrel)
        have hmem : e ∈ H.crossingEdges P := by
          simp [crossingEdges, hnrel]
        rw [if_pos hmem]
        simpa [mem_cut_classFinset, a, b] using sum_xor_eq_two a b hab
    _ = 2 * (H.crossingEdges P).card := by
      calc
        (∑ e : E, if e ∈ H.crossingEdges P then 2 else 0) =
            ∑ e ∈ H.crossingEdges P, 2 := by
          rw [← Finset.sum_filter]
          congr 1
          ext e
          simp
        _ = 2 * (H.crossingEdges P).card := by
          simp [Nat.mul_comm]

omit [DecidableEq V] in
/-- Three-edge-connectivity of `H` makes its doubled graph satisfy the
Nash-Williams--Tutte condition for three spanning trees. -/
theorem doubleGraph_satisfiesTreePackingCondition_of_threeEdgeConnected [Nonempty V]
    (h3 : H.IsThreeEdgeConnected) :
    (H.doubleGraph).SatisfiesTreePackingCondition 3 := by
  intro P
  by_cases hsub : Subsingleton (Quotient P)
  · have hcard : Nat.card (Quotient P) ≤ 1 := by
      simpa [Nat.card_eq_fintype_card] using
        (Fintype.card_le_one_iff_subsingleton.mpr hsub)
    omega
  · letI : Nontrivial (Quotient P) := not_subsingleton_iff_nontrivial.mp hsub
    have hsum : (∑ _q : Quotient P, 3) ≤
        ∑ q : Quotient P, (H.cut (classFinset P q)).card := by
      apply Finset.sum_le_sum
      intro q _
      exact h3 (classFinset P q) (classFinset_nonempty P q)
        (classFinset_ne_univ P q)
    have hleft : (∑ _q : Quotient P, 3) = 3 * Nat.card (Quotient P) := by
      simp [Nat.card_eq_fintype_card, Nat.mul_comm]
    rw [hleft, H.sum_card_cut_classFinset P] at hsum
    rw [H.crossingEdges_doubleGraph_card P]
    omega

/-- A three-edge-connected graph has three spanning trees such that every original edge
is omitted by at least one of them.  Pack three trees in the doubled multigraph and then
forget which of the two copies was used. -/
theorem exists_three_spanningTrees_omitting_each_edge [Nonempty V]
    (h3 : H.IsThreeEdgeConnected) :
    ∃ T : Fin 3 → Finset E,
      (∀ i, H.IsSpanningTree (T i)) ∧
        ∀ e : E, ∃ i : Fin 3, e ∉ T i := by
  classical
  have hpack : (H.doubleGraph).HasTreePacking 3 :=
    ((H.doubleGraph).nashWilliamsTutte 3).2
      (H.doubleGraph_satisfiesTreePackingCondition_of_threeEdgeConnected h3)
  obtain ⟨U, hUtree, hUdisj⟩ := hpack
  let T : Fin 3 → Finset E := fun i => (U i).image Prod.fst
  have hTtree : ∀ i, H.IsSpanningTree (T i) := by
    intro i
    have hconn : H.Connects (T i) := by
      refine { preconnected := ?_ }
      intro u v
      apply FiniteGraph.reachable_of_adj_reachable
        (H := (H.doubleGraph).supportGraph (U i))
        (K := H.supportGraph (T i))
      · intro x y hxy
        rw [(H.doubleGraph).supportGraph_adj_iff (U i) x y] at hxy
        apply SimpleGraph.Adj.reachable
        rw [H.supportGraph_adj_iff (T i) x y]
        rcases hxy with ⟨hxy, e, heU, hends⟩
        refine ⟨hxy, e.1, ?_, ?_⟩
        · exact Finset.mem_image.mpr ⟨e, heU, rfl⟩
        · simpa [doubleGraph] using hends
      · exact (hUtree i).1.preconnected u v
    have hinj : Set.InjOn Prod.fst (U i : Set (E × Fin 2)) := by
      intro a ha b hb hab
      apply (H.doubleGraph).symEdge_injOn_of_spanningTree (hUtree i) ha hb
      simp [symEdge, doubleGraph, hab]
    have hcard : (T i).card = (U i).card := by
      exact Finset.card_image_of_injOn hinj
    exact ⟨hconn, by rw [hcard]; exact (hUtree i).2⟩
  refine ⟨T, hTtree, ?_⟩
  intro e
  by_contra hall
  push Not at hall
  choose x hxU hxe using fun i => Finset.mem_image.mp (hall i)
  let j : Fin 3 → Fin 2 := fun i => (x i).2
  have hjinj : Function.Injective j := by
    intro i k hj
    have hx : x i = x k := by
      apply Prod.ext
      · exact (hxe i).trans (hxe k).symm
      · exact hj
    by_contra hik
    exact (Finset.disjoint_left.mp (hUdisj i k hik)
      (hxU i) (hx ▸ hxU k)).elim
  have hle := Fintype.card_le_of_injective j hjinj
  norm_num at hle

/-- The direct Jaeger construction in the three-edge-connected case. -/
theorem nowhereZeroGammaFlow_of_threeEdgeConnected [Nonempty V]
    (h3 : H.IsThreeEdgeConnected) :
    Nonempty (H.NowhereZeroFlow Gamma) := by
  obtain ⟨T, hTtree, homit⟩ := H.exists_three_spanningTrees_omitting_each_edge h3
  choose F hEven hsup using fun i =>
    H.exists_even_superset_compl_of_spanningTree (T i) (hTtree i)
  apply H.nowhereZeroGammaFlow_of_evenCover F hEven
  intro e
  obtain ⟨i, hei⟩ := homit e
  exact ⟨i, hsup i e hei⟩

/-- The equivalence relation obtained by contracting one edge object. -/
def contractEdgeSetoid (e : E) : Setoid V where
  r u v := u = v ∨
    (u = H.endAt e 0 ∧ v = H.endAt e 1) ∨
      (u = H.endAt e 1 ∧ v = H.endAt e 0)
  iseqv := by
    constructor
    · intro u
      exact Or.inl rfl
    · intro u v huv
      rcases huv with rfl | ⟨rfl, rfl⟩ | ⟨rfl, rfl⟩
      · exact Or.inl rfl
      · exact Or.inr (Or.inr ⟨rfl, rfl⟩)
      · exact Or.inr (Or.inl ⟨rfl, rfl⟩)
    · intro u v w huv hvw
      rcases huv with rfl | ⟨rfl, rfl⟩ | ⟨rfl, rfl⟩
      · exact hvw
      · rcases hvw with rfl | ⟨h, _⟩ | ⟨_, rfl⟩
        · exact Or.inr (Or.inl ⟨rfl, rfl⟩)
        · exact (H.loopless e h.symm).elim
        · exact Or.inl rfl
      · rcases hvw with rfl | ⟨_, rfl⟩ | ⟨h, _⟩
        · exact Or.inr (Or.inr ⟨rfl, rfl⟩)
        · exact Or.inl rfl
        · exact (H.loopless e h).elim

/-- An original edge survives contraction when its two ends do not become equal. -/
def SurvivesContraction (e f : E) : Prop :=
  ¬ (H.contractEdgeSetoid e).r (H.endAt f 0) (H.endAt f 1)

noncomputable instance contractEdgeQuotientDecidableEq (e : E) :
    DecidableEq (Quotient (H.contractEdgeSetoid e)) := Classical.decEq _

noncomputable instance survivesContractionDecidablePred (e : E) :
    DecidablePred (H.SurvivesContraction e) := Classical.decPred _

noncomputable instance survivesContractionFintype (e : E) :
    Fintype {f : E // H.SurvivesContraction e f} :=
  Fintype.ofFinite _

/-- Contract one edge and discard precisely the edge objects that become loops. -/
noncomputable def contractEdge (e : E) :
    FiniteGraph (Quotient (H.contractEdgeSetoid e))
      {f : E // H.SurvivesContraction e f} := by
  classical
  letI : Fintype (Quotient (H.contractEdgeSetoid e)) := Fintype.ofFinite _
  letI : Fintype {f : E // H.SurvivesContraction e f} := Fintype.ofFinite _
  exact
    { endAt := fun f i => Quotient.mk _ (H.endAt f.1 i)
      loopless := by
        intro f h
        exact f.2 (Quotient.eq'.mp h) }

omit [DecidableEq V] [DecidableEq E] in
theorem not_survives_contracted_edge (e : E) :
    ¬ H.SurvivesContraction e e := by
  intro h
  apply h
  exact Or.inr (Or.inl ⟨rfl, rfl⟩)

/-- Pull a vertex set of a contracted graph back to the original vertices. -/
noncomputable def contractionPullback (e : E)
    (A : Finset (Quotient (H.contractEdgeSetoid e))) : Finset V := by
  classical
  exact Finset.univ.filter fun v => Quotient.mk (H.contractEdgeSetoid e) v ∈ A

omit [DecidableEq V] [DecidableEq E] in
@[simp]
theorem mem_contractionPullback {e : E}
    {A : Finset (Quotient (H.contractEdgeSetoid e))} {v : V} :
    v ∈ H.contractionPullback e A ↔
      Quotient.mk (H.contractEdgeSetoid e) v ∈ A := by
  classical
  simp [contractionPullback]

omit [DecidableEq V] [DecidableEq E] in
theorem not_crosses_contractionPullback_of_not_survives {e f : E}
    (A : Finset (Quotient (H.contractEdgeSetoid e)))
    (hf : ¬ H.SurvivesContraction e f) :
    ¬ H.Crosses (H.contractionPullback e A) f := by
  classical
  have hrel : (H.contractEdgeSetoid e).r (H.endAt f 0) (H.endAt f 1) :=
    not_not.mp hf
  have hq : Quotient.mk (H.contractEdgeSetoid e) (H.endAt f 0) =
      Quotient.mk (H.contractEdgeSetoid e) (H.endAt f 1) := Quotient.sound hrel
  intro hcross
  unfold Crosses at hcross
  apply hcross
  simp [hq]

omit [DecidableEq V] [DecidableEq E] in
theorem mem_contractEdge_cut_iff {e : E}
    (A : Finset (Quotient (H.contractEdgeSetoid e)))
    (f : {f : E // H.SurvivesContraction e f}) :
    f ∈ (H.contractEdge e).cut A ↔
      f.1 ∈ H.cut (H.contractionPullback e A) := by
  classical
  simp [cut, Crosses, contractEdge]

omit [DecidableEq V] [DecidableEq E] in
/-- Contracting an edge and discarding the resulting loops preserves bridgelessness. -/
theorem contractEdge_bridgeless (e : E) (hb : H.Bridgeless) :
    (H.contractEdge e).Bridgeless := by
  classical
  intro A hcard
  obtain ⟨f, hf⟩ := Finset.card_eq_one.mp hcard
  let S := H.contractionPullback e A
  have hcut : H.cut S = {f.1} := by
    ext g
    constructor
    · intro hg
      have hcross : H.Crosses S g := (Finset.mem_filter.mp hg).2
      have hsurv : H.SurvivesContraction e g := by
        intro hnot
        exact (H.not_crosses_contractionPullback_of_not_survives A
          (fun hs => hs hnot)) hcross
      let g' : {g : E // H.SurvivesContraction e g} := ⟨g, hsurv⟩
      have hg' : g' ∈ (H.contractEdge e).cut A :=
        (H.mem_contractEdge_cut_iff A g').2 hg
      have hgf : g' = f := by simpa [hf] using hg'
      simpa using congrArg Subtype.val hgf
    · intro hg
      have hgf : g = f.1 := by simpa using hg
      subst g
      have hfmem : f ∈ (H.contractEdge e).cut A := by simp [hf]
      exact (H.mem_contractEdge_cut_iff A f).1 hfmem
  apply hb S
  rw [hcut]
  simp

omit [DecidableEq V] [DecidableEq E] in
theorem quotient_mk_contractEdge_eq_iff_of_ne_endpoints {e : E} {x v : V}
    (hv0 : v ≠ H.endAt e 0) (hv1 : v ≠ H.endAt e 1) :
    Quotient.mk (H.contractEdgeSetoid e) x =
        Quotient.mk (H.contractEdgeSetoid e) v ↔ x = v := by
  constructor
  · intro h
    rcases Quotient.eq'.mp h with h | ⟨_, hv⟩ | ⟨_, hv⟩
    · exact h
    · exact (hv1 hv).elim
    · exact (hv0 hv).elim
  · intro h
    subst x
    rfl

omit [DecidableEq V] in
/-- For a two-edge cut, the only original edges discarded when the first cut edge is
contracted are the two cut edges themselves. -/
theorem eq_contractEdge_or_eq_second_of_not_survives_of_twoCut
    (S : Finset V) {e₁ e₂ f : E}
    (hcut : H.cut S = {e₁, e₂}) (he₁ : e₁ ∈ H.cut S)
    (hf : ¬ H.SurvivesContraction e₁ f) : f = e₁ ∨ f = e₂ := by
  classical
  have hrel : (H.contractEdgeSetoid e₁).r (H.endAt f 0) (H.endAt f 1) :=
    not_not.mp hf
  rcases hrel with hloop | hends | hends
  · exact (H.loopless f hloop).elim
  · have hcross₁ : H.Crosses S e₁ := (Finset.mem_filter.mp he₁).2
    have hcross : H.Crosses S f := by
      unfold Crosses at hcross₁ ⊢
      simpa [hends.1, hends.2] using hcross₁
    have hfcut : f ∈ H.cut S := Finset.mem_filter.mpr ⟨Finset.mem_univ _, hcross⟩
    rw [hcut] at hfcut
    simpa using hfcut
  · have hcross₁ : H.Crosses S e₁ := (Finset.mem_filter.mp he₁).2
    have hcross : H.Crosses S f := by
      unfold Crosses at hcross₁ ⊢
      simpa [hends.1, hends.2] using hcross₁.symm
    have hfcut : f ∈ H.cut S := Finset.mem_filter.mpr ⟨Finset.mem_univ _, hcross⟩
    rw [hcut] at hfcut
    simpa using hfcut

omit [DecidableEq V] [DecidableEq E] in
theorem endAt_ne_of_not_survives_of_ne_contract_endpoints {e f : E} {v : V}
    (hf : ¬ H.SurvivesContraction e f)
    (hv0 : v ≠ H.endAt e 0) (hv1 : v ≠ H.endAt e 1) (j : Fin 2) :
    H.endAt f j ≠ v := by
  have hrel : (H.contractEdgeSetoid e).r (H.endAt f 0) (H.endAt f 1) :=
    not_not.mp hf
  rcases hrel with hloop | hends | hends
  · exact (H.loopless f hloop).elim
  · fin_cases j
    · simpa [hends.1] using hv0.symm
    · simpa [hends.2] using hv1.symm
  · fin_cases j
    · simpa [hends.1] using hv1.symm
    · simpa [hends.2] using hv0.symm

/-- A fixed nonzero element of `Gamma`, used only when both edges of a two-cut become
parallel loops after contraction. -/
def gammaUnit : Gamma := Pi.single 0 1

theorem gammaUnit_ne_zero : gammaUnit ≠ (0 : Gamma) := by
  intro h
  have h0 := congrFun h 0
  simp [gammaUnit] at h0

theorem gamma_neg_eq_self (x : Gamma) : -x = x := by
  funext i
  exact ZMod.neg_eq_self_mod_two _

theorem gamma_add_self_eq_zero (x : Gamma) : x + x = 0 := by
  funext i
  exact CharTwo.add_self_eq_zero _

/-- In characteristic two the signed boundary sum over a vertex set is just the sum of
the values on its cut edges. -/
theorem sum_cut_term_gamma_eq_sum_cut (φ : E → Gamma) (S : Finset V) :
    (∑ e : E,
      ((if H.endAt e 0 ∈ S then φ e else 0) -
        (if H.endAt e 1 ∈ S then φ e else 0))) =
      ∑ e ∈ H.cut S, φ e := by
  classical
  calc
    (∑ e : E,
      ((if H.endAt e 0 ∈ S then φ e else 0) -
        (if H.endAt e 1 ∈ S then φ e else 0))) =
        ∑ e : E, if e ∈ H.cut S then φ e else 0 := by
      apply Finset.sum_congr rfl
      intro e _
      by_cases h0 : H.endAt e 0 ∈ S <;> by_cases h1 : H.endAt e 1 ∈ S
      · have hnot : e ∉ H.cut S := by simp [cut, Crosses, h0, h1]
        simp [h0, h1, hnot]
      · have hmem : e ∈ H.cut S := by simp [cut, Crosses, h0, h1]
        simp [h0, h1, hmem]
      · have hmem : e ∈ H.cut S := by simp [cut, Crosses, h0, h1]
        simp [h0, h1, hmem, gamma_neg_eq_self]
      · have hnot : e ∉ H.cut S := by simp [cut, Crosses, h0, h1]
        simp [h0, h1, hnot]
    _ = ∑ e ∈ H.cut S, φ e := by
      rw [← Finset.sum_filter]
      congr 1
      ext e
      simp

omit [DecidableEq E] in
theorem sum_lift_off_contract_endpoints {e : E}
    (ψ : (H.contractEdge e).NowhereZeroFlow Gamma) (a : Gamma)
    {v : V} (hv0 : v ≠ H.endAt e 0) (hv1 : v ≠ H.endAt e 1)
    (j : Fin 2) :
    (∑ f : E, if H.endAt f j = v then
        (if hf : H.SurvivesContraction e f then ψ.val ⟨f, hf⟩ else a) else 0) =
      ∑ f : {f : E // H.SurvivesContraction e f},
        if (H.contractEdge e).endAt f j = Quotient.mk _ v then ψ.val f else 0 := by
  classical
  let g : E → Gamma := fun f =>
    if hf : H.SurvivesContraction e f then
      if H.endAt f j = v then ψ.val ⟨f, hf⟩ else 0
    else 0
  calc
    (∑ f : E, if H.endAt f j = v then
        (if hf : H.SurvivesContraction e f then ψ.val ⟨f, hf⟩ else a) else 0) =
        ∑ f : E, g f := by
      apply Finset.sum_congr rfl
      intro f _
      by_cases hf : H.SurvivesContraction e f
      · simp [g, hf]
      · have hfv : H.endAt f j ≠ v :=
          H.endAt_ne_of_not_survives_of_ne_contract_endpoints hf hv0 hv1 j
        simp [g, hf, hfv]
    _ = ∑ f : {f : E // H.SurvivesContraction e f}, g f.1 := by
      calc
        (∑ f : E, g f) =
            ∑ f ∈ (Finset.univ.filter fun f => H.SurvivesContraction e f), g f := by
          rw [Finset.sum_filter]
          apply Finset.sum_congr rfl
          intro f _
          by_cases hf : H.SurvivesContraction e f <;> simp [g, hf]
        _ = ∑ f : {f : E // H.SurvivesContraction e f}, g f.1 := by
          symm
          simpa using (Finset.sum_subtype_eq_sum_filter
            (s := (Finset.univ : Finset E))
            (p := fun f => H.SurvivesContraction e f) g)
    _ = ∑ f : {f : E // H.SurvivesContraction e f},
        if (H.contractEdge e).endAt f j = Quotient.mk _ v then ψ.val f else 0 := by
      apply Finset.sum_congr rfl
      intro f _
      have hq : (H.contractEdge e).endAt f j = Quotient.mk _ v ↔
          H.endAt f.1 j = v := by
        change Quotient.mk (H.contractEdgeSetoid e) (H.endAt f.1 j) =
            Quotient.mk (H.contractEdgeSetoid e) v ↔ _
        exact H.quotient_mk_contractEdge_eq_iff_of_ne_endpoints hv0 hv1
      simp [g, f.2, hq]

/-- A `Gamma`-flow on the contraction of one edge of a two-edge cut lifts across that
cut.  The contracted edge receives the value of the other cut edge; if the two cut
edges are parallel and both disappear, they receive the fixed value `gammaUnit`. -/
theorem nowhereZeroGammaFlow_of_contractEdge_of_twoCut
    (S : Finset V) {e₁ e₂ : E}
    (hcut : H.cut S = {e₁, e₂})
    (he₁ : e₁ ∈ H.cut S) (he₁₂ : e₁ ≠ e₂)
    (hψ : Nonempty ((H.contractEdge e₁).NowhereZeroFlow Gamma)) :
    Nonempty (H.NowhereZeroFlow Gamma) := by
  classical
  obtain ⟨ψ⟩ := hψ
  let a : Gamma :=
    if he₂s : H.SurvivesContraction e₁ e₂ then ψ.val ⟨e₂, he₂s⟩ else gammaUnit
  have ha : a ≠ 0 := by
    dsimp [a]
    split
    · exact ψ.nowhereZero _
    · exact gammaUnit_ne_zero
  let φ : E → Gamma := fun e =>
    if he : H.SurvivesContraction e₁ e then ψ.val ⟨e, he⟩ else a
  have hφe₁ : φ e₁ = a := by
    simp [φ, H.not_survives_contracted_edge]
  have hφe₂ : φ e₂ = a := by
    by_cases he₂s : H.SurvivesContraction e₁ e₂
    · simp [φ, a, he₂s]
    · simp [φ, a, he₂s]
  let d : V → Gamma := fun v =>
    (∑ e : E, if H.endAt e 0 = v then φ e else 0) -
      ∑ e : E, if H.endAt e 1 = v then φ e else 0
  have hoff (v : V) (hv0 : v ≠ H.endAt e₁ 0) (hv1 : v ≠ H.endAt e₁ 1) :
      d v = 0 := by
    dsimp [d]
    rw [H.sum_lift_off_contract_endpoints ψ a hv0 hv1 0,
      H.sum_lift_off_contract_endpoints ψ a hv0 hv1 1]
    exact ψ.conservation (Quotient.mk (H.contractEdgeSetoid e₁) v)
  have hsumS : ∑ v ∈ S, d v = 0 := by
    have h := H.sum_conservation_eq_cut φ S
    change (∑ v ∈ S, d v) =
      (∑ e : E,
        ((if H.endAt e 0 ∈ S then φ e else 0) -
          (if H.endAt e 1 ∈ S then φ e else 0))) at h
    rw [H.sum_cut_term_gamma_eq_sum_cut φ S, hcut] at h
    simpa [he₁₂, hφe₁, hφe₂, gamma_add_self_eq_zero] using h
  have hsumUniv : ∑ v : V, d v = 0 := by
    have h := H.sum_conservation_eq_cut φ (Finset.univ : Finset V)
    change (∑ v ∈ (Finset.univ : Finset V), d v) =
      (∑ e : E,
        ((if H.endAt e 0 ∈ (Finset.univ : Finset V) then φ e else 0) -
          (if H.endAt e 1 ∈ (Finset.univ : Finset V) then φ e else 0))) at h
    rw [H.sum_cut_term_gamma_eq_sum_cut φ (Finset.univ : Finset V)] at h
    simpa [cut, Crosses] using h
  have hcross₁ : H.Crosses S e₁ := (Finset.mem_filter.mp he₁).2
  have hendsZero : d (H.endAt e₁ 0) = 0 ∧ d (H.endAt e₁ 1) = 0 := by
    by_cases h0 : H.endAt e₁ 0 ∈ S
    · have h1 : H.endAt e₁ 1 ∉ S := by
        intro h1
        exact hcross₁ (propext ⟨fun _ => h1, fun _ => h0⟩)
      have hd0 : d (H.endAt e₁ 0) = 0 := by
        have hsingle : ∑ v ∈ S, d v = d (H.endAt e₁ 0) := by
          apply Finset.sum_eq_single (H.endAt e₁ 0)
          · intro v hv hvne
            exact hoff v hvne (fun h => h1 (h ▸ hv))
          · intro hnot
            exact (hnot h0).elim
        rw [← hsingle]
        exact hsumS
      have hd1 : d (H.endAt e₁ 1) = 0 := by
        have hsingle : ∑ v : V, d v = d (H.endAt e₁ 1) := by
          apply Fintype.sum_eq_single
          intro v hvne
          by_cases hv0 : v = H.endAt e₁ 0
          · simpa [hv0] using hd0
          · exact hoff v hv0 hvne
        rw [← hsingle]
        exact hsumUniv
      exact ⟨hd0, hd1⟩
    · have h1 : H.endAt e₁ 1 ∈ S := by
        by_contra h1
        exact hcross₁ (propext ⟨fun h => (h0 h).elim, fun h => (h1 h).elim⟩)
      have hd1 : d (H.endAt e₁ 1) = 0 := by
        have hsingle : ∑ v ∈ S, d v = d (H.endAt e₁ 1) := by
          apply Finset.sum_eq_single (H.endAt e₁ 1)
          · intro v hv hvne
            exact hoff v (fun h => h0 (h ▸ hv)) hvne
          · intro hnot
            exact (hnot h1).elim
        rw [← hsingle]
        exact hsumS
      have hd0 : d (H.endAt e₁ 0) = 0 := by
        have hsingle : ∑ v : V, d v = d (H.endAt e₁ 0) := by
          apply Fintype.sum_eq_single
          intro v hvne
          by_cases hv1 : v = H.endAt e₁ 1
          · simpa [hv1] using hd1
          · exact hoff v hvne hv1
        rw [← hsingle]
        exact hsumUniv
      exact ⟨hd0, hd1⟩
  refine ⟨⟨φ, ?_, ?_⟩⟩
  · intro v
    change d v = 0
    by_cases hv0 : v = H.endAt e₁ 0
    · simpa [hv0] using hendsZero.1
    · by_cases hv1 : v = H.endAt e₁ 1
      · simpa [hv1] using hendsZero.2
      · exact hoff v hv0 hv1
  · intro e
    dsimp [φ]
    split
    · exact ψ.nowhereZero _
    · exact ha

omit [DecidableEq E] in
/-- A nontrivial vertex shore of a connected graph has a crossing edge. -/
theorem cut_nonempty_of_connects [Nonempty V] (hconn : H.Connects Finset.univ)
    (S : Finset V) (hS : S.Nonempty) (hSne : S ≠ Finset.univ) :
    (H.cut S).Nonempty := by
  classical
  by_contra hcut
  have hcutempty : H.cut S = ∅ := Finset.not_nonempty_iff_eq_empty.mp hcut
  obtain ⟨u, hu⟩ := hS
  have hcompl : (Finset.univ \ S).Nonempty :=
    Finset.sdiff_nonempty.mpr (by simpa using hSne)
  obtain ⟨v, hv⟩ := hcompl
  have hvS : v ∉ S := (Finset.mem_sdiff.mp hv).2
  have hreach := hconn.preconnected u v
  rcases hreach with ⟨p⟩
  have hprop : ∀ {x y : V}, (H.supportGraph Finset.univ).Adj x y →
      x ∈ S → y ∈ S := by
    intro x y hxy hx
    rw [H.supportGraph_adj_iff Finset.univ x y] at hxy
    rcases hxy with ⟨_, e, _, hends | hends⟩
    · by_contra hy
      have hecut : e ∈ H.cut S := by
        simp [cut, Crosses, hends.1, hends.2, hx, hy]
      rw [hcutempty] at hecut
      simp at hecut
    · by_contra hy
      have hecut : e ∈ H.cut S := by
        simp [cut, Crosses, hends.1, hends.2, hx, hy]
      rw [hcutempty] at hecut
      simp at hecut
  have hvmem : v ∈ S := by
    have hwalk : ∀ {x y : V} (p : (H.supportGraph Finset.univ).Walk x y),
        x ∈ S → y ∈ S := by
      intro x y p
      induction p with
      | nil => intro hx; exact hx
      | @cons x y z hxy p ih =>
          intro hx
          exact ih (hprop hxy hx)
    exact hwalk p hu
  exact (hvS hvmem).elim

omit [DecidableEq V] [DecidableEq E] in
/-- Contracting an edge preserves connectedness after the resulting loops are discarded. -/
theorem contractEdge_connects_univ [Nonempty V] (e : E)
    (hconn : H.Connects Finset.univ) :
    (H.contractEdge e).Connects Finset.univ := by
  classical
  letI : Nonempty (Quotient (H.contractEdgeSetoid e)) :=
    Nonempty.map (Quotient.mk (H.contractEdgeSetoid e)) inferInstance
  refine { preconnected := ?_ }
  intro q r
  induction q using Quotient.inductionOn with
  | _ u =>
      induction r using Quotient.inductionOn with
      | _ v =>
          apply FiniteGraph.reachable_map_of_adj_reachable
            (fun x => Quotient.mk (H.contractEdgeSetoid e) x)
          · intro x y hxy
            rw [H.supportGraph_adj_iff Finset.univ x y] at hxy
            rcases hxy with ⟨hxy, f, _, hends | hends⟩
            · by_cases hf : H.SurvivesContraction e f
              · apply SimpleGraph.Adj.reachable
                rw [(H.contractEdge e).supportGraph_adj_iff Finset.univ]
                exact ⟨by
                  intro h
                  apply hf
                  simpa [hends.1, hends.2] using Quotient.eq'.mp h, ⟨f, hf⟩, by simp,
                  Or.inl ⟨by simp [contractEdge, hends.1],
                    by simp [contractEdge, hends.2]⟩⟩
              · have hEq : Quotient.mk (H.contractEdgeSetoid e) x =
                    Quotient.mk (H.contractEdgeSetoid e) y := by
                  apply Quotient.sound
                  simpa [hends.1, hends.2] using not_not.mp hf
                rw [hEq]
            · by_cases hf : H.SurvivesContraction e f
              · apply SimpleGraph.Adj.reachable
                rw [(H.contractEdge e).supportGraph_adj_iff Finset.univ]
                exact ⟨by
                  intro h
                  apply hf
                  simpa [hends.1, hends.2] using
                    (H.contractEdgeSetoid e).symm (Quotient.eq'.mp h), ⟨f, hf⟩, by simp,
                  Or.inr ⟨by simp [contractEdge, hends.1],
                    by simp [contractEdge, hends.2]⟩⟩
              · have hEq : Quotient.mk (H.contractEdgeSetoid e) x =
                    Quotient.mk (H.contractEdgeSetoid e) y := by
                  apply Quotient.sound
                  simpa [hends.1, hends.2] using
                    (H.contractEdgeSetoid e).symm (not_not.mp hf)
                rw [hEq]
          · exact hconn.preconnected u v

omit [DecidableEq V] [DecidableEq E] in
theorem card_contractEdge_lt [Nonempty V] (e : E) :
    Fintype.card (Quotient (H.contractEdgeSetoid e)) < Fintype.card V := by
  apply Fintype.card_lt_of_surjective_not_injective
    (Quotient.mk (H.contractEdgeSetoid e))
  · intro q
    induction q using Quotient.inductionOn with
    | _ v => exact ⟨v, rfl⟩
  · intro hinj
    apply H.loopless e
    apply hinj
    apply Quotient.sound
    exact Or.inr (Or.inl ⟨rfl, rfl⟩)

/-- Connected bridgeless graphs have a nowhere-zero `Gamma`-flow.  A two-edge cut is
contracted recursively; when no such cut remains, the doubled-edge tree packing above
applies. -/
theorem jaegerKilpatrickEightFlow_connected
    {W F : Type*} [Fintype W] [Fintype F] [DecidableEq W] [DecidableEq F]
    (K : FiniteGraph W F) [Nonempty W]
    (hconn : K.Connects Finset.univ) (hb : K.Bridgeless) :
    Nonempty (K.NowhereZeroFlow Gamma) := by
  classical
  by_cases h3 : K.IsThreeEdgeConnected
  · exact K.nowhereZeroGammaFlow_of_threeEdgeConnected h3
  · unfold IsThreeEdgeConnected at h3
    push Not at h3
    obtain ⟨S, hS, hSne, hlt⟩ := h3
    have hcutne : (K.cut S).Nonempty := K.cut_nonempty_of_connects hconn S hS hSne
    have hcardne : (K.cut S).card ≠ 1 := hb S
    have hcard : (K.cut S).card = 2 := by
      have hpos := hcutne.card_pos
      omega
    obtain ⟨e₁, e₂, he₁₂, hcut⟩ := Finset.card_eq_two.mp hcard
    have he₁ : e₁ ∈ K.cut S := by simp [hcut]
    have he₂ : e₂ ∈ K.cut S := by simp [hcut]
    letI : Nonempty (Quotient (K.contractEdgeSetoid e₁)) :=
      Nonempty.map (Quotient.mk (K.contractEdgeSetoid e₁)) inferInstance
    have hrec : Nonempty ((K.contractEdge e₁).NowhereZeroFlow Gamma) :=
      jaegerKilpatrickEightFlow_connected (K.contractEdge e₁)
        (K.contractEdge_connects_univ e₁ hconn) (K.contractEdge_bridgeless e₁ hb)
    exact K.nowhereZeroGammaFlow_of_contractEdge_of_twoCut S hcut he₁ he₁₂ hrec
termination_by Fintype.card W
decreasing_by
  exact K.card_contractEdge_lt e₁

omit [DecidableEq V] [DecidableEq E] in
/-- The component relation of the full support graph relates the two ends of every edge. -/
theorem endpoints_componentSetoid_rel (e : E) :
    (H.componentSetoid Finset.univ).r (H.endAt e 0) (H.endAt e 1) := by
  change (H.supportGraph Finset.univ).Reachable (H.endAt e 0) (H.endAt e 1)
  apply SimpleGraph.Adj.reachable
  rw [H.supportGraph_adj_iff Finset.univ]
  exact ⟨H.loopless e, e, by simp, Or.inl ⟨rfl, rfl⟩⟩

/-- Vertices of one connected component of the full support graph. -/
abbrev ComponentVertex (q : Quotient (H.componentSetoid Finset.univ)) :=
  {v : V // Quotient.mk (H.componentSetoid Finset.univ) v = q}

/-- Edge objects whose first endpoint lies in one connected component. -/
abbrev ComponentEdge (q : Quotient (H.componentSetoid Finset.univ)) :=
  {e : E // Quotient.mk (H.componentSetoid Finset.univ) (H.endAt e 0) = q}

noncomputable instance componentVertexFintype
    (q : Quotient (H.componentSetoid Finset.univ)) : Fintype (H.ComponentVertex q) :=
  Fintype.ofFinite _

noncomputable instance componentEdgeFintype
    (q : Quotient (H.componentSetoid Finset.univ)) : Fintype (H.ComponentEdge q) :=
  Fintype.ofFinite _

/-- The finite graph induced by one connected component, keeping genuine edge objects. -/
noncomputable def componentGraph
    (q : Quotient (H.componentSetoid Finset.univ)) :
    FiniteGraph (H.ComponentVertex q) (H.ComponentEdge q) where
  endAt e i := if i = 0 then
      ⟨H.endAt e.1 0, e.2⟩
    else
      ⟨H.endAt e.1 1, by
        have hEq : Quotient.mk (H.componentSetoid Finset.univ) (H.endAt e.1 1) =
            Quotient.mk (H.componentSetoid Finset.univ) (H.endAt e.1 0) :=
          (Quotient.sound (H.endpoints_componentSetoid_rel e.1)).symm
        exact hEq.trans e.2⟩
  loopless := by
    intro e h
    apply H.loopless e.1
    exact congrArg Subtype.val h

omit [DecidableEq V] [DecidableEq E] in
theorem componentGraph_connects_univ
    (q : Quotient (H.componentSetoid Finset.univ)) :
    (H.componentGraph q).Connects Finset.univ := by
  classical
  letI : Nonempty (H.ComponentVertex q) := by
    induction q using Quotient.inductionOn with
    | _ v => exact ⟨⟨v, rfl⟩⟩
  refine { preconnected := ?_ }
  intro u v
  have huvRel : (H.componentSetoid Finset.univ).r u.1 v.1 :=
    Quotient.eq'.mp (u.2.trans v.2.symm)
  change (H.supportGraph Finset.univ).Reachable u.1 v.1 at huvRel
  rcases huvRel with ⟨p⟩
  have hwalk : ∀ {x y : V} (p : (H.supportGraph Finset.univ).Walk x y)
      (hx : Quotient.mk (H.componentSetoid Finset.univ) x = q)
      (hy : Quotient.mk (H.componentSetoid Finset.univ) y = q),
      (H.componentGraph q).ReachableIn Finset.univ ⟨x, hx⟩ ⟨y, hy⟩ := by
    intro x y p
    induction p with
    | nil =>
        intro hx _
        exact SimpleGraph.Reachable.refl (⟨_, hx⟩ : H.ComponentVertex q)
    | @cons x y z hxy p ih =>
        intro hx hz
        have hxyRel : (H.componentSetoid Finset.univ).r x y := by
          change (H.supportGraph Finset.univ).Reachable x y
          exact SimpleGraph.Adj.reachable hxy
        have hy : Quotient.mk (H.componentSetoid Finset.univ) y = q :=
          (Quotient.sound hxyRel).symm.trans hx
        have hstep : ((H.componentGraph q).supportGraph Finset.univ).Adj
            ⟨x, hx⟩ ⟨y, hy⟩ := by
          rw [(H.componentGraph q).supportGraph_adj_iff Finset.univ]
          rw [H.supportGraph_adj_iff Finset.univ x y] at hxy
          rcases hxy with ⟨hxy, e, _, hends | hends⟩
          · let e' : H.ComponentEdge q := ⟨e, by simpa [hends.1] using hx⟩
            refine ⟨by
              intro h
              exact hxy (congrArg Subtype.val h), e', by simp, Or.inl ⟨?_, ?_⟩⟩
            · apply Subtype.ext
              simp [componentGraph, e', hends.1]
            · apply Subtype.ext
              simp [componentGraph, e', hends.2]
          · let e' : H.ComponentEdge q := ⟨e, by simpa [hends.1] using hy⟩
            refine ⟨by
              intro h
              exact hxy (congrArg Subtype.val h), e', by simp, Or.inr ⟨?_, ?_⟩⟩
            · apply Subtype.ext
              simp [componentGraph, e', hends.1]
            · apply Subtype.ext
              simp [componentGraph, e', hends.2]
        exact (SimpleGraph.Adj.reachable hstep).trans (ih hy hz)
  exact hwalk p u.2 v.2

omit [DecidableEq E] in
theorem mem_componentGraph_cut_iff
    (q : Quotient (H.componentSetoid Finset.univ))
    (A : Finset (H.ComponentVertex q)) (e : H.ComponentEdge q) :
    e ∈ (H.componentGraph q).cut A ↔
      e.1 ∈ H.cut (A.image Subtype.val) := by
  classical
  simp only [cut, Finset.mem_filter, Finset.mem_univ, true_and, Crosses]
  have hmem (w : H.ComponentVertex q) :
      w.1 ∈ A.image Subtype.val ↔ w ∈ A := by
    constructor
    · rw [Finset.mem_image]
      rintro ⟨z, hz, hzw⟩
      have hEq : z = w := by
        apply Subtype.ext
        exact hzw
      simpa [hEq] using hz
    · intro hw
      exact Finset.mem_image.mpr ⟨w, hw, rfl⟩
  have hval0 : ((H.componentGraph q).endAt e 0).1 = H.endAt e.1 0 := by
    simp [componentGraph]
  have hval1 : ((H.componentGraph q).endAt e 1).1 = H.endAt e.1 1 := by
    simp [componentGraph]
  rw [← hval0, ← hval1, hmem ((H.componentGraph q).endAt e 0),
    hmem ((H.componentGraph q).endAt e 1)]

omit [DecidableEq E] in
/-- A connected component of a bridgeless graph is bridgeless. -/
theorem componentGraph_bridgeless
    (q : Quotient (H.componentSetoid Finset.univ)) (hb : H.Bridgeless) :
    (H.componentGraph q).Bridgeless := by
  classical
  intro A hcard
  obtain ⟨e, heq⟩ := Finset.card_eq_one.mp hcard
  let S : Finset V := A.image Subtype.val
  have hcut : H.cut S = {e.1} := by
    ext f
    constructor
    · intro hf
      have hcross : H.Crosses S f := (Finset.mem_filter.mp hf).2
      have h0or1 : H.endAt f 0 ∈ S ∨ H.endAt f 1 ∈ S := by
        unfold Crosses at hcross
        by_cases h0 : H.endAt f 0 ∈ S <;> by_cases h1 : H.endAt f 1 ∈ S <;>
          simp [h0, h1] at hcross ⊢
      have hfq : Quotient.mk (H.componentSetoid Finset.univ) (H.endAt f 0) = q := by
        rcases h0or1 with h0 | h1
        · rcases Finset.mem_image.mp h0 with ⟨v, _, hv⟩
          simpa [hv] using v.2
        · rcases Finset.mem_image.mp h1 with ⟨v, _, hv⟩
          have hEq : Quotient.mk (H.componentSetoid Finset.univ) (H.endAt f 0) =
              Quotient.mk (H.componentSetoid Finset.univ) (H.endAt f 1) :=
            Quotient.sound (H.endpoints_componentSetoid_rel f)
          exact hEq.trans (by simpa [hv] using v.2)
      let f' : H.ComponentEdge q := ⟨f, hfq⟩
      have hf' : f' ∈ (H.componentGraph q).cut A :=
        (H.mem_componentGraph_cut_iff q A f').2 hf
      have hfe : f' = e := by simpa [heq] using hf'
      simpa using congrArg Subtype.val hfe
    · intro hf
      have hfe : f = e.1 := by simpa using hf
      subst f
      have he : e ∈ (H.componentGraph q).cut A := by simp [heq]
      exact (H.mem_componentGraph_cut_iff q A e).1 he
  apply hb S
  rw [hcut]
  simp

omit [DecidableEq V] [DecidableEq E] in
theorem component_eq_of_endAt_eq {e : E} {v : V} (j : Fin 2)
    (h : H.endAt e j = v) :
    Quotient.mk (H.componentSetoid Finset.univ) (H.endAt e 0) =
      Quotient.mk (H.componentSetoid Finset.univ) v := by
  classical
  fin_cases j
  · exact congrArg (Quotient.mk (H.componentSetoid Finset.univ)) h
  · have hEq : Quotient.mk (H.componentSetoid Finset.univ) (H.endAt e 0) =
        Quotient.mk (H.componentSetoid Finset.univ) (H.endAt e 1) :=
      Quotient.sound (H.endpoints_componentSetoid_rel e)
    exact hEq.trans (congrArg (Quotient.mk (H.componentSetoid Finset.univ)) h)

/-- The nonempty-vertex case of Jaeger--Kilpatrick's eight-flow theorem. -/
theorem jaegerKilpatrickEightFlow_of_nonempty [Nonempty V] (hb : H.Bridgeless) :
    Nonempty (H.NowhereZeroFlow Gamma) := by
  classical
  let P := H.componentSetoid Finset.univ
  have hcomp : ∀ q : Quotient P,
      Nonempty ((H.componentGraph q).NowhereZeroFlow Gamma) := by
    intro q
    letI : Nonempty (H.ComponentVertex q) := by
      induction q using Quotient.inductionOn with
      | _ v => exact ⟨⟨v, rfl⟩⟩
    apply jaegerKilpatrickEightFlow_connected (H.componentGraph q)
    · exact H.componentGraph_connects_univ q
    · exact H.componentGraph_bridgeless q hb
  let ψ : ∀ q : Quotient P, (H.componentGraph q).NowhereZeroFlow Gamma :=
    fun q => Classical.choice (hcomp q)
  let φ : E → Gamma := fun e =>
    let q : Quotient P := Quotient.mk P (H.endAt e 0)
    (ψ q).val ⟨e, rfl⟩
  refine ⟨⟨φ, ?_, ?_⟩⟩
  · intro v
    let q : Quotient P := Quotient.mk P v
    have hsum (j : Fin 2) :
        (∑ e : E, if H.endAt e j = v then φ e else 0) =
          ∑ e : H.ComponentEdge q,
            if (H.componentGraph q).endAt e j = (⟨v, rfl⟩ : H.ComponentVertex q)
              then (ψ q).val e else 0 := by
      let g : E → Gamma := fun e =>
        if heq : Quotient.mk P (H.endAt e 0) = q then
          if H.endAt e j = v then (ψ q).val ⟨e, heq⟩ else 0
        else 0
      calc
        (∑ e : E, if H.endAt e j = v then φ e else 0) =
            ∑ e : E, g e := by
          apply Finset.sum_congr rfl
          intro e _
          by_cases hev : H.endAt e j = v
          · have heq : Quotient.mk P (H.endAt e 0) = q := by
              exact H.component_eq_of_endAt_eq j hev
            have hφ : φ e = (ψ q).val ⟨e, heq⟩ := by
              have hφ_of_eq : ∀ (q' : Quotient P)
                  (heq' : Quotient.mk P (H.endAt e 0) = q'),
                  φ e = (ψ q').val ⟨e, heq'⟩ := by
                intro q' heq'
                subst q'
                rfl
              exact hφ_of_eq q heq
            simp [g, heq, hev, hφ]
          · simp [g, hev]
        _ = ∑ e : H.ComponentEdge q, g e.1 := by
          calc
            (∑ e : E, g e) =
                ∑ e ∈ (Finset.univ.filter fun e =>
                  Quotient.mk P (H.endAt e 0) = q), g e := by
              rw [Finset.sum_filter]
              apply Finset.sum_congr rfl
              intro e _
              by_cases heq : Quotient.mk P (H.endAt e 0) = q <;>
                simp [g, heq]
            _ = ∑ e : H.ComponentEdge q, g e.1 := by
              symm
              simpa [P] using (Finset.sum_subtype_eq_sum_filter
                (s := (Finset.univ : Finset E))
                (p := fun e => Quotient.mk P (H.endAt e 0) = q) g)
        _ = ∑ e : H.ComponentEdge q,
            if (H.componentGraph q).endAt e j = (⟨v, rfl⟩ : H.ComponentVertex q)
              then (ψ q).val e else 0 := by
          apply Finset.sum_congr rfl
          intro e _
          have hval : ((H.componentGraph q).endAt e j).1 = H.endAt e.1 j := by
            fin_cases j <;> simp [componentGraph]
          have hiff : H.endAt e.1 j = v ↔
              (H.componentGraph q).endAt e j =
                (⟨v, rfl⟩ : H.ComponentVertex q) := by
            constructor
            · intro h
              apply Subtype.ext
              exact hval.trans h
            · intro h
              exact hval.symm.trans (congrArg Subtype.val h)
          change (if heq : Quotient.mk P (H.endAt e.1 0) = q then
              if H.endAt e.1 j = v then (ψ q).val ⟨e.1, heq⟩ else 0
            else 0) =
            if (H.componentGraph q).endAt e j =
                (⟨v, rfl⟩ : H.ComponentVertex q) then (ψ q).val e else 0
          rw [dif_pos e.2]
          simp [hiff]
    rw [hsum 0, hsum 1]
    exact (ψ q).conservation ⟨v, rfl⟩
  · intro e
    dsimp [φ]
    exact (ψ (Quotient.mk P (H.endAt e 0))).nowhereZero _

/-- Jaeger--Kilpatrick's eight-flow theorem, stated directly for the elementary abelian
group `Gamma = (ZMod 2)^3`. -/
theorem jaegerKilpatrickEightFlow (hb : H.Bridgeless) :
    Nonempty (H.NowhereZeroFlow Gamma) := by
  classical
  cases isEmpty_or_nonempty V with
  | inl hV =>
      letI := hV
      letI : IsEmpty E := ⟨fun e => isEmptyElim (H.endAt e 0)⟩
      refine ⟨⟨fun e => isEmptyElim e, ?_, ?_⟩⟩
      · intro v
        exact isEmptyElim v
      · intro e
        exact isEmptyElim e
  | inr hV =>
      letI := hV
      exact H.jaegerKilpatrickEightFlow_of_nonempty hb

end FiniteGraph

end CDCLean
