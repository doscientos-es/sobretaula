import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

const tenantInput = z.object({ tenantId: z.string().uuid() })
const hexColor = /^#[0-9A-Fa-f]{6}$/

const brandingInput = tenantInput.extend({
  emailFromName: z.string().trim().min(1).max(120),
  logoUrl: z.union([z.literal(''), z.string().url().startsWith('https://')]),
  primaryColor: z.string().regex(hexColor),
  replyToEmail: z.union([z.literal(''), z.string().email().max(320)]),
})

export interface EmailBranding {
  emailFromName: string
  logoUrl: string | null
  primaryColor: string
  replyToEmail: string | null
}

function requireManager(role: string): void {
  if (role !== 'owner' && role !== 'manager') throw new Response('Forbidden', { status: 403 })
}

/** Returns the restaurant identity used by reservation emails. */
export const getEmailBranding = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(tenantInput)
  .handler(async ({ context, data }): Promise<EmailBranding | null> => {
    const { data: branding, error } = await createRequestSupabaseClient(
      context.tenantMembership.accessToken,
    )
      .from('tenant_email_branding')
      .select('email_from_name, logo_url, primary_color, reply_to_email')
      .eq('tenant_id', data.tenantId)
      .maybeSingle()
    if (error) throw new Error(`email_branding_load_failed:${error.code}`)
    if (!branding) return null
    return {
      emailFromName: branding.email_from_name,
      logoUrl: branding.logo_url,
      primaryColor: branding.primary_color,
      replyToEmail: branding.reply_to_email,
    }
  })

/** Owners and managers can change their restaurant's public email identity. */
export const saveEmailBranding = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(brandingInput)
  .handler(async ({ context, data }) => {
    requireManager(context.tenantMembership.role)
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
      .from('tenant_email_branding')
      .upsert(
        {
          email_from_name: data.emailFromName,
          logo_url: data.logoUrl || null,
          primary_color: data.primaryColor.toLowerCase(),
          reply_to_email: data.replyToEmail || null,
          tenant_id: data.tenantId,
        },
        { onConflict: 'tenant_id' },
      )
    if (error) throw new Error(`email_branding_save_failed:${error.code}`)
  })
