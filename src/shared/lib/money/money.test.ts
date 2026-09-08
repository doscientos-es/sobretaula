import { describe, expect, it } from 'vitest'

import { assertMinorUnits, formatMoney } from './money'

describe('assertMinorUnits', () => {
  it('rejects fractional amounts', () => {
    expect(() => assertMinorUnits(12.5)).toThrow()
  })

  it('accepts integers', () => {
    expect(assertMinorUnits(1250)).toBe(1250)
  })
})

describe('formatMoney', () => {
  it('renders euros from minor units', () => {
    expect(formatMoney(1250, 'es').replace(/\u00a0/g, ' ')).toBe('12,50 €')
  })
})
