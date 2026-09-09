import { describe, expect, it } from 'vitest'

import { filterPlatformTenants } from './platform-tenant-directory'

const tenants = [
  {
    createdAt: '2026-01-01T00:00:00.000Z',
    id: 'tenant-1',
    name: 'Bistró Norte',
    slug: 'bistro-norte',
    status: 'active' as const,
    subscription: { nextPaymentOn: null, planName: 'Estándar', status: 'active' as const },
  },
  {
    createdAt: '2026-03-01T00:00:00.000Z',
    id: 'tenant-2',
    name: 'Casa Alba',
    slug: 'casa-alba',
    status: 'suspended' as const,
    subscription: { nextPaymentOn: null, planName: 'Estándar', status: 'past_due' as const },
  },
  {
    createdAt: '2026-02-01T00:00:00.000Z',
    id: 'tenant-3',
    name: 'Mar y Sol',
    slug: 'mar-sol',
    status: 'trial' as const,
    subscription: null,
  },
]

describe('filterPlatformTenants', () => {
  it('searches by restaurant name and tenant slug', () => {
    expect(
      filterPlatformTenants(tenants, {
        order: 'newest',
        query: 'mar-sol',
        status: 'all',
        subscription: 'all',
      }).map((tenant) => tenant.slug),
    ).toEqual(['mar-sol'])
  })

  it('combines status and subscription filters before sorting', () => {
    expect(
      filterPlatformTenants(tenants, {
        order: 'name_asc',
        query: '',
        status: 'suspended',
        subscription: 'past_due',
      }).map((tenant) => tenant.name),
    ).toEqual(['Casa Alba'])
  })

  it('can show tenants without a subscription and order them by oldest first', () => {
    expect(
      filterPlatformTenants(tenants, {
        order: 'oldest',
        query: '',
        status: 'all',
        subscription: null,
      }).map((tenant) => tenant.slug),
    ).toEqual(['mar-sol'])
  })
})
