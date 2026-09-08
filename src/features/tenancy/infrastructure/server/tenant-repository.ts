import { createAnonSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { tenantRowSchema, toTenant } from '../../application/tenant-schema'
import type { Tenant } from '../../domain/tenant'

/**
 * Resolves the tenant behind a slug before the visitor has a session. The RPC
 * exposes only public branding metadata for an exact slug, so it grants
 * nothing: every operational read still goes through the user's own client
 * under RLS.
 */
export async function findTenantBySlug(slug: string): Promise<Tenant | null> {
  const { data, error } = await createAnonSupabaseClient()
    .rpc('tenant_public_by_slug', { p_slug: slug })
    .maybeSingle()

  if (error) throw new Error(`tenant_lookup_failed:${error.code}`)
  if (!data) return null

  return toTenant(tenantRowSchema.parse(data))
}
