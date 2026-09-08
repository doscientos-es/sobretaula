import { createServiceSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

export interface CertificateHandle {
  tenantId: string
  secretName: string
  notAfter: string
}

/**
 * Certificates are write-only from the application's point of view: the tenant
 * uploads a .pfx, it is stored encrypted, and only this Node runtime resolves
 * the handle when signing. The material never leaves the server (ADR-0005).
 */
export async function findCertificateHandle(tenantId: string): Promise<CertificateHandle | null> {
  const { data, error } = await createServiceSupabaseClient()
    .from('tenant_fiscal_settings')
    .select('tenant_id, certificate_secret_name, certificate_not_after')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw new Error(`certificate_lookup_failed:${error.code}`)
  if (!data?.certificate_secret_name) return null

  return {
    notAfter: data.certificate_not_after as string,
    secretName: data.certificate_secret_name as string,
    tenantId: data.tenant_id as string,
  }
}
