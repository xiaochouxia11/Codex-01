# Verification record

Date: 2026-07-09 (UTC)

Toolchain:

- Lean `v4.31.0`
- Mathlib `9a9483a92959bc92bd6a60176dd1fe597298c1f8`

Commands run from the repository root:

```bash
lake build CDCLean
lake env lean CDCLean/Audit.lean
rg -n '\bsorry\b|\badmit\b|\bnative_decide\b|^\s*(axiom|opaque|unsafe)\b' --glob '*.lean' .
```

Results:

- The complete library build succeeded (`1727` Lake jobs) with no warnings.
- The source scan returned no matches.
- `#print axioms` reported exactly `propext`, `Classical.choice`, and `Quot.sound` for the final
  theorem `CDCLean.cycleDoubleCover_of_bridgeless` and for every audited critical intermediate
  theorem. In particular, there is no project-specific axiom and no native-decision axiom.

The final theorem is unconditional for finite loopless bridgeless multigraphs. It uses the
formalized Jaeger--Kilpatrick eight-flow theorem to produce a nowhere-zero
`Gamma = (ZMod 2)^3` flow on a cubic expansion, then converts that flow into a cycle double
cover.
