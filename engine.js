// ======= Crafting Engine =======
// Pure calculation core, free of DOM/browser dependencies so it can be unit
// tested in Node and reused verbatim in the browser. All state is passed in
// via an explicit context object rather than read from module globals:
//
//   ctx = { allRecipes, categories, materialPreferences, variantPreferences }
//
// where `allRecipes` is the combined recipe map (game + custom, conflicts
// already resolved by the caller). The browser app in app.js delegates all of
// its math to the functions exported here.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CraftEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
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

  // Resolve a category ingredient to the specific material the user selected,
  // falling back to the first member, then the category name itself.
  function getSelectedMaterial(categoryName, categories = {}, materialPreferences = {}) {
    return materialPreferences[categoryName] || categories[categoryName]?.[0] || categoryName;
  }

  // Detect circular dependencies across every variant of every recipe.
  function hasCircularDependency(itemName, recipeSet, visited = new Set()) {
    if (visited.has(itemName)) {
      return true; // Found a cycle
    }
    const recipe = recipeSet[itemName];
    if (!recipe) {
      return false; // Base ingredient, no cycle
    }
    visited.add(itemName);
    const normalized = normalizeRecipe(recipe);
    for (const variant of normalized.variants) {
      for (const ingredient in variant.ingredients) {
        if (hasCircularDependency(ingredient, recipeSet, visited)) {
          return true;
        }
      }
    }
    visited.delete(itemName);
    return false;
  }

  // Recursively expand a single item into a tree of craft requirements.
  function expand(item, qty, ctx) {
    const { allRecipes, categories = {}, materialPreferences = {}, variantPreferences = {} } = ctx;

    if (!allRecipes[item]) {
      return {
        name: item,
        qty: qty,
        requestedQty: qty,
        crafts: 0,
        produces: 1,
        byproducts: {},
        building: null,
        buildingCost: {},
        children: [],
        craftingTime: 0,
        variantName: null,
      };
    }

    const recipe = allRecipes[item];
    const variant = getSelectedVariant(item, recipe, variantPreferences);
    const { produces, ingredients, metadata, building, buildingCost } = variant;
    const crafts = Math.ceil(qty / produces);
    const actualQty = crafts * produces;

    const baseTime = metadata?.craftingTime || 0;
    const totalCraftingTime = baseTime * crafts;

    const scaledByproducts = {};
    for (const [bpItem, bpAmt] of Object.entries(variant.byproducts || {})) {
      scaledByproducts[bpItem] = bpAmt * crafts;
    }

    const children = [];
    for (const ing in ingredients) {
      const need = ingredients[ing] * crafts;
      let ingredientName = ing;
      if (categories[ing] && !allRecipes[ing]) {
        // Category ingredient: resolve to the selected specific material
        ingredientName = getSelectedMaterial(ing, categories, materialPreferences);
      }
      children.push(expand(ingredientName, need, ctx));
    }

    return {
      name: item,
      qty: actualQty,
      requestedQty: qty,
      crafts: crafts,
      produces: produces,
      byproducts: scaledByproducts,
      building: building || null,
      buildingCost: buildingCost || {},
      children,
      craftingTime: totalCraftingTime,
      variantName: variant.name,
    };
  }

  // Global batch calculation using fractional-demand propagation.
  // Exact fractional demands are propagated through the whole recipe tree so
  // that batch rounding happens once, at the leaves, across all queue items
  // combined. This prevents overcounting when several items share the same
  // intermediate recipe.
  function computeGlobalNeeds(queue, ctx) {
    const { allRecipes, categories = {}, materialPreferences = {}, variantPreferences = {} } = ctx;
    const exactDemands = {};

    function collectExactDemands(item, qty) {
      exactDemands[item] = (exactDemands[item] || 0) + qty;
      const recipe = allRecipes[item];
      if (!recipe) return;
      const variant = getSelectedVariant(item, recipe, variantPreferences);
      const exactBatches = Math.ceil(qty / variant.produces);
      for (const [ing, amount] of Object.entries(variant.ingredients)) {
        let ingName = ing;
        if (categories[ing] && !allRecipes[ing]) {
          ingName = getSelectedMaterial(ing, categories, materialPreferences);
        }
        collectExactDemands(ingName, exactBatches * amount);
      }
    }

    for (const { item, qty } of queue) {
      collectExactDemands(item, qty);
    }

    const leafTotals = {};
    const allBatches = {};
    const queueItemSet = new Set(queue.map((q) => q.item));

    for (const [mat, totalDemand] of Object.entries(exactDemands)) {
      const recipe = allRecipes[mat];
      if (!recipe) {
        leafTotals[mat] = (leafTotals[mat] || 0) + Math.ceil(totalDemand);
      } else {
        const variant = getSelectedVariant(mat, recipe, variantPreferences);
        const crafts = Math.ceil(totalDemand / variant.produces);
        const produced = crafts * variant.produces;
        const scaledByproducts = {};
        for (const [bp, amt] of Object.entries(variant.byproducts || {})) {
          scaledByproducts[bp] = amt * crafts;
        }
        allBatches[mat] = {
          requestedTotal: totalDemand,
          crafts,
          produces: variant.produces,
          produced,
          leftover: produced - Math.ceil(totalDemand),
          byproducts: scaledByproducts,
          building: variant.building || null,
          buildingCost: variant.buildingCost || {},
          craftingTime: (variant.metadata?.craftingTime || 0) * crafts,
          isQueueItem: queueItemSet.has(mat),
        };
      }
    }

    const byproductTotals = {};
    const buildings = {};
    let totalTime = 0;
    const intermediateBatches = {};

    for (const [mat, info] of Object.entries(allBatches)) {
      for (const [bp, amt] of Object.entries(info.byproducts)) {
        byproductTotals[bp] = (byproductTotals[bp] || 0) + amt;
      }
      if (info.building && !buildings[info.building]) {
        buildings[info.building] = info.buildingCost;
      }
      totalTime += info.craftingTime;
      if (!info.isQueueItem) {
        intermediateBatches[mat] = info;
      }
    }

    return { leafTotals, byproductTotals, buildings, totalTime, intermediateBatches };
  }

  return {
    normalizeRecipe,
    getSelectedVariant,
    getSelectedMaterial,
    hasCircularDependency,
    expand,
    computeGlobalNeeds,
  };
});
