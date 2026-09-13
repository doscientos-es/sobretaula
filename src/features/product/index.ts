export { calculateRecipeCost, ALLERGENS } from './domain/product-costing'
export type { Allergen, RecipeCost, RecipeIngredient } from './domain/product-costing'
export { calculateRecipeAvailability, calculateStock, findLowStock } from './domain/inventory'
export { validateDeliveryNoteLines } from './domain/delivery-notes'
export { buildPurchaseRecommendation } from './domain/purchase-recommendation'
export { canAdvancePurchaseOrder, validatePurchaseOrderLines } from './domain/purchase-order'
export type { PurchaseOrderLine, PurchaseOrderStatus } from './domain/purchase-order'
export type { DeliveryNoteLineInput } from './domain/delivery-notes'
export {
  addInventoryMovement,
  createDeliveryNote,
  createIngredient,
  createPurchaseOrder,
  createSupplier,
  getInventory,
  getRecipeCost,
  listIngredients,
  listPurchaseOrders,
  listSuppliers,
  listRecipeVersions,
  replaceRecipe,
  receiveDeliveryNote,
  updatePurchaseOrderStatus,
  restoreRecipeVersion,
} from './application/product'
