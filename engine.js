// ======= Crafting Engine =======
// Pure calculation core, free of DOM/browser dependencies so it can be unit
// tested in Node and reused verbatim in the browser. All state is passed in
// via an explicit context object rather than read from module globals.
//
// See docs/ENGINE.md for the model. In short: a recipe is a net-flow vector,
// a plan is a run count per recipe, and the raw shopping list is what the
// plan consumes at the leaves. The solver resolves categories/variants into a
// concrete one-recipe-per-item graph, topologically orders it (consumers
// before the items they consume), then propagates demand and rounds once per
// node — so shared intermediates pool before batching instead of over-rounding.
//
//   ctx = {
//     allRecipes,          // combined recipe map (game + custom), conflicts resolved
//     categories,          // { categoryName: [material, ...] }
//     materialChoice,      // { "consumingItem|categoryName": material }  (per-recipe)
//     materialPreferences, // { categoryName: material }  (global fallback)
//     variantPreferences,  // { recipeName: variantIndex }
//     onHand,              // { item: amount }  inventory already on hand
//     mode,                // "batch" (integer) | "rate" (real-valued)
//     byproductsAsSupply,  // when true, co-products offset demand (fixpoint)
//   }
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CraftEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const EPS = 1e-9;

  // ---- Recipe shape helpers ------------------------------------------------

  // Normalize a recipe to always expose a `variants` array.
  function normalizeRecipe(recipe) {
    if (recipe.variants) {
      return recipe; // Already in variants format
    }
    return {
      variants: [
        {
          name: "Default",
          produces: recipe.produces,
          byproducts: recipe.byproducts || {},
          ingredients: recipe.ingredients,
          building: recipe.building || null,
          buildingCost: recipe.buildingCost || {},
          metadata: recipe.metadata || {},
        },
      ],
    };
  }

  // Resolve the variant the user prefers for a recipe (clamped to range).
  function getSelectedVariant(recipeName, recipe, variantPreferences = {}) {
    const normalized = normalizeRecipe(recipe);
    const preferredIndex = variantPreferences[recipeName] || 0;
    const index = Math.min(preferredIndex, normalized.variants.length - 1);
    return normalized.variants[index];
  }

  // Global (non-keyed) material resolution — used by the UI for default display.
  function getSelectedMaterial(categoryName, categories = {}, materialPreferences = {}) {
    return materialPreferences[categoryName] || categories[categoryName]?.[0] || categoryName;
  }

  // Per-recipe material resolution: which concrete material a given consuming
  // recipe uses for a category ingredient. Falls back to the global preference,
  // then the category's first member, then the name itself (not a category).
  function resolveMaterial(consumingItem, ingredient, ctx) {
    const categories = ctx.categories || {};
    const isCategory = categories[ingredient] && !ctx.allRecipes[ingredient];
    if (!isCategory) return ingredient;
    const keyed = ctx.materialChoice?.[consumingItem + "|" + ingredient];
    return (
      keyed ||
      ctx.materialPreferences?.[ingredient] ||
      categories[ingredient][0] ||
      ingredient
    );
  }

  // Detect circular dependencies across every variant of every recipe.
  function hasCircularDependency(itemName, recipeSet, visited = new Set()) {
    if (visited.has(itemName)) return true;
    const recipe = recipeSet[itemName];
    if (!recipe) return false;
    visited.add(itemName);
    const normalized = normalizeRecipe(recipe);
    for (const variant of normalized.variants) {
      for (const ingredient in variant.ingredients) {
        if (hasCircularDependency(ingredient, recipeSet, visited)) return true;
      }
    }
    visited.delete(itemName);
    return false;
  }

  // ---- Graph construction --------------------------------------------------

  // Resolve every recipe reachable from the queue into a concrete node:
  // categories replaced by chosen materials, the selected variant applied.
  function buildConcreteRecipes(queue, ctx) {
    const concrete = {};
    function visit(item) {
      if (concrete[item] !== undefined) return;
      const recipe = ctx.allRecipes[item];
      if (!recipe) {
        concrete[item] = null; // raw material
        return;
      }
      const v = getSelectedVariant(item, recipe, ctx.variantPreferences);
      const inputs = {};
      for (const [ing, amt] of Object.entries(v.ingredients || {})) {
        const mat = resolveMaterial(item, ing, ctx);
        inputs[mat] = (inputs[mat] || 0) + amt; // two ingredients may resolve to one material
      }
      concrete[item] = {
        produces: v.produces,
        inputs,
        byproducts: v.byproducts || {},
        building: v.building || null,
        buildingCost: v.buildingCost || {},
        time: v.metadata?.craftingTime || 0,
        yieldMultiplier: v.yieldMultiplier ?? 1,
      };
      for (const mat of Object.keys(inputs)) visit(mat);
    }
    for (const { item } of queue) visit(item);
    return concrete;
  }

  // Topological order of crafted items, consumers BEFORE the items they
  // consume. Throws on a cycle. Raw items (concrete === null) are omitted;
  // they are handled as leaves during the pass.
  function topoOrder(concrete) {
    const crafted = Object.keys(concrete).filter((k) => concrete[k]);
    const inDegree = {}; // number of crafted consumers of an item
    for (const item of crafted) inDegree[item] = inDegree[item] || 0;
    for (const item of crafted) {
      for (const inp of Object.keys(concrete[item].inputs)) {
        if (concrete[inp]) inDegree[inp] = (inDegree[inp] || 0) + 1;
      }
    }
    const queue = crafted.filter((i) => (inDegree[i] || 0) === 0);
    const order = [];
    while (queue.length) {
      const item = queue.shift();
      order.push(item);
      for (const inp of Object.keys(concrete[item].inputs)) {
        if (!concrete[inp]) continue;
        inDegree[inp] -= 1;
        if (inDegree[inp] === 0) queue.push(inp);
      }
    }
    if (order.length !== crafted.length) {
      throw new Error("Recipe graph contains a cycle");
    }
    return order;
  }

  // ---- Solver --------------------------------------------------------------

  // One propagation pass over the ordered graph. `offsets` carries byproduct
  // supply fed back from a previous iteration (empty on the first pass).
  function solvePass(queue, concrete, order, ctx, offsets) {
    const mode = ctx.mode || "batch";
    const onHand = ctx.onHand || {};
    const demand = {};
    const targetQty = {};
    for (const { item, qty } of queue) {
      demand[item] = (demand[item] || 0) + qty;
      targetQty[item] = (targetQty[item] || 0) + qty;
    }

    const batches = {};
    const produced = {};
    const consumed = {};
    const byproductSupply = {};

    for (const item of order) {
      const c = concrete[item];
      const eff = Math.max(0, (demand[item] || 0) - (onHand[item] || 0) - (offsets[item] || 0));
      const perRun = c.produces * (c.yieldMultiplier || 1);
      const crafts = mode === "batch" ? Math.ceil(eff / perRun) : eff / perRun;
      const producedQty = crafts * c.produces;
      produced[item] = producedQty;

      const scaledByproducts = {};
      for (const [bp, amt] of Object.entries(c.byproducts)) {
        scaledByproducts[bp] = amt * crafts;
        byproductSupply[bp] = (byproductSupply[bp] || 0) + amt * crafts;
      }

      batches[item] = {
        crafts,
        produces: c.produces,
        produced: producedQty,
        leftover: producedQty - eff,
        byproducts: scaledByproducts,
        building: c.building,
        buildingCost: c.buildingCost,
        craftingTime: c.time * crafts,
      };

      for (const [inp, amt] of Object.entries(c.inputs)) {
        demand[inp] = (demand[inp] || 0) + crafts * amt;
        consumed[inp] = (consumed[inp] || 0) + crafts * amt;
      }
    }

    // Leaves: demanded items with no recipe → the shopping list.
    const leafTotals = {};
    for (const [item, d] of Object.entries(demand)) {
      if (concrete[item]) continue;
      const net = d - (onHand[item] || 0) - (offsets[item] || 0);
      const qty = mode === "batch" ? Math.ceil(net) : net;
      if (qty > EPS) leafTotals[item] = qty;
    }

    return { demand, targetQty, batches, produced, consumed, byproductSupply, leafTotals };
  }

  // Full solve: builds the graph, iterates the pass to a fixpoint when
  // byproducts act as supply, and assembles the Plan.
  function solve(queue, ctx) {
    const concrete = buildConcreteRecipes(queue, ctx);
    const order = topoOrder(concrete);
    const maxIter = ctx.byproductsAsSupply ? ctx.maxIterations || 12 : 1;

    let offsets = {};
    let res;
    for (let i = 0; i < maxIter; i++) {
      res = solvePass(queue, concrete, order, ctx, offsets);
      const next = ctx.byproductsAsSupply ? res.byproductSupply : {};
      if (stableOffsets(next, offsets)) break;
      offsets = next;
    }

    const queueItemSet = new Set(queue.map((q) => q.item));

    // Aggregate byproducts, buildings, time; split batches into queue vs intermediate.
    const byproductTotals = {};
    const buildings = {};
    let totalTime = 0;
    const intermediateBatches = {};
    for (const [item, info] of Object.entries(res.batches)) {
      info.isQueueItem = queueItemSet.has(item);
      for (const [bp, amt] of Object.entries(info.byproducts)) {
        byproductTotals[bp] = (byproductTotals[bp] || 0) + amt;
      }
      if (info.crafts > 0 && info.building && !buildings[info.building]) {
        buildings[info.building] = info.buildingCost || {};
      }
      totalTime += info.craftingTime;
      if (!info.isQueueItem) intermediateBatches[item] = info;
    }

    // Surplus: anything available beyond what the plan consumes or targets.
    const surplus = {};
    const items = new Set([
      ...Object.keys(res.produced),
      ...Object.keys(res.consumed),
      ...Object.keys(res.byproductSupply),
      ...Object.keys(ctx.onHand || {}),
      ...Object.keys(res.targetQty),
    ]);
    for (const item of items) {
      const avail =
        (res.produced[item] || 0) +
        (res.byproductSupply[item] || 0) +
        ((ctx.onHand || {})[item] || 0);
      const used = (res.consumed[item] || 0) + (res.targetQty[item] || 0);
      const s = avail - used;
      if (s > EPS) surplus[item] = s;
    }

    return {
      leafTotals: res.leafTotals,
      byproductTotals,
      buildings,
      totalTime,
      intermediateBatches,
      batches: res.batches,
      surplus,
    };
  }

  function stableOffsets(a, b) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (Math.abs((a[k] || 0) - (b[k] || 0)) > EPS) return false;
    }
    return true;
  }

  // Backwards-compatible name: the app calls computeGlobalNeeds(queue, ctx).
  const computeGlobalNeeds = solve;

  // ---- Per-item tree (breakdown view) -------------------------------------
  // Unchanged model, but resolves categories per-consuming-recipe like the
  // solver. Used only for the human-readable per-item breakdown.
  function expand(item, qty, ctx) {
    const allRecipes = ctx.allRecipes;
    if (!allRecipes[item]) {
      return {
        name: item, qty, requestedQty: qty, crafts: 0, produces: 1,
        byproducts: {}, building: null, buildingCost: {}, children: [],
        craftingTime: 0, variantName: null,
      };
    }
    const recipe = allRecipes[item];
    const variant = getSelectedVariant(item, recipe, ctx.variantPreferences);
    const { produces, ingredients, metadata, building, buildingCost } = variant;
    const crafts = Math.ceil(qty / produces);
    const actualQty = crafts * produces;
    const baseTime = metadata?.craftingTime || 0;

    const scaledByproducts = {};
    for (const [bpItem, bpAmt] of Object.entries(variant.byproducts || {})) {
      scaledByproducts[bpItem] = bpAmt * crafts;
    }

    const children = [];
    for (const ing in ingredients) {
      const need = ingredients[ing] * crafts;
      const ingredientName = resolveMaterial(item, ing, ctx);
      children.push(expand(ingredientName, need, ctx));
    }

    return {
      name: item, qty: actualQty, requestedQty: qty, crafts, produces,
      byproducts: scaledByproducts, building: building || null,
      buildingCost: buildingCost || {}, children,
      craftingTime: baseTime * crafts, variantName: variant.name,
    };
  }

  return {
    normalizeRecipe,
    getSelectedVariant,
    getSelectedMaterial,
    resolveMaterial,
    hasCircularDependency,
    buildConcreteRecipes,
    topoOrder,
    solve,
    computeGlobalNeeds,
    expand,
  };
});
