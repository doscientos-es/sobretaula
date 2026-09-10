import { describe, expect, it } from 'vitest'
import { cashDifferenceCents, expectedCashCents } from './cash-register'

describe('cash register totals', () => {
  it('reconciles float, cash sales and movements', () => {
    expect(expectedCashCents(1000, [{ kind: 'in', amountCents: 200 }, { kind: 'out', amountCents: 50 }], 3500)).toBe(4650)
  })
  it('reports overages and shortages with a signed difference', () => {
    expect(cashDifferenceCents(4650, 4600)).toBe(-50)
  })
})
