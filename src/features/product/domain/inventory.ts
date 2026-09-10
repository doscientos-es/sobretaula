export interface InventoryMovement { ingredientId: string; quantity: number }
export interface InventoryMinimum { ingredientId: string; minimum: number }
export function calculateStock(movements: readonly InventoryMovement[]): Readonly<Record<string, number>> {
  const stock: Record<string, number> = {}
  for (const movement of movements) stock[movement.ingredientId] = (stock[movement.ingredientId] ?? 0) + movement.quantity
  return stock
}

export function findLowStock(stock: Readonly<Record<string, number>>, minimums: readonly InventoryMinimum[]): string[] {
  return minimums.filter((item) => (stock[item.ingredientId] ?? 0) < item.minimum).map((item) => item.ingredientId)
}
