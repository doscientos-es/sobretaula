import { describe, expect, it } from 'vitest'

import { resolveTenantSlug } from './resolve-tenant-slug'

describe('resolveTenantSlug', () => {
  it('reads the slug from the /t/:slug prefix', () => {
    expect(resolveTenantSlug({ pathname: '/t/can-pere/reservas' })).toBe('can-pere')
  })

  it('ignores paths outside the tenant prefix', () => {
    expect(resolveTenantSlug({ pathname: '/admin/tenants' })).toBeNull()
    expect(resolveTenantSlug({ pathname: '/' })).toBeNull()
  })

  it('rejects an invalid slug even under the tenant prefix', () => {
    expect(resolveTenantSlug({ pathname: '/t/-nope' })).toBeNull()
  })
})
