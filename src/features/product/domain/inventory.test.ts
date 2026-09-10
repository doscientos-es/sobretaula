import { describe, expect, it } from 'vitest'
import { calculateStock, findLowStock } from './inventory'
describe('inventory', () => {
  it('derives stock from immutable movements', () => {
    expect(calculateStock([{ ingredientId: 'a', quantity: 10 }, { ingredientId: 'a', quantity: -2.5 }, { ingredientId: 'b', quantity: 4 }])).toEqual({ a: 7.5, b: 4 })
  })
  it('flags only ingredients below their configured minimum', () => {
    expect(findLowStock({ a: 2, b: 10 }, [{ ingredientId: 'a', minimum: 3 }, { ingredientId: 'b', minimum: 5 }])).toEqual(['a'])
  })
})
