import { describe, expect, it } from 'vitest'

import { buildFullNumber, groupVatTotals, invoiceIssueBlocker, isValidNifFormat, normalizeNif, sumVatBreakdowns } from './invoice'
import { isValidSeriesCode, normalizeSeriesCode, validateFiscalSettings } from './fiscal-settings'

describe('normalizeNif / isValidNifFormat', () => {
  it('trims, uppercases and strips separators', () => {
    expect(normalizeNif(' b-12345678 ')).toBe('B12345678')
  })

  it('accepts 9 alphanumeric characters and nothing else', () => {
    expect(isValidNifFormat('B12345678')).toBe(true)
    expect(isValidNifFormat('B1234567')).toBe(false)
    expect(isValidNifFormat('12345678Z')).toBe(true)
  })
})

describe('series code', () => {
  it('normalizes and validates against the database pattern', () => {
    expect(normalizeSeriesCode(' a-2026 ')).toBe('A-2026')
    expect(isValidSeriesCode('A-2026')).toBe(true)
    expect(isValidSeriesCode('SERIE LARGA')).toBe(false)
  })
})

describe('buildFullNumber', () => {
  it('pads the number within the year', () => {
    expect(buildFullNumber('A-2026', 2026, 42)).toBe('A-2026-2026/000042')
  })
})

describe('groupVatTotals', () => {
  it('groups VAT-included lines by rate with per-rate net and vat', () => {
    const breakdowns = groupVatTotals([
      { quantity: 1, unitPriceCents: 1210, vatRateBps: 2100 },
      { quantity: 2, unitPriceCents: 105, vatRateBps: 1000 },
      { quantity: 1, unitPriceCents: 1000, vatRateBps: 2100 },
    ])
    expect(breakdowns).toHaveLength(2)
    const ten = breakdowns.find((item) => item.rateBps === 1000)
    const twentyOne = breakdowns.find((item) => item.rateBps === 2100)
    expect(ten).toEqual({ net: 191, rateBps: 1000, vat: 19 })
    expect(twentyOne?.net).toBe(2120 + 1000 - 1) // 3119
    expect(twentyOne?.vat).toBe(1 + 210) // 211
    const totals = sumVatBreakdowns(breakdowns)
    expect(totals.net).toBe(3310)
    expect(totals.vat).toBe(230)
    expect(totals.gross).toBe(3540)
  })

  it('handles zero-rated lines', () => {
    const totals = sumVatBreakdowns(groupVatTotals([{ quantity: 3, unitPriceCents: 100, vatRateBps: 0 }]))
    expect(totals).toEqual({ gross: 300, net: 300, vat: 0 })
  })
})

describe('invoiceIssueBlocker', () => {
  it('blocks without settings and in prod (MVP is test-only)', () => {
    expect(invoiceIssueBlocker(null)).toBe('fiscal_settings_missing')
    expect(invoiceIssueBlocker({ environment: 'prod' })).toBe('prod_not_enabled')
    expect(invoiceIssueBlocker({ environment: 'test' })).toBeNull()
  })
})

describe('validateFiscalSettings', () => {
  const base = {
    addressLine: 'C/ Mayor 1',
    city: 'Valencia',
    countryCode: 'es',
    environment: 'test' as const,
    issuerNif: ' b12345678 ',
    legalName: 'La Terrassa SL',
    postalCode: '46001',
  }

  it('normalizes the fields it accepts', () => {
    const settings = validateFiscalSettings(base)
    expect(settings.issuerNif).toBe('B12345678')
    expect(settings.countryCode).toBe('ES')
  })

  it('rejects wrong NIF, postal code or empty name', () => {
    expect(() => validateFiscalSettings({ ...base, issuerNif: 'BAD' })).toThrow('fiscal_settings_invalid_nif')
    expect(() => validateFiscalSettings({ ...base, postalCode: '4600' })).toThrow('fiscal_settings_invalid_postal_code')
    expect(() => validateFiscalSettings({ ...base, legalName: '   ' })).toThrow('fiscal_settings_invalid_legal_name')
  })
})
