import { describe, expect, it } from 'vitest'

import { forecastDemand, forecastIngredientDemand } from './forecast'

describe('forecastDemand', () => {
  it('uses the greater of history and confirmed reservations', () => {
    const result = forecastDemand(
      [
        { date: 'a', covers: 20, salesCents: 50000 },
        { date: 'b', covers: 24, salesCents: 60000 },
      ],
      30,
      2500,
    )
    expect(result.expectedCovers).toBe(30)
    expect(result.expectedSalesCents).toBe(75000)
    expect(result.confidence).toBe('medium')
  })

  it('reports low confidence when there is no history', () => {
    expect(forecastDemand([], 8).confidence).toBe('low')
  })

  it('projects ingredient usage from the historical recipe mix', () => {
    expect(forecastIngredientDemand(10, [{ ingredientId: 'tomato', quantity: 20 }], 25)).toEqual({
      tomato: 50,
    })
  })
})
