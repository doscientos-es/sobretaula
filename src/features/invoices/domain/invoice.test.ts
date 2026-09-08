import { describe, expect, it } from 'vitest'

import { formatInvoiceReference, isInvoiceMutable } from './invoice'

describe('isInvoiceMutable', () => {
  it('only allows editing drafts', () => {
    expect(isInvoiceMutable('draft')).toBe(true)
    expect(isInvoiceMutable('issued')).toBe(false)
    expect(isInvoiceMutable('registered')).toBe(false)
  })
})

describe('formatInvoiceReference', () => {
  it('pads the correlative number', () => {
    expect(formatInvoiceReference('A', 7)).toBe('A/000007')
  })
})
