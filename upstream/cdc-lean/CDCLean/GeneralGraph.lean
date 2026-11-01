import CDCLean.EvenCover
import Mathlib.Data.Finite.Set
import Mathlib.Data.Fintype.Sets

/-!
# General finite loopless multigraphs

An edge object has two numbered ends.  Numbering is only an orientation used to state flow
conservation; graph predicates below are invariant under swapping the two ends.
-/

namespace CDCLean

open scoped BigOperators

/-- A finite loopless multigraph with genuinely distinct edge objects. -/
structure FiniteGraph (V E : Type*) [Fintype V] [Fintype E] where
  endAt : E → Fin 2 → V
  loopless : ∀ e, endAt e 0 ≠ endAt e 1

namespace FiniteGraph

variable {V E : Type*} [Fintype V] [Fintype E] [DecidableEq V] [DecidableEq E]
  (G : FiniteGraph V E)

/-- The type of edge ends (half-edges). -/
abbrev HalfEdge (E : Type*) := E × Fin 2

/-- Vertex incident with a half-edge. -/
def vertex (h : HalfEdge E) : V := G.endAt h.1 h.2

/-- Half-edges incident with `v`. -/
def halfEdgesAt (v : V) := {h : HalfEdge E // G.vertex h = v}

instance (v : V) : Fintype (G.halfEdgesAt v) :=
  Subtype.fintype (fun h : HalfEdge E ↦ G.vertex h = v)

/-- Degree, with parallel edge objects counted separately. -/
def degree (v : V) : ℕ := Fintype.card (G.halfEdgesAt v)

/-- Whether edge `e` crosses the vertex subset `S`. -/
def Crosses (S : Finset V) (e : E) : Prop :=
  (G.endAt e 0 ∈ S) ≠ (G.endAt e 1 ∈ S)

/-- A cut contains exactly the edge objects crossing a vertex subset. -/
noncomputable def cut (G : FiniteGraph V E) (S : Finset V) : Finset E := by
  classical
  exact Finset.univ.filter (G.Crosses S)

/-- Cut characterization of a finite bridgeless loopless multigraph: there is no cut consisting
of one edge object. -/
def Bridgeless (G : FiniteGraph V E) : Prop := ∀ S : Finset V, (cut G S).card ≠ 1

/-- Signed conservation for a function on the oriented edge objects. -/
def IsFlow {A : Type*} [AddCommGroup A] (f : E → A) : Prop :=
  ∀ v : V,
    (∑ e : E, if G.endAt e 0 = v then f e else 0) -
      (∑ e : E, if G.endAt e 1 = v then f e else 0) = 0

def IsNowhereZero {A : Type*} [Zero A] (f : E → A) : Prop := ∀ e, f e ≠ 0

/-- An integer nowhere-zero 6-flow, the direct conclusion of Seymour's theorem. -/
structure SixFlow where
  val : E → ℤ
  conservation : G.IsFlow val
  bound : ∀ e, 0 < Int.natAbs (val e) ∧ Int.natAbs (val e) < 6

/-- A nowhere-zero group-valued flow. -/
structure NowhereZeroFlow (A : Type*) [AddCommGroup A] [Zero A] where
  val : E → A
  conservation : G.IsFlow val
  nowhereZero : IsNowhereZero val

/-- The explicit theorem-shaped trust boundary for Seymour's original result. -/
def SeymourSixFlowStatement : Prop :=
  ∀ (V : Type*) (E : Type*) [Fintype V] [Fintype E] [DecidableEq V] [DecidableEq E]
    (G : FiniteGraph V E), Bridgeless G → Nonempty G.SixFlow

/-- The eight edge sets used in the projection stage, stated for an arbitrary graph. -/
structure IndexedEvenDoubleCover where
  member : Gamma → E → F₂
  vertexEven : ∀ s v,
    ∑ e : E,
      ((if G.endAt e 0 = v then member s e else 0) +
       (if G.endAt e 1 = v then member s e else 0)) = 0
  coveredTwice : ∀ e,
    (Finset.univ.filter fun s : Gamma ↦ member s e = 1).card = 2

end FiniteGraph

end CDCLean
