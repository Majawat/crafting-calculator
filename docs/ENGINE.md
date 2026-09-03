# Crafting Engine Design

This document describes the calculation engine (`engine.js`) from first
principles: what a recipe *is*, the general model, and how the solver works.
It is the reference for extending the engine.

## 1. First principles — a recipe is a net-flow vector

Strip away the game dressing. One *run* of a recipe is a vector over items:
some entries produced (`outputs`), some consumed (`inputs`), plus non-item
costs (time, a machine that must be present but is not consumed).

A **crafting plan** chooses a run count `x_r` for each recipe so that net
production meets a target. Net production of item `i` is:

```
net(i) = Σ_r  x_r · (outputs_r[i] − inputs_r[i])
```

with constraints:

- **targets**: `net(i) ≥ demand(i)`
- **intermediates**: `net(i) ≥ 0`
- **raws**: nothing produces them, so their total consumption
  `Σ_r x_r · inputs_r[i]` **is the answer** — the shopping list.

Everything a crafting calculator does is: solve for `x`, then read off raw
consumption. Every game mechanic is a variation on the *shape* of that linear
system, a scalar transform on the flows, or an objective for choosing among
many valid `x`.

## 2. The axes games vary on

| Axis | Effect on the math |
|------|--------------------|
| One recipe/item, integer batches | triangular system; back-substitute; round up runs → leftover |
| Shared intermediates | still triangular, but **pool all demand before rounding**, once, in dependency order |
| Useful byproducts (co-products) | a recipe *supplies* an item demanded elsewhere → demand offset; couples equations; can force surplus |
| Alternate recipes (choice) | underdetermined → pick by an objective (LP). *Deferred.* |
| Rates instead of batches | `x_r` real-valued; round **machines** not batches; ratios + throughput. *Deferred (mode).* |
| Probabilistic / efficiency yield | scalar on outputs: `demand / (produces · yieldMultiplier)` |
| On-hand inventory | scalar offset: `effective = max(0, demand − onHand)` at **every** node |
| Catalyst / machine / fuel | station (one-time) vs N-machines (throughput) vs fuel (per run / per time) |

## 3. The model — one topological net-flow pass

Process items in **topological order: every consumer before the item it
consumes.** That ordering is what makes pooling correct — by the time an
item's batch count is decided, *all* demand for it has landed.

```
solvePass(targets, ctx, offsets):
  demand = {}
  for {item, qty} in targets: demand[item] += qty

  for item in topoOrder(ctx.recipes):        # consumers first; reject on cycle
     eff = max(0, demand[item] - onHand[item] - offsets[item])
     r = ctx.recipes[item]
     if r == null:                           # raw → shopping-list entry
        raw[item] = eff; continue
     perRun = primaryOutput(r, item) * (r.yieldMultiplier ?? 1)
     crafts = ctx.mode == "batch" ? ceil(eff / perRun) : eff / perRun
     produced[item] = crafts * perRun
     leftover[item] = produced[item] - eff
     for [inp, amt] in r.inputs:  demand[inp] += crafts * amt
     for [out, amt] in r.outputs where out != item:
        byproductSupply[out] += crafts * amt
```

### Byproducts as supply (fixpoint)

Co-product supply can lower a crafted item's batch count, which lowers *its*
co-product output. Resolve by **iterating the pass to a fixpoint**, feeding
supply back as a demand offset. Supply only ever *reduces* demand, so the
iteration trends downward; cap at N iterations and accept the last state. When
`byproductsAsSupply` is off, run a single pass (the pure tree case).

### Why topological order, not recursion

Recursion `ceil`s at each branch, so a shared intermediate is over-rounded
(e.g. one consumer needs 3, another 2, batch size 5 → recursion makes 2 batches;
pooled demand of 5 makes 1). The topo pass pools first, rounds once — this is
both the correctness fix and the substrate every later feature builds on.

## 4. Categories & variants — resolved *before* the solver

The solver sees a clean one-recipe-per-item map (`ctx.recipes`). Variant
selection and category→material resolution happen when that map is built.

**Material choice is keyed per `(consuming recipe, category)`**, not globally.
In ONI you build one thing from Igneous Rock and another from Gold Amalgam,
both drawing on the same `Refined Metal` category. When recipe `R` consumes
category `C`, substitute the material chosen for `(R, C)`, falling back to a
global/first-member default. Different occurrences resolving to different
concrete materials simply become different items and pool independently — the
net-flow model needs no special case for it.

Granularity is `(recipe, category)`, not per-ingredient-slot; the only thing
it cannot express is the same category twice in one recipe wanting different
materials each (does not occur in ONI). Slot-level is a cheap later extension.

## 5. The Plan (solver output)

```
Plan {
  raw:        { [item]: qty }                       # shopping list
  batches:    { [item]: {crafts, produced, leftover, machine, time} }
  surplus:    { [item]: qty }                       # leftover + unused byproduct
  byproducts: { [item]: qty }                       # gross co-product output
  buildings:  { [machine]: cost }
  totalTime:  number                                # batch: Σ; rate: wall-clock
}
```

## 6. Compute-only vs. optimize (the fork)

The engine is **compute-only**: it computes a plan from the choices the user
has pinned (which variant, which material per recipe). It does **not** choose
recipes to minimize anything. An "optimize this for me" objective is a future
addition — an LP over the same net-flow model — and the data model keeps
choices as explicit, overridable assignments so it can slot in without a
rewrite.

## 7. Roadmap

- **Phase 1** *(done)* — topo net-flow solver (batch mode), per-`(recipe,
  category)` material assignments, `onHand`/`yieldMultiplier` in the engine.
  `byproductsAsSupply` off by default (parity + the batch-rounding fix).
- **Phase 2** *(done)* — inventory UI (`onHand` input) + surplus display.
- **Phase 3** *(this)* — byproducts-as-supply toggle in the UI (engine fixpoint
  already present). Per-pack default flag still TODO.
- **Phase 4** — graph/DAG view + efficiency exposure.
- **Phase 5** *(optional)* — rate mode; then alternate-recipe optimization (LP).
