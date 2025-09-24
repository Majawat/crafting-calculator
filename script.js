const recipes = {};

function addIngredientField() {
  const container = document.getElementById("ingredients");
  const div = document.createElement("div");
  div.classList.add("ingredient");
  div.innerHTML = `<input type="text" placeholder="Ingredient name"> <input type="number" placeholder="Amount" min="1" value="1">`;
  container.appendChild(div);
}

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

  recipes[name] = { produces, ingredients };
  alert(`Recipe for ${name} saved!`);
  console.log(`Recipe for ${name} saved!`, produces, ingredients);
  localStorage.setItem("recipes", JSON.stringify(recipes));

  const saved = localStorage.getItem("recipes");
  if (saved) {
    Object.assign(recipes, JSON.parse(saved));
  }

  // Add to craftItem dropdown
  const select = document.getElementById("craftItem");
  const optionExists = Array.from(select.options).some((opt) => opt.value === name);
  if (!optionExists) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  }

  // Reset form
  document.getElementById("itemName").value = "";
  document.getElementById("produces").value = 1;
  document.getElementById("ingredients").innerHTML =
    '<h3>Ingredients</h3><div class="ingredient"><input type="text" placeholder="Ingredient name"><input type="number" placeholder="Amount" min="1" value="1"></div>';
}

function calculate() {
  const item = document.getElementById("craftItem").value.trim();
  const qty = parseInt(document.getElementById("craftQty").value, 10);
  if (!item || qty < 1) return;

  const tree = expand(item, qty);
  const flatTotals = flatten(tree);

  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML =
    "<h3>Totals:</h3><ul>" +
    Object.entries(flatTotals)
      .map(([k, v]) => `<li>${v} × ${k}</li>`)
      .join("") +
    "</ul><h3>Breakdown:</h3><ul>" +
    renderTree(tree) +
    "</ul>";
}

function expand(item, qty) {
  if (!recipes[item]) {
    // Base material
    return { name: item, qty: qty, children: [] };
  }

  const { produces, ingredients } = recipes[item];
  const crafts = Math.ceil(qty / produces); // how many times we must craft this
  const actualQty = crafts * produces; // actual produced qty (could overshoot)

  const children = [];
  for (let ing in ingredients) {
    const need = ingredients[ing] * crafts; // total ingredient requirement
    children.push(expand(ing, need));
  }

  return { name: item, qty: actualQty, children };
}

function flatten(node, totals = {}) {
  if (node.children.length === 0) {
    totals[node.name] = (totals[node.name] || 0) + node.qty;
  } else {
    node.children.forEach((child) => flatten(child, totals));
  }
  return totals;
}

function renderTree(node) {
  let html = `<li>${node.qty} × ${node.name}`;
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
