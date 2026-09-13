import { describe, expect, it } from 'vitest'

import { calculateLaborCosts } from './labor-cost'

describe('calculateLaborCosts', () => {
  it('calculates hourly cost from effective minutes', () => {
    expect(
      calculateLaborCosts([{ employeeId: 'a', workedMinutes: 120, hourlyCostCents: 1200 }]),
    ).toMatchObject({ totalCostCents: 2400, costAvailable: true })
  })

  it('marks incomplete rates instead of guessing', () => {
    expect(
      calculateLaborCosts([{ employeeId: 'a', workedMinutes: 120, hourlyCostCents: null }])
        .costAvailable,
    ).toBe(false)
  })
})
