import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { tenantMembershipMiddleware } from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

const input = z.object({ tenantId: z.string().uuid() })

export interface TenantBillingStatus {
  graceEndsOn: string | null
  nextPaymentOn: string | null
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | null
}

/** Billing remains visible during a suspension so an owner can regularize it. */
export const getTenantBillingStatus = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(input)
  .handler(async ({ context, data }): Promise<TenantBillingStatus> => {
    const { data: subscription, error } = await createRequestSupabaseClient(
      context.tenantMembership.accessToken,
    )
      .from('subscriptions')
      .select('grace_ends_on, next_payment_on, status')
      .eq('tenant_id', data.tenantId)
      .maybeSingle()
    if (error) throw new Error(`tenant_billing_status_load_failed:${error.code}`)
    return subscription
      ? {
          graceEndsOn: subscription.grace_ends_on,
          nextPaymentOn: subscription.next_payment_on,
          status: subscription.status,
        }
      : { graceEndsOn: null, nextPaymentOn: null, status: null }
  })
