export { calculateRecipeCost, ALLERGENS } from './domain/product-costing'
export type { Allergen, RecipeCost, RecipeIngredient } from './domain/product-costing'
export { calculateStock, findLowStock } from './domain/inventory'
export {
  addInventoryMovement,
  createIngredient,
  getInventory,
  getRecipeCost,
  listIngredients,
  listRecipeVersions,
  replaceRecipe,
  restoreRecipeVersion,
} from './application/product'
