// ======= Recipes Storage =======
const recipes = {};
const gameRecipes = {};
let currentGame = null;
let ingredientCount = 0;
const variantPreferences = {}; // Stores selected variant index per recipe: { "RecipeName": 0 }

// ======= Load recipes from LocalStorage on page load =======
window.addEventListener("DOMContentLoaded", () => {
  const savedRecipes = localStorage.getItem("recipes");
  if (savedRecipes) {
    Object.assign(recipes, JSON.parse(savedRecipes));
  }
  const savedGame = localStorage.getItem("currentGame");
  if (savedGame) {
    currentGame = savedGame;
    document.getElementById("gameSelect").value = currentGame;
    loadGameRecipes();
  }
  const savedPreferences = localStorage.getItem("variantPreferences");
  if (savedPreferences) {
    Object.assign(variantPreferences, JSON.parse(savedPreferences));
  }

  updateCraftDropdown();
  updateIngredientDatalist();
  updateStoredRecipesList();
  addIngredientField(); // start with one ingredient input
});

function addIngredientField() {
  const container = document.getElementById("ingredients");
  const div = document.createElement("div");
  div.classList.add("ingredient");

  // Build the inner HTML, conditionally adding delete button
  div.innerHTML = `
    <input 
      type="number" 
      placeholder="Amount" 
      min="1" 
      value="1" 
      class="ingredient-amount"
      name="ingredientAmount_${ingredientCount}" 
      id="ingredientAmount_${ingredientCount}"
    >
    <input 
      list="ingredientList" 
      placeholder="Ingredient name" 
      class="ingredient-name" 
      name="ingredientName_${ingredientCount}" 
      id="ingredientName_${ingredientCount}"
    >
    ${
      container.children.length > 0
        ? `<button type="button" class="delete-btn" onclick="removeIngredientField(this)">x</button>`
        : ""
    }
  `;

  ingredientCount++; // increment each time we add one
  container.appendChild(div);
  updateIngredientDatalist();
}

// Remove ingredient field button
function removeIngredientField(button) {
  button.parentElement.remove();
}

// ======= Recipe Variants Helpers =======
// Normalize a recipe to always have variants array
function normalizeRecipe(recipe) {
  if (recipe.variants) {
    return recipe; // Already in variants format
  }
  // Convert old format to variants format
  return {
    variants: [
      {
        name: "Default",
        produces: recipe.produces,
        ingredients: recipe.ingredients,
        metadata: recipe.metadata || {},
      },
    ],
  };
}

// Get the selected variant for a recipe
function getSelectedVariant(recipeName, recipe) {
  const normalized = normalizeRecipe(recipe);
  const preferredIndex = variantPreferences[recipeName] || 0;
  // Ensure index is valid
  const index = Math.min(preferredIndex, normalized.variants.length - 1);
  return normalized.variants[index];
}

// Set the selected variant for a recipe
function setVariantPreference(recipeName, variantIndex) {
  variantPreferences[recipeName] = variantIndex;
  localStorage.setItem("variantPreferences", JSON.stringify(variantPreferences));
}

// ======= Circular Dependency Detection =======
function hasCircularDependency(itemName, recipeSet, visited = new Set()) {
  if (visited.has(itemName)) {
    return true; // Found a cycle
  }

  const recipe = recipeSet[itemName];
  if (!recipe) {
    return false; // Base ingredient, no cycle
  }

  visited.add(itemName);

  // Check all variants for circular dependencies
  const normalized = normalizeRecipe(recipe);
  for (let variant of normalized.variants) {
    for (let ingredient in variant.ingredients) {
      if (hasCircularDependency(ingredient, recipeSet, visited)) {
        return true;
      }
    }
  }

  visited.delete(itemName);
  return false;
}

// ======= Add Recipe =======
function addRecipe() {
  const name = document.getElementById("itemName").value.trim();
  const produces = parseInt(document.getElementById("produces").value, 10);
  const ingredientDivs = document.querySelectorAll("#ingredients .ingredient");
  const ingredients = {};

  ingredientDivs.forEach((div) => {
    const ingName = div.querySelector(".ingredient-name").value.trim();
    const ingAmt = parseInt(div.querySelector(".ingredient-amount").value, 10);
    if (ingName && ingAmt > 0) {
      ingredients[ingName] = ingAmt;
    }
  });

  if (!name) {
    document.getElementById("itemName").focus();
    return alert("Item name required");
  }
  if (Object.keys(ingredients).length === 0) return alert("At least one ingredient required");

  // Check for circular dependencies before saving
  const tempRecipes = { ...getAllRecipes(), [name]: { produces, ingredients } };
  if (hasCircularDependency(name, tempRecipes)) {
    return alert(`Cannot save recipe: "${name}" would create a circular dependency`);
  }

  recipes[name] = { produces, ingredients };
  localStorage.setItem("recipes", JSON.stringify(recipes));
  console.log(`Recipe for ${name} saved!`, produces, ingredients);

  updateCraftDropdown();
  updateIngredientDatalist();
  updateStoredRecipesList();

  // Reset form
  document.getElementById("itemName").value = "";
  document.getElementById("produces").value = 1;
  document.getElementById("ingredients").innerHTML = "<h3>Ingredients</h3>";
  addIngredientField();
}

// ======= Update Craft Dropdown =======
function updateCraftDropdown() {
  const select = document.getElementById("craftItem");
  if (!select) return;
  select.innerHTML = '<option value="" disabled selected>Select an item</option>';

  const allRecipes = getAllRecipes();
  for (let name in allRecipes) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  }
}

// ======= Update Variant Selector =======
function updateVariantSelector() {
  const itemSelect = document.getElementById("craftItem");
  const variantContainer = document.getElementById("variantSelector");
  const variantSelect = document.getElementById("variantSelect");

  if (!itemSelect || !variantContainer || !variantSelect) return;

  const selectedItem = itemSelect.value;
  if (!selectedItem) {
    variantContainer.style.display = "none";
    return;
  }

  const allRecipes = getAllRecipes();
  const recipe = allRecipes[selectedItem];
  if (!recipe) {
    variantContainer.style.display = "none";
    return;
  }

  const normalized = normalizeRecipe(recipe);

  // Only show variant selector if there are multiple variants
  if (normalized.variants.length <= 1) {
    variantContainer.style.display = "none";
    return;
  }

  // Populate variant options
  variantSelect.innerHTML = "";
  const preferredIndex = variantPreferences[selectedItem] || 0;

  normalized.variants.forEach((variant, idx) => {
    const option = document.createElement("option");
    option.value = idx;
    option.textContent = `${variant.name} (${variant.produces}x from ${Object.entries(variant.ingredients)
      .map(([ing, amt]) => `${amt} ${ing}`)
      .join(", ")})`;
    if (idx === preferredIndex) {
      option.selected = true;
    }
    variantSelect.appendChild(option);
  });

  variantContainer.style.display = "block";
}

// ======= Save Variant Selection =======
function saveVariantSelection() {
  const itemSelect = document.getElementById("craftItem");
  const variantSelect = document.getElementById("variantSelect");

  if (!itemSelect || !variantSelect) return;

  const selectedItem = itemSelect.value;
  const selectedVariantIdx = parseInt(variantSelect.value, 10);

  if (selectedItem && !isNaN(selectedVariantIdx)) {
    setVariantPreference(selectedItem, selectedVariantIdx);
  }
}

// ======= Update Ingredient Datalist =======
function updateIngredientDatalist() {
  const datalist = document.getElementById("ingredientList");
  if (!datalist) return;
  datalist.innerHTML = ""; // clear existing options

  const ingredientsSet = new Set();
  const allRecipes = getAllRecipes();
  for (let recipeName in allRecipes) {
    const recipe = allRecipes[recipeName];
    const normalized = normalizeRecipe(recipe);

    // Add ingredients from all variants
    for (let variant of normalized.variants) {
      for (let ing in variant.ingredients) {
        ingredientsSet.add(ing);
      }
    }
  }

  ingredientsSet.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    datalist.appendChild(option);
  });
}

// ======= Update Stored Recipes List =======
function updateStoredRecipesList() {
  const container = document.getElementById("storedRecipes");
  if (!container) return;

  const allRecipes = getAllRecipes();
  const customCount = Object.keys(recipes).length;
  const gameCount = Object.keys(gameRecipes).length;

  if (Object.keys(allRecipes).length === 0) {
    container.innerHTML = "<p>No recipes available.</p>";
    return;
  }

  let html = "<div class='recipes-list'>";

  // Show game recipes first (if any)
  if (gameCount > 0) {
    html += `<h4>Game Recipes (${gameCount})</h4>`;
    for (let name in gameRecipes) {
      const recipe = gameRecipes[name];
      const normalized = normalizeRecipe(recipe);

      // Show all variants
      normalized.variants.forEach((variant, idx) => {
        const ingredients = Object.entries(variant.ingredients)
          .map(([ing, amt]) => `${amt} x ${ing}`)
          .join(", ");

        const variantLabel =
          normalized.variants.length > 1 ? `${name} [${variant.name}]` : name;

        html += `
          <div class="recipe-item game-recipe">
            <div class="recipe-info">
              <strong>${variantLabel}</strong> (produces ${variant.produces})
              <br><small>Requires: ${ingredients}</small>
            </div>
            <span class="recipe-source">Game</span>
          </div>
        `;
      });
    }
  }

  // Show custom recipes
  if (customCount > 0) {
    html += `<h4>Custom Recipes (${customCount})</h4>`;
    for (let name in recipes) {
      const recipe = recipes[name];
      const normalized = normalizeRecipe(recipe);

      const displayName = gameRecipes[name] ? `${name} (Custom)` : name;
      const hasConflict = gameRecipes[name];

      // Show all variants
      normalized.variants.forEach((variant, idx) => {
        const ingredients = Object.entries(variant.ingredients)
          .map(([ing, amt]) => `${amt} x ${ing}`)
          .join(", ");

        const variantLabel =
          normalized.variants.length > 1
            ? `${displayName} [${variant.name}]`
            : displayName;

        html += `
          <div class="recipe-item custom-recipe ${hasConflict ? "conflict-recipe" : ""}">
            <div class="recipe-info">
              <strong>${variantLabel}</strong> (produces ${variant.produces}) <br /><small
                >Requires: ${ingredients}</small
              >
            </div>
            <button type="button" class="delete-btn" onclick="deleteRecipe('${name}')">Delete</button>
          </div>
        `;
      });
    }
  }

  html += "</div>";
  container.innerHTML = html;
}

// ======= Delete Recipe =======
function deleteRecipe(recipeName) {
  if (!confirm(`Are you sure you want to delete the recipe for "${recipeName}"?`)) {
    return;
  }

  delete recipes[recipeName];
  localStorage.setItem("recipes", JSON.stringify(recipes));

  updateCraftDropdown();
  updateIngredientDatalist();
  updateStoredRecipesList();

  console.log(`Recipe for "${recipeName}" deleted.`);
}

// ======= Load Game Recipes =======
async function loadGameRecipes() {
  const gameSelect = document.getElementById("gameSelect");
  const statusDiv = document.getElementById("gameStatus");
  const selectedGame = gameSelect.value;

  if (!selectedGame) {
    // Clear game recipes and use only custom recipes
    Object.keys(gameRecipes).forEach((key) => delete gameRecipes[key]);
    localStorage.removeItem("currentGame");
    currentGame = null;
    statusDiv.innerHTML = "<small>Custom recipes only</small>";
    updateAllUI();
    return;
  }

  try {
    statusDiv.innerHTML = "<small>Loading...</small>";
    const response = await fetch(`recipes/${selectedGame}.json`);

    if (!response.ok) {
      throw new Error(`Failed to load: ${response.status}`);
    }

    const gameData = await response.json();

    // Clear existing game recipes and load new ones
    Object.keys(gameRecipes).forEach((key) => delete gameRecipes[key]);

    // Load game recipes (preserve variant structure or convert single recipes)
    for (let [name, recipe] of Object.entries(gameData.recipes)) {
      if (recipe.variants) {
        // Recipe has variants - preserve the structure
        gameRecipes[name] = {
          variants: recipe.variants,
          isGameRecipe: true,
        };
      } else {
        // Single recipe - store as-is
        gameRecipes[name] = {
          produces: recipe.produces,
          ingredients: recipe.ingredients,
          metadata: recipe.metadata || {},
          isGameRecipe: true,
        };
      }
    }

    currentGame = selectedGame;
    statusDiv.innerHTML = `<small>Loaded ${Object.keys(gameRecipes).length} recipes from ${
      gameData.gameInfo.name
    }</small>`;
    localStorage.setItem("currentGame", currentGame);

    updateAllUI();
  } catch (error) {
    statusDiv.innerHTML = `<small style="color: red;">Error loading recipes: ${error.message}</small>`;
    console.error("Failed to load game recipes:", error);
  }
}

// ======= Update All UI Elements =======
function updateAllUI() {
  updateCraftDropdown();
  updateIngredientDatalist();
  updateStoredRecipesList();
}

// ======= Get All Recipes (Combined) =======
function getAllRecipes() {
  const combined = {};

  // Add game recipes first
  for (let [name, recipe] of Object.entries(gameRecipes)) {
    combined[name] = recipe;
  }

  // Add custom recipes, handling conflicts with suffix
  for (let [name, recipe] of Object.entries(recipes)) {
    if (gameRecipes[name]) {
      // Conflict: add custom version with suffix
      combined[`${name} (Custom)`] = recipe;
    } else {
      // No conflict: add as-is
      combined[name] = recipe;
    }
  }

  return combined;
}

// ======= Calculate =======
function calculate() {
  const itemSelect = document.getElementById("craftItem");
  const item = itemSelect.value.trim();
  const qty = parseInt(document.getElementById("craftQty").value, 10);
  if (!item || qty < 1) return;

  const tree = expand(item, qty);
  const flatTotals = flatten(tree);
  const totalTime = calculateTotalTime(tree);

  const resultsDiv = document.getElementById("results");

  // Show batch info for the main item
  let html = "";
  if (tree.crafts > 0) {
    const excess = tree.qty - tree.requestedQty;
    html += `<div class="batch-info">
      <h3>${item}</h3>
      <p><strong>Requested:</strong> ${tree.requestedQty}</p>
      <p><strong>Will produce:</strong> ${tree.qty} (${tree.crafts} × ${tree.produces})`;
    if (excess > 0) {
      html += ` <span class="excess">+${excess} extra</span>`;
    }
    html += `</p></div>`;
  }

  html +=
    "<h3>Materials Needed:</h3><ul>" +
    Object.entries(flatTotals)
      .map(([k, v]) => `<li>${v} × ${k}</li>`)
      .join("") +
    "</ul>";

  // Add total time if any recipes have time data
  if (totalTime > 0) {
    html += `<p><strong>Crafting Time:</strong> ${formatTime(totalTime)}</p>`;
  }

  html += "<h3>Breakdown:</h3><ul>" + renderTree(tree) + "</ul>";
  resultsDiv.innerHTML = html;
}

// ======= Expand Recipes Recursively =======
function expand(item, qty) {
  const allRecipes = getAllRecipes();
  if (!allRecipes[item]) {
    return {
      name: item,
      qty: qty,
      requestedQty: qty,
      crafts: 0,
      produces: 1,
      children: [],
      craftingTime: 0,
      variantName: null,
    };
  }

  const recipe = allRecipes[item];
  const variant = getSelectedVariant(item, recipe);
  const { produces, ingredients, metadata } = variant;
  const crafts = Math.ceil(qty / produces);
  const actualQty = crafts * produces;

  // Get crafting time from metadata (defaults to 0 if not specified)
  const baseTime = metadata?.craftingTime || 0;
  const totalCraftingTime = baseTime * crafts;

  const children = [];
  for (let ing in ingredients) {
    const need = ingredients[ing] * crafts;
    // When expanding ingredients, check if we need to use the prefixed version
    let ingredientName = ing;
    if (gameRecipes[ing] && recipes[ing]) {
      // Both versions exist - prefer the game version for sub-recipes
      // (user explicitly chose the custom version only if they selected it from dropdown)
      ingredientName = ing; // Use game version
    }
    children.push(expand(ingredientName, need));
  }

  return {
    name: item,
    qty: actualQty,
    requestedQty: qty,
    crafts: crafts,
    produces: produces,
    children,
    craftingTime: totalCraftingTime,
    variantName: variant.name,
  };
}

// ======= Flatten Tree to Totals =======
function flatten(node, totals = {}) {
  if (node.children.length === 0) {
    totals[node.name] = (totals[node.name] || 0) + node.qty;
  } else {
    node.children.forEach((child) => flatten(child, totals));
  }
  return totals;
}

// ======= Calculate Total Time =======
function calculateTotalTime(node) {
  let totalTime = node.craftingTime || 0;

  // Add time from children (this assumes sequential crafting)
  for (let child of node.children) {
    totalTime += calculateTotalTime(child);
  }

  return totalTime;
}

// ======= Format Time Display =======
function formatTime(hours) {
  if (hours === 0) return "instant";

  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);

  if (wholeHours === 0) {
    return `${minutes} min`;
  } else if (minutes === 0) {
    return `${wholeHours}h`;
  } else {
    return `${wholeHours}h ${minutes}m`;
  }
}

// ======= Render Tree View =======
function renderTree(node) {
  let html = `<li>${node.qty} × ${node.name}`;

  // Show variant name if not default
  if (node.variantName && node.variantName !== "Default") {
    html += ` <span class="variant-info">[${node.variantName}]</span>`;
  }

  // Show batch info for crafted items
  if (node.crafts > 0) {
    const excess = node.qty - node.requestedQty;
    html += ` <span class="craft-info">(${node.crafts} × ${node.produces}`;
    if (excess > 0) {
      html += `, +${excess} extra`;
    }
    html += `)</span>`;
  }

  if (node.children.length > 0) {
    html += "<ul>";
    node.children.forEach((child) => {
      html += renderTree(child);
    });
    html += "</ul>";
  }
  html += "</li>";
  return html;
}
