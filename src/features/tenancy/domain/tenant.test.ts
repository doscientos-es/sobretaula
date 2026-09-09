import { describe, expect, it } from 'vitest'

import { isTenantAdministrator, isTenantOperational } from './tenant'

describe('isTenantOperational', () => {
  it('lets trial and active tenants operate', () => {
    expect(isTenantOperational('trial')).toBe(true)
    expect(isTenantOperational('active')).toBe(true)
  })

  it('stops suspended tenants', () => {
    expect(isTenantOperational('suspended')).toBe(false)
  })
})

describe('isTenantAdministrator', () => {
  it.each(['owner', 'manager', 'accountant'] as const)(
    'classifies %s as administrative',
    (role) => {
      expect(isTenantAdministrator(role)).toBe(true)
    },
  )

  it.each(['host', 'waiter'] as const)('classifies %s as operational', (role) => {
    expect(isTenantAdministrator(role)).toBe(false)
  })
})
