import CDCLean.CubicBridge
import Mathlib.Logic.Equiv.Fin.Rotate

/-!
# Vertex-ring expansion

This file builds the cubic incidence object used in the reduction.  The vertices of the expanded
graph are the half-edges of the original graph.  Its edges are the original spokes together with
one ring edge leaving every half-edge.
-/

namespace CDCLean

namespace FiniteGraph

variable {V E : Type*} [Fintype V] [Fintype E] [DecidableEq V] [DecidableEq E]
  (G : FiniteGraph V E)

/-- A cyclic successor system on the half-edges at every original vertex.  `next_ne` is precisely
what rules out loops in the expanded rings.  Fiber transitivity, needed for bridgelessness, is
recorded separately rather than smuggled into the cubic encoding. -/
structure RotationSystem where
  next : Equiv.Perm (HalfEdge E)
  sameVertex : ∀ h, G.vertex (next h) = G.vertex h
  next_ne : ∀ h, next h ≠ h
  fiberTransitive : ∀ h k, G.vertex h = G.vertex k →
    ∃ n : ℕ, (next : HalfEdge E → HalfEdge E)^[n] h = k

private theorem finRotate_ne_self_of_card_ne_one {n : ℕ} (hn : n ≠ 1) (a : Fin n) :
    finRotate n a ≠ a := by
  haveI : NeZero n := a.neZero
  intro h
  rw [finRotate_apply] at h
  have hn2 : 2 ≤ n := by omega
  have hh : a + 1 = a + 0 := by simpa using h
  have hz : (1 : Fin n) = 0 := add_left_cancel hh
  have hv := congrArg Fin.val hz
  norm_num at hv
  omega

/-- Partition all half-edges by their incident vertex. -/
def halfEdgeSigmaEquiv : HalfEdge E ≃ (v : V) × G.halfEdgesAt v where
  toFun h := ⟨G.vertex h, h, rfl⟩
  invFun p := p.2.1
  left_inv _ := rfl
  right_inv p := by
    rcases p with ⟨v, ⟨h, hh⟩⟩
    dsimp
    subst v
    rfl

omit [DecidableEq V] [DecidableEq E] in
@[simp]
theorem halfEdgeSigmaEquiv_fst (h : HalfEdge E) :
    (halfEdgeSigmaEquiv G h).1 = G.vertex h := rfl

omit [DecidableEq V] [DecidableEq E] in
@[simp]
theorem vertex_halfEdgeSigmaEquiv_symm (p : (v : V) × G.halfEdgesAt v) :
    G.vertex ((halfEdgeSigmaEquiv G).symm p) = p.1 := by
  rcases p with ⟨v, ⟨h, hh⟩⟩
  exact hh

/-- One cyclic step on a single vertex fiber, obtained by identifying the fiber with a `Fin`. -/
noncomputable def fiberCycle (v : V) : Equiv.Perm (G.halfEdgesAt v) :=
  (Fintype.equivFin (G.halfEdgesAt v)).trans
    ((finRotate (Fintype.card (G.halfEdgesAt v))).trans
      (Fintype.equivFin (G.halfEdgesAt v)).symm)

/-- The simultaneous cyclic permutation on every vertex fiber. -/
noncomputable def rotationPerm : Equiv.Perm (HalfEdge E) :=
  (halfEdgeSigmaEquiv G).trans
    ((Equiv.sigmaCongrRight (fiberCycle G)).trans (halfEdgeSigmaEquiv G).symm)

omit [DecidableEq E] in
theorem rotationPerm_sameVertex (h : HalfEdge E) :
    G.vertex (rotationPerm G h) = G.vertex h := by
  simp [rotationPerm]

omit [DecidableEq E] in
theorem rotationPerm_ne (hne : ∀ v, G.degree v ≠ 1) (h : HalfEdge E) :
    rotationPerm G h ≠ h := by
  intro heq
  have hs := congrArg (halfEdgeSigmaEquiv G) heq
  simp only [rotationPerm, Equiv.trans_apply, Equiv.apply_symm_apply] at hs
  change (⟨G.vertex h, fiberCycle G (G.vertex h) ⟨h, rfl⟩⟩ :
      (v : V) × G.halfEdgesAt v) = ⟨G.vertex h, ⟨h, rfl⟩⟩ at hs
  have hf : fiberCycle G (G.vertex h) ⟨h, rfl⟩ = ⟨h, rfl⟩ := by
    injection hs
  have hi := congrArg (Fintype.equivFin (G.halfEdgesAt (G.vertex h))) hf
  simp only [fiberCycle, Equiv.trans_apply, Equiv.apply_symm_apply] at hi
  exact finRotate_ne_self_of_card_ne_one (hne (G.vertex h)) _ hi

omit [DecidableEq E] in
theorem rotationPerm_fiberTransitive (h k : HalfEdge E)
    (hvk : G.vertex h = G.vertex k) :
    ∃ n : ℕ, (rotationPerm G : HalfEdge E → HalfEdge E)^[n] h = k := by
  let v := G.vertex h
  let eh : G.halfEdgesAt v := ⟨h, rfl⟩
  let ek : G.halfEdgesAt v := ⟨k, hvk.symm⟩
  let ef := Fintype.equivFin (G.halfEdgesAt v)
  obtain ⟨n, hn⟩ : ∃ n : ℕ,
      (finRotate (Fintype.card (G.halfEdgesAt v)) :
        Fin (Fintype.card (G.halfEdgesAt v)) →
          Fin (Fintype.card (G.halfEdgesAt v)))^[n] (ef eh) = ef ek := by
    haveI : NeZero (Fintype.card (G.halfEdgesAt v)) := (ef eh).neZero
    refine ⟨(ef ek - ef eh).val, ?_⟩
    rw [← finCycle_eq_finRotate_iterate]
    simp only [finCycle_apply]
    rw [sub_eq_add_neg]
    abel
  have hsemFiber : Function.Semiconj ef (fiberCycle G v)
      (finRotate (Fintype.card (G.halfEdgesAt v))) := by
    intro x
    simp only [ef, fiberCycle, Equiv.trans_apply, Equiv.apply_symm_apply]
  have hfiber : (fiberCycle G v : G.halfEdgesAt v → G.halfEdgesAt v)^[n] eh = ek := by
    apply ef.injective
    rw [hsemFiber.iterate_right]
    exact hn
  let sigmaCycle : Equiv.Perm ((v : V) × G.halfEdgesAt v) :=
    Equiv.sigmaCongrRight (fiberCycle G)
  let embed : G.halfEdgesAt v → ((v : V) × G.halfEdgesAt v) := fun x ↦ ⟨v, x⟩
  have hsemEmbed : Function.Semiconj embed (fiberCycle G v) sigmaCycle := by
    intro x
    rfl
  have hsigma : (sigmaCycle : ((v : V) × G.halfEdgesAt v) →
      ((v : V) × G.halfEdgesAt v))^[n] ⟨v, eh⟩ = ⟨v, ek⟩ := by
    rw [← hsemEmbed.iterate_right]
    exact congrArg embed hfiber
  have hsemGlobal : Function.Semiconj (halfEdgeSigmaEquiv G) (rotationPerm G)
      sigmaCycle := by
    intro x
    simp only [rotationPerm, sigmaCycle, Equiv.trans_apply, Equiv.apply_symm_apply]
  refine ⟨n, (halfEdgeSigmaEquiv G).injective ?_⟩
  rw [hsemGlobal.iterate_right]
  have hh : halfEdgeSigmaEquiv G h = ⟨v, eh⟩ := rfl
  have hk : halfEdgeSigmaEquiv G k = ⟨v, ek⟩ := by
    apply Sigma.ext hvk.symm
    apply (Subtype.heq_iff_coe_eq (fun x => by simp [v, hvk])).2
    rfl
  rw [hh, hk]
  exact hsigma

/-- Every finite graph with no degree-one vertex admits a cyclic successor on each nonempty
vertex fiber.  Empty fibers require no choices. -/
noncomputable def rotationSystemOfDegreeNeOne (hne : ∀ v, G.degree v ≠ 1) :
    G.RotationSystem where
  next := rotationPerm G
  sameVertex := rotationPerm_sameVertex G
  next_ne := rotationPerm_ne G hne
  fiberTransitive := rotationPerm_fiberTransitive G

omit [DecidableEq E] in
/-- A bridgeless loopless finite graph has no vertex of degree one: the unique incident edge
would itself be a singleton cut. -/
theorem degree_ne_one_of_bridgeless (hb : G.Bridgeless) (v : V) : G.degree v ≠ 1 := by
  intro hd
  obtain ⟨h, hh⟩ := Fintype.card_eq_one_iff.mp hd
  let e : E := h.1.1
  have hend : G.endAt e h.1.2 = v := h.2
  have hcut : G.cut {v} = {e} := by
    ext k
    simp only [cut, Finset.mem_filter, Finset.mem_univ, true_and, Finset.mem_singleton]
    constructor
    · intro hk
      simp only [Crosses, Finset.mem_singleton] at hk
      by_cases hk0 : G.endAt k 0 = v
      · have hkhe : (⟨(k, 0), hk0⟩ : G.halfEdgesAt v) = h := hh _
        exact congrArg (fun q ↦ q.1.1) hkhe
      · have hk1 : G.endAt k 1 = v := by
          simpa [hk0] using hk
        have hkhe : (⟨(k, 1), hk1⟩ : G.halfEdgesAt v) = h := hh _
        exact congrArg (fun q ↦ q.1.1) hkhe
    · intro hke
      subst k
      simp only [Crosses, Finset.mem_singleton]
      have hj : h.1.2 = 0 ∨ h.1.2 = 1 := by omega
      rcases hj with hj | hj
      · rw [hj] at hend
        have hne : G.endAt e 1 ≠ v := by
          intro hz
          exact G.loopless e (hend.trans hz.symm)
        simp [hend, hne]
      · rw [hj] at hend
        have hne : G.endAt e 0 ≠ v := by
          intro hz
          exact G.loopless e (hz.trans hend.symm)
        simp [hend, hne]
  have hc := hb {v}
  rw [hcut] at hc
  exact hc (Finset.card_singleton e)

/-- The canonical rotation system available on every bridgeless finite graph. -/
noncomputable def rotationSystemOfBridgeless (hb : G.Bridgeless) : G.RotationSystem :=
  rotationSystemOfDegreeNeOne G (degree_ne_one_of_bridgeless G hb)

/-- Vertices in the cubic expansion. -/
abbrev ExpandedVertex (_G : FiniteGraph V E) := HalfEdge E

/-- Spokes followed by ring edges.  A ring edge is named by its initial half-edge. -/
abbrev ExpandedEdge (_G : FiniteGraph V E) := E ⊕ HalfEdge E

variable (R : G.RotationSystem)

private def expansionToEnd :
    (G.ExpandedVertex × Fin 3) → (G.ExpandedEdge × Fin 2) := fun p ↦
  if p.2 = 0 then
    (Sum.inl p.1.1, p.1.2)
  else if p.2 = 1 then
    (Sum.inr p.1, 0)
  else
    (Sum.inr (R.next.symm p.1), 1)

private def expansionFromEnd :
    (G.ExpandedEdge × Fin 2) → (G.ExpandedVertex × Fin 3)
  | (Sum.inl e, j) => ((e, j), 0)
  | (Sum.inr h, j) => if j = 0 then (h, 1) else (R.next h, 2)

omit [DecidableEq V] [DecidableEq E] in
private theorem expansion_left_inverse :
    Function.LeftInverse (expansionFromEnd G R) (expansionToEnd G R) := by
  rintro ⟨h, i⟩
  fin_cases i <;> simp [expansionToEnd, expansionFromEnd]

omit [DecidableEq V] [DecidableEq E] in
private theorem expansion_right_inverse :
    Function.RightInverse (expansionFromEnd G R) (expansionToEnd G R) := by
  rintro ⟨e, j⟩
  cases e with
  | inl e => simp [expansionToEnd, expansionFromEnd]
  | inr h => fin_cases j <;> simp [expansionToEnd, expansionFromEnd]

/-- The explicit three-slots-to-two-ends equivalence for the cubic expansion. -/
noncomputable def expansionIncidence :
    (G.ExpandedVertex × Fin 3) ≃ (G.ExpandedEdge × Fin 2) where
  toFun := expansionToEnd G R
  invFun := expansionFromEnd G R
  left_inv := expansion_left_inverse G R
  right_inv := expansion_right_inverse G R

/-- The vertex-ring expansion is a finite loopless cubic multigraph. -/
noncomputable def cubicExpansion : CubicGraph G.ExpandedVertex G.ExpandedEdge where
  incidence := expansionIncidence G R
  loopless := by
    intro e
    cases e with
    | inl e =>
        simp [expansionIncidence, expansionFromEnd]
    | inr h =>
        simpa [expansionIncidence, expansionFromEnd] using (R.next_ne h).symm

/-- The same expansion viewed as a general finite graph, with its endpoints written explicitly. -/
def expansionGraph : FiniteGraph G.ExpandedVertex G.ExpandedEdge where
  endAt
    | Sum.inl e, j => (e, j)
    | Sum.inr h, j => if j = 0 then h else R.next h
  loopless := by
    intro e
    cases e with
    | inl e =>
        intro heq
        exact Fin.zero_ne_one (congrArg Prod.snd heq)
    | inr h => simpa using (R.next_ne h).symm

omit [DecidableEq V] [DecidableEq E] in
@[simp]
theorem expansionGraph_spoke_endAt (e : E) (j : Fin 2) :
    (expansionGraph G R).endAt (Sum.inl e) j = (e, j) := by
  rfl

omit [DecidableEq V] [DecidableEq E] in
@[simp]
theorem expansionGraph_ring_endAt_zero (h : G.ExpandedVertex) :
    (expansionGraph G R).endAt (Sum.inr h) 0 = h := by
  rfl

omit [DecidableEq V] [DecidableEq E] in
@[simp]
theorem expansionGraph_ring_endAt_one (h : G.ExpandedVertex) :
    (expansionGraph G R).endAt (Sum.inr h) 1 = R.next h := by
  rfl

private theorem finiteGraph_eq_of_endAt_eq
    {V' E' : Type*} [Fintype V'] [Fintype E'] (A B : FiniteGraph V' E')
    (h : A.endAt = B.endAt) : A = B := by
  cases A with
  | mk ae al =>
    cases B with
    | mk be bl =>
      dsimp at h
      cases h
      rfl

omit [DecidableEq V] [DecidableEq E] in
/-- The explicit endpoint presentation agrees with forgetting the cubic incidence presentation. -/
theorem cubicExpansion_toFiniteGraph_eq :
    (cubicExpansion G R).toFiniteGraph = expansionGraph G R := by
  apply finiteGraph_eq_of_endAt_eq
  funext e j
  cases e with
  | inl e => rfl
  | inr h => fin_cases j <;> rfl

/-- The vertex-ring expansion of a bridgeless graph is bridgeless.  Ring edges cannot form a
singleton cut because their crossing indicators sum to zero in `F₂`.  If a singleton cut were a
spoke, the absence of ring crossings makes membership constant on each original vertex fiber,
so that cut would descend to a singleton cut of the original graph. -/
theorem expansionGraph_bridgeless (hb : G.Bridgeless) :
    (expansionGraph G R).Bridgeless := by
  classical
  intro S hcard
  obtain ⟨x, hx⟩ := Finset.card_eq_one.mp hcard
  let chi : G.ExpandedVertex → F₂ := fun h ↦ if h ∈ S then 1 else 0
  let ringCross : G.ExpandedVertex → F₂ := fun h ↦
    if (expansionGraph G R).Crosses S (Sum.inr h) then 1 else 0
  have hringPoint (h : G.ExpandedVertex) :
      ringCross h = chi h + chi (R.next h) := by
    simp only [ringCross, chi, Crosses, expansionGraph_ring_endAt_zero,
      expansionGraph_ring_endAt_one]
    by_cases ha : h ∈ S <;> by_cases hb : R.next h ∈ S <;> simp [ha, hb]
    all_goals decide
  have hringSum : (∑ h : G.ExpandedVertex, ringCross h) = 0 := by
    simp_rw [hringPoint]
    rw [Finset.sum_add_distrib]
    have hreindex : (∑ h : G.ExpandedVertex, chi (R.next h)) = ∑ h, chi h :=
      R.next.sum_comp (Finset.univ : Finset G.ExpandedVertex) chi (by simp)
    rw [hreindex]
    ring_nf
    have htwo : (2 : F₂) = 0 := by decide
    rw [htwo, mul_zero]
  have hmemCut (e : G.ExpandedEdge) :
      e ∈ (expansionGraph G R).cut S ↔ (expansionGraph G R).Crosses S e := by
    simp [cut]
  cases x with
  | inr h0 =>
      have hsingle : (∑ h : G.ExpandedVertex, ringCross h) = 1 := by
        change (∑ h : G.ExpandedVertex,
          if (expansionGraph G R).Crosses S (Sum.inr h) then 1 else 0) = 1
        calc
          _ = ∑ h : G.ExpandedVertex, if h = h0 then (1 : F₂) else 0 := by
            apply Finset.sum_congr rfl
            intro h _
            have hm : (expansionGraph G R).Crosses S (Sum.inr h) ↔ h = h0 := by
              rw [← hmemCut]
              rw [hx, Finset.mem_singleton]
              simp
            by_cases heq : h = h0
            · rw [if_pos (hm.mpr heq), if_pos heq]
            · rw [if_neg (hm.not.mpr heq), if_neg heq]
          _ = 1 := by simp
      rw [hringSum] at hsingle
      exact zero_ne_one hsingle
  | inl e0 =>
      have hnoRing (h : G.ExpandedVertex) :
          ¬ (expansionGraph G R).Crosses S (Sum.inr h) := by
        intro hc
        have hm : Sum.inr h ∈ (expansionGraph G R).cut S := by
          simp [cut, hc]
        rw [hx, Finset.mem_singleton] at hm
        exact Sum.inr_ne_inl hm
      have hnext (h : G.ExpandedVertex) : (h ∈ S) = (R.next h ∈ S) := by
        have hn := hnoRing h
        simp only [Crosses, expansionGraph_ring_endAt_zero,
          expansionGraph_ring_endAt_one, not_not] at hn
        exact hn
      have hiterate (n : ℕ) (h : G.ExpandedVertex) :
          (h ∈ S) = (((R.next : G.ExpandedVertex → G.ExpandedVertex)^[n] h) ∈ S) := by
        induction n with
        | zero => rfl
        | succ n ih =>
            rw [Function.iterate_succ_apply']
            exact ih.trans (hnext _)
      have hfiber (h k : G.ExpandedVertex) (hvk : G.vertex h = G.vertex k) :
          (h ∈ S) = (k ∈ S) := by
        obtain ⟨n, hn⟩ := R.fiberTransitive h k hvk
        simpa [hn] using hiterate n h
      let T : Finset V := Finset.univ.filter fun v ↦
        ∃ h : G.ExpandedVertex, G.vertex h = v ∧ h ∈ S
      have hmem (h : G.ExpandedVertex) : G.vertex h ∈ T ↔ h ∈ S := by
        constructor
        · intro hv
          simp only [T, Finset.mem_filter, Finset.mem_univ, true_and] at hv
          obtain ⟨k, hkv, hkS⟩ := hv
          have heq := hfiber k h hkv
          exact heq.mp hkS
        · intro hh
          simp only [T, Finset.mem_filter, Finset.mem_univ, true_and]
          exact ⟨h, rfl, hh⟩
      have hspoke (e : E) :
          (expansionGraph G R).Crosses S (Sum.inl e) ↔ G.Crosses T e := by
        simp only [Crosses, expansionGraph_spoke_endAt]
        rw [← hmem (e, 0), ← hmem (e, 1)]
        rfl
      have horiginal : G.cut T = {e0} := by
        ext e
        simp only [cut, Finset.mem_filter, Finset.mem_univ, true_and,
          Finset.mem_singleton]
        rw [← hspoke]
        rw [← hmemCut]
        rw [hx, Finset.mem_singleton]
        simp
      have hc := hb T
      rw [horiginal] at hc
      exact hc (Finset.card_singleton e0)

/-- Bridgelessness in the exact forgotten-cubic representation consumed by the cubic theorem. -/
theorem cubicExpansion_bridgeless (hb : G.Bridgeless) :
    (cubicExpansion G R).toFiniteGraph.Bridgeless := by
  rw [cubicExpansion_toFiniteGraph_eq G R]
  exact expansionGraph_bridgeless G R hb

omit [DecidableEq V] [DecidableEq E] in
@[simp]
theorem cubicExpansion_edgeAt_zero (h : G.ExpandedVertex) :
    (cubicExpansion G R).edgeAt h 0 = Sum.inl h.1 := by
  rfl

omit [DecidableEq V] [DecidableEq E] in
@[simp]
theorem cubicExpansion_edgeAt_one (h : G.ExpandedVertex) :
    (cubicExpansion G R).edgeAt h 1 = Sum.inr h := by
  rfl

omit [DecidableEq V] [DecidableEq E] in
@[simp]
theorem cubicExpansion_edgeAt_two (h : G.ExpandedVertex) :
    (cubicExpansion G R).edgeAt h 2 = Sum.inr (R.next.symm h) := by
  rfl

omit [DecidableEq E] in
/-- Summing cubic parity around the ring over an original vertex cancels the two copies of
each ring edge, leaving exactly the parity equation for the original spokes. -/
theorem projected_vertex_even
    (C : CDCLean.IndexedEvenDoubleCover (cubicExpansion G R)) (s : Gamma) (v : V) :
    ∑ e : E,
      ((if G.endAt e 0 = v then C.member s (Sum.inl e) else 0) +
       (if G.endAt e 1 = v then C.member s (Sum.inl e) else 0)) = 0 := by
  let spoke : G.ExpandedVertex → F₂ := fun h ↦
    if G.vertex h = v then C.member s (Sum.inl h.1) else 0
  let ring : G.ExpandedVertex → F₂ := fun h ↦
    if G.vertex h = v then C.member s (Sum.inr h) else 0
  let previousRing : G.ExpandedVertex → F₂ := fun h ↦
    if G.vertex h = v then C.member s (Sum.inr (R.next.symm h)) else 0
  have hlocal (h : G.ExpandedVertex) :
      C.member s (Sum.inl h.1) + C.member s (Sum.inr h) +
        C.member s (Sum.inr (R.next.symm h)) = 0 := by
    simpa [Fin.sum_univ_three] using C.vertexEven s h
  have htotal :
      (∑ h : G.ExpandedVertex, (spoke h + ring h + previousRing h)) = 0 := by
    apply Finset.sum_eq_zero
    intro h _
    by_cases hv : G.vertex h = v
    · simpa [spoke, ring, previousRing, hv] using hlocal h
    · simp [spoke, ring, previousRing, hv]
  have hring : (∑ h : G.ExpandedVertex, previousRing h) = ∑ h, ring h := by
    let f : G.ExpandedVertex → F₂ := fun h ↦
      if G.vertex h = v then C.member s (Sum.inr h) else 0
    have hpoint (h : G.ExpandedVertex) : previousRing h = f (R.next.symm h) := by
      have hn : G.vertex (R.next.symm h) = G.vertex h := by
        have hx := R.sameVertex (R.next.symm h)
        simpa using hx.symm
      simp only [previousRing, f]
      rw [hn]
    simp_rw [hpoint]
    exact R.next.symm.sum_comp f
  have hspoke : (∑ h : G.ExpandedVertex, spoke h) = 0 := by
    rw [Finset.sum_add_distrib, Finset.sum_add_distrib, hring] at htotal
    ring_nf at htotal
    have htwo : (2 : F₂) = 0 := by decide
    rw [htwo, mul_zero, add_zero] at htotal
    exact htotal
  calc
    _ = ∑ e : E, ∑ j : Fin 2,
        if G.endAt e j = v then C.member s (Sum.inl e) else 0 := by
      apply Finset.sum_congr rfl
      intro e _
      rw [Fin.sum_univ_two]
    _ = ∑ h : G.ExpandedVertex, spoke h := by
      rw [← Fintype.sum_prod_type']
      rfl
    _ = 0 := hspoke

/-- Restricting an indexed even double cover of the cubic expansion to the spoke edges gives
an indexed even double cover of the original graph. -/
noncomputable def projectEvenDoubleCover
    (C : CDCLean.IndexedEvenDoubleCover (cubicExpansion G R)) :
    G.IndexedEvenDoubleCover where
  member s e := C.member s (Sum.inl e)
  vertexEven := projected_vertex_even G R C
  coveredTwice e := C.coveredTwice (Sum.inl e)

end FiniteGraph

end CDCLean
