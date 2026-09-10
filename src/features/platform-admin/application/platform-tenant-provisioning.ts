import { createHash, randomBytes } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { tenantOnboardingInput } from '@/features/tenancy/application/onboarding-schema'
import { isAuthEmailRateLimited } from '@/shared/lib/supabase/auth-email-rate-limit'
import { createServiceSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { createPlatformOwnerClient } from './platform-dashboard'

export const platformTenantProvisioningInput = tenantOnboardingInput.extend({
  ownerEmail: z.string().trim().toLowerCase().email().max(254),
  ownerName: z.string().trim().min(2).max(120),
})

const provisioningResult = z
  .array(
    z.object({
      owner_invitation_created: z.boolean(),
      tenant_id: z.string().uuid(),
      tenant_slug: z.string(),
    }),
  )
  .length(1)

function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function invitationRedirect(token: string): string {
  const appUrl = process.env.APP_URL
  if (!appUrl) throw new Error('app_url_not_configured')
  const url = new URL('/activar-cuenta', appUrl)
  url.searchParams.set('token', token)
  return url.toString()
}

/** Creates a setup-pending tenant and assigns or invites its real owner. */
export const provisionPlatformTenant = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(platformTenantProvisioningInput)
  .handler(async ({ context, data }) => {
    const request = await createPlatformOwnerClient(
      context.principal.accessToken,
      context.principal.userId,
    )
    const token = randomBytes(32).toString('base64url')
    const { data: result, error } = await request.rpc('provision_platform_tenant', {
      p_address_line: data.addressLine,
      p_city: data.city,
      p_default_locale: data.defaultLocale,
      p_email: data.email,
      p_legal_name: data.legalName,
      p_owner_email: data.ownerEmail,
      p_owner_token_hash: hashInvitationToken(token),
      p_postal_code: data.postalCode,
      p_tax_id: data.taxId,
      p_tenant_name: data.name,
      p_tenant_slug: data.slug,
      p_timezone: data.timezone,
    })
    if (error) {
      if (error.code === '23505') throw new Response('Tenant slug already exists', { status: 409 })
      if (error.code === '42501') throw new Response('Forbidden', { status: 403 })
      throw new Error(`platform_tenant_provisioning_failed:${error.code}`)
    }

    const tenant = provisioningResult.parse(result)[0]
    if (!tenant) throw new Error('platform_tenant_provisioning_result_missing')
    if (tenant.owner_invitation_created) {
      const { error: inviteError } =
        await createServiceSupabaseClient().auth.admin.inviteUserByEmail(data.ownerEmail, {
          data: { display_name: data.ownerName },
          redirectTo: invitationRedirect(token),
        })
      if (isAuthEmailRateLimited(inviteError)) {
        throw new Response('Tenant owner invitation email rate limited', { status: 429 })
      }
      if (inviteError) throw new Error('platform_tenant_owner_invitation_delivery_failed')
    }

    return {
      ownerInvitationCreated: tenant.owner_invitation_created,
      tenantId: tenant.tenant_id,
      tenantSlug: tenant.tenant_slug,
    }
  })

export type PlatformTenantProvisioningInput = z.infer<typeof platformTenantProvisioningInput>
