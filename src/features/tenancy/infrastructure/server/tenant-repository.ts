import { createServiceSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { tenantRowSchema, toTenant } from '../../application/tenant-schema'
import type { Tenant } from '../../domain/tenant'

const PUBLIC_COLUMNS = 'id, slug, name, status, default_locale, timezone'

/**
 * Resolves the tenant behind a slug before the visitor has a session, so it
 * reads only public branding metadata. It grants nothing: every operational
 * read still goes through the user's own client under RLS.
 */
export async function findTenantBySlug(slug: string): Promise<Tenant | null> {
  const { data, error } = await createServiceSupabaseClient()
    .from('tenants')
    .select(PUBLIC_COLUMNS)
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new Error(`tenant_lookup_failed:${error.code}`)
  if (!data) return null

  return toTenant(tenantRowSchema.parse(data))
}
