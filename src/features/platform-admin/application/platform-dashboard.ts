import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { extraVenueNetCents } from '@/features/platform-billing'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import type { ManagedTenantStatus, PlatformAdminRole } from '../domain/platform-admin'

const tenantStatusInput = z.enum(['setup_pending', 'trial', 'active', 'suspended'])
const subscriptionStatusInput = z.enum(['active', 'canceled', 'past_due', 'trialing'])

export interface PlatformDashboard {
  currentUserId: string
  fiscalReviewCount: number
  monthlyRecurringRevenueCents: number
  outstandingBalanceCents: number
  overdueSubscriptionCount: number
  pendingInvitationCount: number
  subscriptions: PlatformDashboardSubscription[]
  tenants: PlatformDashboardTenant[]
  totalTenantCount: number
}

export interface PlatformDashboardSubscription {
  graceEndsOn: string | null
  monthlyNetCents: number
  nextPaymentOn: string | null
  planName: string
  status: z.infer<typeof subscriptionStatusInput>
  tenantId: string
}

export interface PlatformDashboardTenant {
  createdAt: string
  id: string
  name: string
  status: z.infer<typeof tenantStatusInput>
  subscription: PlatformDashboardSubscription | null
  slug: string
}

async function createPlatformOwnerClient(accessToken: string, userId: string) {
  const supabase = createRequestSupabaseClient(accessToken)
  const { data, error } = await supabase
    .from('platform_members')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(`platform_owner_lookup_failed:${error.code}`)
  if (data?.role !== 'platform_owner') throw new Response('Forbidden', { status: 403 })
  return supabase
}

/** Returns aggregate health and every tenant available to a platform owner under RLS. */
export const getPlatformDashboard = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PlatformDashboard> => {
    const supabase = await createPlatformOwnerClient(
      context.principal.accessToken,
      context.principal.userId,
    )
    const [
      tenantsResult,
      subscriptionsResult,
      venuesResult,
      invoicesResult,
      fiscalResult,
      invitationsResult,
    ] = await Promise.all([
      supabase
        .from('tenants')
        .select('created_at, id, name, slug, status')
        .order('created_at', { ascending: false }),
      supabase
        .from('subscriptions')
        .select(
          'grace_ends_on, next_payment_on, status, tenant_id, plans!inner(extra_venue_monthly_price_cents, monthly_price_cents, name)',
        ),
      supabase.from('venues').select('tenant_id').eq('is_active', true),
      supabase
        .from('platform_billing_invoices')
        .select('status, tenant_id, total_cents')
        .in('status', ['open', 'failed']),
      supabase.from('platform_fiscal_invoices').select('id').eq('status', 'pending_review'),
      supabase
        .from('platform_invitations')
        .select('id')
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString()),
    ])
    const results = [
      tenantsResult,
      subscriptionsResult,
      venuesResult,
      invoicesResult,
      fiscalResult,
      invitationsResult,
    ]
    if (results.some((result) => result.error)) throw new Error('platform_dashboard_load_failed')

    const venuesByTenant = new Map<string, number>()
    for (const venue of venuesResult.data ?? []) {
      venuesByTenant.set(venue.tenant_id, (venuesByTenant.get(venue.tenant_id) ?? 0) + 1)
    }
    const subscriptions = (subscriptionsResult.data ?? []).flatMap((subscription) => {
      const plan = Array.isArray(subscription.plans) ? subscription.plans[0] : subscription.plans
      if (!plan) return []
      const venueCount = Math.max(1, venuesByTenant.get(subscription.tenant_id) ?? 0)
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
          planName: plan.name,
          status: subscriptionStatusInput.parse(subscription.status),
          tenantId: subscription.tenant_id,
        },
      ]
    })
    const subscriptionsByTenant = new Map(
      subscriptions.map((subscription) => [subscription.tenantId, subscription]),
    )
    const outstandingBalanceCents = (invoicesResult.data ?? []).reduce(
      (total, invoice) => total + invoice.total_cents,
      0,
    )

    return {
      currentUserId: context.principal.userId,
      fiscalReviewCount: fiscalResult.data?.length ?? 0,
      monthlyRecurringRevenueCents: subscriptions
        .filter((subscription) => subscription.status !== 'canceled')
        .reduce((total, subscription) => total + subscription.monthlyNetCents, 0),
      outstandingBalanceCents,
      overdueSubscriptionCount: subscriptions.filter(
        (subscription) => subscription.status === 'past_due',
      ).length,
      pendingInvitationCount: invitationsResult.data?.length ?? 0,
      subscriptions,
      tenants: (tenantsResult.data ?? []).map((tenant) => ({
        createdAt: tenant.created_at,
        id: tenant.id,
        name: tenant.name,
        status: tenantStatusInput.parse(tenant.status),
        subscription: subscriptionsByTenant.get(tenant.id) ?? null,
        slug: tenant.slug,
      })),
      totalTenantCount: tenantsResult.data?.length ?? 0,
    }
  })

/** Verifies that the current session may enter the owner-only platform console. */
export const getPlatformAdminAccess = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await createPlatformOwnerClient(context.principal.accessToken, context.principal.userId)
  })

export { createPlatformOwnerClient }
export type { ManagedTenantStatus, PlatformAdminRole }
