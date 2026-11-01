import CDCLean.GeneralGraph

/-!
# The elementary first step from a 6-flow

Reducing the integer circulation modulo eight is safe because all its edge values have absolute
value between one and five.  The subsequent transfer from `ZMod 8` to `F₂³` is a separate
group-order counting theorem; it is not hidden in the definition below.
-/

namespace CDCLean

open scoped BigOperators

namespace FiniteGraph

variable {V E : Type*} [Fintype V] [Fintype E] [DecidableEq V] [DecidableEq E]
  (G : FiniteGraph V E)

/-- Reduction of Seymour's integer circulation modulo eight. -/
def SixFlow.toZModEight (sf : G.SixFlow) : G.NowhereZeroFlow (ZMod 8) where
  val e := (sf.val e : ZMod 8)
  conservation := by
    intro v
    have h := congrArg (fun z : ℤ ↦ (z : ZMod 8)) (sf.conservation v)
    simpa only [IsFlow, Int.cast_sub, Int.cast_sum, Int.cast_ite, Int.cast_zero] using h
  nowhereZero := by
    intro e he
    have hne : sf.val e ≠ 0 := by
      intro hz
      simpa [hz] using (sf.bound e).1
    have hdvd : (8 : ℤ) ∣ sf.val e :=
      (ZMod.intCast_zmod_eq_zero_iff_dvd (sf.val e) 8).mp he
    have hlt : Int.natAbs (sf.val e) < Int.natAbs (8 : ℤ) := by
      simpa using lt_trans (sf.bound e).2 (by decide : 6 < 8)
    exact hne (Int.eq_zero_of_dvd_of_natAbs_lt_natAbs hdvd hlt)

end FiniteGraph

end CDCLean
