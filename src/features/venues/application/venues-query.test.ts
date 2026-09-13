import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { tenantBySlugQuery } from '@/features/tenancy/application/get-tenant-by-slug'

import { loadVenueRouteContext, tenantVenuesQuery } from './venues'

const tenant = {
  defaultLocale: 'es' as const,
  id: '00000000-0000-4000-8000-000000000001',
  name: 'La Fonda',
  slug: 'la-fonda',
  status: 'active' as const,
  timezone: 'Europe/Madrid',
}
const venue = {
  id: '00000000-0000-4000-8000-000000000002',
  isActive: true,
  name: 'Principal',
  slug: 'principal',
}

describe('venue route context cache', () => {
  it('uses the tenant and venue list already loaded by the parent route', async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(tenantBySlugQuery(tenant.slug).queryKey, tenant)
    queryClient.setQueryData(tenantVenuesQuery(tenant.id).queryKey, [venue])

    await expect(loadVenueRouteContext(queryClient, tenant.slug, venue.slug)).resolves.toEqual({
      tenant,
      venue,
    })
  })

  it('keeps the venue list cached for five minutes per tenant', () => {
    const query = tenantVenuesQuery(tenant.id)

    expect(query.queryKey).toEqual(['tenant', tenant.id, 'venues'])
    expect(query.staleTime).toBe(5 * 60_000)
  })
})
