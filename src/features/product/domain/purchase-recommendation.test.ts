import { describe, expect, it } from 'vitest'

import { buildPurchaseRecommendation } from './purchase-recommendation'

describe('buildPurchaseRecommendation', () => {
  it('covers forecast demand and minimum stock', () => {
    expect(
      buildPurchaseRecommendation({
        ingredientId: 'i',
        ingredientName: 'Tomate',
        stock: 4,
        minimumStock: 10,
        unitCostCents: 150,
      }),
    ).toMatchObject({ quantity: 16, estimatedCostCents: 2400, reason: 'below_minimum' })
  })

  it('does not recommend when stock covers the target', () => {
    expect(
      buildPurchaseRecommendation({
        ingredientId: 'i',
        ingredientName: 'Sal',
        stock: 20,
        minimumStock: 5,
        unitCostCents: 100,
      }).quantity,
    ).toBe(0)
  })
})
