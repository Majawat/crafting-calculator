// Unit tests for the pure crafting engine. Run with: node --test
// No external dependencies — uses Node's built-in test runner and assert.
// Recipes use schema v2: inputs / outputs (all outputs, primary = the key) /
// machine / time / yield.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../engine.js");

// Helper: build a context from a plain recipe map plus optional extras.
function ctx(allRecipes, extra = {}) {
  return {
    allRecipes,
    categories: extra.categories || {},
    materialChoice: extra.materialChoice || {},
    materialPreferences: extra.materialPreferences || {},
    variantPreferences: extra.variantPreferences || {},
    onHand: extra.onHand || {},
    mode: extra.mode || "batch",
    byproductsAsSupply: extra.byproductsAsSupply || false,
  };
}

test("normalizeRecipe wraps a flat recipe into a variants array", () => {
  const n = engine.normalizeRecipe({ outputs: { Plate: 2 }, inputs: { Iron: 3 } });
  assert.equal(n.variants.length, 1);
  assert.equal(n.variants[0].name, "Default");
  assert.deepEqual(n.variants[0].outputs, { Plate: 2 });
  assert.deepEqual(n.variants[0].inputs, { Iron: 3 });
  assert.equal(n.variants[0].yield, 1);
});

test("normalizeRecipe leaves an existing variants recipe untouched", () => {
  const recipe = { variants: [{ name: "A", outputs: { A: 1 }, inputs: {} }] };
  assert.equal(engine.normalizeRecipe(recipe), recipe);
});

test("getSelectedVariant honors the preference and clamps out-of-range indices", () => {
  const recipe = {
    variants: [
      { name: "Slow", outputs: { X: 1 }, inputs: { A: 1 } },
      { name: "Fast", outputs: { X: 3 }, inputs: { A: 2 } },
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
    A: { outputs: { A: 1 }, inputs: { B: 1 } },
    B: { outputs: { B: 1 }, inputs: { A: 1 } },
  };
  assert.equal(engine.hasCircularDependency("A", cyclic), true);

  const acyclic = {
    Widget: { outputs: { Widget: 1 }, inputs: { Plate: 2 } },
    Plate: { outputs: { Plate: 1 }, inputs: { Iron: 3 } },
  };
  assert.equal(engine.hasCircularDependency("Widget", acyclic), false);
});

test("expand rounds up to whole batches and scales inputs", () => {
  const recipes = { Bolt: { outputs: { Bolt: 4 }, inputs: { Iron: 1 } } };
  const tree = engine.expand("Bolt", 5, ctx(recipes));
  assert.equal(tree.crafts, 2); // ceil(5/4)
  assert.equal(tree.qty, 8); // 2 * 4
  assert.equal(tree.requestedQty, 5);
  assert.equal(tree.children[0].name, "Iron");
  assert.equal(tree.children[0].qty, 2); // 1 per batch * 2 batches
});

test("expand scales co-products and crafting time per batch", () => {
  const recipes = {
    Charcoal: {
      outputs: { Charcoal: 2, Ash: 1 },
      inputs: { Wood: 5 },
      time: 0.5,
    },
  };
  const tree = engine.expand("Charcoal", 3, ctx(recipes)); // ceil(3/2)=2 batches
  assert.deepEqual(tree.byproducts, { Ash: 2 });
  assert.equal(tree.craftingTime, 1); // 0.5 * 2
});

test("expand resolves a category input to the selected material", () => {
  const recipes = { Wire: { outputs: { Wire: 1 }, inputs: { "Refined Metal": 2 } } };
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
    "Bridge Anchor": { outputs: { "Bridge Anchor": 1 }, inputs: { Metals: 20, Polymers: 20 } },
    Polymers: { outputs: { Polymers: 10 }, inputs: { Organics: 20, Minerals: 20 } },
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

test("computeGlobalNeeds pools shared intermediate demand before rounding", () => {
  // Gadget needs 3 Widget, Gizmo needs 2 Widget; a Widget batch makes 5.
  // Pooled demand is 5 → exactly ONE Widget batch → 1 Scrap (not 2).
  const recipes = {
    Gadget: { outputs: { Gadget: 1 }, inputs: { Widget: 3 } },
    Gizmo: { outputs: { Gizmo: 1 }, inputs: { Widget: 2 } },
    Widget: { outputs: { Widget: 5 }, inputs: { Scrap: 1 } },
  };
  const { leafTotals, intermediateBatches } = engine.computeGlobalNeeds(
    [
      { item: "Gadget", qty: 1 },
      { item: "Gizmo", qty: 1 },
    ],
    ctx(recipes),
  );
  assert.equal(intermediateBatches.Widget.crafts, 1);
  assert.equal(leafTotals.Scrap, 1);
});

test("onHand inventory offsets demand at leaves and intermediates", () => {
  const recipes = {
    Ring: { outputs: { Ring: 1 }, inputs: { Ingot: 5 } },
    Ingot: { outputs: { Ingot: 1 }, inputs: { Ore: 2 } },
  };
  const { leafTotals, intermediateBatches } = engine.solve(
    [{ item: "Ring", qty: 1 }],
    ctx(recipes, { onHand: { Ingot: 2, Ore: 3 } }),
  );
  assert.equal(intermediateBatches.Ingot.crafts, 3);
  assert.equal(leafTotals.Ore, 3);
});

test("onHand larger than demand yields zero need and reports surplus", () => {
  const recipes = { Plate: { outputs: { Plate: 1 }, inputs: { Iron: 2 } } };
  const { leafTotals, surplus } = engine.solve(
    [{ item: "Plate", qty: 1 }],
    ctx(recipes, { onHand: { Iron: 10 } }),
  );
  assert.ok(!("Iron" in leafTotals)); // nothing to buy
  assert.equal(surplus.Iron, 8); // 10 on hand − 2 consumed
});

test("yield scales effective output (efficiency / expected value)", () => {
  const recipes = {
    Ore: { variants: [{ name: "Default", outputs: { Ore: 1 }, inputs: { Rock: 1 }, yield: 2 }] },
  };
  // Each run yields 2 (e.g. a +100% bonus), so 10 demand → 5 runs → 5 Rock.
  const { leafTotals, batches } = engine.solve([{ item: "Ore", qty: 10 }], ctx(recipes));
  assert.equal(batches.Ore.crafts, 5);
  assert.equal(leafTotals.Rock, 5);
});

test("byproductsAsSupply offsets demand for a co-product", () => {
  // Refining oil yields Petroleum + Gas; Fuel needs Gas. The Gas co-product
  // offsets Fuel's Gas demand when supply mode is on.
  const recipes = {
    Petroleum: { outputs: { Petroleum: 1, Gas: 2 }, inputs: { Oil: 1 } },
    Fuel: { outputs: { Fuel: 1 }, inputs: { Gas: 2 } },
  };
  const withSupply = engine.solve(
    [
      { item: "Petroleum", qty: 1 },
      { item: "Fuel", qty: 1 },
    ],
    ctx(recipes, { byproductsAsSupply: true }),
  );
  assert.ok(!("Gas" in withSupply.leafTotals)); // covered by byproduct
  const without = engine.solve(
    [
      { item: "Petroleum", qty: 1 },
      { item: "Fuel", qty: 1 },
    ],
    ctx(recipes, { byproductsAsSupply: false }),
  );
  assert.equal(without.leafTotals.Gas, 2); // must buy Gas when supply is ignored
});

test("byproducts are not double-reported as surplus when supply is off", () => {
  const recipes = {
    Steel: { outputs: { Steel: 2, Slag: 1 }, inputs: { Iron: 3 } },
  };
  const { byproductTotals, surplus } = engine.solve(
    [{ item: "Steel", qty: 4 }], // 2 batches → 2 Slag
    ctx(recipes, { byproductsAsSupply: false }),
  );
  assert.equal(byproductTotals.Slag, 2); // shown in the byproducts section
  assert.ok(!("Slag" in surplus)); // but NOT counted again as surplus
});

test("computeGlobalNeeds aggregates co-products, machines and total time", () => {
  const recipes = {
    Steel: {
      outputs: { Steel: 2, Slag: 1 },
      inputs: { Iron: 3 },
      machine: "Furnace",
      time: 1.5,
    },
  };
  const { byproductTotals, buildings, totalTime } = engine.solve(
    [{ item: "Steel", qty: 3 }], // ceil(3/2) = 2 batches
    ctx(recipes),
  );
  assert.equal(byproductTotals.Slag, 2); // 1 * 2 batches
  assert.ok("Furnace" in buildings); // machine reported
  assert.equal(totalTime, 3); // 1.5 * 2
});

test("resolveMaterial keys material choice per consuming recipe", () => {
  const c = ctx(
    {
      Frame: { outputs: { Frame: 1 }, inputs: { Metal: 1 } },
      Plate: { outputs: { Plate: 1 }, inputs: { Metal: 1 } },
    },
    {
      categories: { Metal: ["Copper", "Iron", "Gold"] },
      materialPreferences: { Metal: "Copper" }, // global fallback
      materialChoice: { "Frame|Metal": "Gold" }, // per-recipe override
    },
  );
  assert.equal(engine.resolveMaterial("Frame", "Metal", c), "Gold"); // keyed override
  assert.equal(engine.resolveMaterial("Plate", "Metal", c), "Copper"); // falls back to global
  assert.equal(engine.resolveMaterial("Frame", "NotACategory", c), "NotACategory");
});

test("per-recipe material choice routes demand to different concrete materials", () => {
  const recipes = {
    Frame: { outputs: { Frame: 1 }, inputs: { Metal: 4 } },
    Plate: { outputs: { Plate: 1 }, inputs: { Metal: 3 } },
  };
  const { leafTotals } = engine.solve(
    [
      { item: "Frame", qty: 1 },
      { item: "Plate", qty: 1 },
    ],
    ctx(recipes, {
      categories: { Metal: ["Copper", "Iron"] },
      materialChoice: { "Frame|Metal": "Gold", "Plate|Metal": "Iron" },
    }),
  );
  assert.equal(leafTotals.Gold, 4); // Frame's metal
  assert.equal(leafTotals.Iron, 3); // Plate's metal — pooled independently
});

test("computeGlobalNeeds keeps queue items out of intermediateBatches", () => {
  const recipes = { Plate: { outputs: { Plate: 1 }, inputs: { Iron: 2 } } };
  const { intermediateBatches, leafTotals } = engine.solve(
    [{ item: "Plate", qty: 3 }],
    ctx(recipes),
  );
  assert.ok(!("Plate" in intermediateBatches));
  assert.equal(leafTotals.Iron, 6);
});

test("computeGlobalNeeds reports leftover when batches overproduce", () => {
  const recipes = {
    Ingot: { outputs: { Ingot: 4 }, inputs: { Ore: 1 } },
    Ring: { outputs: { Ring: 1 }, inputs: { Ingot: 5 } },
  };
  const { intermediateBatches } = engine.solve(
    [{ item: "Ring", qty: 1 }], // needs 5 Ingot → ceil(5/4)=2 batches → 8 → 3 leftover
    ctx(recipes),
  );
  assert.equal(intermediateBatches.Ingot.crafts, 2);
  assert.equal(intermediateBatches.Ingot.produced, 8);
  assert.equal(intermediateBatches.Ingot.leftover, 3);
});

test("topoOrder throws on a cyclic graph", () => {
  const recipes = {
    A: { outputs: { A: 1 }, inputs: { B: 1 } },
    B: { outputs: { B: 1 }, inputs: { A: 1 } },
  };
  const c = ctx(recipes);
  const concrete = engine.buildConcreteRecipes([{ item: "A", qty: 1 }], c);
  assert.throws(() => engine.topoOrder(concrete), /cycle/i);
});
