import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from './require-tenant-membership'

const setupStatusInput = z.object({
  tenantId: z.string().uuid(),
  venueIds: z.array(z.string().uuid()).default([]),
})

export interface TenantSetupStatus {
  hasTeam: boolean
  hasFloorPlan: boolean
  hasMenu: boolean
  hasReservations: boolean
  hasVenue: boolean
}

export const getTenantSetupStatus = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(setupStatusInput)
  .handler(async ({ context, data }): Promise<TenantSetupStatus> => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const venueFilter = data.venueIds.length
      ? data.venueIds
      : ['00000000-0000-0000-0000-000000000000']
    const [team, categories, items, areas, tables, services] = await Promise.all([
      supabase
        .from('memberships')
        .select('user_id', { count: 'exact', head: true })
        .eq('tenant_id', data.tenantId),
      supabase
        .from('menu_categories')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', data.tenantId),
      supabase
        .from('menu_items')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', data.tenantId)
        .eq('is_active', true),
      supabase
        .from('areas')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', data.tenantId)
        .in('venue_id', venueFilter),
      supabase
        .from('tables')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', data.tenantId)
        .in('venue_id', venueFilter),
      supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', data.tenantId)
        .in('venue_id', venueFilter)
        .eq('is_active', true),
    ])
    const failed = [team, categories, items, areas, tables, services].find((result) => result.error)
    if (failed?.error) throw new Error(`tenant_setup_status_failed:${failed.error.code}`)
    return {
      // The owner is created during onboarding; this step is complete only
      // when at least one operational teammate has been invited.
      hasTeam: (team.count ?? 0) > 1,
      hasFloorPlan: (areas.count ?? 0) > 0 && (tables.count ?? 0) > 0,
      hasMenu: (categories.count ?? 0) > 0 && (items.count ?? 0) > 0,
      hasReservations: (services.count ?? 0) > 0,
      hasVenue: data.venueIds.length > 0,
    }
  })
