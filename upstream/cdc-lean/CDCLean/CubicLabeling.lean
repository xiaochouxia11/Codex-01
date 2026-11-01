import CDCLean.Basic
import Mathlib.Tactic.Ring

/-!
# The cubic labeling argument

This file formalizes the local pair construction and its global compatibility system.  The
solvability proof follows the manuscript's dual-obstruction calculation.
-/

namespace CDCLean

open scoped BigOperators

variable {V E : Type*} [Fintype V] [Fintype E] [DecidableEq V] [DecidableEq E]

/-- Membership in the two-element affine pair `{p, p+h}` as an `F₂` indicator. -/
def pairIndicator (p h s : Gamma) : F₂ := if s = p ∨ s = p + h then 1 else 0

/-- The finite local parity fact used at a cubic vertex.  It is a closed statement about the
eight-element vector space `F₂³`; `decide` exhaustively verifies all cases by kernel reduction. -/
theorem local_pair_parity :
    ∀ (x y t s : Gamma), x ≠ 0 → y ≠ 0 → x ≠ y →
      pairIndicator t x s +
      pairIndicator (t + x) y s +
      pairIndicator t (x + y) s = 0 := by
  decide

/-- Equality criterion for affine two-element pairs in an elementary abelian two-group. -/
theorem pairIndicator_eq_of_difference :
    ∀ (p q h : Gamma) (ε : F₂), h ≠ 0 → p + q = ε • h →
      pairIndicator p h = pairIndicator q h := by
  decide

/-- The local incidence base point `g_{v,e}` from the manuscript. -/
def localBase (G : CubicGraph V E) (f : GammaFlow G) (v : V) (e : E) : Gamma :=
  if e = G.edgeAt v 1 then f.val (G.edgeAt v 0) else 0

/-- Right-hand side of the edge compatibility system. -/
def compatibilityRhs (G : CubicGraph V E) (f : GammaFlow G) (e : E) : Gamma :=
  localBase G f (G.endAt e 0) e + localBase G f (G.endAt e 1) e

/-- Linear map whose range is the set of compatible edge right-hand sides. -/
def compatibilityMap (G : CubicGraph V E) (f : GammaFlow G) :
    ((V → Gamma) × (E → F₂)) →ₗ[F₂] (E → Gamma) where
  toFun x e := x.1 (G.endAt e 0) + x.1 (G.endAt e 1) + x.2 e • f.val e
  map_add' x y := by
    ext e i
    dsimp
    ring
  map_smul' c x := by
    ext e i
    dsimp
    ring

/-- A linear functional on an edge-indexed product, restricted to coordinate `e`. -/
def coordinateFunctional (φ : Module.Dual F₂ (E → Gamma)) (e : E) :
    Module.Dual F₂ Gamma :=
  φ.comp (LinearMap.single F₂ (fun _ : E ↦ Gamma) e)

theorem dual_apply_eq_sum_coordinates (φ : Module.Dual F₂ (E → Gamma)) (y : E → Gamma) :
    φ y = ∑ e : E, coordinateFunctional φ e (y e) := by
  conv_lhs => rw [← LinearMap.sum_single_apply (fun _ : E ↦ Gamma) y]
  simp [coordinateFunctional]

/-- Standard finite-dimensional separation, stated in precisely the form used below. -/
theorem mem_range_of_dual_obstructions_vanish
    {X Y : Type*} [AddCommGroup X] [Module F₂ X] [AddCommGroup Y] [Module F₂ Y]
    (L : X →ₗ[F₂] Y) (b : Y)
    (h : ∀ φ : Module.Dual F₂ Y, (∀ x, φ (L x) = 0) → φ b = 0) :
    b ∈ LinearMap.range L := by
  have hsep := Subspace.forall_mem_dualAnnihilator_apply_eq_zero_iff
    (LinearMap.range L : Subspace F₂ Y) b
  apply hsep.mp
  intro φ hφ
  apply h φ
  intro x
  exact (Submodule.mem_dualAnnihilator φ).mp hφ (L x) ⟨x, rfl⟩

/-- Coordinate vector of a functional on `F₂³`. -/
def functionalCode (η : Module.Dual F₂ Gamma) : Gamma :=
  fun i ↦ η (Pi.single i 1)

/-- The standard dot pairing on `F₂³`. -/
def gammaPairing (a x : Gamma) : F₂ := ∑ i : Fin 3, x i * a i

theorem functional_apply_eq_pairing (η : Module.Dual F₂ Gamma) (x : Gamma) :
    η x = gammaPairing (functionalCode η) x := by
  conv_lhs => rw [← LinearMap.sum_single_apply (fun _ : Fin 3 ↦ F₂) x]
  rw [map_sum, gammaPairing]
  apply Finset.sum_congr rfl
  intro i hi
  calc
    η (Pi.single i (x i)) = η (x i • Pi.single i (1 : F₂)) := by
      congr 1
      simpa using Pi.single_smul' i (x i) (1 : F₂)
    _ = x i • η (Pi.single i (1 : F₂)) := by rw [map_smul]
    _ = x i * functionalCode η i := by simp [functionalCode]

/-- Indicator of a nonzero linear functional, valued in `F₂`. -/
def functionalNonzero (η : Module.Dual F₂ Gamma) : F₂ :=
  if functionalCode η = 0 then 0 else 1

/-- The three-dimensional local dual identity.  This is again a finite, closed statement over
`F₂³`; exhaustive verification avoids importing any unproved dimension/cardinality claim. -/
theorem local_dual_identity :
    ∀ (x y a b c : Gamma),
      x ≠ 0 → y ≠ 0 → x ≠ y →
      a + b + c = 0 →
      gammaPairing a x = 0 → gammaPairing b y = 0 → gammaPairing c (x + y) = 0 →
      gammaPairing b x =
        (if a = 0 then 0 else 1) + (if b = 0 then 0 else 1) +
          (if c = 0 then 0 else 1) := by
  decide

/-- Elementary consequences of a nowhere-zero characteristic-two flow at a cubic vertex. -/
theorem flow_triple_properties :
    ∀ (x y z : Gamma), x ≠ 0 → y ≠ 0 → z ≠ 0 → x + y + z = 0 →
      z = x + y ∧ x ≠ y := by
  decide

omit [DecidableEq V] in
/-- A common endpoint-sum formula, expressed after reindexing edge ends as vertex slots. -/
theorem dual_end_sum (G : CubicGraph V E) (φ : Module.Dual F₂ (E → Gamma))
    (q : V → E → Gamma) :
    φ (fun e ↦ q (G.endAt e 0) e + q (G.endAt e 1) e) =
      ∑ v : V, ∑ i : Fin 3,
        coordinateFunctional φ (G.edgeAt v i) (q v (G.edgeAt v i)) := by
  rw [dual_apply_eq_sum_coordinates]
  simp_rw [map_add]
  calc
    ∑ e : E, (coordinateFunctional φ e (q (G.endAt e 0) e) +
        coordinateFunctional φ e (q (G.endAt e 1) e)) =
        ∑ e : E, ∑ j : Fin 2,
          coordinateFunctional φ e (q (G.endAt e j) e) := by
            congr 1
            funext e
            rw [Fin.sum_univ_two]
    _ = ∑ v : V, ∑ i : Fin 3,
          coordinateFunctional φ (G.edgeAt v i) (q v (G.edgeAt v i)) := by
            rw [G.sum_edgeEnds_eq_sum_vertexSlots]
            simp [CubicGraph.edgeAt, CubicGraph.endAt]

omit [DecidableEq V] in
theorem dual_compatibility_vertex_part (G : CubicGraph V E) (f : GammaFlow G)
    (φ : Module.Dual F₂ (E → Gamma)) (t : V → Gamma) :
    φ (compatibilityMap G f (t, 0)) =
      ∑ v : V, ∑ i : Fin 3,
        coordinateFunctional φ (G.edgeAt v i) (t v) := by
  rw [show compatibilityMap G f (t, 0) =
      (fun e ↦ t (G.endAt e 0) + t (G.endAt e 1)) by
        ext e i
        simp [compatibilityMap]]
  exact dual_end_sum G φ (fun v _ ↦ t v)

omit [DecidableEq V] in
theorem dual_compatibility_edge_part (G : CubicGraph V E) (f : GammaFlow G)
    (φ : Module.Dual F₂ (E → Gamma)) (ε : E → F₂) :
    φ (compatibilityMap G f (0, ε)) =
      ∑ e : E, coordinateFunctional φ e (ε e • f.val e) := by
  rw [show compatibilityMap G f (0, ε) = (fun e ↦ ε e • f.val e) by
        ext e i
        simp [compatibilityMap]]
  exact dual_apply_eq_sum_coordinates φ _

/-- The manuscript's dual-obstruction calculation, now as a Lean theorem. -/
theorem compatibility_solvable (G : CubicGraph V E) (f : GammaFlow G) :
    compatibilityRhs G f ∈ LinearMap.range (compatibilityMap G f) := by
  apply mem_range_of_dual_obstructions_vanish
  intro φ hφ
  let η : E → Module.Dual F₂ Gamma := coordinateFunctional φ
  have hedge (e : E) : η e (f.val e) = 0 := by
    let eps : E → F₂ := Pi.single e (1 : F₂)
    have hz := hφ ((0 : V → Gamma), eps)
    rw [dual_compatibility_edge_part] at hz
    have hcollapse :
        (∑ k : E, coordinateFunctional φ k (eps k • f.val k)) =
          coordinateFunctional φ e (f.val e) := by
      calc
        (∑ k : E, coordinateFunctional φ k (eps k • f.val k)) =
            coordinateFunctional φ e (eps e • f.val e) := by
              apply Fintype.sum_eq_single e
              intro k hke
              simp [eps, hke]
        _ = coordinateFunctional φ e (f.val e) := by simp [eps]
    rw [hcollapse] at hz
    exact hz
  have hvertex (v : V) : ∑ i : Fin 3, η (G.edgeAt v i) = 0 := by
    apply LinearMap.ext
    intro q
    let tv : V → Gamma := Pi.single v q
    have hz := hφ (tv, (0 : E → F₂))
    rw [dual_compatibility_vertex_part] at hz
    have hz' : ∑ i : Fin 3, η (G.edgeAt v i) q = 0 := by
      have hcollapse :
          (∑ w : V, ∑ i : Fin 3, η (G.edgeAt w i) (tv w)) =
            ∑ i : Fin 3, η (G.edgeAt v i) q := by
        calc
          (∑ w : V, ∑ i : Fin 3, η (G.edgeAt w i) (tv w)) =
              ∑ i : Fin 3, η (G.edgeAt v i) (tv v) := by
                apply Fintype.sum_eq_single v
                intro w hwv
                simp [tv, hwv]
          _ = ∑ i : Fin 3, η (G.edgeAt v i) q := by simp [tv]
      rw [hcollapse] at hz
      exact hz
    simpa [Finset.sum_apply] using hz'
  have hlocal (v : V) :
      η (G.edgeAt v 1) (f.val (G.edgeAt v 0)) =
        ∑ i : Fin 3, functionalNonzero (η (G.edgeAt v i)) := by
    let x := f.val (G.edgeAt v 0)
    let y := f.val (G.edgeAt v 1)
    let z := f.val (G.edgeAt v 2)
    have hsum : x + y + z = 0 := by
      simpa [x, y, z, Fin.sum_univ_three] using f.conservation v
    obtain ⟨hz, hxy⟩ := flow_triple_properties x y z
      (f.nowhereZero _) (f.nowhereZero _) (f.nowhereZero _) hsum
    rw [Fin.sum_univ_three]
    rw [functional_apply_eq_pairing]
    simp only [functionalNonzero]
    apply local_dual_identity x y
        (functionalCode (η (G.edgeAt v 0)))
        (functionalCode (η (G.edgeAt v 1)))
        (functionalCode (η (G.edgeAt v 2)))
        (f.nowhereZero _) (f.nowhereZero _) hxy
    · ext k
      have hv := hvertex v
      rw [Fin.sum_univ_three] at hv
      have := LinearMap.congr_fun hv (Pi.single k 1)
      simpa [functionalCode] using this
    · simpa [← functional_apply_eq_pairing] using hedge (G.edgeAt v 0)
    · simpa [← functional_apply_eq_pairing] using hedge (G.edgeAt v 1)
    · rw [← functional_apply_eq_pairing, ← hz]
      exact hedge (G.edgeAt v 2)
  rw [show compatibilityRhs G f = fun e ↦
      localBase G f (G.endAt e 0) e + localBase G f (G.endAt e 1) e by rfl]
  rw [dual_end_sum G φ (localBase G f)]
  change (∑ v : V, ∑ i : Fin 3, η (G.edgeAt v i)
    (localBase G f v (G.edgeAt v i))) = 0
  have hcontrib (v : V) :
      (∑ i : Fin 3, η (G.edgeAt v i)
        (localBase G f v (G.edgeAt v i))) =
      η (G.edgeAt v 1) (f.val (G.edgeAt v 0)) := by
    have hinj := G.edgeAt_injective v
    rw [Fin.sum_univ_three]
    simp [localBase, hinj.ne (by decide : (0 : Fin 3) ≠ 1),
      hinj.ne (by decide : (2 : Fin 3) ≠ 1)]
  simp_rw [hcontrib, hlocal]
  rw [← G.sum_edgeEnds_eq_sum_vertexSlots
    (fun e _ ↦ functionalNonzero (η e))]
  simp [show (2 : F₂) = 0 by decide]

/-- The pair labels ultimately attached to the edge objects of a cubic graph. -/
structure CubicLabeling (G : CubicGraph V E) (f : GammaFlow G) where
  base : E → Gamma
  vertexParity : ∀ v s,
    ∑ i : Fin 3, pairIndicator (base (G.edgeAt v i)) (f.val (G.edgeAt v i)) s = 0

theorem compatibility_rearrange :
    ∀ (a b c d h : Gamma) (ε : F₂),
      a + b + ε • h = c + d → (a + c) + (b + d) = ε • h := by
  intro a b c d h ε hab
  ext i
  have hi := congrFun hab i
  dsimp at hi ⊢
  calc
    a i + c i + (b i + d i) = (a i + b i) + (c i + d i) := by ring
    _ = (a i + b i) + (a i + b i + ε * h i) := by rw [hi]
    _ = ((a i + b i) + (a i + b i)) + ε * h i := by ring
    _ = ε * h i := by rw [CharTwo.add_self_eq_zero, zero_add]

/-- Solvability of the compatibility system produces globally compatible labels with even local
multiplicity. -/
noncomputable def cubic_labeling (G : CubicGraph V E) (f : GammaFlow G) : CubicLabeling G f := by
  let x := Classical.choose (compatibility_solvable G f)
  have hx : compatibilityMap G f x = compatibilityRhs G f := by
    simpa [x] using Classical.choose_spec (compatibility_solvable G f)
  let t : V → Gamma := x.1
  let ε : E → F₂ := x.2
  let p : E → Gamma := fun e ↦ t (G.endAt e 0) + localBase G f (G.endAt e 0) e
  have hedge (e : E) :
      (t (G.endAt e 0) + localBase G f (G.endAt e 0) e) +
      (t (G.endAt e 1) + localBase G f (G.endAt e 1) e) = ε e • f.val e := by
    apply compatibility_rearrange
    have := congrFun hx e
    simpa [compatibilityMap, compatibilityRhs, t, ε] using this
  have hp_endpoint (e : E) (j : Fin 2) :
      pairIndicator (p e) (f.val e) =
        pairIndicator (t (G.endAt e j) + localBase G f (G.endAt e j) e) (f.val e) := by
    fin_cases j
    · rfl
    · apply pairIndicator_eq_of_difference _ _ _ (ε e) (f.nowhereZero e)
      simpa [p, add_assoc, add_left_comm, add_comm] using hedge e
  refine ⟨p, ?_⟩
  intro v s
  have hslot (i : Fin 3) :
      pairIndicator (p (G.edgeAt v i)) (f.val (G.edgeAt v i)) =
        pairIndicator
          (t v + localBase G f v (G.edgeAt v i))
          (f.val (G.edgeAt v i)) := by
    let j := (G.incidence (v, i)).2
    have hend : G.endAt (G.edgeAt v i) j = v := by
      dsimp [j]
      exact G.endAt_edgeAt_incidence v i
    simpa only [hend] using hp_endpoint (G.edgeAt v i) j
  simp_rw [hslot]
  let x₀ := f.val (G.edgeAt v 0)
  let y₀ := f.val (G.edgeAt v 1)
  let z₀ := f.val (G.edgeAt v 2)
  have hsum : x₀ + y₀ + z₀ = 0 := by
    simpa [x₀, y₀, z₀, Fin.sum_univ_three] using f.conservation v
  obtain ⟨hz, hxy⟩ := flow_triple_properties x₀ y₀ z₀
    (f.nowhereZero _) (f.nowhereZero _) (f.nowhereZero _) hsum
  have hinj := G.edgeAt_injective v
  rw [Fin.sum_univ_three]
  simpa [localBase, x₀, y₀, z₀, hz,
    hinj.ne (by decide : (0 : Fin 3) ≠ 1),
    hinj.ne (by decide : (2 : Fin 3) ≠ 1)] using
      local_pair_parity x₀ y₀ (t v) s
        (f.nowhereZero _) (f.nowhereZero _) hxy

end CDCLean
