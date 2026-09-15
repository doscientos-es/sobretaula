export interface PurchaseRecommendationInput {
  ingredientId: string
  ingredientName: string
  stock: number
  minimumStock: number
  unitCostCents: number
}

export function buildPurchaseRecommendation(input: PurchaseRecommendationInput) {
  const target = input.minimumStock
  const quantity = Math.max(0, target - input.stock)
  return {
    ...input,
    quantity,
    estimatedCostCents: Math.round(quantity * input.unitCostCents),
    reason: input.stock < input.minimumStock ? 'below_minimum' : 'none',
  } as const
}
