# Crafting Calculator

A lightweight, generic crafting calculator that works for *any* game or project. Define your own recipes ad‑hoc in the browser, calculate base resources needed, and see both a hierarchical breakdown and flattened totals.

This project runs entirely client‑side (HTML, CSS, JavaScript) — no backend, no database, no sign‑in. Just open the page, add recipes, and calculate.

## Features

* Add recipes on the fly (name, quantity produced, ingredients)
* Craft calculator with recursive expansion of components
* Totals view for base materials
* Tree breakdown view for nested recipes
* Works fully offline in your browser
* Can be hosted easily on **GitHub Pages** (free)

## Usage

1. Clone or fork this repo.
2. Open `index.html` in a browser.
3. Add recipes using the form.
4. Enter the item you want to craft and the quantity.
5. View required base resources and the breakdown.

## Example Recipe (The Alters)

* **Polymers** → produces 10 from 20 Organics + 20 Minerals
* **Bridge Anchor** → produces 1 from 20 Metals + 20 Polymers

Crafting 4 Bridge Anchors → requires **80 Metals, 160 Organics, 160 Minerals**.

## Tech

* Pure HTML, CSS, and JavaScript
* No dependencies
* Works in any modern browser
