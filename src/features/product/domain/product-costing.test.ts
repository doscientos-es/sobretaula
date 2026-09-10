import { describe, expect, it } from 'vitest'
import { calculateRecipeCost } from './product-costing'
describe('recipe costing', () => {
  it('includes waste and explains allergens by ingredient', () => {
    expect(calculateRecipeCost([
      { name: 'Pan', quantity: 100, costCentsPerUnit: 0.02, wastePercent: 10, allergens: ['gluten'], isVegan: true },
      { name: 'Queso', quantity: 20, costCentsPerUnit: 0.5, wastePercent: 0, allergens: ['milk'], isVegan: false },
    ])).toEqual({ costCents: 12, isVegan: false, allergens: [{ name: 'gluten', reasons: ['Pan'] }, { name: 'milk', reasons: ['Queso'] }] })
  })
})
