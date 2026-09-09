import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { tenantOnboardingInput } from './onboarding-schema'

const onboardingResult = z
  .array(z.object({ tenant_id: z.string().uuid(), tenant_slug: z.string() }))
  .length(1)

/** Creates the non-operational tenant and billing profile in the database RPC transaction. */
export const provisionTenantOnboarding = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(tenantOnboardingInput)
  .handler(async ({ context, data }) => {
    const { data: result, error } = await createRequestSupabaseClient(
      context.principal.accessToken,
    ).rpc('provision_tenant_onboarding', {
      p_address_line: data.addressLine,
      p_city: data.city,
      p_default_locale: data.defaultLocale,
      p_email: data.email,
      p_legal_name: data.legalName,
      p_postal_code: data.postalCode,
      p_tax_id: data.taxId,
      p_tenant_name: data.name,
      p_tenant_slug: data.slug,
      p_timezone: data.timezone,
    })
    if (error) {
      if (error.code === '23505') throw new Response('Tenant slug already exists', { status: 409 })
      throw new Error(`tenant_onboarding_failed:${error.code}`)
    }

    const tenant = onboardingResult.parse(result)[0]
    if (!tenant) throw new Error('tenant_onboarding_result_missing')
    return { slug: tenant.tenant_slug, tenantId: tenant.tenant_id }
  })
