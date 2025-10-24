# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a pure client-side crafting calculator application built with vanilla HTML, CSS, and JavaScript. It allows users to define recipes dynamically in the browser, calculate resource requirements for crafting items, and view both flat totals and hierarchical breakdowns.

## Architecture

The application follows a simple three-file structure:

- **index.html**: Single-page application with forms for adding recipes and calculating crafts
- **app.js**: All application logic including recipe storage, calculation engine, and DOM manipulation
- **styles.css**: Styling with card-based layout and responsive design

### Core Data Structures

- `recipes` object: In-memory storage of custom recipes, persisted to localStorage
- `gameRecipes` object: In-memory storage of loaded game recipe packs
- `variantPreferences` object: Stores user's selected variant per recipe, persisted to localStorage
- Recipe format (single): `{ produces: number, ingredients: { [name]: amount }, metadata?: {...} }`
- Recipe format (variants): `{ variants: [{ name: string, produces: number, ingredients: {...}, metadata?: {...} }] }`
- Tree structure: Recursive expansion creates `{ name, qty, children[], variantName, ... }` nodes

### Recipe Variants

Recipes can have multiple variants (e.g., different crafting methods for the same item). When a recipe has variants:
- All variants are displayed in the stored recipes list
- A variant selector appears in the Craft card when selecting items with multiple variants
- User preferences for variant selection are saved to localStorage
- The selected variant is used during recipe expansion and is shown in the calculation breakdown

### Key Functions

- `expand(item, qty)`: Recursively expands recipes into a tree structure using selected variants
- `flatten(tree)`: Converts tree to flat totals for base materials
- `calculate()`: Main entry point that orchestrates expansion and rendering
- `normalizeRecipe(recipe)`: Converts single recipes to variant format for consistent handling
- `getSelectedVariant(name, recipe)`: Returns the user's preferred variant or the first one
- Recipe management: `addRecipe()`, `updateCraftDropdown()`, `updateVariantSelector()`, `updateIngredientDatalist()`

## Development

Since this is a static client-side application:

- **Testing**: Open `index.html` directly in a browser
- **No build process**: Files can be edited and refreshed immediately
- **No dependencies**: Pure vanilla JavaScript, no package.json or build tools
- **Deployment**: Can be hosted on any static hosting service (GitHub Pages, Netlify, etc.)

## Data Persistence

Recipes are stored in browser localStorage as JSON. The application automatically saves and loads recipes on page refresh. No backend or database required.