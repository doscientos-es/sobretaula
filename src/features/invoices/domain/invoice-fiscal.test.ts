import { describe, expect, it } from 'vitest'

import { isValidSeriesCode, normalizeSeriesCode, validateFiscalSettings } from './fiscal-settings'
import {
  buildFullNumber,
  canIssueInvoices,
  groupVatTotals,
  isValidNifFormat,
  normalizeNif,
  sumVatBreakdowns,
} from './invoice'

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
    // 1210 -> net 1000/vat 210; 1000 -> net 826/vat 174
    expect(twentyOne).toEqual({ net: 1826, rateBps: 2100, vat: 384 })
    const totals = sumVatBreakdowns(breakdowns)
    expect(totals.net).toBe(2017)
    expect(totals.vat).toBe(403)
    expect(totals.gross).toBe(2420)
  })

  it('handles zero-rated lines', () => {
    const totals = sumVatBreakdowns(
      groupVatTotals([{ quantity: 3, unitPriceCents: 100, vatRateBps: 0 }]),
    )
    expect(totals).toEqual({ gross: 300, net: 300, vat: 0 })
  })
})

describe('canIssueInvoices', () => {
  it('blocks without settings and production while the AEAT adapter is unavailable', () => {
    expect(canIssueInvoices(null)).toBe(false)
    expect(canIssueInvoices({ environment: 'prod' })).toBe(false)
    expect(canIssueInvoices({ environment: 'test' })).toBe(true)
  })
})

describe('validateFiscalSettings', () => {
  const base = {
    addressLine: 'C/ Mayor 1',
    city: 'Valencia',
    countryCode: 'es',
    issuerNif: ' b12345678 ',
    legalName: 'La Terrassa SL',
    postalCode: '46001',
  }

  it('normalizes the fields it accepts', () => {
    const settings = validateFiscalSettings(base)
    expect(settings.issuerNif).toBe('B12345678')
    expect(settings.countryCode).toBe('ES')
    expect(settings.environment).toBe('prod')
  })

  it('rejects wrong NIF, postal code or empty name', () => {
    expect(() => validateFiscalSettings({ ...base, issuerNif: 'BAD' })).toThrow(
      'fiscal_settings_invalid_nif',
    )
    expect(() => validateFiscalSettings({ ...base, postalCode: '4600' })).toThrow(
      'fiscal_settings_invalid_postal_code',
    )
    expect(() => validateFiscalSettings({ ...base, legalName: '   ' })).toThrow(
      'fiscal_settings_invalid_legal_name',
    )
  })
})
