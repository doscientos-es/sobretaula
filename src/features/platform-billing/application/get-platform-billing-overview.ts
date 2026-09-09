import { createServerFn } from '@tanstack/react-start'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { extraVenueNetCents } from '../domain/subscription-pricing'

export interface PlatformSubscriptionOverview {
  graceEndsOn: string | null
  monthlyNetCents: number
  nextPaymentOn: string | null
  planMonthlyNetCents: number
  planName: string
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
  tenantName: string
  tenantSlug: string
  tenantStatus: 'active' | 'suspended' | 'trial'
  venueCount: number
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
        'grace_ends_on, next_payment_on, status, plans!inner(extra_venue_monthly_price_cents, monthly_price_cents, name), tenants!inner(id, name, slug, status)',
      )
      .order('next_payment_on', { ascending: true, nullsFirst: false })
    if (error) throw new Error(`platform_subscriptions_load_failed:${error.code}`)

    const { data: venues, error: venuesError } = await supabase
      .from('venues')
      .select('tenant_id')
      .eq('is_active', true)
    if (venuesError) throw new Error(`platform_venues_load_failed:${venuesError.code}`)

    const venuesByTenant = new Map<string, number>()
    for (const venue of venues ?? [])
      venuesByTenant.set(venue.tenant_id, (venuesByTenant.get(venue.tenant_id) ?? 0) + 1)

    return (data ?? []).flatMap((subscription) => {
      const [plan] = subscription.plans
      const [tenant] = subscription.tenants
      if (!plan || !tenant) return []
      // El plan cubre un local aunque el tenant todavía no lo haya dado de alta.
      const venueCount = Math.max(1, venuesByTenant.get(tenant.id) ?? 0)
      return [
        {
          graceEndsOn: subscription.grace_ends_on,
          monthlyNetCents:
            plan.monthly_price_cents +
            extraVenueNetCents({
              extraVenueMonthlyNetCents: plan.extra_venue_monthly_price_cents,
              venueCount,
            }),
          nextPaymentOn: subscription.next_payment_on,
          planMonthlyNetCents: plan.monthly_price_cents,
          planName: plan.name,
          status: subscription.status,
          tenantName: tenant.name,
          tenantSlug: tenant.slug,
          tenantStatus: tenant.status,
          venueCount,
        },
      ]
    })
  })
