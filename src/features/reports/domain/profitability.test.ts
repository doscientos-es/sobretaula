import { describe, expect, it } from 'vitest'

import { calculateProfitability } from './profitability'

describe('calculateProfitability', () => {
  it('calculates net sales, costs and contribution', () => {
    const result = calculateProfitability({
      grossCents: 100_000,
      refundedCents: 5_000,
      discountsCents: 5_000,
      foodCostCents: 25_000,
      wasteCostCents: 2_000,
      laborCostCents: 10_000,
      laborCostAvailable: true,
      wasteMovements: 2,
      dataFrom: '2026-09-01T00:00:00.000Z',
      dataTo: '2026-09-02T00:00:00.000Z',
    })
    expect(result.netSalesCents).toBe(90_000)
    expect(result.totalCostCents).toBe(37_000)
    expect(result.estimatedContributionCents).toBe(53_000)
    expect(result.confidence).toBe('high')
  })

  it('does not pretend labor is known when it is unavailable', () => {
    const result = calculateProfitability({
      grossCents: 10_000,
      refundedCents: 0,
      discountsCents: 0,
      foodCostCents: 2_000,
      wasteCostCents: 0,
      laborCostCents: 0,
      laborCostAvailable: false,
      wasteMovements: 0,
      dataFrom: 'a',
      dataTo: 'b',
    })
    expect(result.confidence).toBe('medium')
    expect(result.recommendations.some((item) => item.kind === 'labor_data')).toBe(true)
  })
})
