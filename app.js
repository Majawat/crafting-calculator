// ======= Recipes Storage =======
const recipes = {};
const gameRecipes = {};
let currentGame = null;
let ingredientCount = 0;
let byproductCount = 0;
let buildingCostCount = 0;
let categoryMemberCount = 0;
const variantPreferences = {}; // Stores selected variant index per recipe: { "RecipeName": 0 }
const categories = {}; // { categoryName: string[] }
const materialPreferences = {}; // { categoryName: specificMaterial }
let queue = []; // { item: string, qty: number }[]

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
  const savedQueue = localStorage.getItem("queue");
  if (savedQueue) {
    queue = JSON.parse(savedQueue);
  }
  const savedCategories = localStorage.getItem("categories");
  if (savedCategories) {
    Object.assign(categories, JSON.parse(savedCategories));
  }
  const savedMaterialPrefs = localStorage.getItem("materialPreferences");
  if (savedMaterialPrefs) {
    Object.assign(materialPreferences, JSON.parse(savedMaterialPrefs));
  }

  updateCraftDropdown();
  updateIngredientDatalist();
  updateStoredRecipesList();
  updateStoredCategoriesList();
  renderQueue();
  addIngredientField(); // start with one ingredient input
  addCategoryMemberField(); // start with one category member input
});

function switchTab(tabId) {
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
  const idx = tabId === "calculateTab" ? 0 : 1;
  document.querySelectorAll(".tab-btn")[idx].classList.add("active");
}

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

function addByproductField() {
  const container = document.getElementById("byproducts");
  const div = document.createElement("div");
  div.classList.add("byproduct");

  div.innerHTML = `
    <input
      type="number"
      placeholder="Amount"
      min="1"
      value="1"
      class="byproduct-amount"
      name="byproductAmount_${byproductCount}"
      id="byproductAmount_${byproductCount}"
    >
    <input
      list="ingredientList"
      placeholder="Byproduct name"
      class="byproduct-name"
      name="byproductName_${byproductCount}"
      id="byproductName_${byproductCount}"
    >
    <button type="button" class="delete-btn" onclick="removeByproductField(this)">x</button>
  `;

  byproductCount++;
  container.appendChild(div);
}

function removeByproductField(button) {
  button.parentElement.remove();
}

function addBuildingCostField() {
  const container = document.getElementById("buildingCost");
  if (!container) return;
  const div = document.createElement("div");
  div.classList.add("building-cost-row");

  div.innerHTML = `
    <input
      type="number"
      placeholder="Amount"
      min="0"
      step="any"
      value="1"
      class="building-cost-amount"
      name="buildingCostAmount_${buildingCostCount}"
      id="buildingCostAmount_${buildingCostCount}"
    >
    <input
      list="ingredientList"
      placeholder="Material name"
      class="building-cost-material"
      name="buildingCostMaterial_${buildingCostCount}"
      id="buildingCostMaterial_${buildingCostCount}"
    >
    <button type="button" class="delete-btn" onclick="removeBuildingCostField(this)">x</button>
  `;

  buildingCostCount++;
  container.appendChild(div);
}

function removeBuildingCostField(button) {
  button.parentElement.remove();
}

// ======= Category Management =======
function addCategoryMemberField() {
  const container = document.getElementById("categoryMembers");
  if (!container) return;
  const div = document.createElement("div");
  div.classList.add("category-member");

  div.innerHTML = `
    <input
      type="text"
      placeholder="Material name (e.g. copper)"
      class="category-member-name"
      name="categoryMember_${categoryMemberCount}"
      id="categoryMember_${categoryMemberCount}"
    >
    <button type="button" class="delete-btn" onclick="removeCategoryMemberField(this)">x</button>
  `;

  categoryMemberCount++;
  container.appendChild(div);
}

function removeCategoryMemberField(button) {
  button.parentElement.remove();
}

function addCategory() {
  const name = document.getElementById("categoryName").value.trim();
  const memberDivs = document.querySelectorAll("#categoryMembers .category-member");
  const members = [];

  memberDivs.forEach((div) => {
    const memberName = div.querySelector(".category-member-name").value.trim();
    if (memberName) members.push(memberName);
  });

  if (!name) {
    document.getElementById("categoryName").focus();
    return alert("Category name required");
  }
  if (members.length === 0) return alert("At least one member required");

  if (categories[name]) {
    if (!confirm(`Category "${name}" already exists. Overwrite?`)) return;
  }

  categories[name] = members;
  localStorage.setItem("categories", JSON.stringify(categories));

  updateIngredientDatalist();
  updateStoredCategoriesList();
  updateStoredRecipesList();

  // Reset form
  document.getElementById("categoryName").value = "";
  document.getElementById("categoryMembers").innerHTML = "<h3>Members</h3>";
  addCategoryMemberField();
}

function deleteCategory(name) {
  if (!confirm(`Delete category "${name}"?`)) return;
  delete categories[name];
  localStorage.setItem("categories", JSON.stringify(categories));
  updateIngredientDatalist();
  updateStoredCategoriesList();
  updateStoredRecipesList();
}

function editCategory(name) {
  const members = categories[name];
  if (!members) return;

  document.getElementById("categoryName").value = name;
  const container = document.getElementById("categoryMembers");
  container.innerHTML = "<h3>Members</h3>";
  categoryMemberCount = 0;

  members.forEach((member) => {
    addCategoryMemberField();
    const input = container.querySelector(
      `#categoryMember_${categoryMemberCount - 1}`
    );
    if (input) input.value = member;
  });

  document
    .getElementById("categoriesCard")
    .scrollIntoView({ behavior: "smooth" });
}

function updateStoredCategoriesList() {
  const container = document.getElementById("storedCategories");
  if (!container) return;

  const names = Object.keys(categories);
  if (names.length === 0) {
    container.innerHTML = "<p>No categories defined.</p>";
    return;
  }

  let html = "<div class='recipes-list'>";
  for (let name of names) {
    const members = categories[name];
    const safeName = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    html += `
      <div class="recipe-item custom-recipe">
        <div class="recipe-info">
          <strong>${name}</strong>
          <br><small>${members.join(", ")}</small>
        </div>
        <div class="item-actions">
          <button type="button" class="edit-btn" onclick="editCategory('${safeName}')">Edit</button>
          <button type="button" class="delete-btn" onclick="deleteCategory('${safeName}')">Delete</button>
        </div>
      </div>
    `;
  }
  html += "</div>";
  container.innerHTML = html;
}

// ======= Material Preference Helpers =======
function getSelectedMaterial(categoryName) {
  return materialPreferences[categoryName] || categories[categoryName]?.[0] || categoryName;
}

function setMaterialPreference(categoryName, material) {
  materialPreferences[categoryName] = material;
  localStorage.setItem("materialPreferences", JSON.stringify(materialPreferences));
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
        byproducts: recipe.byproducts || {},
        ingredients: recipe.ingredients,
        building: recipe.building || null,
        buildingCost: recipe.buildingCost || {},
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
  const variantName = document.getElementById("variantName").value.trim() || "Default";
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

  const byproductDivs = document.querySelectorAll("#byproducts .byproduct");
  const byproducts = {};
  byproductDivs.forEach((div) => {
    const bpName = div.querySelector(".byproduct-name").value.trim();
    const bpAmt = parseInt(div.querySelector(".byproduct-amount").value, 10);
    if (bpName && bpAmt > 0) {
      byproducts[bpName] = bpAmt;
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

  const building = document.getElementById("buildingName").value.trim();
  const buildingCostDivs = document.querySelectorAll("#buildingCost .building-cost-row");
  const buildingCost = {};
  buildingCostDivs.forEach((div) => {
    const mat = div.querySelector(".building-cost-material").value.trim();
    const amt = parseFloat(div.querySelector(".building-cost-amount").value);
    if (mat && amt > 0) buildingCost[mat] = amt;
  });

  // Auto-create a separate recipe for the building if cost is specified and no recipe exists yet
  if (building && Object.keys(buildingCost).length > 0 && !getAllRecipes()[building]) {
    recipes[building] = { variants: [{ name: "Default", produces: 1, ingredients: buildingCost, byproducts: {} }] };
  }

  // Build the new variant object (buildingCost lives in the building's own recipe, not here)
  const newVariant = { name: variantName, produces, ingredients, byproducts: {} };
  if (Object.keys(byproducts).length > 0) newVariant.byproducts = byproducts;
  if (building) newVariant.building = building;

  // Append variant if recipe already exists, otherwise create fresh
  if (recipes[name]) {
    const normalized = normalizeRecipe(recipes[name]);
    const existingIdx = normalized.variants.findIndex((v) => v.name === variantName);
    if (existingIdx >= 0) {
      if (!confirm(`Variant "${variantName}" already exists for "${name}". Overwrite?`)) return;
      normalized.variants[existingIdx] = newVariant;
    } else {
      normalized.variants.push(newVariant);
    }
    recipes[name] = normalized;
  } else {
    recipes[name] = { variants: [newVariant] };
  }

  localStorage.setItem("recipes", JSON.stringify(recipes));

  updateCraftDropdown();
  updateIngredientDatalist();
  updateStoredRecipesList();

  // Reset form
  document.getElementById("itemName").value = "";
  document.getElementById("variantName").value = "";
  document.getElementById("produces").value = 1;
  document.getElementById("ingredients").innerHTML = "<h3>Ingredients</h3>";
  addIngredientField();
  document.getElementById("byproducts").innerHTML = '<h3>Byproducts <span class="optional-label">(optional)</span></h3>';
  document.getElementById("buildingName").value = "";
  document.getElementById("buildingCost").innerHTML = '<h3>Building Cost <span class="optional-label">(optional)</span></h3>';
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
    updateMaterialSelectors(); // variant change may alter category ingredients
  }
}

// ======= Update Material Selectors =======
function updateMaterialSelectors() {
  const container = document.getElementById("materialSelectors");
  if (!container) return;

  const itemSelect = document.getElementById("craftItem");
  const selectedItem = itemSelect?.value;

  if (!selectedItem) {
    container.style.display = "none";
    return;
  }

  const allRecipes = getAllRecipes();
  const recipe = allRecipes[selectedItem];
  if (!recipe) {
    container.style.display = "none";
    return;
  }

  const variant = getSelectedVariant(selectedItem, recipe);
  const categoryIngredients = Object.keys(variant.ingredients).filter(
    (ing) => categories[ing]
  );

  const buildingName = variant.building;
  const buildingRecipe = buildingName ? allRecipes[buildingName] : null;
  const normalizedBuilding = buildingRecipe ? normalizeRecipe(buildingRecipe) : null;
  const buildingHasVariants = normalizedBuilding && normalizedBuilding.variants.length > 1;
  const buildingVariant = buildingRecipe
    ? getSelectedVariant(buildingName, buildingRecipe)
    : null;
  const buildingCatIngredients = buildingVariant
    ? Object.keys(buildingVariant.ingredients).filter((ing) => categories[ing])
    : [];

  if (
    categoryIngredients.length === 0 &&
    !buildingHasVariants &&
    buildingCatIngredients.length === 0
  ) {
    container.style.display = "none";
    return;
  }

  let html = "";

  categoryIngredients.forEach((catName) => {
    const members = categories[catName];
    const selected = getSelectedMaterial(catName);
    const options = members
      .map((m) => `<option value="${m}"${m === selected ? " selected" : ""}>${m}</option>`)
      .join("");
    html += `
      <div class="material-selector-row">
        <label><em>${catName}:</em></label>
        <select onchange="saveMaterialSelection('${catName}', this.value)">${options}</select>
      </div>
    `;
  });

  if (buildingName && buildingRecipe && (buildingHasVariants || buildingCatIngredients.length > 0)) {
    html += `<div class="building-selector-section"><span class="building-selector-label">Building: ${buildingName}</span>`;

    if (buildingHasVariants) {
      const preferredIdx = variantPreferences[buildingName] || 0;
      const validIdx = Math.min(preferredIdx, normalizedBuilding.variants.length - 1);
      const options = normalizedBuilding.variants
        .map((v, i) => `<option value="${i}"${i === validIdx ? " selected" : ""}>${v.name}</option>`)
        .join("");
      html += `
        <div class="material-selector-row">
          <label>Variant:</label>
          <select onchange="saveBuildingVariantSelection('${buildingName}', this.value)">${options}</select>
        </div>
      `;
    }

    buildingCatIngredients.forEach((catName) => {
      const members = categories[catName];
      const selected = getSelectedMaterial(catName);
      const options = members
        .map((m) => `<option value="${m}"${m === selected ? " selected" : ""}>${m}</option>`)
        .join("");
      html += `
        <div class="material-selector-row">
          <label><em>${catName}:</em></label>
          <select onchange="saveMaterialSelection('${catName}', this.value)">${options}</select>
        </div>
      `;
    });

    html += "</div>";
  }

  container.innerHTML = html;
  container.style.display = "block";
}

function saveMaterialSelection(categoryName, material) {
  setMaterialPreference(categoryName, material);
}

function saveBuildingVariantSelection(buildingName, variantIndex) {
  setVariantPreference(buildingName, parseInt(variantIndex, 10));
  updateMaterialSelectors();
}

// ======= Update Ingredient Datalist =======
function updateIngredientDatalist() {
  const datalist = document.getElementById("ingredientList");
  if (!datalist) return;
  datalist.innerHTML = "";

  const allRecipes = getAllRecipes();
  const recipeNames = new Set(Object.keys(allRecipes));
  const categoryNames = new Set(
    Object.keys(categories).filter((c) => !recipeNames.has(c))
  );
  const otherNames = new Set();

  for (let recipeName in allRecipes) {
    const normalized = normalizeRecipe(allRecipes[recipeName]);
    for (let variant of normalized.variants) {
      for (let ing in variant.ingredients) {
        if (!recipeNames.has(ing) && !categoryNames.has(ing)) {
          otherNames.add(ing);
        }
      }
    }
  }

  const sorted = [
    ...[...recipeNames].sort((a, b) => a.localeCompare(b)),
    ...[...categoryNames].sort((a, b) => a.localeCompare(b)),
    ...[...otherNames].sort((a, b) => a.localeCompare(b)),
  ];

  for (const name of sorted) {
    const option = document.createElement("option");
    option.value = name;
    datalist.appendChild(option);
  }
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
          .map(([ing, amt]) => {
            const label = categories[ing] ? `<span class="category-ref">${ing}</span>` : ing;
            return `${amt} x ${label}`;
          })
          .join(", ");
        const byproductEntries = Object.entries(variant.byproducts || {});
        const byproductsStr = byproductEntries
          .map(([item, amt]) => `${amt} × ${item}`)
          .join(", ");

        const variantLabel =
          normalized.variants.length > 1 ? `${name} [${variant.name}]` : name;

        const buildingStr = variant.building
          ? `${variant.building}${Object.keys(variant.buildingCost || {}).length > 0 ? ` (costs: ${Object.entries(variant.buildingCost).map(([m, a]) => `${a} × ${m}`).join(", ")})` : ""}`
          : "";

        html += `
          <div class="recipe-item game-recipe">
            <div class="recipe-info">
              <strong>${variantLabel}</strong> (produces ${variant.produces})
              <br><small>Requires: ${ingredients}</small>
              ${byproductsStr ? `<br><small>Also produces: ${byproductsStr}</small>` : ""}
              ${buildingStr ? `<br><small>Building: ${buildingStr}</small>` : ""}
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
          .map(([ing, amt]) => {
            const label = categories[ing] ? `<span class="category-ref">${ing}</span>` : ing;
            return `${amt} x ${label}`;
          })
          .join(", ");
        const byproductEntries = Object.entries(variant.byproducts || {});
        const byproductsStr = byproductEntries
          .map(([item, amt]) => `${amt} × ${item}`)
          .join(", ");

        const variantLabel =
          normalized.variants.length > 1
            ? `${displayName} [${variant.name}]`
            : displayName;

        const buildingStr = variant.building
          ? `${variant.building}${Object.keys(variant.buildingCost || {}).length > 0 ? ` (costs: ${Object.entries(variant.buildingCost).map(([m, a]) => `${a} × ${m}`).join(", ")})` : ""}`
          : "";

        const safeRecipeName = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        html += `
          <div class="recipe-item custom-recipe ${hasConflict ? "conflict-recipe" : ""}">
            <div class="recipe-info">
              <strong>${variantLabel}</strong> (produces ${variant.produces}) <br /><small
                >Requires: ${ingredients}</small
              >
              ${byproductsStr ? `<br><small>Also produces: ${byproductsStr}</small>` : ""}
              ${buildingStr ? `<br><small>Building: ${buildingStr}</small>` : ""}
            </div>
            <div class="item-actions">
              <button type="button" class="edit-btn" onclick="editRecipe('${safeRecipeName}', ${idx})">Edit</button>
              <button type="button" class="delete-btn" onclick="deleteRecipe('${safeRecipeName}')">Delete</button>
            </div>
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

function editRecipe(name, variantIdx) {
  const recipe = recipes[name];
  if (!recipe) return;
  const normalized = normalizeRecipe(recipe);
  const variant = normalized.variants[variantIdx];
  if (!variant) return;

  switchTab("setupTab");

  document.getElementById("itemName").value = name;
  document.getElementById("variantName").value = variant.name;
  document.getElementById("produces").value = variant.produces;

  // Fill ingredients
  document.getElementById("ingredients").innerHTML = "";
  for (const [ingName, ingAmt] of Object.entries(variant.ingredients)) {
    addIngredientField();
    const idx = ingredientCount - 1;
    document.getElementById(`ingredientName_${idx}`).value = ingName;
    document.getElementById(`ingredientAmount_${idx}`).value = ingAmt;
  }

  // Fill byproducts
  document.getElementById("byproducts").innerHTML =
    '<h4>Byproducts <span class="optional-label">(optional)</span></h4>';
  for (const [bpName, bpAmt] of Object.entries(variant.byproducts || {})) {
    addByproductField();
    const idx = byproductCount - 1;
    document.getElementById(`byproductName_${idx}`).value = bpName;
    document.getElementById(`byproductAmount_${idx}`).value = bpAmt;
  }

  // Fill building
  document.getElementById("buildingName").value = variant.building || "";
  document.getElementById("buildingCost").innerHTML =
    '<h4>Building Cost <span class="optional-label">(optional)</span></h4>';

  document
    .getElementById("addRecipeCard")
    .scrollIntoView({ behavior: "smooth" });
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
  updateStoredCategoriesList();
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

// ======= Queue Management =======
function addToQueue() {
  const item = document.getElementById("craftItem").value;
  const qty = parseInt(document.getElementById("craftQty").value, 10);
  if (!item || qty < 1) return;

  queue.push({ item, qty });
  localStorage.setItem("queue", JSON.stringify(queue));
  renderQueue();
}

function removeFromQueue(index) {
  queue.splice(index, 1);
  localStorage.setItem("queue", JSON.stringify(queue));
  renderQueue();
}

function clearQueue() {
  queue = [];
  localStorage.setItem("queue", JSON.stringify(queue));
  renderQueue();
}

function addBuildingToQueue(name) {
  queue.push({ item: name, qty: 1 });
  localStorage.setItem("queue", JSON.stringify(queue));
  renderQueue();
  document.getElementById("queueCard").scrollIntoView({ behavior: "smooth" });
}

function renderQueue() {
  const container = document.getElementById("queueItems");
  const calcBtn = document.getElementById("calculateBtn");
  if (!container) return;

  if (queue.length === 0) {
    container.innerHTML = "<p class='queue-empty'>No items in queue.</p>";
    if (calcBtn) calcBtn.disabled = true;
    return;
  }

  if (calcBtn) calcBtn.disabled = false;

  let html = "";
  queue.forEach(({ item, qty }, index) => {
    html += `
      <div class="queue-item">
        <span class="queue-item-label">${qty} &times; ${item}</span>
        <button type="button" class="delete-btn" onclick="removeFromQueue(${index})">Remove</button>
      </div>
    `;
  });
  container.innerHTML = html;
}

// ======= Global Needs Calculation (fractional batch arithmetic) =======
// Propagates exact fractional demands through the recipe tree so that
// batch rounding only happens once at the leaf level, across all queue
// items combined. This prevents overcounting when multiple items share
// the same intermediate recipe.
function computeGlobalNeeds(queue) {
  const allRecipes = getAllRecipes();
  const exactDemands = {};

  function collectExactDemands(item, qty) {
    exactDemands[item] = (exactDemands[item] || 0) + qty;
    const recipe = allRecipes[item];
    if (!recipe) return;
    const variant = getSelectedVariant(item, recipe);
    const exactBatches = qty / variant.produces;
    for (const [ing, amount] of Object.entries(variant.ingredients)) {
      let ingName = ing;
      if (categories[ing] && !allRecipes[ing]) {
        ingName = getSelectedMaterial(ing);
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
      const variant = getSelectedVariant(mat, recipe);
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

// ======= Calculate =======
function calculate() {
  if (queue.length === 0) return;

  const trees = queue.map(({ item, qty }) => expand(item, qty));
  const { leafTotals, byproductTotals, buildings, totalTime, intermediateBatches } =
    computeGlobalNeeds(queue);

  const resultsDiv = document.getElementById("results");
  let html = "";

  // Combined materials section
  html +=
    "<h3>Materials Needed:</h3><ul>" +
    Object.entries(leafTotals)
      .map(([k, v]) => `<li>${v} × ${k}</li>`)
      .join("") +
    "</ul>";

  if (Object.keys(byproductTotals).length > 0) {
    html +=
      '<h3 class="byproducts-heading">Byproducts:</h3><ul>' +
      Object.entries(byproductTotals)
        .map(([k, v]) => `<li>${v} × ${k}</li>`)
        .join("") +
      "</ul>";
  }

  if (Object.keys(buildings).length > 0) {
    const allRecipes = getAllRecipes();
    html += '<h3 class="buildings-heading">Buildings Needed:</h3><ul>';
    for (let [bldg, cost] of Object.entries(buildings)) {
      const costStr = Object.entries(cost)
        .map(([mat, amt]) => `${amt} × ${mat}`)
        .join(", ");
      const safeName = bldg.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      const addBtn = allRecipes[bldg]
        ? `<button type="button" class="add-to-queue-btn" onclick="addBuildingToQueue('${safeName}')">Add to queue</button>`
        : "";
      html += `<li><strong>${bldg}</strong>${costStr ? `: ${costStr}` : ""} ${addBtn}</li>`;
    }
    html += "</ul>";
  }

  if (totalTime > 0) {
    html += `<p><strong>Total Crafting Time:</strong> ${formatTime(totalTime)}</p>`;
  }

  // Combined Crafting section — global batch stats for intermediate materials
  if (Object.keys(intermediateBatches).length > 0) {
    html += '<h3 class="combined-crafting-heading">Combined Crafting:</h3><ul>';
    for (const [mat, info] of Object.entries(intermediateBatches)) {
      const needed = Math.ceil(info.requestedTotal);
      const batchWord = info.crafts === 1 ? "batch" : "batches";
      let entry = `<li><strong>${mat}</strong>: ${needed} needed → ${info.crafts} ${batchWord} → ${info.produced} produced`;
      if (info.leftover > 0) {
        entry += ` <span class="excess">(${info.leftover} leftover)</span>`;
      }
      if (Object.keys(info.byproducts).length > 0) {
        const bpStr = Object.entries(info.byproducts)
          .map(([k, v]) => `${v} × ${k}`)
          .join(", ");
        entry += ` <span class="byproduct-info">→ ${bpStr}</span>`;
      }
      if (info.building) {
        entry += ` <span class="building-info">[${info.building}]</span>`;
      }
      entry += "</li>";
      html += entry;
    }
    html += "</ul>";
  }

  // Per-item breakdown
  html += "<h3>Breakdown:</h3>";
  trees.forEach((tree, i) => {
    html += `<div class="queue-result-section">`;

    if (tree.crafts > 0) {
      const excess = tree.qty - tree.requestedQty;
      html += `<div class="batch-info">
        <h3>${queue[i].item}</h3>
        <p><strong>Requested:</strong> ${tree.requestedQty}</p>
        <p><strong>Will produce:</strong> ${tree.qty} (${tree.crafts} × ${tree.produces})`;
      if (excess > 0) {
        html += ` <span class="excess">+${excess} extra</span>`;
      }
      html += `</p></div>`;
    }

    html += "<ul>" + renderTree(tree) + "</ul>";
    html += "</div>";
  });

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
      byproducts: {},
      building: null,
      buildingCost: {},
      children: [],
      craftingTime: 0,
      variantName: null,
    };
  }

  const recipe = allRecipes[item];
  const variant = getSelectedVariant(item, recipe);
  const { produces, ingredients, metadata, building, buildingCost } = variant;
  const crafts = Math.ceil(qty / produces);
  const actualQty = crafts * produces;

  // Get crafting time from metadata (defaults to 0 if not specified)
  const baseTime = metadata?.craftingTime || 0;
  const totalCraftingTime = baseTime * crafts;

  // Scale byproducts by number of crafting runs
  const scaledByproducts = {};
  for (let [bpItem, bpAmt] of Object.entries(variant.byproducts || {})) {
    scaledByproducts[bpItem] = bpAmt * crafts;
  }

  const children = [];
  for (let ing in ingredients) {
    const need = ingredients[ing] * crafts;
    let ingredientName = ing;
    if (categories[ing] && !allRecipes[ing]) {
      // Category ingredient: resolve to the selected specific material
      ingredientName = getSelectedMaterial(ing);
    }
    children.push(expand(ingredientName, need));
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

// ======= Flatten Tree to Totals =======
function flatten(node, totals = {}) {
  if (node.children.length === 0) {
    totals[node.name] = (totals[node.name] || 0) + node.qty;
  } else {
    node.children.forEach((child) => flatten(child, totals));
  }
  return totals;
}

// ======= Flatten Byproducts Across All Nodes =======
function flattenByproducts(node, totals = {}) {
  for (let [item, amt] of Object.entries(node.byproducts || {})) {
    totals[item] = (totals[item] || 0) + amt;
  }
  node.children.forEach((child) => flattenByproducts(child, totals));
  return totals;
}

// ======= Collect Unique Buildings Across Tree =======
function collectBuildings(node, buildings = {}) {
  if (node.building && !buildings[node.building]) {
    buildings[node.building] = node.buildingCost || {};
  }
  node.children.forEach((child) => collectBuildings(child, buildings));
  return buildings;
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
  // For intermediates show actual demand (requestedQty); for leaves qty === requestedQty anyway
  const displayQty = node.crafts > 0 ? node.requestedQty : node.qty;
  let html = `<li>${displayQty} × ${node.name}`;

  if (node.variantName && node.variantName !== "Default") {
    html += ` <span class="variant-info">[${node.variantName}]</span>`;
  }

  if (node.building) {
    html += ` <span class="building-info">[${node.building}]</span>`;
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

// ======= Import Recipes =======
function importRecipes() {
  document.getElementById("importFileInput").click();
}

function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.recipes || typeof data.recipes !== "object") {
        return alert("Invalid recipe file: missing 'recipes' object.");
      }
      let imported = 0;
      for (const [name, recipe] of Object.entries(data.recipes)) {
        if (recipes[name]) {
          const existing = normalizeRecipe(recipes[name]);
          const incoming = normalizeRecipe(recipe);
          for (const variant of incoming.variants) {
            const existIdx = existing.variants.findIndex((v) => v.name === variant.name);
            if (existIdx >= 0) {
              existing.variants[existIdx] = variant;
            } else {
              existing.variants.push(variant);
            }
          }
          recipes[name] = existing;
        } else {
          recipes[name] = recipe;
        }
        imported++;
      }
      localStorage.setItem("recipes", JSON.stringify(recipes));
      updateAllUI();
      alert(`Imported ${imported} recipe(s) successfully.`);
    } catch (err) {
      alert(`Failed to import: ${err.message}`);
    }
    event.target.value = "";
  };
  reader.readAsText(file);
}

// ======= Export Recipes =======
function exportRecipes() {
  if (Object.keys(recipes).length === 0) {
    alert("No custom recipes to export.");
    return;
  }
  const name = prompt("Pack name for export:", "My Custom Recipes");
  if (name === null) return;
  const pack = {
    gameInfo: { name, version: "1.0.0", description: "Exported from Crafting Calculator" },
    recipes: { ...recipes },
  };
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name.toLowerCase().replace(/\s+/g, "-") + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
}

// ======= Clear All Local Data =======
function clearAllData() {
  if (!confirm("Clear all stored recipes, categories, and queue? This cannot be undone.")) return;
  ["recipes", "currentGame", "variantPreferences", "queue", "categories", "materialPreferences"].forEach(
    (k) => localStorage.removeItem(k)
  );
  location.reload();
}
