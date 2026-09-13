export interface PurchaseRecommendationInput {
  ingredientId: string
  ingredientName: string
  stock: number
  minimumStock: number
  forecastDemand: number
  unitCostCents: number
}

export function buildPurchaseRecommendation(input: PurchaseRecommendationInput) {
  const target = Math.max(input.minimumStock, input.forecastDemand)
  const quantity = Math.max(0, target - input.stock)
  return {
    ...input,
    quantity,
    estimatedCostCents: Math.round(quantity * input.unitCostCents),
    reason:
      input.stock < input.minimumStock
        ? 'below_minimum'
        : input.stock < input.forecastDemand
          ? 'forecast_demand'
          : 'none',
  } as const
}
