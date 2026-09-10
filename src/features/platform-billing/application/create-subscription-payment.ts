import { randomBytes, randomUUID } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { tenantMembershipMiddleware } from '@/features/tenancy/application/require-tenant-membership'
import { createServiceSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { createRedsysPaymentForm, readRedsysConfig } from '../infrastructure/server/redsys'

const input = z.object({ tenantId: z.string().uuid() })

function orderReference(): string {
  return `ST${randomBytes(5).toString('hex').toUpperCase()}`
}

/** Creates the first authenticated charge and returns a hosted Redsys form. */
export const createSubscriptionPayment = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(input)
  .handler(async ({ context, data }) => {
    if (context.tenantMembership.role !== 'owner') throw new Response('Forbidden', { status: 403 })
    const supabase = createServiceSupabaseClient()
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('id, plan_id, status')
      .eq('tenant_id', data.tenantId)
      .maybeSingle()
    if (subscriptionError) throw new Error(`subscription_load_failed:${subscriptionError.code}`)
    if (!subscription) throw new Error('subscription_not_found')
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('slug')
      .eq('id', data.tenantId)
      .single()
    if (tenantError || !tenant) throw new Error('tenant_not_found')
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('monthly_price_cents')
      .eq('id', subscription.plan_id)
      .single()
    if (planError || !plan) throw new Error('subscription_plan_not_found')

    const periodStart = new Date()
    const periodEnd = new Date(periodStart)
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    const start = periodStart.toISOString().slice(0, 10)
    const end = periodEnd.toISOString().slice(0, 10)
    const vat = Math.round(plan.monthly_price_cents * 0.21)
    const { data: invoice, error: invoiceError } = await supabase
      .from('platform_billing_invoices')
      .upsert({
        tenant_id: data.tenantId,
        subscription_id: subscription.id,
        period_start: start,
        period_end: end,
        subtotal_cents: plan.monthly_price_cents,
        vat_rate_bps: 2100,
        vat_cents: vat,
        total_cents: plan.monthly_price_cents + vat,
        due_on: start,
      }, { onConflict: 'subscription_id,period_start' })
      .select('id, total_cents')
      .single()
    if (invoiceError || !invoice) throw new Error(`subscription_invoice_create_failed:${invoiceError?.code ?? 'unknown'}`)
    const order = orderReference()
    const { error: attemptError } = await supabase.from('platform_payment_attempts').insert({
      invoice_id: invoice.id,
      provider: 'redsys',
      merchant_order: order,
      idempotency_key: randomUUID(),
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    if (attemptError) throw new Error(`subscription_payment_attempt_create_failed:${attemptError.code}`)
    const appUrl = process.env.APP_URL
    if (!appUrl) throw new Error('app_url_not_configured')
    return createRedsysPaymentForm({
      amountCents: invoice.total_cents,
      merchantOrder: order,
      merchantUrl: new URL('/api/webhooks/redsys', appUrl).toString(),
      successUrl: new URL(`/t/${tenant.slug}`, appUrl).toString(),
      cancelUrl: new URL(`/t/${tenant.slug}`, appUrl).toString(),
      config: readRedsysConfig(),
    })
  })
