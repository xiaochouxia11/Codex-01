import CDCLean.CubicTheorem
import CDCLean.CycleDecomposition
import CDCLean.Expansion
import CDCLean.PathCut
import CDCLean.JaegerKilpatrick

/-!
# The assembled implication

This file first records the six-flow route to a cycle double cover, then isolates the construction
from an explicit `Gamma`-flow on a cubic expansion, and finally combines that construction with
Jaeger--Kilpatrick's eight-flow theorem.
-/

namespace CDCLean

open FiniteGraph

universe u

/-- The claimed implication with Seymour's literal nowhere-zero integer 6-flow theorem as its
only mathematical premise.  Tutte's coefficient transfer, cubic expansion, affine-pair
construction, projection, and circuit decomposition are all proved internally. -/
theorem cycleDoubleCover_of_sixFlow
    (seymour : SeymourSixFlowStatement.{u, u})
    {V E : Type u} [Fintype V] [Fintype E] [DecidableEq V] [DecidableEq E]
    (G : FiniteGraph V E) (hb : G.Bridgeless) :
    Nonempty G.CycleDoubleCover := by
  let R : G.RotationSystem := G.rotationSystemOfBridgeless hb
  let K : CubicGraph G.ExpandedVertex G.ExpandedEdge := G.cubicExpansion R
  have hK : K.toFiniteGraph.Bridgeless := by
    simpa [K] using G.cubicExpansion_bridgeless R hb
  obtain ⟨sf⟩ := seymour _ _ K.toFiniteGraph hK
  have hgamma : Nonempty (K.toFiniteGraph.NowhereZeroFlow Gamma) :=
    K.toFiniteGraph.zmodEight_to_gamma_unconditional ⟨sf.toZModEight⟩
  obtain ⟨gamma⟩ := hgamma
  let cubicCover : IndexedEvenDoubleCover K :=
    cubic_even_double_cover K (K.gammaFlowOfNowhereZero gamma)
  let projected : G.IndexedEvenDoubleCover := G.projectEvenDoubleCover R cubicCover
  exact ⟨projected.toCycleDoubleCover⟩

/-- A nowhere-zero `Gamma`-flow on a cubic expansion supplies the even double cover that
projects back to a cycle double cover of the original graph. -/
theorem cycleDoubleCover_of_gammaFlow
    {V E : Type u} [Fintype V] [Fintype E] [DecidableEq V] [DecidableEq E]
    (G : FiniteGraph V E) (R : G.RotationSystem)
    (gamma : (G.cubicExpansion R).toFiniteGraph.NowhereZeroFlow Gamma) :
    Nonempty G.CycleDoubleCover := by
  let K : CubicGraph G.ExpandedVertex G.ExpandedEdge := G.cubicExpansion R
  let cubicCover : IndexedEvenDoubleCover K :=
    cubic_even_double_cover K (K.gammaFlowOfNowhereZero gamma)
  let projected : G.IndexedEvenDoubleCover := G.projectEvenDoubleCover R cubicCover
  exact ⟨projected.toCycleDoubleCover⟩

/-- Every finite bridgeless graph has a cycle double cover.  Jaeger--Kilpatrick supplies a
nowhere-zero `Gamma`-flow on the cubic expansion, and the preceding construction turns that
flow into the desired cover. -/
theorem cycleDoubleCover_of_bridgeless
    {V E : Type u} [Fintype V] [Fintype E] [DecidableEq V] [DecidableEq E]
    (G : FiniteGraph V E) (hb : G.Bridgeless) :
    Nonempty G.CycleDoubleCover := by
  let R : G.RotationSystem := G.rotationSystemOfBridgeless hb
  let K : CubicGraph G.ExpandedVertex G.ExpandedEdge := G.cubicExpansion R
  have hK : K.toFiniteGraph.Bridgeless := by
    simpa [K] using G.cubicExpansion_bridgeless R hb
  obtain ⟨gamma⟩ := K.toFiniteGraph.jaegerKilpatrickEightFlow hK
  exact cycleDoubleCover_of_gammaFlow G R gamma

end CDCLean
