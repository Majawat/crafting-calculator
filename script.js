// ======= Recipes Storage =======
const recipes = {};

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
  const tempRecipes = { ...recipes, [name]: { produces, ingredients } };
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
  for (let name in recipes) {
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
  for (let recipeName in recipes) {
    const recipe = recipes[recipeName];
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

  console.debug(Object.keys(recipes).length + " recipes stored.");
  if (Object.keys(recipes).length === 0) {
    container.innerHTML = "<p>No recipes stored yet.</p>";
    return;
  }

  let html = "<div class='recipes-list'>";
  for (let name in recipes) {
    const recipe = recipes[name];
    const ingredients = Object.entries(recipe.ingredients)
      .map(([ing, amt]) => `${amt} x ${ing}`)
      .join(", ");

    html += `
      <div class="recipe-item">
        <div class="recipe-info">
          <strong>${name}</strong> (produces ${recipe.produces})
          <br><small>Requires: ${ingredients}</small>
        </div>
        <button type="button" class="delete-btn" onclick="deleteRecipe('${name}')">Delete</button>
      </div>
    `;
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

  alert(`Recipe for "${recipeName}" deleted.`);
}

// ======= Calculate =======
function calculate() {
  const itemSelect = document.getElementById("craftItem");
  const item = itemSelect.value.trim();
  const qty = parseInt(document.getElementById("craftQty").value, 10);
  if (!item || qty < 1) return;

  const tree = expand(item, qty);
  const flatTotals = flatten(tree);

  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML =
    "<h3>Totals:</h3><ul>" +
    Object.entries(flatTotals)
      .map(([k, v]) => `<li>${v} x ${k}</li>`)
      .join("") +
    "</ul><h3>Breakdown:</h3><ul>" +
    renderTree(tree) +
    "</ul>";
}

// ======= Expand Recipes Recursively =======
function expand(item, qty) {
  if (!recipes[item]) {
    return { name: item, qty: qty, children: [] };
  }

  const { produces, ingredients } = recipes[item];
  const crafts = Math.ceil(qty / produces);
  const actualQty = crafts * produces;

  const children = [];
  for (let ing in ingredients) {
    const need = ingredients[ing] * crafts;
    children.push(expand(ing, need));
  }

  return { name: item, qty: actualQty, children };
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
