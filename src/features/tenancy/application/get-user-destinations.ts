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

/** Avoids resolving tenant memberships for platform operators. */
export async function resolveUserDestinations(
  isPlatformMember: boolean,
  loadTenants: () => Promise<readonly UserTenantDestination[]>,
): Promise<UserDestinations> {
  if (isPlatformMember) return { isPlatformMember: true, tenants: [] }

  return { isPlatformMember: false, tenants: await loadTenants() }
}

/** Reads only the current principal's active memberships under RLS. */
export const getUserDestinations = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<UserDestinations> => {
    const supabase = createRequestSupabaseClient(context.principal.accessToken)
    const platformMemberResult = await supabase
      .from('platform_members')
      .select('user_id')
      .eq('user_id', context.principal.userId)
      .maybeSingle()
    if (platformMemberResult.error) {
      throw new Error('user_destinations_load_failed')
    }

    return resolveUserDestinations(platformMemberResult.data !== null, async () => {
      const membershipsResult = await supabase
        .from('memberships')
        .select('tenants!inner(name, slug)')
        .eq('user_id', context.principal.userId)
        .eq('status', 'active')
      if (membershipsResult.error) throw new Error('user_destinations_load_failed')

      // The Supabase client has no generated `Database` schema, so postgrest-js
      // cannot infer that `memberships.tenant_id` is a to-one relation and
      // widens the embedded `tenants` type to an array. At runtime Supabase
      // still returns a single joined object per row, hence the cast below.
      type MembershipTenantRow = { tenants: { name: string; slug: string } | null }

      return ((membershipsResult.data ?? []) as unknown as MembershipTenantRow[])
        .map((membership) => membership.tenants)
        .filter((tenant): tenant is { name: string; slug: string } => tenant != null)
        .sort((first, second) => first.name.localeCompare(second.name))
    })
  })
