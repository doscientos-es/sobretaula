import { createServerFn } from '@tanstack/react-start'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { aggregateSales, summarizeProducts } from '../domain/sales-report'
import { salesReportInput } from './reports-schema'
export const getSalesReport = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(salesReportInput)
  .handler(async ({ context, data }) => {
    if (!['owner', 'manager'].includes(context.tenantMembership.role))
      throw new Response('Forbidden', { status: 403 })
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: sessions, error: sessionError } = await supabase
      .from('table_sessions')
      .select('id, discount_cents')
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
    if (sessionError) throw new Error(`sales_sessions_failed:${sessionError.code}`)
    const sessionIds = (sessions ?? []).map((session) => session.id as string)
    const discountsCents = (sessions ?? []).reduce(
      (sum, session) => sum + Number(session.discount_cents ?? 0),
      0,
    )
    if (!sessionIds.length)
      return {
        grossCents: 0,
        byMethod: {},
        vatCents: 0,
        ticketAverageCents: 0,
        netCollectedCents: 0,
        refundedCents: 0,
        discountsCents: 0,
        products: [],
        productSummary: [],
      }
    const [payments, orders] = await Promise.all([
      supabase
        .from('payments')
        .select('id, method, amount_cents')
        .eq('tenant_id', data.tenantId)
        .in('session_id', sessionIds)
        .gte('paid_at', data.from)
        .lt('paid_at', data.to),
      supabase
        .from('orders')
        .select('id')
        .eq('tenant_id', data.tenantId)
        .in('session_id', sessionIds),
    ])
    if (payments.error || orders.error) throw new Error('sales_report_load_failed')
    const orderIds = (orders.data ?? []).map((order) => order.id as string)
    const items = orderIds.length
      ? await supabase
          .from('order_items')
          .select('name_snapshot, quantity, unit_price_cents, vat_rate_bps')
          .eq('tenant_id', data.tenantId)
          .in('order_id', orderIds)
          .neq('status', 'cancelled')
      : { data: [], error: null }
    if (items.error) throw new Error(`sales_products_failed:${items.error.code}`)
    const paymentIds = (payments.data ?? []).map((payment) => payment.id as string)
    const refunds = paymentIds.length
      ? await supabase
          .from('payment_refunds')
          .select('amount_cents')
          .eq('tenant_id', data.tenantId)
          .in('payment_id', paymentIds)
      : { data: [], error: null }
    if (refunds.error && refunds.error.code !== '42P01')
      throw new Error(`sales_refunds_failed:${refunds.error.code}`)
    const refundedCents = (refunds.data ?? []).reduce(
      (sum, refund) => sum + (refund.amount_cents as number),
      0,
    )
    const aggregate = aggregateSales(
      (payments.data ?? []).map((row) => ({
        method: row.method as string,
        amountCents: row.amount_cents as number,
      })),
      (items.data ?? []).map((row) => ({
        name: row.name_snapshot as string,
        quantity: row.quantity as number,
        amountCents: (row.quantity as number) * (row.unit_price_cents as number),
        vatRateBps: row.vat_rate_bps as number,
      })),
      sessionIds.length,
    )
    const soldProducts = (items.data ?? []).map((row) => ({
      name: row.name_snapshot as string,
      quantity: row.quantity as number,
      amountCents: (row.quantity as number) * (row.unit_price_cents as number),
      vatRateBps: row.vat_rate_bps as number,
    }))
    return {
      ...aggregate,
      netCollectedCents: Math.max(0, aggregate.grossCents - refundedCents - discountsCents),
      refundedCents,
      discountsCents,
      products: items.data ?? [],
      productSummary: summarizeProducts(soldProducts),
    }
  })

export const exportSalesReportCsv = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(salesReportInput)
  .handler(async ({ context, data }) => {
    if (!['owner', 'manager'].includes(context.tenantMembership.role))
      throw new Response('Forbidden', { status: 403 })
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: sessions, error } = await supabase
      .from('table_sessions')
      .select('id')
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
    if (error) throw new Error(`sales_export_sessions_failed:${error.code}`)
    const ids = (sessions ?? []).map((session) => session.id as string)
    const { data: orders } = ids.length
      ? await supabase
          .from('orders')
          .select('id')
          .eq('tenant_id', data.tenantId)
          .in('session_id', ids)
      : { data: [] }
    const orderIds = (orders ?? []).map((order) => order.id as string)
    const { data: items, error: itemsError } = orderIds.length
      ? await supabase
          .from('order_items')
          .select('name_snapshot, quantity, unit_price_cents, vat_rate_bps')
          .eq('tenant_id', data.tenantId)
          .in('order_id', orderIds)
          .neq('status', 'cancelled')
      : { data: [], error: null }
    if (itemsError) throw new Error(`sales_export_items_failed:${itemsError.code}`)
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
    return [
      'producto,cantidad,total_cents,iva_bps',
      ...(items ?? []).map((item) =>
        [
          item.name_snapshot,
          item.quantity,
          (item.quantity as number) * (item.unit_price_cents as number),
          item.vat_rate_bps,
        ]
          .map(escape)
          .join(','),
      ),
    ].join('\n')
  })
