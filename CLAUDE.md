# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a pure client-side crafting calculator application built with vanilla HTML, CSS, and JavaScript. It allows users to define recipes dynamically in the browser, calculate resource requirements for crafting items, and view both flat totals and hierarchical breakdowns.

## Architecture

The application follows a simple three-file structure:

- **index.html**: Single-page application with forms for adding recipes and calculating crafts
- **script.js**: All application logic including recipe storage, calculation engine, and DOM manipulation
- **styles.css**: Styling with card-based layout and responsive design

### Core Data Structures

- `recipes` object: In-memory storage of all recipes, persisted to localStorage
- Recipe format: `{ produces: number, ingredients: { [name]: amount } }`
- Tree structure: Recursive expansion creates `{ name, qty, children[] }` nodes

### Key Functions

- `expand(item, qty)`: Recursively expands recipes into a tree structure
- `flatten(tree)`: Converts tree to flat totals for base materials
- `calculate()`: Main entry point that orchestrates expansion and rendering
- Recipe management: `addRecipe()`, `updateCraftDropdown()`, `updateIngredientDatalist()`

## Development

Since this is a static client-side application:

- **Testing**: Open `index.html` directly in a browser
- **No build process**: Files can be edited and refreshed immediately
- **No dependencies**: Pure vanilla JavaScript, no package.json or build tools
- **Deployment**: Can be hosted on any static hosting service (GitHub Pages, Netlify, etc.)

## Data Persistence

Recipes are stored in browser localStorage as JSON. The application automatically saves and loads recipes on page refresh. No backend or database required.