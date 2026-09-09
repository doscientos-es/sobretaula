import { describe, expect, it } from 'vitest'

import { canAccessTenantRoute } from './tenant-route-access'

describe('tenant route access', () => {
  it.each(['owner', 'manager', 'accountant'] as const)(
    'allows %s into the administrative workspace',
    (role) => expect(canAccessTenantRoute(role, 'administration')).toBe(true),
  )

  it.each(['host', 'waiter'] as const)('keeps %s out of administration', (role) => {
    expect(canAccessTenantRoute(role, 'administration')).toBe(false)
  })

  it.each(['owner', 'manager', 'host', 'waiter'] as const)('allows %s into operations', (role) =>
    expect(canAccessTenantRoute(role, 'operations')).toBe(true),
  )

  it('restricts table accounts and venue creation to their existing editor roles', () => {
    expect(canAccessTenantRoute('host', 'table_account')).toBe(false)
    expect(canAccessTenantRoute('waiter', 'table_account')).toBe(true)
    expect(canAccessTenantRoute('accountant', 'venue_management')).toBe(false)
    expect(canAccessTenantRoute('manager', 'venue_management')).toBe(true)
  })
})
