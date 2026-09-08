import { createServerFn } from '@tanstack/react-start'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

export interface PlatformSubscriptionOverview {
  graceEndsOn: string | null
  nextPaymentOn: string | null
  planMonthlyNetCents: number
  planName: string
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
  tenantName: string
  tenantSlug: string
  tenantStatus: 'active' | 'suspended' | 'trial'
}

/** Lists subscription status for global platform operators under RLS. */
export const getPlatformBillingOverview = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PlatformSubscriptionOverview[]> => {
    const supabase = createRequestSupabaseClient(context.principal.accessToken)
    const { data: platformMember, error: platformMemberError } = await supabase
      .from('platform_members')
      .select('user_id')
      .eq('user_id', context.principal.userId)
      .maybeSingle()
    if (platformMemberError)
      throw new Error(`platform_membership_lookup_failed:${platformMemberError.code}`)
    if (!platformMember) throw new Response('Forbidden', { status: 403 })

    const { data, error } = await supabase
      .from('subscriptions')
      .select(
        'grace_ends_on, next_payment_on, status, plans!inner(monthly_price_cents, name), tenants!inner(name, slug, status)',
      )
      .order('next_payment_on', { ascending: true, nullsFirst: false })
    if (error) throw new Error(`platform_subscriptions_load_failed:${error.code}`)

    return (data ?? []).flatMap((subscription) => {
      const [plan] = subscription.plans
      const [tenant] = subscription.tenants
      if (!plan || !tenant) return []
      return [
        {
          graceEndsOn: subscription.grace_ends_on,
          nextPaymentOn: subscription.next_payment_on,
          planMonthlyNetCents: plan.monthly_price_cents,
          planName: plan.name,
          status: subscription.status,
          tenantName: tenant.name,
          tenantSlug: tenant.slug,
          tenantStatus: tenant.status,
        },
      ]
    })
  })
