# Crafting Calculator

A lightweight, generic crafting calculator that works for *any* game or project. Define your own recipes ad‑hoc in the browser, calculate base resources needed, and see both a hierarchical breakdown and flattened totals.

This project runs entirely client‑side (HTML, CSS, JavaScript) — no backend, no database, no sign‑in. Just open the page, add recipes, and calculate.

## Features

* Add recipes on the fly (name, quantity produced, ingredients, byproducts, building costs)
* **Recipe variants** — define multiple crafting methods for the same item; the calculator uses your preferred variant
* **Material categories** — group interchangeable materials (e.g. "Refined Metal" → Copper, Aluminum…) and pick which one to use per calculation
* **Multi-item queue** — queue up several items at once; the calculator finds the globally optimal batch counts across all of them
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
* **Add Recipe** — define item name, ingredients (with amounts), quantity produced, optional byproducts, and optional building + building cost.
* **Material Categories** — group interchangeable materials under a category name. Recipes can list the category name as an ingredient; the calculator resolves it to the selected material at calculation time.
* **Stored Recipes** — load a game recipe pack, browse saved custom recipes, **Export My Recipes** to download your custom recipes as a shareable `.json` file, or **Clear All Data** to wipe everything from localStorage.

## Recipe Packs

Recipe packs live in the `recipes/` directory as `.json` files. Format:

```json
{
  "gameInfo": { "name": "...", "version": "1.0.0", "description": "..." },
  "recipes": {
    "Item Name": {
      "produces": 1,
      "ingredients": { "Material": 5 },
      "byproducts": { "Waste": 1 },
      "building": "Furnace",
      "buildingCost": { "Metal": 100 },
      "metadata": { "craftingTime": 2, "station": "Furnace" }
    }
  }
}
```

Recipes can also use a `variants` array for items with multiple crafting methods. Use **Export My Recipes** on the Setup tab to create a pack file from your custom recipes — the downloaded file can be dropped into `recipes/` and loaded via the UI.

## Example Recipe (The Alters)

* **Polymers Package** → produces 10 from 20 Organics + 20 Minerals
* **Bridge Anchor** → produces 1 from 20 Metals + 20 Polymers

Crafting 4 Bridge Anchors → requires **80 Metals, 160 Organics, 160 Minerals**.

## Tech

* Pure HTML, CSS, and JavaScript
* No dependencies
* Works in any modern browser
