import { describe, expect, it } from 'vitest'

import { calculateRecipeAvailability, calculateStock, findLowStock } from './inventory'
describe('inventory', () => {
  it('derives stock from immutable movements', () => {
    expect(
      calculateStock([
        { ingredientId: 'a', quantity: 10 },
        { ingredientId: 'a', quantity: -2.5 },
        { ingredientId: 'b', quantity: 4 },
      ]),
    ).toEqual({ a: 7.5, b: 4 })
  })
  it('flags only ingredients below their configured minimum', () => {
    expect(
      findLowStock({ a: 2, b: 10 }, [
        { ingredientId: 'a', minimum: 3 },
        { ingredientId: 'b', minimum: 5 },
      ]),
    ).toEqual(['a'])
  })
  it('calculates sellable portions and limiting ingredients per recipe', () => {
    expect(
      calculateRecipeAvailability(
        { bread: 10, cheese: 3 },
        {
          sandwich: [
            { ingredientId: 'bread', quantity: 2 },
            { ingredientId: 'cheese', quantity: 1 },
          ],
        },
      ),
    ).toEqual({ sandwich: { maxPortions: 3, limitingIngredientIds: ['cheese'] } })
  })
})
