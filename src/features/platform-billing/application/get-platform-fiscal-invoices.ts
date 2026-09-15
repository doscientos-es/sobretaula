import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { tenantMembershipMiddleware } from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { canViewPlatformFiscalInvoices } from '../domain/platform-fiscal-invoice-access'

const tenantInput = z.object({ tenantId: z.string().uuid() })

export type PlatformFiscalInvoiceStatus = 'issued' | 'pending_review' | 'registered'
export type PlatformBillingInvoiceStatus = 'open' | 'paid' | 'failed' | 'void'

export interface PlatformFiscalInvoice {
  customerName: string
  fullNumber: string | null
  id: string
  issuedAt: string | null
  paidAt: string | null
  paymentStatus: PlatformBillingInvoiceStatus
  periodEnd: string
  periodStart: string
  reviewReason: string | null
  status: PlatformFiscalInvoiceStatus
  tenantId: string
  tenantName?: string
  tenantSlug?: string
  totalCents: number
}

function toPlatformFiscalInvoice(row: {
  customer_name: string
  full_number: string | null
  id: string
  issued_at: string | null
  paid_at: string | null
  period_end: string
  period_start: string
  payment_status: PlatformBillingInvoiceStatus
  review_reason: string | null
  status: PlatformFiscalInvoiceStatus
  tenant_id: string
  total_cents: number
}): PlatformFiscalInvoice {
  return {
    customerName: row.customer_name,
    fullNumber: row.full_number,
    id: row.id,
    issuedAt: row.issued_at,
    paidAt: row.paid_at,
    paymentStatus: row.payment_status,
    periodEnd: row.period_end,
    periodStart: row.period_start,
    reviewReason: row.review_reason,
    status: row.status,
    tenantId: row.tenant_id,
    totalCents: row.total_cents,
  }
}

async function addPaymentStatus(
  supabase: ReturnType<typeof createRequestSupabaseClient>,
  rows: Array<{
    customer_name: string
    full_number: string | null
    id: string
    issued_at: string | null
    period_end: string
    period_start: string
    platform_billing_invoice_id: string
    review_reason: string | null
    status: PlatformFiscalInvoiceStatus
    tenant_id: string
    total_cents: number
  }>,
): Promise<PlatformFiscalInvoice[]> {
  const billingInvoiceIds = rows.map((row) => row.platform_billing_invoice_id)
  const { data: billingInvoices, error } = billingInvoiceIds.length
    ? await supabase
        .from('platform_billing_invoices')
        .select('id, paid_at, status')
        .in('id', billingInvoiceIds)
    : { data: [], error: null }
  if (error) throw new Error(`platform_billing_invoices_load_failed:${error.code}`)

  const paymentByInvoiceId = new Map(
    (billingInvoices ?? []).map((invoice) => [invoice.id, invoice]),
  )
  return rows.map((row) => {
    const payment = paymentByInvoiceId.get(row.platform_billing_invoice_id)
    return toPlatformFiscalInvoice({
      ...row,
      paid_at: payment?.paid_at ?? null,
      payment_status: payment?.status ?? 'open',
    })
  })
}

/** Lists only the platform invoices owned by the selected tenant under RLS. */
export const getTenantPlatformFiscalInvoices = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(tenantInput)
  .handler(async ({ context, data }): Promise<PlatformFiscalInvoice[]> => {
    if (!canViewPlatformFiscalInvoices(context.tenantMembership.role)) {
      throw new Response('Forbidden', { status: 403 })
    }

    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: invoices, error } = await supabase
      .from('platform_fiscal_invoices')
      .select(
        'customer_name, full_number, id, issued_at, period_end, period_start, platform_billing_invoice_id, review_reason, status, tenant_id, total_cents',
      )
      .eq('tenant_id', data.tenantId)
      .order('period_end', { ascending: false })
    if (error) throw new Error(`tenant_platform_fiscal_invoices_load_failed:${error.code}`)
    return addPaymentStatus(supabase, invoices ?? [])
  })

/** Lists all SaaS fiscal invoices, reserved exclusively for platform owners. */
export const getPlatformFiscalInvoices = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PlatformFiscalInvoice[]> => {
    const supabase = createRequestSupabaseClient(context.principal.accessToken)
    const { data: membership, error: membershipError } = await supabase
      .from('platform_members')
      .select('role')
      .eq('user_id', context.principal.userId)
      .maybeSingle()
    if (membershipError) throw new Error(`platform_owner_lookup_failed:${membershipError.code}`)
    if (membership?.role !== 'platform_owner') throw new Response('Forbidden', { status: 403 })

    const { data: invoices, error } = await supabase
      .from('platform_fiscal_invoices')
      .select(
        'customer_name, full_number, id, issued_at, period_end, period_start, platform_billing_invoice_id, review_reason, status, tenant_id, total_cents, tenants!inner(name, slug)',
      )
      .order('period_end', { ascending: false })
    if (error) throw new Error(`platform_fiscal_invoices_load_failed:${error.code}`)

    const fiscalInvoices = (invoices ?? []).flatMap((invoice) => {
      const [tenant] = invoice.tenants
      if (!tenant) return []
      return [{ ...invoice, tenantName: tenant.name, tenantSlug: tenant.slug }]
    })
    const enriched = await addPaymentStatus(supabase, fiscalInvoices)
    return enriched.map((invoice, index) => ({
      ...invoice,
      tenantName: fiscalInvoices[index]?.tenantName,
      tenantSlug: fiscalInvoices[index]?.tenantSlug,
    }))
  })
