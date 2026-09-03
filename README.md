# Crafting Calculator

A lightweight, generic crafting calculator that works for *any* game or project. Define your own recipes ad‑hoc in the browser, calculate base resources needed, and see both a hierarchical breakdown and flattened totals.

This project runs entirely client‑side (HTML, CSS, JavaScript) — no backend, no database, no sign‑in. Just open the page, add recipes, and calculate.

## Features

* Add recipes on the fly (inputs, outputs incl. co-products, machine, time)
* **Display units** — packs can label items (e.g. kg) shown next to quantities
* **Recipe variants** — define multiple crafting methods for the same item; the calculator uses your preferred variant
* **Material categories** — group interchangeable materials (e.g. "Refined Metal" → Copper, Aluminum…) and pick which one to use **per recipe** (build one thing from Copper and another from Aluminum, both drawing on the same category)
* **Multi-item queue** — queue up several items at once; the calculator finds the globally optimal batch counts across all of them
* **On-hand inventory** — list materials you already have; they're subtracted from what you need, and anything left over shows as **surplus**
* **Byproducts as supply** — optionally treat a recipe's byproducts as usable stock that offsets demand for those items elsewhere (e.g. refining byproducts feeding another recipe)
* Totals view for base materials (globally correct — no per-item batch overcounting)
* **Combined Crafting** section showing global batch stats for intermediate materials (batches run, produced, leftover, byproducts)
* Tree breakdown view for nested recipes
* **Load game recipe packs** (e.g. The Alters) from the Setup tab
* **Export your recipes** as a `.json` pack file — compatible with "Load Recipe Pack", ready to commit to the repo
* Works fully offline in your browser
* Can be hosted easily on **GitHub Pages** (free)

## Usage

1. Access this site at https://majawat.github.io/crafting-calculator/ or clone the repo and open `index.html` in a browser.
2. Go to the **Setup** tab to add recipes.
3. Switch to the **Calculate** tab, select an item and quantity, add it to the queue.
4. Click **Calculate All** to see required base resources and the full breakdown.

## Tabs

### Calculate
* **Craft** card — pick an item, choose a variant (if applicable), choose which material to use for any category ingredients, set quantity, and add to queue.
* **Queue** card — view queued items, remove individual ones, or clear the whole queue. Hit **Calculate All** to run.
* **Results** — shows Materials Needed (leaf resources), Byproducts, Buildings Needed, Total Crafting Time, a **Combined Crafting** section for intermediates, and a per-item Breakdown.

### Setup
* **Add Recipe** — define item name, inputs (with amounts), quantity produced, optional co-products, optional machine, and optional time.
* **Material Categories** — group interchangeable materials under a category name. Recipes can list the category name as an ingredient; the calculator resolves it to the selected material at calculation time.
* **Stored Recipes** — load a game recipe pack, browse saved custom recipes, **Export My Recipes** to download your custom recipes as a shareable `.json` file, or **Clear All Data** to wipe everything from localStorage.

## Recipe Packs

Recipe packs live in the `recipes/` directory as `.json` files, in **schema v2**:

```json
{
  "schemaVersion": 2,
  "gameInfo": { "name": "...", "gameVersion": "...", "description": "..." },
  "settings": { "byproductsAsSupply": false },
  "categories": {
    "Refined Metal": ["Copper", "Gold"]
  },
  "items": {
    "Copper Ore": { "unit": "kg", "raw": true, "group": "Ores" }
  },
  "recipes": {
    "Item Name": {
      "inputs": { "Refined Metal": 5 },
      "outputs": { "Item Name": 1, "Waste": 1 },
      "machine": "Furnace",
      "time": 2
    }
  }
}
```

A recipe is a net-flow node:

* **`inputs`** — what it consumes. A category name resolves to the chosen material.
* **`outputs`** — everything it produces. The recipe's **key is its primary output**; any others are co-products. (A recipe with no `inputs` is an extractor/source.)
* **`machine`** — the required structure. Its build cost is just its own recipe.
* **`time`** — seconds per run. Optional: `power`, `yield` (an efficiency/expected-value multiplier).
* Multiple crafting methods → a **`variants`** array of the above (each with a `name`).

Pack-level blocks:

* **`categories`** — interchangeable-material groups. They load with the pack, resolve category inputs, and appear read-only under **Material Categories** on the Setup tab. Your own categories override a pack's on a name clash.
* **`items`** — optional metadata for any item (especially raws): `unit` (a **display-only** label — units never convert), `raw`, `group`, `displayName`.
* **`settings`** — per-pack defaults (e.g. `byproductsAsSupply`).

Use **Export My Recipes** on the Setup tab to create a pack file from your custom recipes — drop the download into `recipes/` and load it via the UI.

### Registering a pack

The game-pack dropdown is populated at load time from `recipes/index.json` — no HTML edits needed. To add a pack, drop its `<id>.json` in `recipes/` and add an entry:

```json
{
  "packs": [
    { "id": "the-alters", "name": "The Alters" },
    { "id": "your-pack-id", "name": "Your Pack Name" }
  ]
}
```

The `id` must match the filename (without `.json`); the `name` is what appears in the dropdown.

## Example Recipe (The Alters)

* **Polymers Package** → produces 10 from 20 Organics + 20 Minerals
* **Bridge Anchor** → produces 1 from 20 Metals + 20 Polymers

Crafting 4 Bridge Anchors → requires **80 Metals, 160 Organics, 160 Minerals**.

## Development

The calculation core lives in `engine.js` as a dependency-free module (no DOM),
so it can be unit tested outside the browser. `app.js` handles all UI/DOM work
and delegates its math to the engine. It solves a topological net-flow pass over
the recipe graph — see [`docs/ENGINE.md`](docs/ENGINE.md) for the model.

Run the test suite (requires Node 18+, no `npm install` needed — uses Node's
built-in test runner):

```bash
node --test
# or
npm test
```

## Tech

* Pure HTML, CSS, and JavaScript
* No runtime dependencies
* Works in any modern browser
