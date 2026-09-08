import { describe, expect, it } from 'vitest'

import { isTenantOperational } from './tenant'

describe('isTenantOperational', () => {
  it('lets trial and active tenants operate', () => {
    expect(isTenantOperational('trial')).toBe(true)
    expect(isTenantOperational('active')).toBe(true)
  })

  it('stops suspended tenants', () => {
    expect(isTenantOperational('suspended')).toBe(false)
  })
})
