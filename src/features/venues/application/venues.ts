import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'
import { isValidVenueSlug } from '@/shared/lib/tenant/venue-slug'

import type { Venue } from '../domain/venue'

const tenantInput = z.object({ tenantId: z.string().uuid() })
const createVenueInput = tenantInput.extend({
  name: z.string().trim().min(1).max(120),
  slug: z.string().refine(isValidVenueSlug, { message: 'invalid_venue_slug' }),
})

function requireManager(role: string): void {
  if (role !== 'owner' && role !== 'manager') throw new Response('Forbidden', { status: 403 })
}

/** Lists only the locals the caller can reach: RLS applies the venue filter. */
export const getTenantVenues = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(tenantInput)
  .handler(async ({ context, data }): Promise<Venue[]> => {
    const { data: venues, error } = await createRequestSupabaseClient(
      context.tenantMembership.accessToken,
    )
      .from('venues')
      .select('id, is_active, name, slug')
      .eq('tenant_id', data.tenantId)
      .eq('is_active', true)
      .order('name')
    if (error) throw new Error(`venues_load_failed:${error.code}`)
    return (venues ?? []).map((venue) => ({
      id: venue.id,
      isActive: venue.is_active,
      name: venue.name,
      slug: venue.slug,
    }))
  })

/** Each extra local adds a fixed monthly amount, so only owners may add one. */
export const createVenue = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(createVenueInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const { data: venue, error } = await createRequestSupabaseClient(
      context.tenantMembership.accessToken,
    )
      .from('venues')
      .insert({ name: data.name, slug: data.slug, tenant_id: data.tenantId })
      .select('id, slug')
      .single()
    if (error?.code === '23505') throw new Response('Slug already used', { status: 409 })
    if (error || !venue) throw new Error(`venue_create_failed:${error?.code ?? 'unknown'}`)
    return { slug: venue.slug, venueId: venue.id }
  })
