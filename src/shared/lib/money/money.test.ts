import { describe, expect, it } from 'vitest'

import { assertMinorUnits, formatMoney, parsePriceToCents } from './money'

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

describe('parsePriceToCents', () => {
  it('parses euros with comma or dot decimals', () => {
    expect(parsePriceToCents('12,50')).toBe(1250)
    expect(parsePriceToCents('12.50')).toBe(1250)
    expect(parsePriceToCents('8')).toBe(800)
    expect(parsePriceToCents('0,95')).toBe(95)
  })

  it('rejects invalid or overflowing amounts', () => {
    expect(parsePriceToCents('')).toBeNull()
    expect(parsePriceToCents('-3')).toBeNull()
    expect(parsePriceToCents('1,234')).toBeNull()
    expect(parsePriceToCents('abc')).toBeNull()
    expect(parsePriceToCents('20000')).toBeNull()
  })
})
