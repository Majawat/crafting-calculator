// Unit tests for the pure crafting engine. Run with: node --test
// No external dependencies — uses Node's built-in test runner and assert.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../engine.js");

// Helper: build a context from a plain recipe map plus optional extras.
function ctx(allRecipes, extra = {}) {
  return {
    allRecipes,
    categories: extra.categories || {},
    materialPreferences: extra.materialPreferences || {},
    variantPreferences: extra.variantPreferences || {},
  };
}

test("normalizeRecipe wraps a single recipe into a variants array", () => {
  const n = engine.normalizeRecipe({ produces: 2, ingredients: { Iron: 3 } });
  assert.equal(n.variants.length, 1);
  assert.equal(n.variants[0].name, "Default");
  assert.equal(n.variants[0].produces, 2);
  assert.deepEqual(n.variants[0].ingredients, { Iron: 3 });
});

test("normalizeRecipe leaves an existing variants recipe untouched", () => {
  const recipe = { variants: [{ name: "A", produces: 1, ingredients: {} }] };
  assert.equal(engine.normalizeRecipe(recipe), recipe);
});

test("getSelectedVariant honors the preference and clamps out-of-range indices", () => {
  const recipe = {
    variants: [
      { name: "Slow", produces: 1, ingredients: { A: 1 } },
      { name: "Fast", produces: 3, ingredients: { A: 2 } },
    ],
  };
  assert.equal(engine.getSelectedVariant("X", recipe, { X: 1 }).name, "Fast");
  assert.equal(engine.getSelectedVariant("X", recipe, {}).name, "Slow"); // default 0
  assert.equal(engine.getSelectedVariant("X", recipe, { X: 99 }).name, "Fast"); // clamped
});

test("getSelectedMaterial resolves preference, then first member, then the name", () => {
  const categories = { Metal: ["Copper", "Aluminum"] };
  assert.equal(engine.getSelectedMaterial("Metal", categories, { Metal: "Aluminum" }), "Aluminum");
  assert.equal(engine.getSelectedMaterial("Metal", categories, {}), "Copper");
  assert.equal(engine.getSelectedMaterial("Unknown", categories, {}), "Unknown");
});

test("hasCircularDependency detects cycles and clears acyclic graphs", () => {
  const cyclic = {
    A: { produces: 1, ingredients: { B: 1 } },
    B: { produces: 1, ingredients: { A: 1 } },
  };
  assert.equal(engine.hasCircularDependency("A", cyclic), true);

  const acyclic = {
    Widget: { produces: 1, ingredients: { Plate: 2 } },
    Plate: { produces: 1, ingredients: { Iron: 3 } },
  };
  assert.equal(engine.hasCircularDependency("Widget", acyclic), false);
});

test("expand rounds up to whole batches and scales ingredients", () => {
  const recipes = { Bolt: { produces: 4, ingredients: { Iron: 1 } } };
  const tree = engine.expand("Bolt", 5, ctx(recipes));
  assert.equal(tree.crafts, 2); // ceil(5/4)
  assert.equal(tree.qty, 8); // 2 * 4
  assert.equal(tree.requestedQty, 5);
  assert.equal(tree.children[0].name, "Iron");
  assert.equal(tree.children[0].qty, 2); // 1 per batch * 2 batches
});

test("expand scales byproducts and crafting time per batch", () => {
  const recipes = {
    Charcoal: {
      produces: 2,
      ingredients: { Wood: 5 },
      byproducts: { Ash: 1 },
      metadata: { craftingTime: 0.5 },
    },
  };
  const tree = engine.expand("Charcoal", 3, ctx(recipes)); // ceil(3/2)=2 batches
  assert.deepEqual(tree.byproducts, { Ash: 2 });
  assert.equal(tree.craftingTime, 1); // 0.5 * 2
});

test("expand resolves a category ingredient to the selected material", () => {
  const recipes = { Wire: { produces: 1, ingredients: { "Refined Metal": 2 } } };
  const c = ctx(recipes, {
    categories: { "Refined Metal": ["Copper", "Aluminum"] },
    materialPreferences: { "Refined Metal": "Aluminum" },
  });
  const tree = engine.expand("Wire", 1, c);
  assert.equal(tree.children[0].name, "Aluminum");
  assert.equal(tree.children[0].qty, 2);
});

test("computeGlobalNeeds reproduces the README Bridge Anchor example", () => {
  const recipes = {
    "Bridge Anchor": { produces: 1, ingredients: { Metals: 20, Polymers: 20 } },
    Polymers: { produces: 10, ingredients: { Organics: 20, Minerals: 20 } },
  };
  const { leafTotals, intermediateBatches } = engine.computeGlobalNeeds(
    [{ item: "Bridge Anchor", qty: 4 }],
    ctx(recipes),
  );
  assert.deepEqual(leafTotals, { Metals: 80, Organics: 160, Minerals: 160 });
  assert.equal(intermediateBatches.Polymers.crafts, 8); // ceil(80/10)
  assert.equal(intermediateBatches.Polymers.produced, 80);
  assert.equal(intermediateBatches.Polymers.leftover, 0);
});

test("computeGlobalNeeds pools shared intermediate demand into one batch count", () => {
  // Gadget needs 3 Widget, Gizmo needs 2 Widget; a Widget batch makes 5.
  // Pooled demand is 5, so the reported Widget batch count is 1 (not 1+1=2).
  const recipes = {
    Gadget: { produces: 1, ingredients: { Widget: 3 } },
    Gizmo: { produces: 1, ingredients: { Widget: 2 } },
    Widget: { produces: 5, ingredients: { Scrap: 1 } },
  };
  const { leafTotals, intermediateBatches } = engine.computeGlobalNeeds(
    [
      { item: "Gadget", qty: 1 },
      { item: "Gizmo", qty: 1 },
    ],
    ctx(recipes),
  );
  assert.equal(intermediateBatches.Widget.crafts, 1); // pooled batch count

  // KNOWN LIMITATION (pins current behavior): the reported Widget batch count is
  // 1, but leaf demand below Widget is rounded per-branch during the descent
  // (ceil(3/5)=1 batch from Gadget + ceil(2/5)=1 from Gizmo), so Scrap comes out
  // as 2 rather than the 1 a single pooled batch would consume. The batch count
  // and the leaf total are therefore mutually inconsistent. Fixing this means
  // propagating fractional demand and batching once in topological order.
  assert.equal(leafTotals.Scrap, 2);
});

test("computeGlobalNeeds keeps queue items out of intermediateBatches", () => {
  const recipes = {
    Plate: { produces: 1, ingredients: { Iron: 2 } },
  };
  const { intermediateBatches, leafTotals } = engine.computeGlobalNeeds(
    [{ item: "Plate", qty: 3 }],
    ctx(recipes),
  );
  assert.ok(!("Plate" in intermediateBatches)); // it's a queue item, not an intermediate
  assert.equal(leafTotals.Iron, 6);
});

test("computeGlobalNeeds aggregates byproducts, buildings and total time", () => {
  const recipes = {
    Steel: {
      variants: [
        {
          name: "Default",
          produces: 2,
          ingredients: { Iron: 3 },
          byproducts: { Slag: 1 },
          building: "Furnace",
          buildingCost: { Brick: 10 },
          metadata: { craftingTime: 1.5 },
        },
      ],
    },
  };
  const { byproductTotals, buildings, totalTime } = engine.computeGlobalNeeds(
    [{ item: "Steel", qty: 3 }], // ceil(3/2) = 2 batches
    ctx(recipes),
  );
  assert.equal(byproductTotals.Slag, 2); // 1 * 2 batches
  assert.deepEqual(buildings, { Furnace: { Brick: 10 } });
  assert.equal(totalTime, 3); // 1.5 * 2
});

test("computeGlobalNeeds resolves category ingredients to the chosen material", () => {
  const recipes = { Circuit: { produces: 1, ingredients: { "Refined Metal": 4 } } };
  const c = ctx(recipes, {
    categories: { "Refined Metal": ["Copper", "Gold"] },
    materialPreferences: { "Refined Metal": "Gold" },
  });
  const { leafTotals } = engine.computeGlobalNeeds([{ item: "Circuit", qty: 2 }], c);
  assert.deepEqual(leafTotals, { Gold: 8 });
});

test("computeGlobalNeeds reports leftover when batches overproduce", () => {
  const recipes = {
    Ingot: { produces: 4, ingredients: { Ore: 1 } },
    Ring: { produces: 1, ingredients: { Ingot: 5 } },
  };
  const { intermediateBatches } = engine.computeGlobalNeeds(
    [{ item: "Ring", qty: 1 }], // needs 5 Ingot → ceil(5/4)=2 batches → 8 produced → 3 leftover
    ctx(recipes),
  );
  assert.equal(intermediateBatches.Ingot.crafts, 2);
  assert.equal(intermediateBatches.Ingot.produced, 8);
  assert.equal(intermediateBatches.Ingot.leftover, 3);
});
