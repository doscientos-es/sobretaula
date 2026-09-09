import { describe, expect, it } from 'vitest'

import { canViewPlatformFiscalInvoices } from './platform-fiscal-invoice-access'

describe('platform fiscal invoice access', () => {
  it.each(['owner', 'manager', 'accountant'] as const)('permits tenant %s', (role) => {
    expect(canViewPlatformFiscalInvoices(role)).toBe(true)
  })

  it.each(['host', 'waiter'] as const)('denies non-administrative tenant %s', (role) => {
    expect(canViewPlatformFiscalInvoices(role)).toBe(false)
  })
})
