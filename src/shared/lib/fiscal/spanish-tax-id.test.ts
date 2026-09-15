import { describe, expect, it } from 'vitest'

import { isValidSpanishTaxId, normalizeSpanishTaxId } from './spanish-tax-id'

describe('Spanish tax identifiers', () => {
  it('normalizes separators and casing', () => {
    expect(normalizeSpanishTaxId(' b-123 45674 ')).toBe('B12345674')
  })

  it.each(['12345678Z', 'X1234567L', 'Y1234567X', 'B12345674', 'P1234567D'])(
    'accepts valid identifier %s',
    (taxId) => expect(isValidSpanishTaxId(taxId)).toBe(true),
  )

  it.each(['12345678A', 'X1234567A', 'B12345678', 'P12345674', 'I12345674', '1234567Z'])(
    'rejects invalid identifier %s',
    (taxId) => expect(isValidSpanishTaxId(taxId)).toBe(false),
  )
})
