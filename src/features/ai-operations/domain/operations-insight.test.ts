import { describe, expect, it } from 'vitest'

import { explainProfitability } from './operations-insight'
describe('explainProfitability', () => {
  it('explains verified cost drivers', () => {
    const result = explainProfitability({
      period: 'Semana 37',
      salesCents: 100000,
      marginPercent: 42,
      foodCostCents: 40000,
      wasteCostCents: 2500,
      laborCostCents: 36000,
      laborCostAvailable: true,
    })
    expect(result.answer).toContain('coste de producto')
    expect(result.sources).toContain('fichajes y tarifas')
    expect(result.confidence).toBe('high')
  })
})
