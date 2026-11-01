import CDCLean.Basic
import CDCLean.CubicLabeling
import CDCLean.EvenCover
import CDCLean.GeneralGraph
import CDCLean.SixFlow
import CDCLean.CubicBridge
import CDCLean.CubicTheorem
import CDCLean.FlowCount
import CDCLean.CycleDecomposition
import CDCLean.Expansion
import CDCLean.PathCut
import CDCLean.NashWilliams
import CDCLean.JaegerKilpatrick
import CDCLean.Main

/-!
# The nowhere-zero 6-flow implication for cycle double covers

This project formalizes the reduction described in the accompanying proof.  The only external
mathematical premise of `cycleDoubleCover_of_sixFlow` is Seymour's nowhere-zero 6-flow theorem,
supplied as an explicit theorem argument rather than declared as an axiom.
-/
