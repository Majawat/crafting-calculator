# Crafting Calculator — Handoff

A snapshot of where this project stands, why it's built the way it is, and what's
next. Read this first, then [`docs/ENGINE.md`](ENGINE.md) for the calculation
model and the [README](../README.md) for the pack authoring format.

## 1. What it is

A **generic, client-side crafting calculator** for any game. You define recipes
(in the browser or via JSON packs), queue up items, and it computes the raw
materials, intermediate batches, byproducts, buildings, and time required. Pure
HTML/CSS/JS, **no runtime dependencies**, no backend — it runs by opening
`index.html` and deploys as static files (GitHub Pages:
https://majawat.github.io/crafting-calculator/).

## 2. Architecture

| File | Role |
|------|------|
| `index.html` | Single page: Calculate / Cookbook / Setup tabs |
| `engine.js` | **Pure calculation core.** No DOM. All state via a `ctx` object. Exposed as `window.CraftEngine` (browser) and `module.exports` (Node), so it's unit-tested directly. |
| `app.js` | All UI/DOM. Owns state (recipes, queue, categories, inventory…), builds `ctx`, and **delegates all math to `CraftEngine`** via thin wrappers fed by `engineCtx()`. |
| `styles.css` | Blueprint Dark Navy theme |
| `recipes/*.json` | Recipe packs (schema v2) + `index.json` manifest |
| `tests/engine.test.js` | Engine unit tests (Node built-in runner) |
| `tests/packs.test.js` | Validates every shipped pack |
| `docs/ENGINE.md` | The calculation model, from first principles |

**Data flow:** `app.js` state → `engineCtx()` → `CraftEngine.solve(queue, ctx)` →
a Plan `{ leafTotals, byproductTotals, buildings, totalTime, intermediateBatches,
batches, surplus }` → rendered in the Results panel. The per-item breakdown tree
comes from `CraftEngine.expand()` (a *view* projection, not the source of totals).

### The engine model (see ENGINE.md for depth)

A recipe is a **net-flow vector**; a plan is a set of run counts; the raw
shopping list is what the plan consumes at the leaves. The solver:

1. **Resolves** categories/variants into a concrete one-recipe-per-item graph
   (`buildConcreteRecipes`).
2. **Topologically orders** items, consumers before the items they consume
   (`topoOrder`; throws on a cycle).
3. **Propagates demand** and rounds to integer batches **once per node**
   (`solvePass`) — pooling shared-intermediate demand *before* rounding. This is
   the correctness core; naive recursion over-rounds.
4. When `byproductsAsSupply` is on, iterates to a **fixpoint**, feeding co-product
   supply back as a demand offset.

## 3. Current state

All feature work through **schema v2 is merged to `main`** (PRs #10–#15). CI runs
`node --test` + CodeQL on every PR; **0 open issues**.

| PR | What |
|----|------|
| #10 | Extracted `engine.js`, added tests + data-driven packs (`recipes/index.json`) |
| #11 | Engine v2: topological net-flow solver + per-`(recipe,category)` material choice; fixed a batch-rounding bug |
| #12 | On-hand inventory (`onHand`) + surplus display |
| #13 | Byproducts-as-supply UI toggle |
| #14 | Load a pack's `categories` block (they were being dropped) |
| #15 | **Schema v2** (no back-compat): `inputs`/`outputs`/`machine`/`time`, `items`/`settings`, units; fixed the ONI "Metal Ore" category; pack validator |

**Tests: 24, all passing.** Every change this era was browser-verified with the
Chrome extension against real ONI data.

## 4. Key design decisions (don't relitigate without cause)

- **Compute-only, not optimize.** The engine plans from the choices the user
  *pins* (which variant, which material per recipe). It does **not** choose
  recipes to minimize anything. "Optimize this for me" is a future phase — an LP
  over the same net-flow model. The data model keeps choices as explicit,
  overridable assignments so it can slot in later. *The fork that decides the
  core:* does the engine make choices or just compute a specified plan? We chose
  compute-only, which is exactly why the legible topo-pass (not an LP) is the
  right core.
- **Topological net-flow pass is the core**, even greenfield — it's legible
  (produces a human-readable "80 Polymers → 8 batches → …" narrative), gives the
  unique expected answer, is zero-dependency, and integer-batches-with-leftover is
  the actual product for batch games.
- **Schema v2, no backwards-compatibility** (user's explicit call). Recipe =
  `inputs` / `outputs` (all outputs; **primary = the recipe key**; rest are
  co-products) / `machine` / `time` (+ optional `power`, `yield`). A machine's
  build cost is *its own recipe*, not a field. A recipe with no `inputs` is an
  extractor. This canonical shape **is the engine's internal model** — pack format
  and solver finally speak the same language.
- **Units are display-only labels.** They never convert and never enter
  arithmetic — within a pack an item's numbers are already one consistent scale.
  The danger the user (rightly) flinched at is *units-as-math* (dimensions,
  densities, cross-unit sums); we avoid it entirely. If a conversion is ever
  needed, model it as an explicit recipe, not a units subsystem.
- **Per-`(recipe, category)` material choice** — key `"consumingItem|categoryName"`
  in `materialChoice`; the global `materialPreferences` is the fallback default.
  Different occurrences resolving to different materials simply pool independently.

## 5. Roadmap (what's next)

From `docs/ENGINE.md` §7:

- **Phase 4** — a **graph/DAG view** of the plan (the tree view repeats shared
  nodes and can't show co-products feeding two consumers), and exposing
  **efficiency/`yield`** in the UI.
- **Phase 5 (optional, larger)** — **rate mode**: `x_r` real-valued (items/sec),
  round *machines* not batches, show ratios + throughput + wall-clock time
  (opens Factorio/Satisfactory/Anno). The engine already has a `mode: "rate"`
  seam in `solvePass` (skips integer rounding) — needs UI + machine-count/ratio
  display. Then **alternate-recipe optimization** (the LP; the compute-only fork).
- **Smaller follow-ups:**
  - A full **"material assignments" panel** for choosing materials on *deep
    intermediates* (today the per-recipe picker only shows on queued items'
    direct inputs — the common ONI build-list flow, but not the whole chain).
  - Recipe **search/filter** in the Cookbook (a big pack is a wall today).
  - **Editable queue quantities** (currently remove-and-re-add).
  - **Shareable links** — encode queue/recipes in a URL hash (the on-brand,
    no-backend way to share, vs. mailing a JSON file).
  - More recipe **packs** (pure content now that packs are data-driven; run the
    pack validator).

## 6. Bigger open question (product, not code)

**BYO hand-entered recipes vs. curated per-game packs.** The best crafting tools
win on *having complete, correct data*, not on flexible entry. The data-driven
packs + validator quietly lean toward curation. Worth deciding deliberately
before investing further — it changes what "done" looks like.

## 7. How to work on it

```bash
# Tests (needs Node 18+, no npm install — built-in runner)
node --test
# or: npm test

# Run / QA locally
python -m http.server 8000    # then open http://localhost:8000/
# (opening index.html via file:// works too, but fetch() of recipes/ needs a server)
```

- **CI:** `.github/workflows/test.yml` runs `node --test` on push/PR; CodeQL +
  Dependabot are on. Keep the pack validator green when editing `recipes/`.
- **Git workflow:** branch per change, PR to `main`, squash-merge (the owner
  merges — an automated merge is classifier-blocked in this setup). Attribution
  trailer conventions are set at the session level.
- **Browser QA:** the Chrome extension (`mcp__claude-in-chrome__*`) works when
  connected — drive real scenarios, watch the console for errors, screenshot.
  If it's offline, a Node `vm` harness that loads `engine.js` + `app.js` in one
  script scope (stubbing only `window`) exercises the real app wrappers headless.

## 8. Gotchas / lessons

- **Pack loading is async.** UI rendered at `DOMContentLoaded` can predate the
  pack. `updateAllUI()` (called at the end of `loadGameRecipes`) is the re-render
  hook — it now includes `renderQueue()` so queue material selectors appear after
  a pack loads.
- **No back-compat means old localStorage breaks.** Recipes saved in the pre-v2
  format won't load; "Clear All Data" resets cleanly. Inherent to the no-compat
  call, not a bug.
- **`expand()` is a view, not the truth.** All authoritative totals come from
  `solve()`. Keep new calculation logic in `engine.js` (pure, tested), not
  `app.js`.
- **The solver's internal concrete shape** still uses `produces`/`byproducts`/
  `machine` fields — these are *derived from* `outputs[item]` and are internal,
  not the pack schema. Don't confuse them.
- **Line endings:** the repo is LF; on Windows, git shows harmless
  "LF will be replaced by CRLF" warnings — blobs are stored LF, consistent.

## 9. Known limitations

- Category material choice is exposed in the UI only for **queued items'** direct
  category inputs (+ their machine's), not arbitrary deep intermediates.
- The **tree breakdown repeats shared nodes** and can't depict co-products
  feeding multiple consumers — the Phase 4 graph view addresses this.
- **Quality tiers, tech-gating, temperature/state, scheduling** are intentionally
  out of scope — this is a bill-of-materials tool, not a factory simulator. A
  `tier`/`quality`/`requires` tag can ride in `items{}` metadata without the calc
  reasoning about it.
