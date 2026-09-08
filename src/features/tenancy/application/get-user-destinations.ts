import { createServerFn } from '@tanstack/react-start'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

export interface UserTenantDestination {
  name: string
  slug: string
}

export interface UserDestinations {
  isPlatformMember: boolean
  tenants: readonly UserTenantDestination[]
}

/** Reads only the current principal's active memberships under RLS. */
export const getUserDestinations = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<UserDestinations> => {
    const supabase = createRequestSupabaseClient(context.principal.accessToken)
    const [membershipsResult, platformMemberResult] = await Promise.all([
      supabase
        .from('memberships')
        .select('tenants!inner(name, slug)')
        .eq('user_id', context.principal.userId)
        .eq('status', 'active'),
      supabase
        .from('platform_members')
        .select('user_id')
        .eq('user_id', context.principal.userId)
        .maybeSingle(),
    ])
    if (membershipsResult.error || platformMemberResult.error) {
      throw new Error('user_destinations_load_failed')
    }
    return {
      isPlatformMember: platformMemberResult.data !== null,
      tenants: (membershipsResult.data ?? [])
        .map((membership) => membership.tenants[0])
        .filter((tenant): tenant is { name: string; slug: string } => tenant !== null)
        .sort((first, second) => first.name.localeCompare(second.name)),
    }
  })
