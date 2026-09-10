import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { createServiceSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

const slugInput = z.object({ slug: z.string().trim().min(2).max(50) })

export interface LegalIdentity {
  address: string
  email: string
  legalName: string
  taxId: string
}

/**
 * Deliberately exposes only the identity that a restaurant must publish with
 * its public booking flow. It never returns customer, reservation or payment
 * information.
 */
export const getRestaurantLegalIdentity = createServerFn({ method: 'GET' })
  .validator(slugInput)
  .handler(async ({ data }): Promise<LegalIdentity | null> => {
    const supabase = createServiceSupabaseClient()
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', data.slug)
      .maybeSingle()
    if (tenantError) throw new Error(`restaurant_legal_tenant_load_failed:${tenantError.code}`)
    if (!tenant) return null

    const { data: customer, error } = await supabase
      .from('platform_billing_customers')
      .select('address_line, city, email, legal_name, postal_code, tax_id')
      .eq('tenant_id', tenant.id)
      .maybeSingle()
    if (error) throw new Error(`restaurant_legal_identity_load_failed:${error.code}`)
    if (!customer) return null

    return {
      address: `${customer.address_line}, ${customer.postal_code} ${customer.city}`,
      email: customer.email,
      legalName: customer.legal_name,
      taxId: customer.tax_id,
    }
  })

export const getPlatformLegalIdentity = createServerFn({ method: 'GET' }).handler(
  async (): Promise<LegalIdentity | null> => {
    const supabase = createServiceSupabaseClient()
    const { data, error } = await supabase
      .from('platform_fiscal_settings')
      .select('address_line, city, issuer_nif, legal_name, postal_code')
      .eq('id', true)
      .maybeSingle()
    if (error) throw new Error(`platform_legal_identity_load_failed:${error.code}`)
    if (!data) return null
    const email = process.env.LEGAL_CONTACT_EMAIL
    if (!email) return null

    return {
      address: `${data.address_line}, ${data.postal_code} ${data.city}`,
      email,
      legalName: data.legal_name,
      taxId: data.issuer_nif,
    }
  },
)
