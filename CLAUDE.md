# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a pure client-side crafting calculator application built with vanilla HTML, CSS, and JavaScript. It allows users to define recipes dynamically in the browser, calculate resource requirements for crafting items, and view both flat totals and hierarchical breakdowns.

## Architecture

The application follows a simple file structure:

- **index.html**: Single-page application with forms for adding recipes and calculating crafts
- **engine.js**: Pure calculation core. Solves a **topological net-flow pass** over the recipe graph (resolve categories/variants → concrete graph → topo-order the items, consumers first → propagate demand, round once per node). No DOM or browser APIs — all state passed via a `ctx` object. Exposed as `window.CraftEngine` (browser) and `module.exports` (Node). Supports per-`(recipe, category)` material choice, `onHand` inventory, `yieldMultiplier`, and `byproductsAsSupply` (co-products offset demand via a fixpoint). See **docs/ENGINE.md** for the full model.
- **app.js**: UI, recipe storage, and DOM manipulation. Delegates all math to `CraftEngine` via thin wrappers (`expand`, `computeGlobalNeeds`, `normalizeRecipe`, etc.) that supply the app's live state through `engineCtx()`. Note: `onHand` inventory has a UI (the On Hand card, offsets demand, shows surplus). `byproductsAsSupply` has a UI too (the "Byproducts count as supply" toggle in the Queue card; persisted, recomputes live).
- **styles.css**: Styling with card-based layout and responsive design
- **tests/engine.test.js**: Node built-in test-runner suite for `engine.js` (`node --test`). No dependencies.
- **recipes/index.json**: Manifest listing the game recipe packs; the Setup-tab dropdown is populated from it at load time.

### Testing

Run `node --test` (or `npm test`). The engine is pure, so tests need no DOM/build. `app.js` is intentionally thin over the engine; keep new calculation logic in `engine.js` so it stays testable.

### Core Data Structures

- `recipes` object: In-memory storage of custom recipes, persisted to localStorage
- `gameRecipes` object: In-memory storage of loaded game recipe packs
- `variantPreferences` object: Stores user's selected variant per recipe, persisted to localStorage
- Recipe format (single): `{ produces: number, ingredients: { [name]: amount }, metadata?: {...} }`
- Recipe format (variants): `{ variants: [{ name: string, produces: number, ingredients: {...}, metadata?: {...} }] }`
- Tree structure: Recursive expansion creates `{ name, qty, children[], variantName, ... }` nodes

### Recipe Variants

Recipes can have multiple variants (e.g., different crafting methods for the same item). When a recipe has variants:
- All variants are displayed in the stored recipes list
- A variant selector appears in the Craft card when selecting items with multiple variants
- User preferences for variant selection are saved to localStorage
- The selected variant is used during recipe expansion and is shown in the calculation breakdown

### Key Functions

Engine (`engine.js`, pure):

- `solve(queue, ctx)` (alias `computeGlobalNeeds`): the topological net-flow solver — returns `{ leafTotals, byproductTotals, buildings, totalTime, intermediateBatches, batches, surplus }`
- `buildConcreteRecipes(queue, ctx)`: resolves reachable recipes into a concrete graph (categories → chosen materials, variant applied)
- `topoOrder(concrete)`: consumers-before-consumed ordering; throws on a cycle
- `resolveMaterial(consumingItem, ingredient, ctx)`: per-`(recipe, category)` material resolution (keyed → global pref → first member)
- `expand(item, qty, ctx)`: per-item tree for the human-readable breakdown view only (not the source of totals)
- `normalizeRecipe`, `getSelectedVariant`, `getSelectedMaterial`, `hasCircularDependency`: recipe-shape helpers

App (`app.js`, DOM):

- `calculate()`: Main entry point that orchestrates expansion and rendering
- `getAllRecipes()`: Merges game + custom recipes (conflict-suffixing), feeding `engineCtx()`
- Recipe management: `addRecipe()`, `updateCraftDropdown()`, `updateVariantSelector()`, `updateIngredientDatalist()`

## Development

Since this is a static client-side application:

- **Testing**: `node --test` (or `npm test`) runs the engine unit tests; open `index.html` directly in a browser for manual UI testing
- **No build process**: Files can be edited and refreshed immediately
- **No runtime dependencies**: Pure vanilla JavaScript; `package.json` only declares the built-in test runner script (no `npm install` needed)
- **Deployment**: Can be hosted on any static hosting service (GitHub Pages, Netlify, etc.). Only the static assets are served; `tests/`, `package.json`, and `.github/` are ignored by the site.

## Data Persistence

Recipes are stored in browser localStorage as JSON. The application automatically saves and loads recipes on page refresh. No backend or database required.