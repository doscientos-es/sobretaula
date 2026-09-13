export interface InventoryMovement {
  ingredientId: string
  quantity: number
}
export interface InventoryMinimum {
  ingredientId: string
  minimum: number
}
export interface RecipeStockLine {
  ingredientId: string
  quantity: number
}

export function calculateRecipeAvailability(
  stock: Readonly<Record<string, number>>,
  recipes: Readonly<Record<string, readonly RecipeStockLine[]>>,
) {
  return Object.fromEntries(
    Object.entries(recipes).map(([menuItemId, lines]) => {
      if (lines.length === 0) return [menuItemId, { maxPortions: null, limitingIngredientIds: [] }]
      const capacities = lines.map((line) =>
        Math.max(0, Math.floor((stock[line.ingredientId] ?? 0) / line.quantity)),
      )
      const maxPortions = Math.min(...capacities)
      return [
        menuItemId,
        {
          maxPortions,
          limitingIngredientIds: lines
            .filter(
              (line) => Math.floor((stock[line.ingredientId] ?? 0) / line.quantity) === maxPortions,
            )
            .map((line) => line.ingredientId),
        },
      ]
    }),
  )
}
export function calculateStock(
  movements: readonly InventoryMovement[],
): Readonly<Record<string, number>> {
  const stock: Record<string, number> = {}
  for (const movement of movements)
    stock[movement.ingredientId] = (stock[movement.ingredientId] ?? 0) + movement.quantity
  return stock
}

export function findLowStock(
  stock: Readonly<Record<string, number>>,
  minimums: readonly InventoryMinimum[],
): string[] {
  return minimums
    .filter((item) => (stock[item.ingredientId] ?? 0) < item.minimum)
    .map((item) => item.ingredientId)
}
