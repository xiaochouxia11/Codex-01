import CDCLean.SixFlow
import Mathlib.Combinatorics.Enumerative.InclusionExclusion

/-!
# The group-order transfer step for nowhere-zero flows

Tutte's group-order invariance theorem says that, on a fixed finite directed incidence
structure, the number of nowhere-zero flows depends only on the cardinality of the finite
abelian coefficient group.  This file isolates the exact statement needed for the passage
from a `ZMod 8` flow to an `F₂³` flow.

The proof first reduces by inclusion--exclusion to flows that vanish on a specified edge set.
An edge-addition recurrence then treats an edge either by an integral cycle correction or by a
separating cut that forces its value to zero.  `PathCut.lean` supplies that dichotomy for every
finite graph and closes the theorem; no group-order statement is assumed as an axiom.
-/

namespace CDCLean

namespace FiniteGraph

variable {V E : Type*} [Fintype V] [Fintype E] [DecidableEq V] [DecidableEq E]
  (G : FiniteGraph V E)

/-- The finite type of nowhere-zero `A`-flows on `G`. -/
def NowhereZeroFlows (A : Type*) [AddCommGroup A] :=
  {f : E → A // G.IsFlow f ∧ IsNowhereZero f}

noncomputable instance {A : Type*} [AddCommGroup A] [Fintype A] :
    Fintype (G.NowhereZeroFlows A) := by
  classical
  exact Subtype.fintype _

/-- All group-valued flows, allowing zero edge values. -/
def Flows (A : Type*) [AddCommGroup A] := {f : E → A // G.IsFlow f}

noncomputable instance {A : Type*} [AddCommGroup A] [Fintype A] :
    Fintype (G.Flows A) := by
  classical
  exact Subtype.fintype _

/-- Flows constrained to vanish on a specified set of edges.  These are the objects whose
cardinality the spanning-forest completion argument must compute. -/
def ZeroOnFlows (A : Type*) [AddCommGroup A] (S : Finset E) :=
  {f : E → A // G.IsFlow f ∧ ∀ e ∈ S, f e = 0}

noncomputable instance {A : Type*} [AddCommGroup A] [Fintype A] (S : Finset E) :
    Fintype (G.ZeroOnFlows A S) := by
  classical
  exact Subtype.fintype _

/-- Flows for which edge `e` is bad (has value zero). -/
noncomputable def badFlows (A : Type*) [AddCommGroup A] [Fintype A] (e : E) :
    Finset (G.Flows A) := by
  classical
  exact Finset.univ.filter fun f ↦ f.1 e = 0

private theorem mem_finset_inf
    {I X : Type*} [Fintype X] [DecidableEq X]
    (s : Finset I) (F : I → Finset X) (x : X) :
    x ∈ s.inf F ↔ ∀ i ∈ s, x ∈ F i := by
  induction s using Finset.cons_induction with
  | empty => simp
  | cons i s hi ih => simp [ih]

/-- The same nowhere-zero condition, phrased inside the finite universe of all flows. -/
def GoodFlows (A : Type*) [AddCommGroup A] :=
  {f : G.Flows A // ∀ e, f.1 e ≠ 0}

noncomputable instance {A : Type*} [AddCommGroup A] [Fintype A] :
    Fintype (G.GoodFlows A) := by
  classical
  exact Subtype.fintype _

/-- The same vanishing condition, phrased inside the finite universe of all flows. -/
def BadOnFlows (A : Type*) [AddCommGroup A] (S : Finset E) :=
  {f : G.Flows A // ∀ e ∈ S, f.1 e = 0}

noncomputable instance {A : Type*} [AddCommGroup A] [Fintype A] (S : Finset E) :
    Fintype (G.BadOnFlows A S) := by
  classical
  exact Subtype.fintype _

def nowhereZeroFlowsEquivGood (A : Type*) [AddCommGroup A] :
    G.NowhereZeroFlows A ≃ G.GoodFlows A where
  toFun f := ⟨⟨f.1, f.2.1⟩, f.2.2⟩
  invFun f := ⟨f.1.1, f.1.2, f.2⟩
  left_inv _ := rfl
  right_inv _ := rfl

def zeroOnFlowsEquivBad (A : Type*) [AddCommGroup A] (S : Finset E) :
    G.ZeroOnFlows A S ≃ G.BadOnFlows A S where
  toFun f := ⟨⟨f.1, f.2.1⟩, f.2.2⟩
  invFun f := ⟨f.1.1, f.1.2, f.2⟩
  left_inv _ := rfl
  right_inv _ := rfl

/-- Base case for a forest-completion proof: if every edge is constrained to zero, there is
exactly one flow. -/
def zeroOnFlowsUnivEquiv (A : Type*) [AddCommGroup A] :
    G.ZeroOnFlows A Finset.univ ≃ PUnit.{1} where
  toFun _ := PUnit.unit
  invFun _ := ⟨fun _ ↦ 0, by simp [IsFlow], by simp⟩
  left_inv f := by
    apply Subtype.ext
    funext e
    exact (f.2.2 e (Finset.mem_univ e)).symm
  right_inv _ := rfl

@[simp]
theorem card_zeroOnFlows_univ (A : Type*) [AddCommGroup A] [Fintype A] :
    Fintype.card (G.ZeroOnFlows A Finset.univ) = 1 := by
  simpa using Fintype.card_congr (G.zeroOnFlowsUnivEquiv A)

/-- An additive equivalence of coefficient groups transports every zero-on flow.  This is the
coefficient-functoriality used after a forest completion has identified the free coordinates. -/
def zeroOnFlowsCongr
    {A B : Type*} [AddCommGroup A] [AddCommGroup B]
    (e : A ≃+ B) (S : Finset E) : G.ZeroOnFlows A S ≃ G.ZeroOnFlows B S where
  toFun f := ⟨fun k ↦ e (f.1 k), by
    intro v
    have h := congrArg e (f.2.1 v)
    simpa only [map_sub, map_sum, apply_ite, map_zero] using h, by
      intro k hk
      simp [f.2.2 k hk]⟩
  invFun f := ⟨fun k ↦ e.symm (f.1 k), by
    intro v
    have h := congrArg e.symm (f.2.1 v)
    simpa only [map_sub, map_sum, apply_ite, map_zero] using h, by
      intro k hk
      simp [f.2.2 k hk]⟩
  left_inv f := by
    apply Subtype.ext
    funext k
    simp
  right_inv f := by
    apply Subtype.ext
    funext k
    simp

theorem card_zeroOnFlows_eq_of_addEquiv
    {A B : Type*} [AddCommGroup A] [AddCommGroup B] [Fintype A] [Fintype B]
    (e : A ≃+ B) (S : Finset E) :
    Fintype.card (G.ZeroOnFlows A S) = Fintype.card (G.ZeroOnFlows B S) :=
  Fintype.card_congr (G.zeroOnFlowsCongr e S)

omit [DecidableEq E] in
/-- Pointwise addition preserves the circulation equations. -/
theorem isFlow_add {A : Type*} [AddCommGroup A] {f g : E → A}
    (hf : G.IsFlow f) (hg : G.IsFlow g) : G.IsFlow (f + g) := by
  intro v
  have hsum (j : Fin 2) :
      (∑ k : E, if G.endAt k j = v then (f + g) k else 0) =
        (∑ k : E, if G.endAt k j = v then f k else 0) +
          ∑ k : E, if G.endAt k j = v then g k else 0 := by
    rw [← Finset.sum_add_distrib]
    apply Finset.sum_congr rfl
    intro k _
    by_cases h : G.endAt k j = v <;> simp [h]
  have hf' := sub_eq_zero.mp (hf v)
  have hg' := sub_eq_zero.mp (hg v)
  rw [hsum 0, hsum 1, hf', hg', sub_self]

omit [DecidableEq E] in
/-- An integer circulation can be evaluated at any element of any additive commutative group. -/
theorem isFlow_int_smul {A : Type*} [AddCommGroup A] {c : E → ℤ}
    (hc : G.IsFlow c) (x : A) : G.IsFlow (fun k ↦ c k • x) := by
  intro v
  have hsum (j : Fin 2) :
      (∑ k : E, if G.endAt k j = v then c k • x else 0) =
        (∑ k : E, if G.endAt k j = v then c k else 0) • x := by
    rw [Finset.sum_smul]
    apply Finset.sum_congr rfl
    intro k _
    by_cases h : G.endAt k j = v <;> simp [h]
  rw [hsum 0, hsum 1, ← sub_smul, hc v, zero_smul]

/-- Signed boundary of an edge-valued chain at a vertex. -/
def divergence {A : Type*} [AddCommGroup A] (f : E → A) (v : V) : A :=
  (∑ k : E, if G.endAt k 0 = v then f k else 0) -
    ∑ k : E, if G.endAt k 1 = v then f k else 0

omit [DecidableEq E] in
theorem divergence_add {A : Type*} [AddCommGroup A] (f g : E → A) (v : V) :
    G.divergence (f + g) v = G.divergence f v + G.divergence g v := by
  have hsum (j : Fin 2) :
      (∑ k : E, if G.endAt k j = v then (f + g) k else 0) =
        (∑ k : E, if G.endAt k j = v then f k else 0) +
          ∑ k : E, if G.endAt k j = v then g k else 0 := by
    rw [← Finset.sum_add_distrib]
    apply Finset.sum_congr rfl
    intro k _
    by_cases h : G.endAt k j = v <;> simp [h]
  simp only [divergence, hsum]
  abel

omit [DecidableEq E] in
theorem divergence_neg {A : Type*} [AddCommGroup A] (f : E → A) (v : V) :
    G.divergence (-f) v = -G.divergence f v := by
  have hsum (j : Fin 2) :
      (∑ k : E, if G.endAt k j = v then (-f) k else 0) =
        -(∑ k : E, if G.endAt k j = v then f k else 0) := by
    rw [← Finset.sum_neg_distrib]
    apply Finset.sum_congr rfl
    intro k _
    by_cases h : G.endAt k j = v <;> simp [h]
  unfold divergence
  rw [hsum 0, hsum 1]
  abel

/-- An integral chain on currently allowed edges whose boundary is `u - v`. -/
def HasIntegerPath (S : Finset E) (u v : V) : Prop :=
  ∃ c : E → ℤ, (∀ k ∈ S, c k = 0) ∧ ∀ w : V,
    G.divergence c w = (if u = w then 1 else 0) - (if v = w then 1 else 0)

omit [DecidableEq E] in
theorem hasIntegerPath_refl (S : Finset E) (u : V) : G.HasIntegerPath S u u := by
  refine ⟨fun _ ↦ 0, by simp, ?_⟩
  intro w
  simp [divergence]

theorem divergence_single_one (k : E) (w : V) :
    G.divergence (Pi.single k (1 : ℤ)) w =
      (if G.endAt k 0 = w then 1 else 0) - (if G.endAt k 1 = w then 1 else 0) := by
  have hsum (j : Fin 2) :
      (∑ l : E, if G.endAt l j = w then (Pi.single k (1 : ℤ)) l else 0) =
        if G.endAt k j = w then 1 else 0 := by
    rw [Fintype.sum_eq_single k]
    · simp
    · intro l hlk
      simp [hlk]
  rw [divergence, hsum 0, hsum 1]

theorem hasIntegerPath_single (S : Finset E) (k : E) (hk : k ∉ S) :
    G.HasIntegerPath S (G.endAt k 0) (G.endAt k 1) := by
  refine ⟨Pi.single k 1, ?_, ?_⟩
  · intro l hl
    have hlk : l ≠ k := fun h ↦ hk (h ▸ hl)
    simp [hlk]
  · exact G.divergence_single_one k

omit [DecidableEq E] in
theorem HasIntegerPath.symm {S : Finset E} {u v : V}
    (h : G.HasIntegerPath S u v) : G.HasIntegerPath S v u := by
  obtain ⟨c, hcS, hc⟩ := h
  refine ⟨-c, ?_, ?_⟩
  · intro k hk
    simp [hcS k hk]
  intro w
  rw [G.divergence_neg, hc w]
  by_cases hu : u = w <;> by_cases hv : v = w <;> simp [hu, hv]

omit [DecidableEq E] in
theorem HasIntegerPath.trans {S : Finset E} {u v w : V}
    (h₁ : G.HasIntegerPath S u v) (h₂ : G.HasIntegerPath S v w) :
    G.HasIntegerPath S u w := by
  obtain ⟨c₁, hc₁S, hc₁⟩ := h₁
  obtain ⟨c₂, hc₂S, hc₂⟩ := h₂
  refine ⟨c₁ + c₂, ?_, ?_⟩
  · intro k hk
    simp [hc₁S k hk, hc₂S k hk]
  · intro x
    rw [G.divergence_add, hc₁ x, hc₂ x]
    by_cases hu : u = x <;> by_cases hv : v = x <;> by_cases hw : w = x <;>
      simp [hu, hv, hw]

/-- A unit integer circulation through `e`, supported outside `S.erase e`, is the abstract
path-correction certificate for allowing edge `e`. -/
def HasCycleCorrection (S : Finset E) (e : E) : Prop :=
  ∃ c : E → ℤ, G.IsFlow c ∧ c e = 1 ∧ ∀ k ∈ S.erase e, c k = 0

/-- An integral allowed path between the endpoints closes with `e` to give the required unit
circulation. -/
theorem hasCycleCorrection_of_integerPath
    (S : Finset E) (e : E) (he : e ∈ S)
    (hp : G.HasIntegerPath S (G.endAt e 0) (G.endAt e 1)) :
    G.HasCycleCorrection S e := by
  obtain ⟨d, hdS, hddiv⟩ := hp
  let q : E → ℤ := Pi.single e 1
  have hqdiv (w : V) : G.divergence q w =
      (if G.endAt e 0 = w then 1 else 0) - (if G.endAt e 1 = w then 1 else 0) :=
    G.divergence_single_one e w
  let c : E → ℤ := q + (-d)
  refine ⟨c, ?_, ?_, ?_⟩
  · intro w
    change G.divergence c w = 0
    rw [show c = q + (-d) by rfl, G.divergence_add, G.divergence_neg,
      hqdiv w, hddiv w]
    ring
  · change q e + (-d) e = 1
    have hde : d e = 0 := hdS e he
    simp [q, hde]
  · intro k hk
    have hke : k ≠ e := (Finset.mem_erase.mp hk).1
    have hdk : d k = 0 := hdS k (Finset.mem_of_mem_erase hk)
    change q k + (-d) k = 0
    simp [q, hke, hdk]

/-- Edge-addition step behind the spanning-forest recurrence.  Allowing an edge equipped with a
cycle correction is equivalent to choosing an old flow and one free coefficient-group value. -/
noncomputable def allowEdgeEquiv
    {A : Type*} [AddCommGroup A] (S : Finset E) (e : E) (he : e ∈ S)
    (hcycle : G.HasCycleCorrection S e) :
    (G.ZeroOnFlows A S × A) ≃ G.ZeroOnFlows A (S.erase e) := by
  classical
  let c : E → ℤ := Classical.choose hcycle
  have hc : G.IsFlow c := (Classical.choose_spec hcycle).1
  have hce : c e = 1 := (Classical.choose_spec hcycle).2.1
  have hc0 : ∀ k ∈ S.erase e, c k = 0 := (Classical.choose_spec hcycle).2.2
  let forward : G.ZeroOnFlows A S × A → G.ZeroOnFlows A (S.erase e) := fun p ↦
    ⟨fun k ↦ p.1.1 k + c k • p.2,
      G.isFlow_add p.1.2.1 (G.isFlow_int_smul hc p.2), by
        intro k hk
        simp [p.1.2.2 k (Finset.mem_of_mem_erase hk), hc0 k hk]⟩
  let backward : G.ZeroOnFlows A (S.erase e) → G.ZeroOnFlows A S × A := fun g ↦
    (⟨fun k ↦ g.1 k + c k • (-g.1 e),
      G.isFlow_add g.2.1 (G.isFlow_int_smul hc (-g.1 e)), by
        intro k hk
        by_cases hke : k = e
        · subst k
          simp [hce]
        · have hk' : k ∈ S.erase e := Finset.mem_erase.mpr ⟨hke, hk⟩
          simp [g.2.2 k hk', hc0 k hk']⟩,
      g.1 e)
  exact
    { toFun := forward
      invFun := backward
      left_inv := by
        rintro ⟨f, x⟩
        apply Prod.ext
        · apply Subtype.ext
          funext k
          simp [forward, backward, f.2.2 e he, hce]
        · change f.1 e + c e • x = x
          rw [f.2.2 e he, hce]
          simp
      right_inv := by
        intro g
        apply Subtype.ext
        funext k
        simp [forward, backward] }

/-- Consequently the edge-addition step multiplies the flow count by the group order. -/
theorem card_zeroOnFlows_erase_of_cycleCorrection
    {A : Type*} [AddCommGroup A] [Fintype A]
    (S : Finset E) (e : E) (he : e ∈ S) (hcycle : G.HasCycleCorrection S e) :
    Fintype.card (G.ZeroOnFlows A (S.erase e)) =
      Fintype.card (G.ZeroOnFlows A S) * Fintype.card A := by
  rw [← Fintype.card_prod]
  exact (Fintype.card_congr (G.allowEdgeEquiv S e he hcycle)).symm

/-- Abstract form of the bridge case: after `e` is allowed, every flow still has value zero on
`e`.  A cut argument supplies this certificate when `e` joins two formerly disconnected
components. -/
def IsForcedZero (S : Finset E) (e : E) : Prop :=
  ∀ (A : Type) [AddCommGroup A], ∀ f : G.ZeroOnFlows A (S.erase e), f.1 e = 0

omit [Fintype V] in
private theorem sum_endpoint_indicator
    {A : Type*} [AddCommGroup A] (U : Finset V) (x : V) (a : A) :
    (∑ v ∈ U, if x = v then a else 0) = if x ∈ U then a else 0 := by
  simp

omit [DecidableEq E] in
/-- Summing conservation over a vertex set leaves only the signed crossing-edge terms. -/
theorem sum_conservation_eq_cut
    {A : Type*} [AddCommGroup A] (f : E → A) (U : Finset V) :
    (∑ v ∈ U,
      ((∑ k : E, if G.endAt k 0 = v then f k else 0) -
       (∑ k : E, if G.endAt k 1 = v then f k else 0))) =
      ∑ k : E,
        ((if G.endAt k 0 ∈ U then f k else 0) -
         (if G.endAt k 1 ∈ U then f k else 0)) := by
  have hside (j : Fin 2) :
      (∑ v ∈ U, ∑ k : E, if G.endAt k j = v then f k else 0) =
        ∑ k : E, if G.endAt k j ∈ U then f k else 0 := by
    rw [Finset.sum_comm]
    apply Finset.sum_congr rfl
    intro k _
    exact sum_endpoint_indicator U (G.endAt k j) (f k)
  rw [Finset.sum_sub_distrib, hside 0, hside 1, ← Finset.sum_sub_distrib]

/-- A vertex cut separating `e` while crossed by no already-allowed edge. -/
def HasCutSeparation (S : Finset E) (e : E) : Prop :=
  ∃ U : Finset V, G.Crosses U e ∧ ∀ k ∉ S, ¬ G.Crosses U k

/-- A separating cut supplies the forced-zero certificate in the edge-addition recurrence. -/
theorem isForcedZero_of_cutSeparation
    (S : Finset E) (e : E) (hcut : G.HasCutSeparation S e) :
    G.IsForcedZero S e := by
  obtain ⟨U, hecross, hallowed⟩ := hcut
  intro A _ f
  have htotal :
      (∑ k : E,
        ((if G.endAt k 0 ∈ U then f.1 k else 0) -
         (if G.endAt k 1 ∈ U then f.1 k else 0))) = 0 := by
    rw [← G.sum_conservation_eq_cut f.1 U]
    apply Finset.sum_eq_zero
    intro v _
    exact f.2.1 v
  have hcollapse :
      (∑ k : E,
        ((if G.endAt k 0 ∈ U then f.1 k else 0) -
         (if G.endAt k 1 ∈ U then f.1 k else 0))) =
      ((if G.endAt e 0 ∈ U then f.1 e else 0) -
       (if G.endAt e 1 ∈ U then f.1 e else 0)) := by
    apply Fintype.sum_eq_single e
    intro k hke
    by_cases hkS : k ∈ S
    · have hkErase : k ∈ S.erase e := Finset.mem_erase.mpr ⟨hke, hkS⟩
      simp [f.2.2 k hkErase]
    · have hsame : (G.endAt k 0 ∈ U) = (G.endAt k 1 ∈ U) :=
        not_ne_iff.mp (hallowed k hkS)
      by_cases hk0 : G.endAt k 0 ∈ U <;> simp [hk0, hsame ▸ hk0]
  rw [hcollapse] at htotal
  unfold Crosses at hecross
  by_cases he0 : G.endAt e 0 ∈ U
  · have he1 : G.endAt e 1 ∉ U := by
      intro he1
      exact hecross (propext ⟨fun _ ↦ he1, fun _ ↦ he0⟩)
    simpa [he0, he1] using htotal
  · have he1 : G.endAt e 1 ∈ U := by
      by_contra he1
      exact hecross (propext ⟨fun h ↦ (he0 h).elim, fun h ↦ (he1 h).elim⟩)
    have : -f.1 e = 0 := by simpa [he0, he1] using htotal
    exact neg_eq_zero.mp this

/-- Allowing a forced-zero edge does not change the flow space. -/
def allowForcedEdgeEquiv
    {A : Type} [AddCommGroup A] (S : Finset E) (e : E)
    (hforced : G.IsForcedZero S e) :
    G.ZeroOnFlows A S ≃ G.ZeroOnFlows A (S.erase e) where
  toFun f := ⟨f.1, f.2.1, fun k hk ↦ f.2.2 k (Finset.mem_of_mem_erase hk)⟩
  invFun f := ⟨f.1, f.2.1, by
    intro k hk
    by_cases hke : k = e
    · subst k
      exact hforced A f
    · exact f.2.2 k (Finset.mem_erase.mpr ⟨hke, hk⟩)⟩
  left_inv _ := rfl
  right_inv _ := rfl

theorem card_zeroOnFlows_erase_of_forced
    {A : Type} [AddCommGroup A] [Fintype A]
    (S : Finset E) (e : E) (hforced : G.IsForcedZero S e) :
    Fintype.card (G.ZeroOnFlows A (S.erase e)) =
      Fintype.card (G.ZeroOnFlows A S) :=
  (Fintype.card_congr (G.allowForcedEdgeEquiv S e hforced)).symm

/-- A certificate that an allowed-edge set can be built from the empty set, with every edge
addition justified by either a cycle correction or a forced-zero cut. -/
inductive FlowReduction (G : FiniteGraph V E) : Finset E → Prop
  | full : FlowReduction G Finset.univ
  | eraseCycle {S : Finset E} {e : E} : FlowReduction G S → e ∈ S →
      G.HasCycleCorrection S e → FlowReduction G (S.erase e)
  | eraseForced {S : Finset E} {e : E} : FlowReduction G S → e ∈ S →
      G.IsForcedZero S e → FlowReduction G (S.erase e)

/-- The edge-addition recurrence already proves group-order invariance for every edge set carrying
a reduction certificate.  The remaining graph-theoretic task is to produce such certificates
from a spanning forest. -/
theorem card_zeroOnFlows_eq_of_reduction
    {A B : Type} [AddCommGroup A] [AddCommGroup B] [Fintype A] [Fintype B]
    {S : Finset E} (hred : G.FlowReduction S)
    (hcard : Fintype.card A = Fintype.card B) :
    Fintype.card (G.ZeroOnFlows A S) = Fintype.card (G.ZeroOnFlows B S) := by
  induction hred with
  | full => simp
  | @eraseCycle S e hred he hcycle ih =>
      rw [G.card_zeroOnFlows_erase_of_cycleCorrection S e he hcycle,
        G.card_zeroOnFlows_erase_of_cycleCorrection S e he hcycle, ih, hcard]
  | @eraseForced S e hred he hforced ih =>
      rw [G.card_zeroOnFlows_erase_of_forced S e hforced,
        G.card_zeroOnFlows_erase_of_forced S e hforced, ih]

/-- Inclusion--exclusion reduces nowhere-zero flow counting to counting flows that vanish on
specified edge sets.  This is the exact interface at which a spanning-forest completion proof
can be attached. -/
theorem card_nowhereZeroFlows_eq_sum_zeroOn
    (A : Type*) [AddCommGroup A] [Fintype A] :
    (Fintype.card (G.NowhereZeroFlows A) : ℤ) =
      ∑ S ∈ (Finset.univ : Finset E).powerset,
        (-1 : ℤ) ^ S.card * Fintype.card (G.ZeroOnFlows A S) := by
  classical
  let good : Finset (G.Flows A) :=
    (Finset.univ : Finset E).inf fun e ↦ (G.badFlows A e)ᶜ
  let goodEquiv : G.GoodFlows A ≃ {f // f ∈ good} :=
    { toFun := fun f ↦ ⟨⟨f.1.1, f.1.2⟩, by
          apply (mem_finset_inf Finset.univ
            (fun e : E ↦ (G.badFlows A e)ᶜ) ⟨f.1.1, f.1.2⟩).2
          intro e _
          simpa [badFlows] using f.2 e⟩
      invFun := fun f ↦ ⟨⟨f.1.1, f.1.2⟩, by
          intro e
          have he := (mem_finset_inf Finset.univ
            (fun e : E ↦ (G.badFlows A e)ᶜ) f.1).mp f.2 e
            (Finset.mem_univ e)
          simpa [badFlows] using he⟩
      left_inv := fun _ ↦ rfl
      right_inv := fun _ ↦ rfl }
  have badEquiv (S : Finset E) :
      G.BadOnFlows A S ≃ {f // f ∈ S.inf (G.badFlows A)} :=
    { toFun := fun f ↦ ⟨f.1, by
          rw [mem_finset_inf]
          intro e he
          simpa [badFlows] using f.2 e he⟩
      invFun := fun f ↦ ⟨f.1, by
          intro e he
          have hz := (mem_finset_inf S (G.badFlows A) f.1).mp f.2 e he
          simpa [badFlows] using hz⟩
      left_inv := fun _ ↦ rfl
      right_inv := fun _ ↦ rfl }
  calc
    (Fintype.card (G.NowhereZeroFlows A) : ℤ) =
        (good.card : ℤ) := by
      exact congrArg (fun n : ℕ ↦ (n : ℤ)) <|
        (Fintype.card_congr ((G.nowhereZeroFlowsEquivGood A).trans goodEquiv)).trans
          (Fintype.card_coe good)
    _ = ∑ S ∈ (Finset.univ : Finset E).powerset,
          (-1 : ℤ) ^ S.card * (S.inf (G.badFlows A)).card := by
      dsimp only [good]
      exact Finset.inclusion_exclusion_card_inf_compl Finset.univ (G.badFlows A)
    _ = ∑ S ∈ (Finset.univ : Finset E).powerset,
          (-1 : ℤ) ^ S.card * Fintype.card (G.ZeroOnFlows A S) := by
      apply Finset.sum_congr rfl
      intro S _
      congr 1
      exact congrArg (fun n : ℕ ↦ (n : ℤ)) <|
        ((Fintype.card_congr
          ((G.zeroOnFlowsEquivBad A S).trans (badEquiv S))).trans
            (Fintype.card_coe (S.inf (G.badFlows A)))).symm

/-- Equality of all the forest-completion counts implies equality of nowhere-zero flow counts. -/
theorem card_nowhereZeroFlows_eq_of_zeroOn
    {A B : Type} [AddCommGroup A] [AddCommGroup B] [Fintype A] [Fintype B]
    (hzero : ∀ S : Finset E,
      Fintype.card (G.ZeroOnFlows A S) = Fintype.card (G.ZeroOnFlows B S)) :
    Fintype.card (G.NowhereZeroFlows A) = Fintype.card (G.NowhereZeroFlows B) := by
  have hA := G.card_nowhereZeroFlows_eq_sum_zeroOn A
  have hB := G.card_nowhereZeroFlows_eq_sum_zeroOn B
  rw [show (∑ S ∈ (Finset.univ : Finset E).powerset,
      (-1 : ℤ) ^ S.card * Fintype.card (G.ZeroOnFlows A S)) =
      ∑ S ∈ (Finset.univ : Finset E).powerset,
        (-1 : ℤ) ^ S.card * Fintype.card (G.ZeroOnFlows B S) by
      apply Finset.sum_congr rfl
      intro S _
      rw [hzero S]] at hA
  exact_mod_cast hA.trans hB.symm

/-- The zero-on form of group-order invariance: for every forbidden edge set, the number of
flows on the remaining incidence structure depends only on the coefficient-group order. -/
def ZeroOnCardinalityInvariant : Prop :=
  ∀ (A B : Type) [AddCommGroup A] [AddCommGroup B] [Fintype A] [Fintype B],
    Fintype.card A = Fintype.card B → ∀ S : Finset E,
      Fintype.card (G.ZeroOnFlows A S) = Fintype.card (G.ZeroOnFlows B S)

/-- Producing a reduction certificate for every edge set suffices for the full zero-on counting
obligation. -/
theorem zeroOnCardinalityInvariant_of_reductions
    (hred : ∀ S : Finset E, G.FlowReduction S) : G.ZeroOnCardinalityInvariant := by
  intro A B _ _ _ _ hcard S
  exact G.card_zeroOnFlows_eq_of_reduction (hred S) hcard

/-- If every allowed-edge step has either a cycle correction or a forced-zero certificate, then
every edge set admits a reduction from the all-zero base case. -/
theorem reductions_of_step_classification
    (hstep : ∀ (S : Finset E) (e : E), e ∈ S →
      G.HasCycleCorrection S e ∨ G.IsForcedZero S e) :
    ∀ S : Finset E, G.FlowReduction S := by
  intro S
  have aux : ∀ T : Finset E, G.FlowReduction (Finset.univ \ T) := by
    intro T
    induction T using Finset.induction with
    | empty =>
        simpa only [Finset.sdiff_empty] using
          (FlowReduction.full : G.FlowReduction (Finset.univ : Finset E))
    | @insert e T heT ih =>
        have heS : e ∈ (Finset.univ \ T : Finset E) := by simp [heT]
        have herase :
            (Finset.univ \ insert e T : Finset E) =
              (Finset.univ \ T).erase e := by
          ext k
          by_cases hke : k = e <;> simp [hke]
        rw [herase]
        rcases hstep (Finset.univ \ T) e heS with hcycle | hforced
        · exact FlowReduction.eraseCycle ih heS hcycle
        · exact FlowReduction.eraseForced ih heS hforced
  have h := aux (Finset.univ \ S)
  simpa using h

/-- The abstract edge dichotomy is sufficient for the full zero-on counting theorem. -/
theorem zeroOnCardinalityInvariant_of_step_classification
    (hstep : ∀ (S : Finset E) (e : E), e ∈ S →
      G.HasCycleCorrection S e ∨ G.IsForcedZero S e) :
    G.ZeroOnCardinalityInvariant :=
  G.zeroOnCardinalityInvariant_of_reductions
    (G.reductions_of_step_classification hstep)

/-- The purely graph-theoretic path/cut dichotomy.  An integer path between the endpoints gives
a cycle correction; otherwise the reachable component gives a separating cut.  It is discharged
for every finite graph in `PathCut.lean`. -/
def IntegralPathCutDichotomy : Prop :=
  ∀ (S : Finset E) (e : E), e ∈ S →
    G.HasCycleCorrection S e ∨ G.HasCutSeparation S e

/-- The integral path/cut dichotomy supplies the complete zero-on counting invariant. -/
theorem zeroOnCardinalityInvariant_of_pathCut
    (hpc : G.IntegralPathCutDichotomy) : G.ZeroOnCardinalityInvariant := by
  apply G.zeroOnCardinalityInvariant_of_step_classification
  intro S e he
  rcases hpc S e he with hcycle | hcut
  · exact Or.inl hcycle
  · exact Or.inr (G.isForcedZero_of_cutSeparation S e hcut)

/-- The exact, local form of Tutte's group-order invariance needed for coefficient transfer. -/
def FlowCardinalityInvariant : Prop :=
  ∀ (A B : Type) [AddCommGroup A] [AddCommGroup B] [Fintype A] [Fintype B],
    Fintype.card A = Fintype.card B →
      Fintype.card (G.NowhereZeroFlows A) = Fintype.card (G.NowhereZeroFlows B)

/-- The verified inclusion--exclusion reduction from the forest-completion obligation to Tutte's
nowhere-zero flow-count invariance. -/
theorem flowCardinalityInvariant_of_zeroOn
    (hzero : G.ZeroOnCardinalityInvariant) : G.FlowCardinalityInvariant := by
  intro A B _ _ _ _ hcard
  exact G.card_nowhereZeroFlows_eq_of_zeroOn (hzero A B hcard)

/-- Group-order invariance follows from the integral path/cut lemma. -/
theorem flowCardinalityInvariant_of_pathCut
    (hpc : G.IntegralPathCutDichotomy) : G.FlowCardinalityInvariant :=
  G.flowCardinalityInvariant_of_zeroOn
    (G.zeroOnCardinalityInvariant_of_pathCut hpc)

/-- A structured nowhere-zero flow and the corresponding element of the finite flow type are
the same data. -/
def nowhereZeroFlowEquiv (A : Type*) [AddCommGroup A] :
    G.NowhereZeroFlow A ≃ G.NowhereZeroFlows A where
  toFun f := ⟨f.val, f.conservation, f.nowhereZero⟩
  invFun f :=
    { val := f.1
      conservation := f.2.1
      nowhereZero := f.2.2 }
  left_inv _ := rfl
  right_inv _ := rfl

/-- Equal flow counts transfer existence.  This is the precise consequence of Tutte's counting
theorem used in the CDC argument. -/
theorem transfer_of_cardinality
    (hcount : G.FlowCardinalityInvariant)
    {A B : Type} [AddCommGroup A] [AddCommGroup B] [Fintype A] [Fintype B]
    (hcard : Fintype.card A = Fintype.card B) :
    Nonempty (G.NowhereZeroFlow A) → Nonempty (G.NowhereZeroFlow B) := by
  intro hA
  have hposA : 0 < Fintype.card (G.NowhereZeroFlows A) := by
    rw [Fintype.card_pos_iff]
    exact hA.map (G.nowhereZeroFlowEquiv A)
  have hposB : 0 < Fintype.card (G.NowhereZeroFlows B) := by
    rwa [← hcount A B hcard]
  rw [Fintype.card_pos_iff] at hposB
  exact hposB.map (G.nowhereZeroFlowEquiv B).symm

/-- `ZMod 8` and `Fin 3 → ZMod 2` have the same finite cardinality. -/
theorem card_zmodEight_eq_gamma :
    Fintype.card (ZMod 8) = Fintype.card (Fin 3 → ZMod 2) := by
  decide

/-- The requested coefficient transfer, conditional only on the explicitly named instance of
Tutte's group-order cardinality theorem. -/
theorem zmodEight_to_gamma
    (hcount : G.FlowCardinalityInvariant) :
    Nonempty (G.NowhereZeroFlow (ZMod 8)) →
      Nonempty (G.NowhereZeroFlow (Fin 3 → ZMod 2)) :=
  G.transfer_of_cardinality hcount card_zmodEight_eq_gamma

/-- The complete local implication starting from Seymour's integer six-flow conclusion.  The
only additional premise is the exact group-order counting statement isolated above. -/
theorem sixFlow_to_gamma
    (hcount : G.FlowCardinalityInvariant) :
    Nonempty G.SixFlow → Nonempty (G.NowhereZeroFlow (Fin 3 → ZMod 2)) := by
  intro hSix
  apply G.zmodEight_to_gamma hcount
  exact hSix.map (SixFlow.toZModEight G)

/-- The six-flow implication with the graph-theoretic path/cut interface exposed directly. -/
theorem sixFlow_to_gamma_of_pathCut
    (hpc : G.IntegralPathCutDichotomy) :
    Nonempty G.SixFlow → Nonempty (G.NowhereZeroFlow (Fin 3 → ZMod 2)) :=
  G.sixFlow_to_gamma (G.flowCardinalityInvariant_of_pathCut hpc)

end FiniteGraph

end CDCLean
