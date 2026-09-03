// ======= HTML Escaping =======
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
window.addEventListener("DOMContentLoaded", async () => {
  const savedRecipes = localStorage.getItem("recipes");
  if (savedRecipes) {
    Object.assign(recipes, JSON.parse(savedRecipes));
  }
  // Populate the game-pack dropdown from the manifest before restoring the
  // saved selection, so the saved <option> exists when we set its value.
  await populatePackDropdown();
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

  document.getElementById("storedCategories").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const name = btn.dataset.name;
    if (btn.dataset.action === "edit-category") editCategory(name);
    else if (btn.dataset.action === "delete-category") deleteCategory(name);
  });

  document.getElementById("storedRecipes").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const name = btn.dataset.name;
    if (btn.dataset.action === "edit-recipe") editRecipe(name, parseInt(btn.dataset.variantIdx, 10));
    else if (btn.dataset.action === "delete-recipe") deleteRecipe(name);
  });

  document.getElementById("calculateTab").addEventListener("change", (e) => {
    const sel = e.target;
    if (sel.dataset.action === "save-material") saveMaterialSelection(sel.dataset.categoryName, sel.value);
    else if (sel.dataset.action === "save-building-variant") saveBuildingVariantSelection(sel.dataset.buildingName, sel.value);
  });

  document.getElementById("calculateTab").addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="add-building-to-queue"]');
    if (!btn) return;
    addBuildingToQueue(btn.dataset.buildingName);
  });
});

function switchTab(tabId) {
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
  const tabs = ["calculateTab", "libraryTab", "setupTab"];
  const idx = tabs.indexOf(tabId);
  if (idx >= 0) document.querySelectorAll(".tab-btn")[idx].classList.add("active");
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
      placeholder="Material name (e.g. Copper)"
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

  switchTab("setupTab");
  document.getElementById("categoryName").value = name;
  const container = document.getElementById("categoryMembers");
  container.innerHTML = "<h3>Members</h3>";
  categoryMemberCount = 0;

  members.forEach((member) => {
    addCategoryMemberField();
    const input = container.querySelector(`#categoryMember_${categoryMemberCount - 1}`);
    if (input) input.value = member;
  });

  document.getElementById("categoriesCard").scrollIntoView({ behavior: "smooth" });
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
    html += `
      <div class="recipe-item custom-recipe">
        <div class="recipe-info">
          <strong>${escapeHtml(name)}</strong>
          <br><small>${escapeHtml(members.join(", "))}</small>
        </div>
        <div class="item-actions">
          <button type="button" class="edit-btn" data-action="edit-category" data-name="${escapeHtml(name)}">Edit</button>
          <button type="button" class="delete-btn" data-action="delete-category" data-name="${escapeHtml(name)}">Delete</button>
        </div>
      </div>
    `;
  }
  html += "</div>";
  container.innerHTML = html;
}

// ======= Engine Delegation =======
// The pure calculation core lives in engine.js (CraftEngine) so it can be unit
// tested outside the browser. The wrappers below feed it the app's live state.
function engineCtx() {
  return {
    allRecipes: getAllRecipes(),
    categories,
    materialPreferences,
    variantPreferences,
  };
}

const normalizeRecipe = (recipe) => CraftEngine.normalizeRecipe(recipe);
const getSelectedVariant = (recipeName, recipe) =>
  CraftEngine.getSelectedVariant(recipeName, recipe, variantPreferences);
const getSelectedMaterial = (categoryName) =>
  CraftEngine.getSelectedMaterial(categoryName, categories, materialPreferences);
const hasCircularDependency = (itemName, recipeSet, visited) =>
  CraftEngine.hasCircularDependency(itemName, recipeSet, visited);
const expand = (item, qty) => CraftEngine.expand(item, qty, engineCtx());
const computeGlobalNeeds = (queue) => CraftEngine.computeGlobalNeeds(queue, engineCtx());

// ======= Material Preference Helpers =======
function setMaterialPreference(categoryName, material) {
  materialPreferences[categoryName] = material;
  localStorage.setItem("materialPreferences", JSON.stringify(materialPreferences));
}

// ======= Recipe Variants Helpers =======
function setVariantPreference(recipeName, variantIndex) {
  variantPreferences[recipeName] = variantIndex;
  localStorage.setItem("variantPreferences", JSON.stringify(variantPreferences));
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
    recipes[building] = {
      variants: [{ name: "Default", produces: 1, ingredients: buildingCost, byproducts: {} }],
    };
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
  document.getElementById("ingredients").innerHTML = "";
  addIngredientField();
  document.getElementById("byproducts").innerHTML =
    '<h4>Byproducts <span class="optional-label">(optional)</span></h4>';
  document.getElementById("buildingName").value = "";
  document.getElementById("buildingCost").innerHTML =
    '<h4>Building Cost <span class="optional-label">(optional)</span></h4>';
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
    option.textContent = `${variant.name} (${variant.produces}x from ${Object.entries(
      variant.ingredients,
    )
      .map(([ing, amt]) => `${amt} ${ing}`)
      .join(", ")})`;
    if (idx === preferredIndex) {
      option.selected = true;
    }
    variantSelect.appendChild(option);
  });

  variantContainer.style.display = "block";
  updateBuildingIndicator();
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
    updateBuildingIndicator();
  }
}

// ======= Update Building Indicator =======
function updateBuildingIndicator() {
  const el = document.getElementById("buildingIndicator");
  if (!el) return;
  const itemSelect = document.getElementById("craftItem");
  if (!itemSelect?.value) {
    el.style.display = "none";
    return;
  }
  const recipe = getAllRecipes()[itemSelect.value];
  if (!recipe) {
    el.style.display = "none";
    return;
  }
  const variant = getSelectedVariant(itemSelect.value, recipe);
  if (!variant?.building) {
    el.style.display = "none";
    return;
  }
  el.innerHTML = `<label class="building-req-label">Built in:</label><span class="building-req-name">${escapeHtml(variant.building)}</span>`;
  el.style.display = "block";
}

// ======= Build Material Option Elements =======
function buildMaterialOptions(catName) {
  const selected = getSelectedMaterial(catName);
  return categories[catName]
    .map((m) => `<option value="${escapeHtml(m)}"${m === selected ? " selected" : ""}>${escapeHtml(m)}</option>`)
    .join("");
}

// ======= Update Material Selectors =======
function updateMaterialSelectors() {
  const container = document.getElementById("materialSelectors");
  const buildingContainer = document.getElementById("buildingSelectors");
  const buildingRowDiv = document.getElementById("buildingCraftRow");
  if (!container) return;

  // Always reset building panel; re-populate below only if needed
  if (buildingContainer) {
    buildingContainer.innerHTML = "";
    buildingContainer.style.display = "none";
  }
  if (buildingRowDiv) buildingRowDiv.style.display = "none";

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
  const categoryIngredients = Object.keys(variant.ingredients).filter((ing) => categories[ing]);

  const buildingName = variant.building;
  const buildingRecipe = buildingName ? allRecipes[buildingName] : null;
  const normalizedBuilding = buildingRecipe ? normalizeRecipe(buildingRecipe) : null;
  const buildingHasVariants = normalizedBuilding && normalizedBuilding.variants.length > 1;
  const buildingVariant = buildingRecipe ? getSelectedVariant(buildingName, buildingRecipe) : null;
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
    html += `
      <div class="material-selector-row">
        <label><em>${escapeHtml(catName)}:</em></label>
        <select data-action="save-material" data-category-name="${escapeHtml(catName)}">${buildMaterialOptions(catName)}</select>
      </div>
    `;
  });

  if (
    buildingName &&
    buildingRecipe &&
    (buildingHasVariants || buildingCatIngredients.length > 0)
  ) {
    let buildingHtml = `<div class="building-selector-section">`;
    buildingRowDiv.style.display = "block";

    if (buildingHasVariants) {
      const preferredIdx = variantPreferences[buildingName] || 0;
      const validIdx = Math.min(preferredIdx, normalizedBuilding.variants.length - 1);
      const options = normalizedBuilding.variants
        .map(
          (v, i) => `<option value="${i}"${i === validIdx ? " selected" : ""}>${escapeHtml(v.name)}</option>`,
        )
        .join("");
      buildingHtml += `
        <div class="material-selector-row">
          <label>Variant:</label>
          <select data-action="save-building-variant" data-building-name="${escapeHtml(buildingName)}">${options}</select>
        </div>
      `;
    }

    buildingCatIngredients.forEach((catName) => {
      buildingHtml += `
        <div class="material-selector-row">
          <label><em>${escapeHtml(catName)}:</em></label>
          <select data-action="save-material" data-category-name="${escapeHtml(catName)}">${buildMaterialOptions(catName)}</select>
        </div>
      `;
    });

    buildingHtml += `<button type="button" class="add-to-queue-btn" data-action="add-building-to-queue" data-building-name="${escapeHtml(buildingName)}">+Add to queue</button>`;
    buildingHtml += "</div>";
    buildingContainer.innerHTML = buildingHtml;
    buildingContainer.style.display = "block";
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
  const categoryNames = new Set(Object.keys(categories).filter((c) => !recipeNames.has(c)));
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
            const label = categories[ing] ? `<span class="category-ref">${escapeHtml(ing)}</span>` : escapeHtml(ing);
            return `${amt} x ${label}`;
          })
          .join(", ");
        const byproductEntries = Object.entries(variant.byproducts || {});
        const byproductsStr = byproductEntries.map(([item, amt]) => `${amt} × ${escapeHtml(item)}`).join(", ");

        const variantLabel = normalized.variants.length > 1 ? `${escapeHtml(name)} [${escapeHtml(variant.name)}]` : escapeHtml(name);

        const buildingStr = variant.building
          ? `${escapeHtml(variant.building)}${
              Object.keys(variant.buildingCost || {}).length > 0
                ? ` (costs: ${Object.entries(variant.buildingCost)
                    .map(([m, a]) => `${a} × ${escapeHtml(m)}`)
                    .join(", ")})`
                : ""
            }`
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

      const displayName = gameRecipes[name] ? `${escapeHtml(name)} (Custom)` : escapeHtml(name);
      const hasConflict = gameRecipes[name];

      // Show all variants
      normalized.variants.forEach((variant, idx) => {
        const ingredients = Object.entries(variant.ingredients)
          .map(([ing, amt]) => {
            const label = categories[ing] ? `<span class="category-ref">${escapeHtml(ing)}</span>` : escapeHtml(ing);
            return `${amt} x ${label}`;
          })
          .join(", ");
        const byproductEntries = Object.entries(variant.byproducts || {});
        const byproductsStr = byproductEntries.map(([item, amt]) => `${amt} × ${escapeHtml(item)}`).join(", ");

        const variantLabel =
          normalized.variants.length > 1 ? `${displayName} [${escapeHtml(variant.name)}]` : displayName;

        const buildingStr = variant.building
          ? `${escapeHtml(variant.building)}${
              Object.keys(variant.buildingCost || {}).length > 0
                ? ` (costs: ${Object.entries(variant.buildingCost)
                    .map(([m, a]) => `${a} × ${escapeHtml(m)}`)
                    .join(", ")})`
                : ""
            }`
          : "";

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
              <button type="button" class="edit-btn" data-action="edit-recipe" data-name="${escapeHtml(name)}" data-variant-idx="${idx}">Edit</button>
              <button type="button" class="delete-btn" data-action="delete-recipe" data-name="${escapeHtml(name)}">Delete</button>
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

  document.getElementById("addRecipeCard").scrollIntoView({ behavior: "smooth" });
}

// ======= Populate Game Pack Dropdown from Manifest =======
// Recipe packs are listed in recipes/index.json so new packs can be added by
// dropping a JSON file and registering it there — no HTML edits required.
async function populatePackDropdown() {
  const sel = document.getElementById("gameSelect");
  if (!sel) return;
  try {
    const res = await fetch("recipes/index.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const packs = Array.isArray(data) ? data : data.packs || [];
    // Preserve the default "Custom Recipes Only" option; append packs after it.
    const existing = new Set(Array.from(sel.options).map((o) => o.value));
    for (const pack of packs) {
      if (!pack || !pack.id || existing.has(pack.id)) continue;
      const opt = document.createElement("option");
      opt.value = pack.id;
      opt.textContent = pack.name || pack.id;
      sel.appendChild(opt);
    }
  } catch (error) {
    console.error("Failed to load recipe pack manifest:", error);
  }
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
    statusDiv.innerHTML = `<small>Loaded ${Object.keys(gameRecipes).length} recipes from ${escapeHtml(
      gameData.gameInfo.name
    )}</small>`;
    localStorage.setItem("currentGame", currentGame);

    updateAllUI();
  } catch (error) {
    statusDiv.innerHTML = `<small style="color: red;">Error loading recipes: ${escapeHtml(error.message)}</small>`;
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

function getQueueItemSelectors(item) {
  const allRecipes = getAllRecipes();
  const recipe = allRecipes[item];
  if (!recipe) return "";

  const variant = getSelectedVariant(item, recipe);
  const categoryIngredients = Object.keys(variant.ingredients).filter((ing) => categories[ing]);

  const buildingName = variant.building;
  const buildingRecipe = buildingName ? allRecipes[buildingName] : null;
  const normalizedBuilding = buildingRecipe ? normalizeRecipe(buildingRecipe) : null;
  const buildingHasVariants = normalizedBuilding && normalizedBuilding.variants.length > 1;
  const buildingVariant = buildingRecipe ? getSelectedVariant(buildingName, buildingRecipe) : null;
  const buildingCatIngredients = buildingVariant
    ? Object.keys(buildingVariant.ingredients).filter((ing) => categories[ing])
    : [];

  if (categoryIngredients.length === 0 && !buildingHasVariants && buildingCatIngredients.length === 0) {
    return "";
  }

  let html = '<div class="queue-item-selectors">';

  categoryIngredients.forEach((catName) => {
    html += `<div class="material-selector-row">
      <label><em>${escapeHtml(catName)}:</em></label>
      <select data-action="save-material" data-category-name="${escapeHtml(catName)}">${buildMaterialOptions(catName)}</select>
    </div>`;
  });

  if (buildingName && buildingRecipe && (buildingHasVariants || buildingCatIngredients.length > 0)) {
    html += `<div class="building-selector-section"><span class="building-selector-label">Building: ${escapeHtml(buildingName)}</span>`;

    if (buildingHasVariants) {
      const preferredIdx = variantPreferences[buildingName] || 0;
      const validIdx = Math.min(preferredIdx, normalizedBuilding.variants.length - 1);
      const options = normalizedBuilding.variants
        .map((v, i) => `<option value="${i}"${i === validIdx ? " selected" : ""}>${escapeHtml(v.name)}</option>`)
        .join("");
      html += `<div class="material-selector-row">
        <label>Variant:</label>
        <select data-action="save-building-variant" data-building-name="${escapeHtml(buildingName)}">${options}</select>
      </div>`;
    }

    buildingCatIngredients.forEach((catName) => {
      html += `<div class="material-selector-row">
        <label><em>${escapeHtml(catName)}:</em></label>
        <select data-action="save-material" data-category-name="${escapeHtml(catName)}">${buildMaterialOptions(catName)}</select>
      </div>`;
    });

    html += "</div>";
  }

  html += "</div>";
  return html;
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
    const selectors = getQueueItemSelectors(item);
    html += `
      <div class="queue-item">
        <div class="queue-item-main">
          <span class="queue-item-label">${qty} &times; ${escapeHtml(item)}</span>
          <button type="button" class="delete-btn" onclick="removeFromQueue(${index})">Remove</button>
        </div>
        ${selectors}
      </div>
    `;
  });
  container.innerHTML = html;
}

// ======= Calculate =======
function calculate() {
  if (queue.length === 0) return;

  const trees = queue.map(({ item, qty }) => expand(item, qty));
  const { leafTotals, byproductTotals, buildings, totalTime, intermediateBatches } =
    computeGlobalNeeds(queue);

  const allRecipes = getAllRecipes();
  const resultsDiv = document.getElementById("results");
  let html = "";

  // Hero materials grid
  html += `<div class="results-section">
    <div class="section-label">materials needed</div>
    <div class="material-grid">`;
  for (const [name, qty] of Object.entries(leafTotals)) {
    html += `<div class="material-tile">
      <div class="material-qty">${qty}</div>
      <div class="material-name">${escapeHtml(name)}</div>
    </div>`;
  }
  html += `</div></div>`;

  // Byproducts (if any)
  if (Object.keys(byproductTotals).length > 0) {
    html += `<div class="results-section">
      <div class="section-label">byproducts</div>
      <div class="material-grid">`;
    for (const [name, qty] of Object.entries(byproductTotals)) {
      html += `<div class="material-tile byproduct-tile">
        <div class="material-qty">+${qty}</div>
        <div class="material-name">${escapeHtml(name)}</div>
      </div>`;
    }
    html += `</div></div>`;
  }

  // Summary strip
  const summaryChips = [];
  if (totalTime > 0)
    summaryChips.push(`<span class="summary-chip">&#9201; ${formatTime(totalTime)}</span>`);
  const buildingCount = Object.keys(buildings).length;
  if (buildingCount > 0)
    summaryChips.push(
      `<span class="summary-chip">&#127981; ${buildingCount} building${buildingCount !== 1 ? "s" : ""}</span>`,
    );
  if (summaryChips.length > 0) {
    html += `<div class="summary-strip">${summaryChips.join("")}</div>`;
  }

  // Combined Crafting collapsible (open by default)
  if (Object.keys(intermediateBatches).length > 0) {
    const count = Object.keys(intermediateBatches).length;
    html += `<details class="results-collapse" open>
      <summary>Combined Crafting <span class="collapse-count">${count} item${count !== 1 ? "s" : ""}</span></summary>
      <div class="collapse-content">
        <table class="batch-table">
          <thead><tr>
            <th>Item</th><th>Batches</th><th>Produced</th><th>Leftover</th><th>Byproducts</th><th>Building</th>
          </tr></thead>
          <tbody>`;
    for (const [mat, info] of Object.entries(intermediateBatches)) {
      const leftover = info.leftover;
      const leftoverCell = leftover > 0 ? `<span class="excess">+${leftover}</span>` : "&#8212;";
      const bpEntries = Object.entries(info.byproducts);
      const bpStr =
        bpEntries.length > 0
          ? bpEntries.map(([k, v]) => `${v} &times; ${escapeHtml(k)}`).join(", ")
          : "&#8212;";
      const buildingStr = info.building
        ? `<span class="building-info">${escapeHtml(info.building)}</span>`
        : "&#8212;";
      html += `<tr>
        <td>${escapeHtml(mat)}</td>
        <td class="mono">${info.crafts}</td>
        <td class="mono">${info.produced}</td>
        <td class="mono">${leftoverCell}</td>
        <td class="byproduct-info">${bpStr}</td>
        <td>${buildingStr}</td>
      </tr>`;
    }
    html += `</tbody></table></div></details>`;
  }

  // Buildings Needed collapsible (closed by default)
  if (Object.keys(buildings).length > 0) {
    const bCount = Object.keys(buildings).length;
    html += `<details class="results-collapse">
      <summary>Buildings Needed <span class="collapse-count">${bCount} station${bCount !== 1 ? "s" : ""}</span></summary>
      <div class="collapse-content buildings-list">`;
    for (const [bldg, cost] of Object.entries(buildings)) {
      const costStr = Object.entries(cost)
        .map(([mat, amt]) => `${amt} &times; ${escapeHtml(mat)}`)
        .join(", ");
      const addBtn = allRecipes[bldg]
        ? `<button type="button" class="add-to-queue-btn" data-action="add-building-to-queue" data-building-name="${escapeHtml(bldg)}">+Add to queue</button>`
        : "";
      html += `<div class="building-row">
        <strong>${escapeHtml(bldg)}</strong>
        ${costStr ? `<span class="building-cost">${costStr}</span>` : ""}
        ${addBtn}
      </div>`;
    }
    html += `</div></details>`;
  }

  // Per-item Breakdown collapsible (closed by default)
  html += `<details class="results-collapse">
    <summary>Per-item Breakdown <span class="collapse-count">${queue.length} item${queue.length !== 1 ? "s" : ""}</span></summary>
    <div class="collapse-content">`;
  trees.forEach((tree, i) => {
    html += `<div class="breakdown-item">`;
    if (tree.crafts > 0) {
      const excess = tree.qty - tree.requestedQty;
      html += `<div class="batch-header">
        <strong>${escapeHtml(queue[i].item)}</strong>
        &nbsp; Requested: ${tree.requestedQty} &rarr; Will produce: ${tree.qty} (${tree.crafts} &times; ${tree.produces})`;
      if (excess > 0) {
        html += ` <span class="excess">+${excess} extra</span>`;
      }
      html += `</div>`;
    }
    html += `<ul class="tree-list">${renderTree(tree)}</ul>`;
    html += `</div>`;
  });
  html += `</div></details>`;

  resultsDiv.innerHTML = html;
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
  let html = `<li>${displayQty} × ${escapeHtml(node.name)}`;

  if (node.variantName && node.variantName !== "Default") {
    html += ` <span class="variant-info">[${escapeHtml(node.variantName)}]</span>`;
  }

  if (node.building) {
    html += ` <span class="building-info">[${escapeHtml(node.building)}]</span>`;
  }

  if (node.children.length > 0) {
    html += `<ul class="tree-list">`;
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
      let importedRecipes = 0;
      let importedCategories = 0;
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
        importedRecipes++;
      }
      localStorage.setItem("recipes", JSON.stringify(recipes));
      if (data.categories && typeof data.categories === "object") {
        for (const [name, members] of Object.entries(data.categories)) {
          categories[name] = members;
          importedCategories++;
        }
        localStorage.setItem("categories", JSON.stringify(categories));
      }
      updateAllUI();
      const catMsg =
        importedCategories > 0
          ? ` and ${importedCategories} categor${importedCategories === 1 ? "y" : "ies"}`
          : "";
      alert(`Imported ${importedRecipes} recipe(s)${catMsg} successfully.`);
    } catch (err) {
      alert(`Failed to import: ${err.message}`);
    }
    event.target.value = "";
  };
  reader.readAsText(file);
}

// ======= Export Recipes =======
function exportRecipes() {
  if (Object.keys(recipes).length === 0 && Object.keys(categories).length === 0) {
    alert("No custom recipes or categories to export.");
    return;
  }
  const name = prompt("Game name for export:", "My Custom Recipes");
  if (name === null) return;
  const pack = {
    gameInfo: { name, version: "1.0.0", description: "Exported from Crafting Calculator" },
    recipes: { ...recipes },
    categories: { ...categories },
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
  [
    "recipes",
    "currentGame",
    "variantPreferences",
    "queue",
    "categories",
    "materialPreferences",
  ].forEach((k) => localStorage.removeItem(k));
  location.reload();
}
