# CDC Lean formalization

This project kernel-checks an unconditional cycle double cover theorem for finite loopless
bridgeless multigraphs. The endpoint is `CDCLean.cycleDoubleCover_of_bridgeless` in
`CDCLean/Main.lean`; it uses the formalized Jaeger--Kilpatrick eight-flow theorem to construct
a nowhere-zero `Gamma = (ZMod 2)^3` flow and then converts that flow into a cycle double cover.
Lean is pinned to `v4.31.0` and Mathlib to `9a9483a92959bc92bd6a60176dd1fe597298c1f8`.

## Setup

Install [elan](https://github.com/leanprover/elan) if `lake` is not already available:

```bash
curl https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh -sSf | sh
source "$HOME/.elan/env"
```

Then clone and build:

```bash
git clone https://github.com/openai/cdc-lean.git
cd cdc-lean
lake update
lake exe cache get
lake build CDCLean
```

If no cache exists for the pinned Mathlib revision, skip `lake exe cache get`; the build will
compile dependencies from source.

## Verify

```bash
lake env lean CDCLean/Audit.lean
rg -n '\bsorry\b|\badmit\b|\bnative_decide\b|^\s*(axiom|opaque|unsafe)\b' --glob '*.lean' .
```

The audit should list only `propext`, `Classical.choice`, and `Quot.sound`; the source scan should
print nothing.
