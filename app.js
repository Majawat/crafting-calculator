// ======= Recipes Storage =======
const recipes = {};
const gameRecipes = {};
let currentGame = null;

// ======= Load recipes from LocalStorage on page load =======
window.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("recipes");
  if (saved) {
    Object.assign(recipes, JSON.parse(saved));
  }
  updateCraftDropdown();
  updateIngredientDatalist();
  updateStoredRecipesList();
  addIngredientField(); // start with one ingredient input
});

// ======= Add Ingredient Field =======
function addIngredientField() {
  const container = document.getElementById("ingredients");
  const div = document.createElement("div");
  div.classList.add("ingredient");
  div.innerHTML = `
    <input list="ingredientList" placeholder="Ingredient name" class="ingredient-name">
    <input type="number" placeholder="Amount" min="1" value="1">
    <button type="button" class="delete-btn" onclick="removeIngredientField(this)">x</button>
  `;
  container.appendChild(div);
  updateIngredientDatalist();
}

// Remove ingredient field button
function removeIngredientField(button) {
  button.parentElement.remove();
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

  for (let ingredient in recipe.ingredients) {
    if (hasCircularDependency(ingredient, recipeSet, visited)) {
      return true;
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
    const inputs = div.querySelectorAll("input");
    const ingName = inputs[0].value.trim();
    const ingAmt = parseInt(inputs[1].value, 10);
    if (ingName && ingAmt > 0) {
      ingredients[ingName] = ingAmt;
    }
  });

  if (!name) return alert("Item name required");
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

// ======= Update Ingredient Datalist =======
function updateIngredientDatalist() {
  const datalist = document.getElementById("ingredientList");
  if (!datalist) return;
  datalist.innerHTML = ""; // clear existing options

  const ingredientsSet = new Set();
  const allRecipes = getAllRecipes();
  for (let recipeName in allRecipes) {
    const recipe = allRecipes[recipeName];
    for (let ing in recipe.ingredients) {
      ingredientsSet.add(ing);
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
      const ingredients = Object.entries(recipe.ingredients)
        .map(([ing, amt]) => `${amt} x ${ing}`)
        .join(", ");

      html += `
        <div class="recipe-item game-recipe">
          <div class="recipe-info">
            <strong>${name}</strong> (produces ${recipe.produces})
            <br><small>Requires: ${ingredients}</small>
          </div>
          <span class="recipe-source">Game</span>
        </div>
      `;
    }
  }

  // Show custom recipes
  if (customCount > 0) {
    html += `<h4>Custom Recipes (${customCount})</h4>`;
    for (let name in recipes) {
      const recipe = recipes[name];
      const ingredients = Object.entries(recipe.ingredients)
        .map(([ing, amt]) => `${amt} x ${ing}`)
        .join(", ");

      const displayName = gameRecipes[name] ? `${name} (Custom)` : name;
      const hasConflict = gameRecipes[name];

      html += `
        <div class="recipe-item custom-recipe ${hasConflict ? "conflict-recipe" : ""}">
          <div class="recipe-info">
            <strong>${displayName}</strong> (produces ${recipe.produces})
            <br><small>Requires: ${ingredients}</small>
          </div>
          <button type="button" class="delete-btn" onclick="deleteRecipe('${name}')">Delete</button>
        </div>
      `;
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

    // Load game recipes (convert metadata-format to calculator-format)
    for (let [name, recipe] of Object.entries(gameData.recipes)) {
      gameRecipes[name] = {
        produces: recipe.produces,
        ingredients: recipe.ingredients,
        metadata: recipe.metadata || {},
        isGameRecipe: true,
      };
    }

    currentGame = selectedGame;
    statusDiv.innerHTML = `<small>Loaded ${Object.keys(gameRecipes).length} recipes from ${
      gameData.gameInfo.name
    }</small>`;
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
  let html =
    "<h3>Totals:</h3><ul>" +
    Object.entries(flatTotals)
      .map(([k, v]) => `<li>${v} x ${k}</li>`)
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
    return { name: item, qty: qty, children: [], craftingTime: 0 };
  }

  const recipe = allRecipes[item];
  const { produces, ingredients } = recipe;
  const crafts = Math.ceil(qty / produces);
  const actualQty = crafts * produces;

  // Get crafting time from metadata (defaults to 0 if not specified)
  const baseTime = recipe.metadata?.craftingTime || 0;
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

  return { name: item, qty: actualQty, children, craftingTime: totalCraftingTime };
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
  let html = `<li>${node.qty} x ${node.name}`;
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
