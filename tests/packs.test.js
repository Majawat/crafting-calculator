// Validates the shipped recipe packs against schema v2 and confirms each one
// actually solves through the engine. Catches dangling references, cycles, and
// primary-output mistakes in pack data before they ship.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = require("../engine.js");

const RECIPES_DIR = path.join(__dirname, "..", "recipes");

function loadJson(file) {
  return JSON.parse(fs.readFileSync(path.join(RECIPES_DIR, file), "utf8"));
}

const manifest = loadJson("index.json");
const packs = Array.isArray(manifest) ? manifest : manifest.packs || [];

test("index.json lists at least one pack", () => {
  assert.ok(packs.length > 0);
});

for (const pack of packs) {
  test(`pack "${pack.id}" is valid schema v2 and solves`, () => {
    const data = loadJson(`${pack.id}.json`);

    assert.equal(data.schemaVersion, 2, "schemaVersion must be 2");
    assert.ok(data.gameInfo && data.gameInfo.name, "gameInfo.name required");
    assert.ok(data.recipes && typeof data.recipes === "object", "recipes required");

    const recipes = data.recipes;
    const categories = data.categories || {};
    const items = data.items || {};

    // Every name that legitimately exists in this pack.
    const known = new Set([
      ...Object.keys(recipes),
      ...Object.keys(items),
      ...Object.keys(categories),
    ]);
    for (const recipe of Object.values(recipes)) {
      for (const v of engine.normalizeRecipe(recipe).variants) {
        Object.keys(v.inputs || {}).forEach((i) => known.add(i));
        Object.keys(v.outputs || {}).forEach((o) => known.add(o));
      }
    }

    // Per-recipe structural checks.
    for (const [name, recipe] of Object.entries(recipes)) {
      for (const v of engine.normalizeRecipe(recipe).variants) {
        assert.ok(
          v.outputs && Object.prototype.hasOwnProperty.call(v.outputs, name),
          `recipe "${name}" variant "${v.name}" must list itself in outputs (primary output)`,
        );
        // Any input that names a category must reference a defined category.
        for (const input of Object.keys(v.inputs || {})) {
          if (categories[input]) {
            assert.ok(
              Array.isArray(categories[input]) && categories[input].length > 0,
              `category "${input}" used by "${name}" must have members`,
            );
          }
        }
      }
    }

    // Category members must be real items in this pack (not typos/danglers).
    for (const [cat, members] of Object.entries(categories)) {
      for (const member of members) {
        assert.ok(
          known.has(member),
          `category "${cat}" member "${member}" is not a known item in this pack`,
        );
      }
    }

    // No circular dependencies.
    for (const name of Object.keys(recipes)) {
      assert.equal(
        engine.hasCircularDependency(name, recipes),
        false,
        `recipe "${name}" is part of a cycle`,
      );
    }

    // Every recipe solves for qty 1 without throwing.
    const ctx = {
      allRecipes: recipes,
      categories,
      materialChoice: {},
      materialPreferences: {},
      variantPreferences: {},
      onHand: {},
      mode: "batch",
      byproductsAsSupply: false,
    };
    for (const name of Object.keys(recipes)) {
      assert.doesNotThrow(
        () => engine.solve([{ item: name, qty: 1 }], ctx),
        `solving "${name}" threw`,
      );
    }
  });
}
